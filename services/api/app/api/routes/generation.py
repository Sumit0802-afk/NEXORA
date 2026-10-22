from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.domain.ai import AIUnavailable, ai_explain_candidates, ai_read_brief, ai_status
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
    floors: int = Field(default=0, ge=0, le=4, description="0 reads the floor count from the brief.")

    model_config = {"populate_by_name": True}


def _generate(payload: LayoutRequest) -> dict:
    ai = {**ai_status(), "used": False, "error": None}
    requirements = None
    if ai["enabled"]:
        try:
            requirements = ai_read_brief(payload.room_list, payload.description, payload.floors)
            ai["used"] = True
        except AIUnavailable as err:
            ai["error"] = str(err)
    if requirements is None:
        requirements = parse_requirements(payload.room_list, payload.description, payload.floors)
    try:
        result = generate_candidates(requirements, payload.plot_width, payload.plot_length, payload.units, payload.seed)
    except PlotTooSmall as err:
        raise HTTPException(status_code=422, detail=str(err)) from err
    if ai["enabled"] and not ai["error"] and result["candidates"]:
        brief = "\n".join(part for part in (payload.room_list, payload.description) if part.strip())
        try:
            notes = ai_explain_candidates(result["candidates"], brief, payload.units)
            for candidate in result["candidates"]:
                candidate["explanation"] = notes.get(candidate["id"])
            ai["used"] = True
        except AIUnavailable as err:
            ai["error"] = str(err)
    message = None
    if not result["candidates"]:
        reasons = sorted({r for rejected in result["rejected"] for r in rejected["reasons"]})
        message = ("No layout fits these rooms on this plot. "
                   + (f"For example: {reasons[0]} " if reasons else "")
                   + ("Try a larger plot, fewer rooms or another floor." if requirements.floors < 4
                      else "Try a larger plot or fewer rooms."))
    reading = requirements.as_dict()
    reading["notes"] += result.get("notes", [])
    return {
        "requirements": reading,
        "floors": result.get("floors", []),
        "candidates": result["candidates"],
        "rejectedCount": len(result["rejected"]),
        "message": message,
        "ai": ai,
        "disclaimer": "Generated plans are conceptual starting points, not construction drawings.",
    }


@layouts_router.get("/ai-status")
def get_ai_status() -> dict:
    """Whether Claude is configured, so the brief form can say so. Never exposes the key."""
    return ai_status()


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
