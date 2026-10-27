from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import auth as auth_routes
from app.core import mailer
from app.db.models import Base, EmailOtp, Project, User
from app.db.seed import DEMO_USER_ID, ensure_demo_user
from app.db.session import get_db
from app.main import app


_state: dict = {}


def _login(c, email="a@example.com", password="correct horse"):
    """Password step, then the code that is emailed on every sign-in. Returns the final response."""
    r = c.post("/api/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        return r
    assert r.json() == {"otpRequired": True, "email": email.lower()}
    assert c.cookies.get("nexora_session") is None  # no session until the code is entered
    code = _state["sent"][-1][1]
    return c.post("/api/auth/login/verify", json={"email": email, "code": code})


@pytest.fixture()
def client(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    sent: list[tuple[str, str, str]] = []
    monkeypatch.setattr(mailer, "send_otp", lambda to, code, minutes, purpose="verify": sent.append((to, code, purpose)))
    # Resend cooldown is exercised in its own test; elsewhere tests resend immediately.
    monkeypatch.setattr(auth_routes, "OTP_RESEND_SECONDS", 0)

    app.dependency_overrides[get_db] = _db
    auth_routes._fails.clear()
    _state["sent"] = sent
    c = TestClient(app)
    c.session_factory = Session  # type: ignore[attr-defined]
    c.sent = sent  # type: ignore[attr-defined]
    yield c
    app.dependency_overrides.clear()


def _register(c, email="a@example.com", password="correct horse"):
    return c.post("/api/auth/register", json={"email": email, "password": password, "displayName": "Ann"})


def _verify(c, email="a@example.com", code=None):
    code = code or c.sent[-1][1]
    return c.post("/api/auth/verify", json={"email": email, "code": code})


def _signup(c, email="a@example.com", password="correct horse"):
    """Register, verify the emailed code, then sign in (verifying does not sign anyone in)."""
    assert _register(c, email, password).status_code == 201
    assert _verify(c, email).status_code == 200
    r = _login(c, email, password)
    assert r.status_code == 200
    return r


def test_requires_login(client):
    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/layouts/generate", json={}).status_code == 401


def test_register_sends_code_and_does_not_sign_in(client):
    r = _register(client)
    assert r.status_code == 201
    assert r.json() == {"verificationRequired": True, "email": "a@example.com"}
    assert "set-cookie" not in r.headers
    assert len(client.sent) == 1 and client.sent[0][0] == "a@example.com"
    assert len(client.sent[0][1]) == 6 and client.sent[0][1].isdigit()
    assert client.get("/api/auth/me").status_code == 401


def test_verify_confirms_the_email_but_does_not_sign_in(client):
    _register(client)
    r = _verify(client)
    assert r.status_code == 200 and r.json() == {"verified": True, "email": "a@example.com"}
    assert "set-cookie" not in r.headers
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/projects").status_code == 401
    r = _login(client)
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/auth/me").json()["displayName"] == "Ann"
    assert client.get("/api/projects").status_code == 200


def test_wrong_code_rejected_and_locks_after_five_attempts(client):
    _register(client)
    real = client.sent[-1][1]
    wrong = "000000" if real != "000000" else "111111"
    for _ in range(5):
        r = _verify(client, code=wrong)
        assert r.status_code == 400
    r = _verify(client, code=real)  # too many attempts: even the right code no longer works
    assert r.status_code == 400
    assert client.get("/api/auth/me").status_code == 401


def test_code_is_single_use_and_stored_hashed(client):
    _register(client)
    code = client.sent[-1][1]
    with client.session_factory() as db:
        otp = db.query(EmailOtp).one()
        assert code not in (otp.code_hash, otp.salt)
    assert _verify(client, code=code).status_code == 200
    client.post("/api/auth/logout")
    assert _verify(client, code=code).status_code == 400


def test_expired_code_rejected(client):
    _register(client)
    with client.session_factory() as db:
        otp = db.query(EmailOtp).one()
        otp.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    r = _verify(client)
    assert r.status_code == 400 and "expired" in r.json()["detail"]


def test_malformed_code_rejected(client):
    _register(client)
    for bad in ("12345", "1234567", "abcdef", "12 456"):
        assert client.post("/api/auth/verify", json={"email": "a@example.com", "code": bad}).status_code == 422


def test_unverified_account_cannot_login_and_gets_a_new_code(client):
    _register(client)
    r = client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"})
    assert r.status_code == 403 and r.json()["detail"] == "email_not_verified"
    assert len(client.sent) == 2
    assert client.get("/api/auth/me").status_code == 401
    assert _verify(client).status_code == 200


def test_resend_issues_a_new_code_and_invalidates_the_old_one(client):
    _register(client)
    first = client.sent[-1][1]
    assert client.post("/api/auth/resend", json={"email": "a@example.com"}).json() == {"status": "sent"}
    second = client.sent[-1][1]
    assert len(client.sent) == 2
    if first != second:
        assert _verify(client, code=first).status_code == 400
    assert _verify(client, code=second).status_code == 200


def test_resend_does_not_reveal_unknown_emails(client):
    r = client.post("/api/auth/resend", json={"email": "nobody@example.com"})
    assert r.status_code == 200 and r.json() == {"status": "sent"} and client.sent == []


def test_resend_cooldown(client, monkeypatch):
    monkeypatch.setattr(auth_routes, "OTP_RESEND_SECONDS", 60)
    _register(client)
    r = client.post("/api/auth/resend", json={"email": "a@example.com"})
    assert r.status_code == 429


def test_register_again_before_verifying_restarts_signup(client):
    _register(client, password="first password")
    assert _register(client, password="second password").status_code == 201
    assert _verify(client).status_code == 200
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "first password"}).status_code == 401
    assert _login(client, "a@example.com", "second password").status_code == 200


