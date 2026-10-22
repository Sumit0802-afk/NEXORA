from fastapi.testclient import TestClient

from app.api.routes import generation
from app.core.config import settings
from app.domain import ai
from app.domain.ai import AIUnavailable, _BriefReading, _Explanations
from app.domain.requirements import normalize_counts
from app.main import app

client = TestClient(app)
BODY = {"roomList": "2 bedrooms, 2 baths", "description": "small family home", "plotWidth": 30, "plotLength": 40}


def _enable(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "ai_model", "")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")


def test_mock_provider_keeps_rule_based_path(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "mock")
    data = client.post("/api/layouts/generate", json=BODY).json()
    assert data["ai"] == {"enabled": False, "provider": "mock", "model": None, "used": False, "error": None}
    assert data["requirements"]["counts"]["bedroom"] == 2
    assert all("explanation" not in c for c in data["candidates"])


def test_gemini_provider_is_enabled_with_its_default_model(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "gemini")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_model", "")
    assert ai.ai_status() == {"enabled": True, "provider": "gemini", "model": ai.DEFAULT_MODELS["gemini"]}


def test_unknown_provider_stays_off(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "openrouter")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")
    assert ai.ai_enabled() is False


def test_status_endpoint_never_exposes_key(monkeypatch):
    _enable(monkeypatch)
    status = client.get("/api/layouts/ai-status").json()
    assert status["enabled"] is True and status["model"] == ai.DEFAULT_MODELS["anthropic"]
    assert "test-key" not in str(status)


def test_ai_reading_and_explanations_are_used(monkeypatch):
    _enable(monkeypatch)

    def fake_parse(system, prompt, schema):
        if schema is _BriefReading:
            return _BriefReading(rooms=[{"type": "bedroom", "count": 3}, {"type": "study", "count": 1}],
                                 notes=["Read '3BHK' as three bedrooms."])
        ids = [line.split('"')[3] for line in prompt.splitlines() if line.strip().startswith('"id"')]
        return _Explanations(candidates=[{"id": i, "headline": "Good for a family.", "pros": ["Bright"], "cons": []}
                                         for i in ids])

    monkeypatch.setattr(ai, "_parse", fake_parse)
    data = client.post("/api/layouts/generate", json={**BODY, "plotWidth": 40, "plotLength": 60}).json()
    assert data["ai"]["used"] is True and data["ai"]["error"] is None
    counts = data["requirements"]["counts"]
    assert counts["bedroom"] == 3 and counts["study"] == 1 and counts["living_room"] == 1
    assert data["candidates"] and all(c["explanation"]["headline"] == "Good for a family." for c in data["candidates"])


def test_ai_failure_falls_back_to_rules(monkeypatch):
    _enable(monkeypatch)

    def failing(*_args):
        raise AIUnavailable("The AI API key was rejected.")

    monkeypatch.setattr(ai, "_parse", failing)
    data = client.post("/api/layouts/generate", json=BODY).json()
    assert data["ai"]["used"] is False and data["ai"]["error"] == "The AI API key was rejected."
    assert data["requirements"]["counts"]["bedroom"] == 2
    assert data["candidates"]


def test_normalize_counts_drops_unknown_and_caps():
    req = normalize_counts({"bedroom": 9, "pool": 1, "kitchen": 0})
    assert req.counts["bedroom"] == 6 and "pool" not in req.counts and req.counts["kitchen"] == 1
    assert generation.parse_requirements("3bhk").counts["bedroom"] == 3
