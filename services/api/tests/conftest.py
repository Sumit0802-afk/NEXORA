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
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.db.models import Base, User
    from app.db.session import get_db
    from app.main import app

    # Limits count in the database, so stateless routes need one too. Tests with their own replace this override.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    def override():
        with Session() as db:
            yield db

    app.dependency_overrides[get_db] = override
    app.dependency_overrides[get_current_user] = lambda: User(id=uuid.uuid4(), email="t@example.com", password_hash="x")
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture(autouse=True)
def _no_library_autobuild(monkeypatch):
    """Tests build their own small catalogue; the full one would be built in a background thread at startup."""
    monkeypatch.setattr(settings, "library_autobuild", False)
