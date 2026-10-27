import uuid

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.api.routes import support as support_routes
from app.core import mailer
from app.core.config import settings
from app.db.models import User
from app.main import app

_USER = User(id=uuid.uuid4(), email="member@example.com", password_hash="x")


@pytest.fixture()
def client():
    support_routes._sent.clear()
    app.dependency_overrides[get_current_user] = lambda: _USER  # same member on every call, so limits apply
    yield TestClient(app)
    app.dependency_overrides.pop(get_current_user, None)


def test_support_needs_login():
    app.dependency_overrides.pop(get_current_user, None)
    assert TestClient(app).post("/api/support/messages", json={"kind": "feedback", "message": "hello"}).status_code == 401


def test_support_message_is_forwarded_and_never_reveals_the_inbox(client, monkeypatch):
    seen = []
    monkeypatch.setattr(mailer, "send_support", lambda kind, subject, body, reply_to=None: seen.append((kind, subject, body, reply_to)))
    monkeypatch.setattr(settings, "support_inbox", "owner@gmail.com")
    r = client.post("/api/support/messages", json={"kind": "feedback", "subject": "Idea", "message": "Add more rooms", "email": "me@example.com"})
    assert r.status_code == 202 and r.json() == {"status": "sent"}
    assert "owner@gmail.com" not in r.text and "gmail" not in r.text
    assert seen[0][0] == "feedback" and seen[0][3] == "me@example.com" and "member@example.com" in seen[0][2]


def test_support_failure_is_generic(client, monkeypatch):
    def boom(*a, **k):
        raise mailer.MailerUnavailable("SMTP host smtp.secret.example refused")
    monkeypatch.setattr(mailer, "send_support", boom)
    r = client.post("/api/support/messages", json={"kind": "support", "message": "help me"})
    assert r.status_code == 503 and "secret" not in r.text


def test_support_validates_and_rate_limits(client, monkeypatch):
    monkeypatch.setattr(mailer, "send_support", lambda *a, **k: None)
    assert client.post("/api/support/messages", json={"kind": "bad", "message": "hello"}).status_code == 422
    assert client.post("/api/support/messages", json={"kind": "feedback", "message": "hello", "email": "nope"}).status_code == 422
    for _ in range(5):
        assert client.post("/api/support/messages", json={"kind": "feedback", "message": "hello"}).status_code == 202
    assert client.post("/api/support/messages", json={"kind": "feedback", "message": "hello"}).status_code == 429