def test_mail_failure_is_reported_not_swallowed(client, monkeypatch):
    def boom(*a, **k):
        raise mailer.MailerUnavailable("Email delivery is not configured.")

    monkeypatch.setattr(mailer, "send_otp", boom)
    r = _register(client)
    assert r.status_code == 503 and "not configured" in r.json()["detail"]
    with client.session_factory() as db:
        assert db.query(EmailOtp).count() == 0  # nothing delivered, nothing left to block a retry


def test_retry_right_after_a_failed_send_is_not_blocked(client, monkeypatch):
    monkeypatch.setattr(auth_routes, "OTP_RESEND_SECONDS", 60)
    real = mailer.send_otp

    def fail(*a, **k):
        raise mailer.MailerUnavailable("down")

    monkeypatch.setattr(mailer, "send_otp", fail)
    assert _register(client).status_code == 503
    monkeypatch.setattr(mailer, "send_otp", real)
    assert _register(client).status_code == 201


def test_password_is_hashed_and_validated(client):
    assert _register(client, password="short").status_code == 422
    assert client.post("/api/auth/register", json={"email": "nope", "password": "longenough1"}).status_code == 422
    _register(client)
    with client.session_factory() as db:
        user = db.query(User).filter_by(email="a@example.com").one()
        assert user.password_hash.startswith("scrypt$") and "correct horse" not in user.password_hash


def test_duplicate_verified_email_rejected(client):
    _signup(client)
    assert _register(client, email="A@Example.com").status_code == 409


