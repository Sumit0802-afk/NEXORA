from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import DesignVersion, Project, User
from app.db.session import get_db
from app.domain.geometry import validate_floor_plan

router = APIRouter(prefix="/projects", tags=["projects"])
_Auth = Depends(get_current_user)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    units: str = Field(default="ft", pattern="^(ft|m)$")
    plot_width: float = Field(default=30, gt=0, alias="plotWidth")
    plot_length: float = Field(default=40, gt=0, alias="plotLength")

    model_config = {"populate_by_name": True}


class ProjectSummary(BaseModel):
    id: UUID
    name: str
    units: str
    status: str
    current_version: int = Field(serialization_alias="currentVersion")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")
    room_count: int = Field(serialization_alias="roomCount")
    plot_width: float = Field(serialization_alias="plotWidth")
    plot_length: float = Field(serialization_alias="plotLength")

    model_config = {"from_attributes": True}


class ProjectRename(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectDetail(BaseModel):
    id: UUID
    name: str
    units: str
    status: str
    current_version: int = Field(serialization_alias="currentVersion")
    design: dict[str, Any]

    model_config = {"from_attributes": True}


def _initial_design(project_id: UUID, name: str, units: str, plot_width: float, plot_length: float) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "projectId": str(project_id),
        "units": units,
        "plot": {"width": plot_width, "length": plot_length, "floors": 1, "shape": "rectangle"},
        "levels": [{
            "id": "ground",
            "elevation": 0,
            "wallHeight": 10,
            "rooms": [],
            "walls": [],
            "openings": [],
            "furniture": [],
        }],
        "metadata": {"version": 1, "status": "draft"},
        "name": name,
    }


def _latest_version(db: Session, project: Project) -> DesignVersion | None:
    stmt = (
        select(DesignVersion)
        .where(DesignVersion.project_id == project.id)
        .order_by(DesignVersion.version_number.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def _room_count(design: dict[str, Any] | None) -> int:
    if not design:
        return 0
    return sum(len(level.get("rooms", [])) for level in design.get("levels", []))


def _get_owned_project(db: Session, project_id: UUID, user: User) -> Project:
    project = db.get(Project, project_id)
    if not project or project.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _summarize(db: Session, project: Project) -> ProjectSummary:
    latest = _latest_version(db, project)
    design = latest.design_json if latest else None
    plot = (design or {}).get("plot", {})
    return ProjectSummary.model_validate({
        **project.__dict__,
        "room_count": _room_count(design),
        "plot_width": plot.get("width", 0),
        "plot_length": plot.get("length", 0),
    })


@router.post("", status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = _Auth) -> ProjectSummary:
    project = Project(owner_id=user.id, name=payload.name, units=payload.units, current_version=1)
    db.add(project)
    db.flush()

    design = _initial_design(project.id, payload.name, payload.units, payload.plot_width, payload.plot_length)
    db.add(DesignVersion(project_id=project.id, version_number=1, design_json=design))
    db.commit()
    db.refresh(project)

    return _summarize(db, project)


@router.get("")
def list_projects(db: Session = Depends(get_db), user: User = _Auth) -> list[ProjectSummary]:
    stmt = select(Project).where(Project.owner_id == user.id).order_by(Project.updated_at.desc())
    projects = db.execute(stmt).scalars().all()

    return [_summarize(db, project) for project in projects]


@router.get("/{project_id}")
def get_project(project_id: UUID, db: Session = Depends(get_db), user: User = _Auth) -> ProjectDetail:
    project = _get_owned_project(db, project_id, user)
    latest = _latest_version(db, project)
    return ProjectDetail.model_validate({**project.__dict__, "design": latest.design_json if latest else {}})


@router.patch("/{project_id}")
def rename_project(project_id: UUID, payload: ProjectRename, db: Session = Depends(get_db), user: User = _Auth) -> ProjectSummary:
    project = _get_owned_project(db, project_id, user)
    project.name = payload.name
    db.commit()
    db.refresh(project)
    return _summarize(db, project)


@router.post("/{project_id}/duplicate", status_code=201)
def duplicate_project(project_id: UUID, db: Session = Depends(get_db), user: User = _Auth) -> ProjectSummary:
    source = _get_owned_project(db, project_id, user)
    latest = _latest_version(db, source)

    copy = Project(owner_id=user.id, name=f"{source.name} (copy)", units=source.units, current_version=1)
    db.add(copy)
    db.flush()

    design = dict(latest.design_json) if latest else _initial_design(copy.id, copy.name, copy.units, 30, 40)
    design["projectId"] = str(copy.id)
    design["name"] = copy.name
    db.add(DesignVersion(project_id=copy.id, version_number=1, design_json=design))
    db.commit()
    db.refresh(copy)
    return _summarize(db, copy)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: UUID, db: Session = Depends(get_db), user: User = _Auth) -> None:
    project = _get_owned_project(db, project_id, user)
    db.delete(project)
    db.commit()


@router.put("/{project_id}/design")
def save_design(project_id: UUID, payload: dict[str, Any], db: Session = Depends(get_db), user: User = _Auth) -> dict[str, Any]:
    project = _get_owned_project(db, project_id, user)

    issues = validate_floor_plan(payload)
    if issues:
        raise HTTPException(status_code=422, detail={"issues": issues})

    next_version = project.current_version + 1
    db.add(DesignVersion(project_id=project.id, version_number=next_version, design_json=payload))
    project.current_version = next_version
    db.commit()

    return {"projectId": str(project_id), "version": next_version, "status": "saved"}
