import base64
import binascii
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.projects import _get_owned_project
from app.db.models import HouseDesign, HouseDesignJob, User
from app.db.session import get_db
from app.domain.ai import AIUnavailable, ai_enabled, ai_read_house_image

logger = logging.getLogger(__name__)
router = APIRouter(tags=["house-design"])
_Auth = Depends(get_current_user)

# A design with four reference photos, a dozen variations and their thumbnails sits well under this; the limit stops runaway payloads.
MAX_DOCUMENT_BYTES = 12_000_000
MAX_IMAGE_BYTES = 2_000_000
JOB_TIMEOUT = timedelta(minutes=10)
_IMAGE_TYPES = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png"}


class ReferenceView(BaseModel):
    """A downscaled copy of a reference photo as a data URL, and the side of the house it shows."""

    elevation: Literal["front", "rear", "left", "right"]
    image: str = Field(min_length=32, max_length=MAX_IMAGE_BYTES * 2)


class ReadJobRequest(BaseModel):
    views: list[ReferenceView] = Field(min_length=1, max_length=4)


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


def _decode(image: str) -> tuple[bytes, str]:
    _, _, encoded = image.partition("base64,")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as err:
        raise HTTPException(status_code=422, detail="That image could not be read.") from err
    media_type = next((kind for magic, kind in _IMAGE_TYPES.items() if data.startswith(magic)), None)
    if media_type is None or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="That image could not be read.")
    return data, media_type


def _job_view(job: HouseDesignJob) -> dict[str, Any]:
    return {"jobId": str(job.id), "status": job.status, "result": job.result, "error": job.error}


def _run_read_job(job_id: UUID, views: list[tuple[str, bytes, str]], bind: Engine | Connection) -> None:
    """Runs after the response is sent. It opens its own session, since the request's has closed by then."""
    with Session(bind=bind) as db:
        job = db.get(HouseDesignJob, job_id)
        if job is None:
            return
        job.status = "running"
        db.commit()
        try:
            job.result = {elevation: ai_read_house_image(data, media_type) for elevation, data, media_type in views}
            job.status = "completed"
        except AIUnavailable:
            job.status, job.error = "failed", "Detailed image reading is not available right now."
        except Exception:
            logger.exception("House reading job %s failed", job_id)
            job.status, job.error = "failed", "Detailed image reading is not available right now."
        db.commit()


@router.post("/projects/{project_id}/house-design/jobs", status_code=202)
def start_read_job(project_id: UUID, payload: ReadJobRequest, background: BackgroundTasks, db: Session = Depends(get_db), user: User = _Auth) -> dict[str, Any]:
    """Optional second reading of the reference views. The browser's own reading works without it."""
    project = _get_owned_project(db, project_id, user)
    if not ai_enabled():
        raise HTTPException(status_code=503, detail="Detailed image reading is not set up on this server.")
    views = [(view.elevation, *_decode(view.image)) for view in payload.views]
    db.query(HouseDesignJob).filter(HouseDesignJob.project_id == project.id, HouseDesignJob.status.in_(("completed", "failed"))).delete(synchronize_session=False)
    job = HouseDesignJob(project_id=project.id)
    db.add(job)
    db.commit()
    background.add_task(_run_read_job, job.id, views, db.get_bind())
    return _job_view(job)


@router.get("/projects/{project_id}/house-design/jobs/{job_id}")
def get_read_job(project_id: UUID, job_id: UUID, db: Session = Depends(get_db), user: User = _Auth) -> dict[str, Any]:
    project = _get_owned_project(db, project_id, user)
    job = db.get(HouseDesignJob, job_id)
    if job is None or job.project_id != project.id:
        raise HTTPException(status_code=404, detail="That job was not found.")
    # A job caught by a server restart would otherwise look busy for ever.
    if job.status in ("queued", "running"):
        touched = job.updated_at if job.updated_at.tzinfo else job.updated_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - touched > JOB_TIMEOUT:
            job.status, job.error = "failed", "Detailed image reading is not available right now."
            db.commit()
    return _job_view(job)
