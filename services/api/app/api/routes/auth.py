import hmac
import re
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.api.deps import SESSION_COOKIE, SESSION_DAYS, check_origin, get_current_user
from app.core.config import settings
from app.core import mailer
from app.core.security import (
    DUMMY_HASH, hash_otp, hash_password, hash_token, new_otp, new_session_token, verify_password,
)
from app.db.models import AuthSession, EmailOtp, Project, User, utc_naive
from app.db.seed import DEMO_USER_ID
from app.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MAX_FAILS, _WINDOW = 5, 15 * 60
_fails: dict[str, list[float]] = {}


NO_ACCOUNT = "No account found with this email. Create an account first."
OTP_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 60


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _issue_otp(db: Session, user: User, strict: bool = False, purpose: str = "verify") -> bool:
    """Replace any outstanding code with a fresh one and email it.

    Within the resend cooldown a code is already on its way. strict (the explicit "resend" action) refuses with
    429; otherwise (sign-up, sign-in) it just keeps the existing code and returns False.
    """
    latest = db.execute(
        select(EmailOtp).where(EmailOtp.user_id == user.id, EmailOtp.purpose == purpose)
        .order_by(EmailOtp.created_at.desc()).limit(1)
    ).scalar_one_or_none()
    age = (datetime.now(timezone.utc) - _aware(latest.created_at)).total_seconds() if latest else None
    # A negative age can only come from rows written before timestamps were stored as UTC; do not let them block sending.
    if age is not None and 0 <= age < OTP_RESEND_SECONDS:
        if strict:
            raise HTTPException(status_code=429, detail="Please wait a minute before requesting another code.")
        return False
    for old in db.execute(select(EmailOtp).where(EmailOtp.user_id == user.id, EmailOtp.purpose == purpose)).scalars():
        db.delete(old)
    code, salt = new_otp(), secrets.token_hex(8)
    db.add(EmailOtp(user_id=user.id, purpose=purpose, salt=salt, code_hash=hash_otp(code, salt),
                    expires_at=utc_naive() + timedelta(minutes=OTP_MINUTES)))
    db.commit()
    try:
        mailer.send_otp(user.email, code, OTP_MINUTES, purpose)
    except mailer.MailerUnavailable as exc:
        # Nothing was delivered, so drop the code: the user must be able to retry without the resend cooldown.
        db.execute(delete(EmailOtp).where(EmailOtp.user_id == user.id, EmailOtp.purpose == purpose))
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return True


def _consume_otp(db: Session, user: User | None, code: str, purpose: str) -> User:
    """Check a one-time code (expiry, attempt limit, constant-time compare) and burn it. Raises 400 otherwise."""
    bad = HTTPException(status_code=400, detail="That code is incorrect or has expired.")
    otp = db.execute(
        select(EmailOtp).where(EmailOtp.user_id == user.id, EmailOtp.purpose == purpose)
    ).scalar_one_or_none() if user else None
    if not (user and otp):
        raise bad
    if _aware(otp.expires_at) <= datetime.now(timezone.utc) or otp.attempts >= OTP_MAX_ATTEMPTS:
        db.delete(otp)
        db.commit()
        raise HTTPException(status_code=400, detail="That code has expired. Request a new one.")
    if not hmac.compare_digest(hash_otp(code, otp.salt), otp.code_hash):
        otp.attempts += 1
        db.commit()
        raise bad
    db.delete(otp)
    return user


def _throttled(key: str) -> bool:
    now = time.time()
    recent = [t for t in _fails.get(key, []) if now - t < _WINDOW]
    _fails[key] = recent
    return len(recent) >= _MAX_FAILS


def _clean_email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL.match(v):
        raise ValueError("Enter a valid email address")
    return v


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        return _clean_email(v)


class RegisterPayload(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=256)
    display_name: str | None = Field(default=None, max_length=80, alias="displayName")

    model_config = {"populate_by_name": True}

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        return _clean_email(v)


class UserOut(BaseModel):
    id: str
    email: str
    displayName: str | None
    createdAt: str | None = None


def _out(user: User) -> UserOut:
    return UserOut(id=str(user.id), email=user.email, displayName=user.display_name,
                   createdAt=user.created_at.isoformat() if user.created_at else None)


def _start_session(response: Response, db: Session, user: User) -> None:
    token = new_session_token()
    expires = utc_naive() + timedelta(days=SESSION_DAYS)
    db.add(AuthSession(user_id=user.id, token_hash=hash_token(token), expires_at=expires))
    db.commit()
    response.set_cookie(
        SESSION_COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax",
        secure=settings.app_env != "development", path="/",
    )


