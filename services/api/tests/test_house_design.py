import base64
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import house_design
from app.core.config import settings
from app.db.models import Base, User
from app.db.session import get_db
from app.domain import ai
from app.main import app

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
DATA_URL = "data:image/jpeg;base64," + base64.b64encode(JPEG).decode("ascii")


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    def override():
        with Session() as db:
            yield db

    owner = User(id=uuid4(), email="owner@example.com", password_hash="x")
    with Session() as db:
        db.add(owner)
        db.commit()
    app.dependency_overrides[get_db] = override
    app.dependency_overrides[get_current_user] = lambda: owner
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


def _project(client) -> str:
    return client.post("/api/projects", json={"name": "House"}).json()["id"]


def test_a_new_project_has_no_design(client):
    assert client.get(f"/api/projects/{_project(client)}/house-design").json() == {}


def test_saves_and_reopens_the_design(client):
    pid = _project(client)
    doc = {"version": 1, "design": {"exterior": {"wall": {"materialId": "brick_red", "color": "#A5503A"}}}, "variations": [{"id": "a", "name": "One"}]}
    assert client.put(f"/api/projects/{pid}/house-design", json=doc).status_code == 200
    assert client.get(f"/api/projects/{pid}/house-design").json() == doc


def test_saving_again_replaces_it(client):
    pid = _project(client)
    client.put(f"/api/projects/{pid}/house-design", json={"version": 1, "n": 1})
    client.put(f"/api/projects/{pid}/house-design", json={"version": 1, "n": 2})
    assert client.get(f"/api/projects/{pid}/house-design").json()["n"] == 2


def test_each_project_keeps_its_own_design(client):
    one, two = _project(client), _project(client)
    client.put(f"/api/projects/{one}/house-design", json={"n": 1})
    client.put(f"/api/projects/{two}/house-design", json={"n": 2})
    assert client.get(f"/api/projects/{one}/house-design").json() == {"n": 1}
    assert client.get(f"/api/projects/{two}/house-design").json() == {"n": 2}


def test_saving_a_design_does_not_add_a_plan_version(client):
    pid = _project(client)
    before = client.get(f"/api/projects/{pid}").json()["currentVersion"]
    client.put(f"/api/projects/{pid}/house-design", json={"n": 1})
    assert client.get(f"/api/projects/{pid}").json()["currentVersion"] == before


def test_duplicating_a_project_copies_its_design(client):
    pid = _project(client)
    client.put(f"/api/projects/{pid}/house-design", json={"n": 1})
    copy = client.post(f"/api/projects/{pid}/duplicate").json()["id"]
    assert client.get(f"/api/projects/{copy}/house-design").json() == {"n": 1}


def test_deleting_a_project_removes_its_design(client):
    pid = _project(client)
    client.put(f"/api/projects/{pid}/house-design", json={"n": 1})
    assert client.delete(f"/api/projects/{pid}").status_code == 204
    assert client.get(f"/api/projects/{pid}/house-design").status_code == 404


def test_refuses_an_oversized_design(client):
    pid = _project(client)
    response = client.put(f"/api/projects/{pid}/house-design", json={"blob": "x" * 12_100_000})
    assert response.status_code == 413
    assert "too large" in response.json()["detail"]


def test_another_users_project_is_hidden(client):
    pid = _project(client)
    stranger = User(id=uuid4(), email="stranger@example.com", password_hash="x")
    app.dependency_overrides[get_current_user] = lambda: stranger
    assert client.get(f"/api/projects/{pid}/house-design").status_code == 404
    assert client.put(f"/api/projects/{pid}/house-design", json={"n": 1}).status_code == 404


def _job(client, pid, views=None):
    return client.post(f"/api/projects/{pid}/house-design/jobs", json={"views": views or [{"elevation": "front", "image": DATA_URL}]})


def test_image_reading_says_when_it_is_off(client):
    response = _job(client, _project(client))
    assert response.status_code == 503
    assert "AI" not in response.json()["detail"]


