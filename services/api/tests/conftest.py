import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def _no_real_ai_calls(monkeypatch):
    """Tests never reach a real AI provider, whatever the local .env says; AI tests opt in with fakes."""
    monkeypatch.setattr(settings, "ai_provider", "mock")


@pytest.fixture(autouse=True)
def _signed_in(request):
    """Endpoint tests exercise routes, not login; test_auth.py uses the real session flow."""
    if request.module.__name__.endswith("test_auth"):
        yield
        return
    import uuid

    from app.api.deps import get_current_user
    from app.db.models import User
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: User(id=uuid.uuid4(), email="t@example.com", password_hash="x")
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def _no_library_autobuild(monkeypatch):
    """Tests build their own small catalogue; the full one would be built in a background thread at startup."""
    monkeypatch.setattr(settings, "library_autobuild", False)
