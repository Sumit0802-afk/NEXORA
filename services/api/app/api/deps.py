from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_token
from app.db.models import AuthSession, User
from app.db.session import get_db

SESSION_COOKIE = "nexora_session"
SESSION_DAYS = 14
_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def _origin_ok(origin: str) -> bool:
    if origin in {o.strip() for o in settings.api_cors_origins.split(",") if o.strip()}:
        return True
    if settings.app_env == "development":
        host = origin.split("://", 1)[-1].split(":", 1)[0]
        return host in {"localhost", "127.0.0.1"}
    return False


def check_origin(request: Request) -> None:
    """Cookie sessions: refuse state-changing requests that come from a foreign origin (CSRF)."""
    origin = request.headers.get("origin")
    if request.method in _UNSAFE and origin and not _origin_ok(origin):
        raise HTTPException(status_code=403, detail="Request origin not allowed")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    check_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        session = db.execute(select(AuthSession).where(AuthSession.token_hash == hash_token(token))).scalar_one_or_none()
        if session:
            expires = session.expires_at if session.expires_at.tzinfo else session.expires_at.replace(tzinfo=timezone.utc)
            if expires > datetime.now(timezone.utc):
                user = db.get(User, session.user_id)
                if user and user.password_hash and user.email_verified_at:
                    return user
            db.delete(session)
            db.commit()
    raise HTTPException(status_code=401, detail="Not signed in")