def _reading(**overrides):
    values = dict(style="mediterranean", roof="hip", pitch=24, window_shape="arched", window_grid="cross", window_trim="none",
                  door_design="arched", balcony="baluster", wall_texture="stucco", accent_texture="none", portico="arch",
                  notes=["Rear not visible.", "b", "c"])
    return ai._HouseReading(**{**values, **overrides})


def _provider(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "ai_api_key", "test")


def test_a_job_reads_each_view_and_keeps_the_result(client, monkeypatch):
    _provider(monkeypatch)
    seen = []

    def fake_parse(system, prompt, schema, image=None):
        seen.append(image)
        return _reading()

    monkeypatch.setattr(ai, "_parse", fake_parse)
    pid = _project(client)
    started = _job(client, pid, [{"elevation": "front", "image": DATA_URL}, {"elevation": "rear", "image": DATA_URL}])
    assert started.status_code == 202
    assert started.json()["status"] == "queued"
    body = client.get(f"/api/projects/{pid}/house-design/jobs/{started.json()['jobId']}").json()
    assert body["status"] == "completed"
    assert seen == [(JPEG, "image/jpeg")] * 2
    assert set(body["result"]) == {"front", "rear"}
    assert body["result"]["rear"]["windowShape"] == "arched"
    assert len(body["result"]["front"]["notes"]) == 2


def test_a_failed_job_says_so_in_plain_words(client, monkeypatch):
    _provider(monkeypatch)

    def fail(*_args, **_kwargs):
        raise ai.AIUnavailable("The AI service is busy.")

    monkeypatch.setattr(ai, "_parse", fail)
    pid = _project(client)
    body = client.get(f"/api/projects/{pid}/house-design/jobs/{_job(client, pid).json()['jobId']}").json()
    assert body["status"] == "failed"
    assert "AI" not in body["error"]


def test_a_stuck_job_stops_looking_busy(client, monkeypatch):
    _provider(monkeypatch)
    monkeypatch.setattr(house_design, "_run_read_job", lambda *_args: None)
    monkeypatch.setattr(house_design, "JOB_TIMEOUT", timedelta(seconds=-1))
    pid = _project(client)
    job_id = _job(client, pid).json()["jobId"]
    assert client.get(f"/api/projects/{pid}/house-design/jobs/{job_id}").json()["status"] == "failed"


def test_a_job_belongs_to_its_project(client, monkeypatch):
    _provider(monkeypatch)
    monkeypatch.setattr(ai, "_parse", lambda *_args, **_kwargs: _reading())
    pid, other = _project(client), _project(client)
    job_id = _job(client, pid).json()["jobId"]
    assert client.get(f"/api/projects/{other}/house-design/jobs/{job_id}").status_code == 404
    stranger = User(id=uuid4(), email="stranger@example.com", password_hash="x")
    app.dependency_overrides[get_current_user] = lambda: stranger
    assert client.get(f"/api/projects/{pid}/house-design/jobs/{job_id}").status_code == 404


@pytest.mark.parametrize("image", ["data:image/jpeg;base64,not-base64!!" + "A" * 32, "data:image/gif;base64," + base64.b64encode(b"GIF89a" + b"0" * 40).decode()])
def test_image_reading_refuses_anything_that_is_not_a_photo(client, monkeypatch, image):
    _provider(monkeypatch)
    assert _job(client, _project(client), [{"elevation": "front", "image": image}]).status_code == 422


def test_a_job_refuses_an_unknown_side(client, monkeypatch):
    _provider(monkeypatch)
    assert _job(client, _project(client), [{"elevation": "top", "image": DATA_URL}]).status_code == 422


def test_image_prompt_never_runs_without_a_provider(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "mock")
    with pytest.raises(ai.AIUnavailable):
        ai.ai_read_house_image(JPEG, "image/jpeg")


