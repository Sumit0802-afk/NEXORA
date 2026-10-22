import uuid

from sqlalchemy.orm import Session

from app.db.models import User

# No authentication is implemented yet (see docs/SECURITY.md). All projects are
# attributed to this fixed local user until real auth/ownership checks land.
DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def ensure_demo_user(db: Session) -> None:
    user = db.get(User, DEMO_USER_ID)
    if user is None:
        db.add(User(id=DEMO_USER_ID, email="demo@nexora.local", display_name="Demo"))
        db.commit()
