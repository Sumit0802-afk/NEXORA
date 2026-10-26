import uuid

from sqlalchemy.orm import Session

from app.db.models import User

# Legacy owner of projects created before login existed. It has no password and cannot sign in;
# the first account to register adopts its projects (see routes/auth.py).
DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def ensure_demo_user(db: Session) -> None:
    user = db.get(User, DEMO_USER_ID)
    if user is None:
        db.add(User(id=DEMO_USER_ID, email="demo@nexora.local", display_name="Demo"))
        db.commit()
