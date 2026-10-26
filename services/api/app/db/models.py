import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.db.types import GUID, JSONType


def _now() -> datetime:
    return datetime.now(timezone.utc)


def utc_naive() -> datetime:
    """UTC wall-clock time without tzinfo. The auth tables use plain TIMESTAMP columns; storing an aware value would
    make Postgres convert it to the server's local zone and shift every comparison by the UTC offset."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    # Null for the legacy local "demo" user, which therefore cannot sign in.
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    # Set once the user proves they own the email address with a one-time code.
    email_verified_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    projects: Mapped[list["Project"]] = relationship(back_populates="owner")


class EmailOtp(Base):
    """One-time verification code; only a salted hash is stored."""

    __tablename__ = "email_otps"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # "verify" (confirm a new account) or "reset" (forgot password); kept apart so one cannot be used as the other.
    purpose: Mapped[str] = mapped_column(String, nullable=False, default="verify")
    salt: Mapped[str] = mapped_column(String, nullable=False)
    code_hash: Mapped[str] = mapped_column(String, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(default=utc_naive)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)


class AuthSession(Base):
    """Server-side login session; only a hash of the cookie token is stored."""

    __tablename__ = "auth_sessions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_naive)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    units: Mapped[str] = mapped_column(String, nullable=False, default="ft")
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(default=_now)
    updated_at: Mapped[datetime] = mapped_column(default=_now, onupdate=_now)

    owner: Mapped["User"] = relationship(back_populates="projects")
    versions: Mapped[list["DesignVersion"]] = relationship(
        back_populates="project", order_by="DesignVersion.version_number", cascade="all, delete-orphan"
    )


class DesignVersion(Base):
    __tablename__ = "design_versions"
    __table_args__ = (UniqueConstraint("project_id", "version_number", name="uq_design_versions_project_version"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    design_json: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    project: Mapped["Project"] = relationship(back_populates="versions")


class LibraryFavorite(Base):
    """A design from the house library that a user has starred."""

    __tablename__ = "library_favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    design_id: Mapped[str] = mapped_column(String, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_naive)
