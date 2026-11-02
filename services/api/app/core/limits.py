from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent, AuthSession, RateEvent, utc_naive

"""Limits and audit records kept in the database, so they survive restarts and are shared between workers."""

AUDIT_DAYS = 365


def over(db: Session, key: str, limit: int, window: int) -> bool:
    since = utc_naive() - timedelta(seconds=window)
    count = db.execute(select(func.count()).select_from(RateEvent).where(RateEvent.key == key, RateEvent.created_at > since)).scalar_one()
    return count >= limit


def record(db: Session, key: str) -> None:
    db.add(RateEvent(key=key))
    db.commit()


def clear(db: Session, key: str) -> None:
    db.execute(delete(RateEvent).where(RateEvent.key == key))
    db.commit()


def spend(db: Session, key: str, limit: int, window: int = 3600) -> None:
    """Counts one use of an expensive action, or refuses it with 429."""
    if over(db, key, limit, window):
        raise HTTPException(status_code=429, detail="You have done this many times recently. Please try again later.")
    record(db, key)


def audit(db: Session, action: str, user_id: object, target: str | None = None) -> None:
    """Adds to the caller's transaction. Holds ids only, never passwords, tokens or codes."""
    db.add(AuditEvent(action=action, user_id=str(user_id), target=target))


def purge(db: Session) -> None:
    """Applies the retention policy: see docs/SECURITY.md."""
    now = utc_naive()
    db.execute(delete(RateEvent).where(RateEvent.created_at < now - timedelta(days=2)))
    db.execute(delete(AuthSession).where(AuthSession.expires_at < now))
    db.execute(delete(AuditEvent).where(AuditEvent.created_at < now - timedelta(days=AUDIT_DAYS)))
    db.commit()
