from fastapi import APIRouter
from pydantic import BaseModel

from app.domain.geometry import spatial_issues, validate_floor_plan

router = APIRouter(prefix="/projects", tags=["validation"])


class ValidateRequest(BaseModel):
    design: dict


@router.post("/{project_id}/validate")
def validate_design(project_id: str, payload: ValidateRequest) -> dict:
    issues = validate_floor_plan(payload.design)
    if not issues:
        issues = spatial_issues(payload.design)
    return {"projectId": project_id, "valid": len(issues) == 0, "issues": issues}
