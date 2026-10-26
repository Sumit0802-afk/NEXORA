from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_auth_columns(engine: Engine) -> None:
    """create_all() does not alter existing tables; add the auth column to databases created before login existed."""
    columns = {c["name"] for c in inspect(engine).get_columns("users")}
    if "password_hash" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR"))
    if "email_verified_at" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP"))
            # Accounts created before verification existed keep working.
            conn.execute(text("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE password_hash IS NOT NULL"))

    otp_columns = {c["name"] for c in inspect(engine).get_columns("email_otps")} if inspect(engine).has_table("email_otps") else None
    if otp_columns is not None and "purpose" not in otp_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE email_otps ADD COLUMN purpose VARCHAR NOT NULL DEFAULT 'verify'"))
