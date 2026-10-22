from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.domain.layout import PlotTooSmall, generate_candidates
from app.domain.requirements import parse_requirements

router = APIRouter(prefix="/projects", tags=["generation"])
layouts_router = APIRouter(prefix="/layouts", tags=["generation"])


class LayoutRequest(BaseModel):
    room_list: str = Field(default="", max_length=2000, alias="roomList")
    description: str = Field(default="", max_length=10000)
    plot_width: float = Field(gt=0, le=1000, alias="plotWidth")
    plot_length: float = Field(gt=0, le=1000, alias="plotLength")
    units: str = Field(default="ft", pattern="^(ft|m)$")
    seed: int = Field(default=0, ge=0, le=1_000_000)

    model_config = {"populate_by_name": True}


def _generate(payload: LayoutRequest) -> dict:
    requirements = parse_requirements(payload.room_list, payload.description)
    try:
        result = generate_candidates(requirements, payload.plot_width, payload.plot_length, payload.units, payload.seed)
    except PlotTooSmall as err:
        raise HTTPException(status_code=422, detail=str(err)) from err
    message = None
    if not result["candidates"]:
        reasons = sorted({r for rejected in result["rejected"] for r in rejected["reasons"]})
        message = ("No layout fits these rooms on this plot. "
                   + (f"For example: {reasons[0]} " if reasons else "")
                   + "Try a larger plot or fewer rooms.")
    return {
        "requirements": requirements.as_dict(),
        "candidates": result["candidates"],
        "rejectedCount": len(result["rejected"]),
        "message": message,
        "disclaimer": "Generated plans are conceptual starting points, not construction drawings.",
    }


@layouts_router.post("/generate")
def generate_layouts(payload: LayoutRequest) -> dict:
    """Rule-based layout candidates, validated by the geometry engine. Synchronous: generation takes milliseconds."""
    return _generate(payload)


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=10, max_length=10000)
    plot_width: float = Field(gt=0, le=10000)
    plot_length: float = Field(gt=0, le=10000)
    units: str = Field(default="ft", pattern="^(ft|m)$")
    required_rooms: list[str] = Field(default_factory=list, max_length=40)


@router.post("/{project_id}/generate")
def start_generation(project_id: str, payload: GenerateRequest) -> dict:
    result = _generate(LayoutRequest(
        roomList=", ".join(payload.required_rooms), description=payload.prompt,
        plotWidth=payload.plot_width, plotLength=payload.plot_length, units=payload.units,
    ))
    return {"jobId": str(uuid4()), "projectId": project_id, "status": "completed", **result}


@router.get("/../jobs/{job_id}")
def get_generation_job(job_id: str) -> dict:
    # TODO: replace with a proper /api/jobs/{job_id} router and persistent job store.
    return {"jobId": job_id, "status": "not_implemented"}