def test_login_logout_flow(client):
    _signup(client)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    bad = client.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong password"})
    assert bad.status_code == 401 and bad.json()["detail"] == "Incorrect email or password"
    unknown = client.post("/api/auth/login", json={"email": "who@example.com", "password": "whatever1"})
    assert unknown.status_code == 404 and "Create an account first" in unknown.json()["detail"]
    assert client.get("/api/auth/me").status_code == 401
    ok = _login(client, "A@example.com")
    assert ok.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_logout_invalidates_server_side(client):
    _signup(client)
    token = client.cookies.get("nexora_session")
    client.post("/api/auth/logout")
    client.cookies.set("nexora_session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_failed_logins_are_throttled(client):
    _signup(client)
    client.post("/api/auth/logout")
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "bad bad bad"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"}).status_code == 429


def test_users_cannot_see_each_others_projects(client):
    _signup(client)
    pid = client.post("/api/projects", json={"name": "Mine"}).json()["id"]
    client.post("/api/auth/logout")
    _signup(client, email="b@example.com")
    assert client.get("/api/projects").json() == []
    assert client.get(f"/api/projects/{pid}").status_code == 404
    assert client.delete(f"/api/projects/{pid}").status_code == 404


def test_first_verified_account_adopts_legacy_projects_only(client):
    with client.session_factory() as db:
        ensure_demo_user(db)
        db.add(Project(owner_id=DEMO_USER_ID, name="Legacy"))
        db.commit()
    _register(client)
    # Registering alone must not hand over the legacy projects.
    with client.session_factory() as db:
        assert db.query(Project).one().owner_id == DEMO_USER_ID
    _verify(client)
    _login(client)
    assert [p["name"] for p in client.get("/api/projects").json()] == ["Legacy"]
    client.post("/api/auth/logout")
    _signup(client, email="b@example.com")
    assert client.get("/api/projects").json() == []


def test_demo_user_cannot_login(client):
    with client.session_factory() as db:
        ensure_demo_user(db)
    r = client.post("/api/auth/login", json={"email": "demo@nexora.local", "password": "anything123"})
    assert r.status_code == 404


def test_foreign_origin_is_rejected_for_writes(client):
    r = client.post("/api/auth/login", json={"email": "a@example.com", "password": "x"}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    r = client.post("/api/auth/verify", json={"email": "a@example.com", "code": "123456"}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_login_then_register_within_cooldown_reuses_the_code(client, monkeypatch):
    monkeypatch.setattr(auth_routes, "OTP_RESEND_SECONDS", 60)
    assert _register(client).status_code == 201
    r = client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"})
    assert r.status_code == 403 and r.json()["detail"] == "email_not_verified"
    assert _register(client).status_code == 201  # no 429: the code from a moment ago is still valid
    assert len(client.sent) == 1
    assert _verify(client).status_code == 200


def test_legacy_otp_with_future_timestamp_does_not_block_sending(client, monkeypatch):
    monkeypatch.setattr(auth_routes, "OTP_RESEND_SECONDS", 60)
    assert _register(client).status_code == 201
    with client.session_factory() as db:
        otp = db.query(EmailOtp).one()
        otp.created_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=5, minutes=30)
        db.commit()
    assert _register(client).status_code == 201
    assert len(client.sent) == 2  # a fresh code really was sent


def test_new_codes_are_stored_as_utc(client):
    _register(client)
    with client.session_factory() as db:
        otp = db.query(EmailOtp).one()
        drift = abs((otp.created_at - datetime.now(timezone.utc).replace(tzinfo=None)).total_seconds())
        assert drift < 5
        assert 9 * 60 < (otp.expires_at - otp.created_at).total_seconds() <= 10 * 60 + 1


# ── forgot password ──────────────────────────────────────────────────────────

def _forgot(c, email="a@example.com"):
    return c.post("/api/auth/forgot", json={"email": email})


def _reset(c, code, password="brand new pass", email="a@example.com"):
    return c.post("/api/auth/reset-password", json={"email": email, "code": code, "password": password})


def test_forgot_password_flow_changes_the_password(client):
    _signup(client)
    client.post("/api/auth/logout")
    assert _forgot(client).json() == {"status": "sent"}
    to, code, purpose = client.sent[-1]
    assert to == "a@example.com" and purpose == "reset"
    assert _reset(client, code).status_code == 200
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"}).status_code == 401
    assert _login(client, "a@example.com", "brand new pass").status_code == 200


def test_forgot_does_not_reveal_unknown_emails(client):
    r = _forgot(client, "nobody@example.com")
    assert r.status_code == 200 and r.json() == {"status": "sent"} and client.sent == []


def test_reset_code_is_single_use_and_wrong_code_is_rejected(client):
    _signup(client)
    client.post("/api/auth/logout")
    _forgot(client)
    code = client.sent[-1][1]
    wrong = "000000" if code != "000000" else "111111"
    assert _reset(client, wrong).status_code == 400
    assert _reset(client, code).status_code == 200
    assert _reset(client, code, password="another pass 1").status_code == 400


def test_reset_locks_after_five_wrong_codes(client):
    _signup(client)
    client.post("/api/auth/logout")
    _forgot(client)
    code = client.sent[-1][1]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert _reset(client, wrong).status_code == 400
    assert _reset(client, code).status_code == 400


def test_signup_and_reset_codes_are_not_interchangeable(client):
    _register(client)  # sign-up code outstanding
    signup_code = client.sent[-1][1]
    assert _reset(client, signup_code).status_code == 400
    assert _verify(client, code=signup_code).status_code == 200


def test_reset_signs_out_existing_sessions(client):
    _signup(client)
    token = client.cookies.get("nexora_session")
    _forgot(client)
    assert _reset(client, client.sent[-1][1]).status_code == 200
    client.cookies.set("nexora_session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_reset_validates_new_password(client):
    _signup(client)
    _forgot(client)
    assert _reset(client, client.sent[-1][1], password="short").status_code == 422


def test_reset_also_confirms_an_unverified_email(client):
    _register(client)
    _forgot(client)
    assert _reset(client, client.sent[-1][1]).status_code == 200
    assert _login(client, "a@example.com", "brand new pass").status_code == 200


# ── account management ───────────────────────────────────────────────────────

def test_me_includes_created_at_and_can_update_the_name(client):
    _signup(client)
    me = client.get("/api/auth/me").json()
    assert me["createdAt"]
    r = client.patch("/api/auth/me", json={"displayName": "  New Name  "})
    assert r.status_code == 200 and r.json()["displayName"] == "New Name"
    assert client.patch("/api/auth/me", json={"displayName": "x" * 81}).status_code == 422
    assert client.patch("/api/auth/me", json={"displayName": ""}).json()["displayName"] is None


def test_profile_update_requires_login(client):
    assert client.patch("/api/auth/me", json={"displayName": "Hacker"}).status_code == 401


def test_change_password_needs_the_current_password(client):
    _signup(client)
    r = client.post("/api/auth/change-password", json={"currentPassword": "wrong one", "newPassword": "a brand new pw"})
    assert r.status_code == 400
    assert client.post("/api/auth/change-password", json={"currentPassword": "correct horse", "newPassword": "short"}).status_code == 422
    same = client.post("/api/auth/change-password", json={"currentPassword": "correct horse", "newPassword": "correct horse"})
    assert same.status_code == 400
    ok = client.post("/api/auth/change-password", json={"currentPassword": "correct horse", "newPassword": "a brand new pw"})
    assert ok.status_code == 200
    assert client.get("/api/auth/me").status_code == 200  # this device stays signed in
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"}).status_code == 401
    assert _login(client, "a@example.com", "a brand new pw").status_code == 200


def test_change_password_signs_out_other_devices(client):
    _signup(client)
    this_device = client.cookies.get("nexora_session")
    other = TestClient(app)
    assert _login(other, "a@example.com", "correct horse").status_code == 200
    assert other.get("/api/auth/me").status_code == 200
    client.cookies.set("nexora_session", this_device)
    assert client.post("/api/auth/change-password", json={"currentPassword": "correct horse", "newPassword": "a brand new pw"}).status_code == 200
    assert other.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me").status_code == 200


def test_logout_all_ends_every_session(client):
    _signup(client)
    other = TestClient(app)
    _login(other)
    assert client.post("/api/auth/logout-all").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert other.get("/api/auth/me").status_code == 401


def test_delete_account_removes_user_and_projects(client):
    _signup(client)
    client.post("/api/projects", json={"name": "Mine"})
    assert client.post("/api/auth/delete-account", json={"password": "wrong one"}).status_code == 400
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/delete-account", json={"password": "correct horse"}).status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    with client.session_factory() as db:
        assert db.query(User).filter_by(email="a@example.com").count() == 0
        assert db.query(Project).count() == 0
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"}).status_code == 404


def test_deleting_one_account_leaves_other_users_untouched(client):
    _signup(client, email="b@example.com")
    client.post("/api/projects", json={"name": "B project"})
    client.post("/api/auth/logout")
    _signup(client)
    client.post("/api/projects", json={"name": "A project"})
    assert client.post("/api/auth/delete-account", json={"password": "correct horse"}).status_code == 204
    _login(client, "b@example.com")
    assert [p["name"] for p in client.get("/api/projects").json()] == ["B project"]


def test_every_sign_in_needs_an_emailed_code(client):
    _signup(client)
    client.post("/api/auth/logout")
    before = len(client.sent)
    r = client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"})
    assert r.status_code == 200 and r.json()["otpRequired"] is True
    assert len(client.sent) == before + 1 and client.sent[-1][2] == "login"
    assert client.get("/api/auth/me").status_code == 401  # password alone is not enough
    wrong = client.post("/api/auth/login/verify", json={"email": "a@example.com", "code": "000000"})
    assert wrong.status_code == 400
    assert client.get("/api/auth/me").status_code == 401
    good = client.post("/api/auth/login/verify", json={"email": "a@example.com", "code": client.sent[-1][1]})
    assert good.status_code == 200 and client.get("/api/auth/me").status_code == 200
    # a used code cannot be replayed, and a new sign-in sends a new code
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login/verify", json={"email": "a@example.com", "code": client.sent[-1][1]}).status_code == 400
    client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"})
    assert len(client.sent) == before + 2


def test_sign_in_code_is_locked_after_too_many_wrong_tries(client):
    _signup(client)
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"})
    code = client.sent[-1][1]
    for _ in range(5):
        assert client.post("/api/auth/login/verify", json={"email": "a@example.com", "code": "000000"}).status_code == 400
    assert client.post("/api/auth/login/verify", json={"email": "a@example.com", "code": code}).status_code == 429


def test_login_code_resend_needs_a_prior_password_step(client):
    _signup(client)
    client.post("/api/auth/logout")
    n = len(client.sent)
    client.post("/api/auth/login/resend", json={"email": "a@example.com"})
    assert len(client.sent) == n  # no password step yet, nothing is sent
    client.post("/api/auth/login", json={"email": "a@example.com", "password": "correct horse"})
    client.post("/api/auth/login/resend", json={"email": "a@example.com"})
    assert len(client.sent) == n + 2