class VerifyPayload(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        return _clean_email(v)


class EmailOnly(BaseModel):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        return _clean_email(v)


class VerifiedOut(BaseModel):
    verified: bool = True
    email: str


class PendingOut(BaseModel):
    verificationRequired: bool = True
    email: str


@router.post("/register", status_code=201)
def register(payload: RegisterPayload, request: Request, db: Session = Depends(get_db)) -> PendingOut:
    check_origin(request)
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if user and user.email_verified_at:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if user:
        # Never verified: let the person start over (new password/name) rather than locking the address.
        user.password_hash = hash_password(payload.password)
        user.display_name = (payload.display_name or "").strip() or None
    else:
        user = User(email=payload.email, display_name=(payload.display_name or "").strip() or None,
                    password_hash=hash_password(payload.password))
        db.add(user)
    db.commit()
    _issue_otp(db, user)
    return PendingOut(email=user.email)


@router.post("/verify")
def verify(payload: VerifyPayload, request: Request, db: Session = Depends(get_db)) -> VerifiedOut:
    check_origin(request)
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    user = _consume_otp(db, user, payload.code, "verify")
    first_account = db.execute(
        select(User.id).where(User.email_verified_at.is_not(None), User.id != user.id).limit(1)
    ).first() is None
    user.email_verified_at = datetime.now(timezone.utc)
    if first_account:
        # The first verified account adopts projects created before login existed, so existing work is not orphaned.
        db.execute(update(Project).where(Project.owner_id == DEMO_USER_ID).values(owner_id=user.id))
    db.commit()
    # Verifying proves the email only. The person signs in afterwards, so no session is created here.
    return VerifiedOut(email=user.email)


@router.post("/resend")
def resend(payload: EmailOnly, request: Request, db: Session = Depends(get_db)) -> dict:
    check_origin(request)
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    # Same answer whether or not the address is pending, so this cannot be used to probe for accounts.
    if user and user.password_hash and not user.email_verified_at:
        _issue_otp(db, user, strict=True)
    return {"status": "sent"}


class ResetPayload(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    password: str = Field(min_length=8, max_length=256)

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        return _clean_email(v)


@router.post("/forgot")
def forgot_password(payload: EmailOnly, request: Request, db: Session = Depends(get_db)) -> dict:
    check_origin(request)
    key = f"forgot|{request.client.host if request.client else '?'}"
    if _throttled(key):
        raise HTTPException(status_code=429, detail="Too many requests. Try again in a few minutes.")
    _fails.setdefault(key, []).append(time.time())
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    # Same answer whether or not the address has an account, so this cannot be used to probe for accounts.
    if user and user.password_hash:
        _issue_otp(db, user, purpose="reset")
    return {"status": "sent"}


@router.post("/reset-password")
def reset_password(payload: ResetPayload, request: Request, db: Session = Depends(get_db)) -> dict:
    check_origin(request)
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    user = _consume_otp(db, user, payload.code, "reset")
    user.password_hash = hash_password(payload.password)
    if not user.email_verified_at:
        user.email_verified_at = datetime.now(timezone.utc)  # the code reached their inbox, so the address is theirs
    # Anyone holding the old password (or a stolen session) is signed out everywhere.
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()
    _fails.pop(f"{request.client.host if request.client else '?'}|{user.email}", None)
    return {"status": "password_updated"}


@router.post("/login")
def login(payload: Credentials, request: Request, response: Response, db: Session = Depends(get_db)) -> UserOut:
    check_origin(request)
    key = f"{request.client.host if request.client else '?'}|{payload.email}"
    if _throttled(key):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in a few minutes.")
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    ok = verify_password(payload.password, user.password_hash if user and user.password_hash else DUMMY_HASH)
    if not (user and user.password_hash):
        # Sign-in is only for accounts that were created first; point people to Create account.
        _fails.setdefault(key, []).append(time.time())
        raise HTTPException(status_code=404, detail=NO_ACCOUNT)
    if not ok:
        _fails.setdefault(key, []).append(time.time())
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    _fails.pop(key, None)
    if not user.email_verified_at:
        _issue_otp(db, user)  # a code sent a moment ago is simply reused
        raise HTTPException(status_code=403, detail="email_not_verified")
    _start_session(response, db, user)
    return _out(user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    check_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        row = db.execute(select(AuthSession).where(AuthSession.token_hash == hash_token(token))).scalar_one_or_none()
        if row:
            db.delete(row)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> UserOut:
    return _out(user)


class ProfilePatch(BaseModel):
    display_name: str | None = Field(default=None, max_length=80, alias="displayName")

    model_config = {"populate_by_name": True}


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=256, alias="currentPassword")
    new_password: str = Field(min_length=8, max_length=256, alias="newPassword")

    model_config = {"populate_by_name": True}


class PasswordConfirm(BaseModel):
    password: str = Field(min_length=1, max_length=256)


def _current_token_hash(request: Request) -> str | None:
    token = request.cookies.get(SESSION_COOKIE)
    return hash_token(token) if token else None


def _check_current_password(user: User, password: str, request: Request) -> None:
    key = f"pw|{user.id}"
    if _throttled(key):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in a few minutes.")
    if not verify_password(password, user.password_hash):
        _fails.setdefault(key, []).append(time.time())
        raise HTTPException(status_code=400, detail="That password is incorrect.")
    _fails.pop(key, None)


@router.patch("/me")
def update_profile(payload: ProfilePatch, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)) -> UserOut:
    user.display_name = (payload.display_name or "").strip() or None
    db.commit()
    return _out(user)


@router.post("/change-password")
def change_password(payload: PasswordChange, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)) -> dict:
    _check_current_password(user, payload.current_password, request)
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Choose a password different from your current one.")
    user.password_hash = hash_password(payload.new_password)
    # Keep this device signed in; every other device has to sign in again with the new password.
    keep = _current_token_hash(request)
    stmt = delete(AuthSession).where(AuthSession.user_id == user.id)
    if keep:
        stmt = stmt.where(AuthSession.token_hash != keep)
    db.execute(stmt)
    db.commit()
    return {"status": "password_updated"}


@router.post("/logout-all", status_code=204)
def logout_all(request: Request, response: Response, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)) -> None:
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.post("/delete-account", status_code=204)
def delete_account(payload: PasswordConfirm, request: Request, response: Response, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)) -> None:
    """Permanently removes the account and every project it owns. Requires the current password."""
    _check_current_password(user, payload.password, request)
    for project in db.execute(select(Project).where(Project.owner_id == user.id)).scalars().all():
        db.delete(project)  # ORM cascade also removes its saved design versions
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.execute(delete(EmailOtp).where(EmailOtp.user_id == user.id))
    db.delete(user)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
