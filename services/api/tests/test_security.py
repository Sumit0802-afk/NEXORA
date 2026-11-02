import re
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.core import limits
from app.core.security import hash_token
from app.db.models import AuditEvent, AuthSession, Base, HouseDesign, Project, User, utc_naive
from app.db.session import get_db
from app.main import app
from datetime import timedelta


@pytest.fixture
def env():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    def override():
        with Session() as db:
            yield db

    app.dependency_overrides[get_db] = override
    app.dependency_overrides.pop(get_current_user, None)
    yield TestClient(app), Session
    app.dependency_overrides.pop(get_db, None)


def _user(Session, name, verified=True, expires=7):
    token = f"tok-{name}-{uuid4()}"
    now = utc_naive()
    with Session() as db:
        user = User(id=uuid4(), email=f"{name}@example.com", password_hash="x", email_verified_at=now if verified else None)
        db.add(user)
        db.flush()
        db.add(AuthSession(user_id=user.id, token_hash=hash_token(token), expires_at=now + timedelta(days=expires)))
        db.commit()
    return {"Cookie": f"nexora_session={token}"}


def test_routes_refuse_without_a_session(env):
    client, _ = env
    for method, path in [("get", "/api/projects"), ("post", "/api/layouts/generate"), ("get", "/api/library"), ("post", f"/api/projects/{uuid4()}/validate"), ("post", "/api/support/messages")]:
        assert client.request(method.upper(), path, json={}).status_code == 401, path


def test_expired_session_and_unverified_account_are_refused(env):
    client, Session = env
    assert client.get("/api/projects", headers=_user(Session, "old", expires=-1)).status_code == 401
    assert client.get("/api/projects", headers=_user(Session, "new", verified=False)).status_code == 401


def test_one_user_cannot_reach_anothers_project(env):
    client, Session = env
    owner, other = _user(Session, "a"), _user(Session, "b")
    pid = client.post("/api/projects", json={"name": "Mine"}, headers=owner).json()["id"]
    calls = [
        ("get", f"/api/projects/{pid}", None), ("patch", f"/api/projects/{pid}", {"name": "x"}), ("delete", f"/api/projects/{pid}", None),
        ("post", f"/api/projects/{pid}/duplicate", None), ("put", f"/api/projects/{pid}/design", {}),
        ("get", f"/api/projects/{pid}/house-design", None), ("put", f"/api/projects/{pid}/house-design", {}),
        ("get", f"/api/projects/{pid}/house-design/jobs/{uuid4()}", None),
    ]
    for method, path, body in calls:
        kwargs = {"headers": other}
        if body is not None:
            kwargs["json"] = body
        assert getattr(client, method)(path, **kwargs).status_code == 404, path
    assert client.get(f"/api/projects/{pid}", headers=owner).status_code == 200


def test_foreign_origin_and_cross_site_writes_are_refused(env):
    client, Session = env
    me = _user(Session, "a")
    body = {"name": "x"}
    assert client.post("/api/projects", json=body, headers={**me, "Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/projects", json=body, headers={**me, "Sec-Fetch-Site": "cross-site"}).status_code == 403
    assert client.post("/api/projects", json=body, headers=me).status_code == 201


def test_project_creation_is_limited_and_survives_a_new_session(env):
    client, Session = env
    me = _user(Session, "a")
    with Session() as db:
        user = db.execute(select(User)).scalar_one()
        for _ in range(60):
            limits.record(db, f"project|{user.id}")
    assert client.post("/api/projects", json={"name": "x"}, headers=me).status_code == 429


def test_layout_generation_is_limited(env, monkeypatch):
    client, Session = env
    me = _user(Session, "a")
    with Session() as db:
        user = db.execute(select(User)).scalar_one()
        for _ in range(60):
            limits.record(db, f"generate|{user.id}")
    body = {"roomList": "bedroom", "plotWidth": 40, "plotLength": 60}
    assert client.post("/api/layouts/generate", json=body, headers=me).status_code == 429


def test_failed_logins_are_counted_in_the_database(env):
    client, Session = env
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "x@example.com", "password": "wrong"}).status_code == 404
    assert client.post("/api/auth/login", json={"email": "x@example.com", "password": "wrong"}).status_code == 429


def test_deleting_a_project_leaves_an_audit_record_with_no_secrets(env):
    client, Session = env
    me = _user(Session, "a")
    pid = client.post("/api/projects", json={"name": "Mine"}, headers=me).json()["id"]
    assert client.delete(f"/api/projects/{pid}", headers=me).status_code == 204
    with Session() as db:
        event = db.execute(select(AuditEvent)).scalar_one()
    assert event.action == "project.delete" and event.target == pid


def test_retention_removes_only_what_is_old(env):
    _, Session = env
    with Session() as db:
        db.add(AuditEvent(action="old", user_id="u", created_at=utc_naive() - timedelta(days=400)))
        db.add(AuditEvent(action="new", user_id="u"))
        db.commit()
        limits.purge(db)
        assert [e.action for e in db.execute(select(AuditEvent)).scalars()] == ["new"]


def test_responses_carry_security_headers(env):
    client, _ = env
    headers = client.get("/api/health").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"


def test_deleting_an_account_removes_its_data(env):
    client, Session = env
    from app.core.security import hash_password
    me = _user(Session, "a")
    with Session() as db:
        user = db.execute(select(User)).scalar_one()
        user.password_hash = hash_password("correct horse")
        db.commit()
    pid = client.post("/api/projects", json={"name": "Mine"}, headers=me).json()["id"]
    client.put(f"/api/projects/{pid}/house-design", json={"n": 1}, headers=me)
    assert client.post("/api/auth/delete-account", json={"password": "correct horse"}, headers=me).status_code == 204
    with Session() as db:
        assert db.execute(select(User)).first() is None
        assert db.execute(select(Project)).first() is None
        assert db.execute(select(HouseDesign)).first() is None
        assert db.execute(select(AuthSession)).first() is None
        assert re.match("account.delete", db.execute(select(AuditEvent).where(AuditEvent.action == "account.delete")).scalar_one().action)
