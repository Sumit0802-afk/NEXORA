import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def _no_real_ai_calls(monkeypatch):
    """Tests never reach a real AI provider, whatever the local .env says; AI tests opt in with fakes."""
    monkeypatch.setattr(settings, "ai_provider", "mock")
