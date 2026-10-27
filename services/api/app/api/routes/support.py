import re
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.api.deps import check_origin, get_current_user
from app.core import mailer
from app.db.models import User

router = APIRouter(prefix="/support", tags=["support"])

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_LIMIT, _WINDOW = 5, 60 * 60
_sent: dict[str, list[float]] = {}


class SupportMessage(BaseModel):
    kind: str = Field(pattern=r"^(feedback|contact|support)$")
    subject: str = Field(default="", max_length=120)
    message: str = Field(min_length=3, max_length=4000)
    email: str | None = Field(default=None, max_length=254)
    details: str | None = Field(default=None, max_length=6000)

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        if not v:
            return None
        if not _EMAIL.match(v):
            raise ValueError("Enter a valid email address")
        return v


@router.post("/messages", status_code=202)
def send_message(payload: SupportMessage, request: Request, user: User = Depends(get_current_user)) -> dict:
    """Private route from the app to the team's inbox. The response never reveals where it goes."""
    check_origin(request)
    now = time.time()
    recent = [t for t in _sent.get(str(user.id), []) if now - t < _WINDOW]
    if len(recent) >= _LIMIT:
        raise HTTPException(status_code=429, detail="You have sent several messages recently. Please try again later.")
    body = (
        f"Type: {payload.kind}\nFrom account: {user.email}\nReply address given: {payload.email or '-'}\n\n"
        f"{payload.message}\n"
        + (f"\n--- details ---\n{payload.details}\n" if payload.details else "")
    )
    try:
        mailer.send_support(payload.kind, payload.subject or payload.kind, body, reply_to=payload.email)
    except mailer.MailerUnavailable:
        # Generic on purpose: configuration details stay in the server log.
        raise HTTPException(status_code=503, detail="We couldn't send your message right now. Please try again later.")
    recent.append(now)
    _sent[str(user.id)] = recent
    return {"status": "sent"}
