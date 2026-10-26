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
    smtp_from: str = ""
    smtp_starttls: bool = True

    # Build the house design library in the background at startup (tests turn this off).
    library_autobuild: bool = True
    library_size: int = 1200

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)


settings = Settings()
