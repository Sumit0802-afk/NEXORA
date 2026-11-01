import base64
import binascii
import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.projects import _get_owned_project
from app.db.models import HouseDesign, User
from app.db.session import get_db
from app.domain.ai import AIUnavailable, ai_enabled, ai_read_house_image

router = APIRouter(tags=["house-design"])
_Auth = Depends(get_current_user)

# A design with a dozen variations and their thumbnails sits well under this; the limit stops runaway payloads.
MAX_DOCUMENT_BYTES = 6_000_000
MAX_IMAGE_BYTES = 2_000_000
_IMAGE_TYPES = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png"}


class ReadImageRequest(BaseModel):
    """A downscaled copy of a reference photo as a data URL."""

    image: str = Field(min_length=32, max_length=MAX_IMAGE_BYTES * 2)


@router.get("/projects/{project_id}/house-design")
def get_house_design(project_id: UUID, db: Session = Depends(get_db), user: User = _Auth) -> dict[str, Any]:
    project = _get_owned_project(db, project_id, user)
    stored = db.get(HouseDesign, project.id)
    return stored.document if stored else {}


@router.put("/projects/{project_id}/house-design")
def save_house_design(project_id: UUID, payload: dict[str, Any], db: Session = Depends(get_db), user: User = _Auth) -> dict[str, Any]:
    project = _get_owned_project(db, project_id, user)
    if len(json.dumps(payload)) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="This design is too large to save. Delete a variation and try again.")
    stored = db.get(HouseDesign, project.id)
    if stored:
        stored.document = payload
    else:
        db.add(HouseDesign(project_id=project.id, document=payload))
    db.commit()
    return {"projectId": str(project_id), "status": "saved"}


@router.post("/house-design/read-image")
def read_house_image(payload: ReadImageRequest, _user: User = _Auth) -> dict[str, Any]:
    """Optional second reading of a reference photo. The browser's own reading works without it."""
    if not ai_enabled():
        raise HTTPException(status_code=503, detail="Detailed image reading is not set up on this server.")
    _, _, encoded = payload.image.partition("base64,")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as err:
        raise HTTPException(status_code=422, detail="That image could not be read.") from err
    media_type = next((kind for magic, kind in _IMAGE_TYPES.items() if data.startswith(magic)), None)
    if media_type is None or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="That image could not be read.")
    try:
        return ai_read_house_image(data, media_type)
    except AIUnavailable as err:
        raise HTTPException(status_code=503, detail="Detailed image reading is not available right now.") from err
