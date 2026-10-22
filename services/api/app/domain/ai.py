"""Optional AI layer (Claude or Gemini) for the layout generator.

The model reads the free-text brief into room counts and explains the generated
candidates. Geometry stays rule-based and validated; when AI is off
(AI_PROVIDER=mock or no key) or a call fails, callers fall back to the
deterministic parser and show no explanations.
"""

import json
import logging
import time
from functools import lru_cache
from typing import Literal

import anthropic
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel, Field

from app.core.config import settings
from app.domain.layout import FLOOR_NAMES
from app.domain.requirements import ROOM_TYPES, RoomRequirements, normalize_counts

log = logging.getLogger(__name__)

DEFAULT_MODELS = {"anthropic": "claude-opus-5-5", "gemini": "gemini-3.5-flash"}
_FALLBACK_BETA = "server-side-fallback-2026-07-01"
_GEMINI_SPARE = "gemini-3.5-flash"

RoomType = Literal[
    "living_room", "dining_room", "kitchen", "bedroom", "bathroom",
    "staircase", "parking", "study", "utility",
]


class AIUnavailable(Exception):
    """Claude is not configured or the call failed; use the rule-based path."""


class _RoomCount(BaseModel):
    type: RoomType
    count: int = Field(ge=1, le=10)


class _BriefReading(BaseModel):
    rooms: list[_RoomCount]
    floors: int = Field(default=1, ge=1, le=4, description="Total floors including the ground floor: G+1 or duplex is 2.")
    notes: list[str] = Field(description="Short notes on how the brief was read, e.g. assumptions made.")


class _CandidateNote(BaseModel):
    id: str
    headline: str = Field(description="One sentence on what this layout is best for.")
    pros: list[str]
    cons: list[str]


class _Explanations(BaseModel):
    candidates: list[_CandidateNote]


def _provider() -> str:
    return settings.ai_provider.strip().lower()


def _model() -> str:
    return settings.ai_model.strip() or DEFAULT_MODELS[_provider()]


def ai_enabled() -> bool:
    return _provider() in DEFAULT_MODELS and bool(settings.ai_api_key.strip())


def ai_status() -> dict:
    return {"enabled": ai_enabled(), "provider": _provider(), "model": _model() if ai_enabled() else None}


@lru_cache(maxsize=1)
def _client(api_key: str) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key, timeout=60.0, max_retries=1)


@lru_cache(maxsize=1)
def _gemini_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key, http_options=genai_types.HttpOptions(timeout=30_000))


def _parse(system: str, prompt: str, schema: type[BaseModel]) -> BaseModel:
    if not ai_enabled():
        raise AIUnavailable("AI is turned off.")
    if _provider() == "gemini":
        return _parse_gemini(system, prompt, schema)
    try:
        response = _client(settings.ai_api_key.strip()).messages.parse(
            model=_model(),
            max_tokens=8000,
            output_config={"effort": "low"},
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_format=schema,
            # Re-run on Anthropic's recommended model if a safety classifier declines.
            extra_headers={"anthropic-beta": _FALLBACK_BETA},
            extra_body={"fallbacks": "default"},
        )
    except anthropic.AuthenticationError as err:
        raise AIUnavailable("The AI API key was rejected.") from err
    except anthropic.RateLimitError as err:
        raise AIUnavailable("The AI service is rate limited; try again shortly.") from err
    except anthropic.APIStatusError as err:
        log.warning("Claude request failed: %s", err)
        raise AIUnavailable(f"The AI service returned an error ({err.status_code}).") from err
    except anthropic.APIConnectionError as err:
        raise AIUnavailable("Could not reach the AI service.") from err
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise AIUnavailable("The AI could not read this request.")
    return response.parsed_output


def _gemini_generate(system: str, prompt: str, schema: type[BaseModel]):
    config = genai_types.GenerateContentConfig(
        system_instruction=system, response_mime_type="application/json", response_schema=schema,
    )
    client = _gemini_client(settings.ai_api_key.strip())
    # Gemini returns 503 during demand spikes: retry once, then move to the stable Flash alias.
    attempts = [_model(), _model()]
    if _GEMINI_SPARE not in attempts:
        attempts.append(_GEMINI_SPARE)
    for i, model in enumerate(attempts):
        try:
            return client.models.generate_content(model=model, contents=prompt, config=config)
        except genai_errors.ServerError:
            if i == len(attempts) - 1:
                raise
            log.info("Gemini %s busy, retrying with %s", model, attempts[i + 1])
            time.sleep(1.5)


