import base64
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
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
    response = client.put(f"/api/projects/{pid}/house-design", json={"blob": "x" * 6_100_000})
    assert response.status_code == 413
    assert "too large" in response.json()["detail"]


def test_another_users_project_is_hidden(client):
    pid = _project(client)
    stranger = User(id=uuid4(), email="stranger@example.com", password_hash="x")
    app.dependency_overrides[get_current_user] = lambda: stranger
    assert client.get(f"/api/projects/{pid}/house-design").status_code == 404
    assert client.put(f"/api/projects/{pid}/house-design", json={"n": 1}).status_code == 404


def test_image_reading_says_when_it_is_off(client):
    response = client.post("/api/house-design/read-image", json={"image": DATA_URL})
    assert response.status_code == 503
    assert "AI" not in response.json()["detail"]


def _reading(**overrides):
    values = dict(style="mediterranean", roof="hip", pitch=24, window_shape="arched", window_grid="cross", window_trim="none",
                  door_design="arched", balcony="baluster", wall_texture="stucco", accent_texture="none", portico="arch",
                  notes=["Rear not visible.", "b", "c"])
    return ai._HouseReading(**{**values, **overrides})


def test_image_reading_returns_the_fields_the_web_app_uses(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "ai_api_key", "test")
    seen = {}

    def fake_parse(system, prompt, schema, image=None):
        seen["image"] = image
        return _reading()

    monkeypatch.setattr(ai, "_parse", fake_parse)
    body = client.post("/api/house-design/read-image", json={"image": DATA_URL}).json()
    assert seen["image"] == (JPEG, "image/jpeg")
    assert body["windowShape"] == "arched"
    assert body["wallTexture"] == "stucco"
    assert len(body["notes"]) == 2


def test_image_reading_failure_is_reported_in_plain_words(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "ai_api_key", "test")

    def fail(*_args, **_kwargs):
        raise ai.AIUnavailable("The AI service is busy.")

    monkeypatch.setattr(ai, "_parse", fail)
    response = client.post("/api/house-design/read-image", json={"image": DATA_URL})
    assert response.status_code == 503
    assert "AI" not in response.json()["detail"]


@pytest.mark.parametrize("image", ["data:image/jpeg;base64,not-base64!!" + "A" * 32, "data:image/gif;base64," + base64.b64encode(b"GIF89a" + b"0" * 40).decode()])
def test_image_reading_refuses_anything_that_is_not_a_photo(client, monkeypatch, image):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "ai_api_key", "test")
    assert client.post("/api/house-design/read-image", json={"image": image}).status_code == 422


def test_image_prompt_never_runs_without_a_provider(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "mock")
    with pytest.raises(ai.AIUnavailable):
        ai.ai_read_house_image(JPEG, "image/jpeg")


