from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    api_cors_origins: str = "http://localhost:3000"
    database_url: str = "postgresql+psycopg://houseplan:houseplan_dev@localhost:5432/houseplan"
    redis_url: str = "redis://localhost:6379/0"
    # "mock" keeps everything rule-based; "anthropic" enables Claude for brief parsing and explanations.
    ai_provider: str = "mock"
    ai_api_key: str = ""
    ai_model: str = ""

    # Email delivery for verification codes (see app/core/mailer.py).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""  # legacy; prefer MAIL_FROM_ADDRESS
    # Sender on your own verified domain, e.g. noreply@yourdomain.com. The display name is always "NEXORA".
    mail_from_address: str = ""
    # Private destination for feedback / contact / support messages. Server-side only; never sent to a client.
    support_inbox: str = ""
    # Testing escape hatch: allow sending through a personal mailbox (Gmail etc.). Recipients then see that personal
    # address in From. Leave off in production.
    allow_personal_smtp: bool = False
    # Public URL of the web app's /email folder (e.g. https://nexora.example.com/email). Empty = image-free email.
    email_asset_base_url: str = ""
    smtp_starttls: bool = True

    # Build the house design library in the background at startup (tests turn this off).
    library_autobuild: bool = True
    library_size: int = 1200

    @field_validator("database_url")
    @classmethod
    def _psycopg_url(cls, v: str) -> str:
        """Hosts such as Neon hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the psycopg 3 driver name."""
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)


settings = Settings()