def _parse_gemini(system: str, prompt: str, schema: type[BaseModel]) -> BaseModel:
    try:
        response = _gemini_generate(system, prompt, schema)
    except genai_errors.ClientError as err:
        if err.code in (401, 403) or "API key" in str(err):
            raise AIUnavailable("The AI API key was rejected.") from err
        if err.code == 429:
            raise AIUnavailable("The AI free quota is used up for now; try again later or change AI_MODEL.") from err
        if err.code == 404:
            raise AIUnavailable(f"The AI model '{_model()}' was not found; check AI_MODEL.") from err
        log.warning("Gemini request failed: %s", err)
        raise AIUnavailable(f"The AI service returned an error ({err.code}).") from err
    except genai_errors.ServerError as err:
        log.warning("Gemini request failed: %s", err)
        raise AIUnavailable("The AI service is busy right now; try again in a minute.") from err
    except genai_errors.APIError as err:
        log.warning("Gemini request failed: %s", err)
        raise AIUnavailable(f"The AI service returned an error ({err.code}).") from err
    except OSError as err:
        raise AIUnavailable("Could not reach the AI service.") from err
    parsed = response.parsed
    if isinstance(parsed, schema):
        return parsed
    try:
        return schema.model_validate_json(response.text or "")
    except ValueError as err:
        raise AIUnavailable("The AI could not read this request.") from err


_BRIEF_SYSTEM = (
    "You read house briefs for a residential floor plan generator (ground floor plus up to 3 upper floors). "
    "Turn the user's room list and description (English, Hindi or Hinglish) into room counts. "
    f"Allowed room types: {', '.join(t for t in ROOM_TYPES if t != 'hallway')}. "
    "The room list is authoritative; the description only adds rooms it implies "
    "(e.g. '3BHK' means 3 bedrooms plus living room and kitchen; 'pooja room' or 'store' map to utility; "
    "'garage' or 'car' to parking; 'office' to study). Do not invent rooms the brief does not ask or imply. "
    "Floors: count the ground floor, so 'G+1', 'duplex', 'double floor' or 'do manzil' is 2 and 'G+2' is 3; "
    "use 1 when the brief does not mention floors. Room counts are totals for the whole house. "
    "Notes are short and plain, at most 4, and mention any request you could not map to a room type."
)


def ai_read_brief(room_list: str, description: str, floors: int = 0) -> RoomRequirements:
    """`floors` > 0 is the user's explicit choice and wins over what the model reads."""
    prompt = f"Room list:\n{room_list or '(none)'}\n\nDescription:\n{description or '(none)'}"
    reading = _parse(_BRIEF_SYSTEM, prompt, _BriefReading)
    counts: dict[str, int] = {}
    for room in reading.rooms:
        counts[room.type] = counts.get(room.type, 0) + room.count
    return normalize_counts(counts, reading.notes[:4], floors or reading.floors)


_EXPLAIN_SYSTEM = (
    "You explain generated house floor plan options to a homeowner in plain, friendly English. "
    "Use only the facts given (rooms, sizes, scores, highlights, warnings); never invent features. "
    "For each candidate give a one-sentence headline on who or what it suits, 1-3 pros and 0-2 cons. "
    "Keep every line under 20 words. Return the candidate ids exactly as given."
)


def _candidate_facts(candidate: dict, units: str) -> dict:
    rooms = []
    levels = candidate["design"]["levels"]
    for index, level in enumerate(levels):
        floor = f"{FLOOR_NAMES[index]}: " if len(levels) > 1 else ""
        for room in level["rooms"]:
            (x0, y0), (x1, y1) = room["polygon"][0], room["polygon"][2]
            rooms.append(f"{floor}{room['name']} ({room['type']}) {round(x1 - x0, 1)}x{round(y1 - y0, 1)} {units}")
    return {"id": candidate["id"], "label": candidate["label"], "summary": candidate["summary"],
            "score": candidate["score"], "scores": candidate["scores"], "highlights": candidate["highlights"],
            "warnings": candidate["warnings"], "rooms": rooms}


def ai_explain_candidates(candidates: list[dict], brief: str, units: str) -> dict[str, dict]:
    if not candidates:
        return {}
    facts = [_candidate_facts(c, units) for c in candidates]
    prompt = (f"Homeowner's brief:\n{brief or '(not given)'}\n\n"
              "Street is at the front (y = 0). Candidates:\n" + json.dumps(facts, indent=1))
    result = _parse(_EXPLAIN_SYSTEM, prompt, _Explanations)
    known = {c["id"] for c in candidates}
    return {note.id: {"headline": note.headline, "pros": note.pros[:3], "cons": note.cons[:2]}
            for note in result.candidates if note.id in known}
