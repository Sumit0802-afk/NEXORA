"""Turns a free-text room list + description into normalized room counts.

Deterministic keyword parsing only; an LLM parser can later produce the same
`RoomRequirements` shape without changing the generator.
"""

import re
from dataclasses import dataclass, field

ROOM_TYPES = (
    "living_room", "dining_room", "kitchen", "bedroom", "bathroom",
    "staircase", "parking", "study", "utility", "hallway",
)

# Longest phrases first so "living room" wins over "room", "car parking" over "car".
_SYNONYMS: list[tuple[str, str]] = sorted([
    ("master bedroom", "bedroom"), ("guest bedroom", "bedroom"), ("bedrooms", "bedroom"), ("bedroom", "bedroom"),
    ("bed rooms", "bedroom"), ("bed room", "bedroom"), ("beds", "bedroom"), ("bhk", "bedroom"),
    ("bathrooms", "bathroom"), ("bathroom", "bathroom"), ("baths", "bathroom"), ("bath", "bathroom"),
    ("washrooms", "bathroom"), ("washroom", "bathroom"), ("toilets", "bathroom"), ("toilet", "bathroom"),
    ("restrooms", "bathroom"), ("restroom", "bathroom"),
    ("kitchens", "kitchen"), ("kitchen", "kitchen"),
    ("living rooms", "living_room"), ("living room", "living_room"), ("living", "living_room"),
    ("drawing room", "living_room"), ("lounge", "living_room"), ("hall", "living_room"),
    ("dining rooms", "dining_room"), ("dining room", "dining_room"), ("dining", "dining_room"),
    ("staircases", "staircase"), ("staircase", "staircase"), ("stairs", "staircase"), ("stair", "staircase"),
    ("car parking", "parking"), ("parking", "parking"), ("garage", "parking"), ("carport", "parking"),
    ("study rooms", "study"), ("study room", "study"), ("study", "study"), ("office", "study"),
    ("home office", "study"),
    ("utility rooms", "utility"), ("utility room", "utility"), ("utility", "utility"), ("laundry", "utility"),
    ("store room", "utility"), ("storage", "utility"),
], key=lambda pair: -len(pair[0]))

_NUMBER_WORDS = {
    "a": 1, "an": 1, "one": 1, "single": 1, "two": 2, "double": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "ek": 1, "do": 2, "teen": 3, "char": 4,
}
_MAX_PER_TYPE = {"bedroom": 6, "bathroom": 6, "kitchen": 1, "living_room": 1, "dining_room": 1,
                 "staircase": 1, "parking": 2, "study": 2, "utility": 2, "hallway": 1}


@dataclass
class RoomRequirements:
    counts: dict[str, int] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"counts": dict(self.counts), "notes": list(self.notes)}


def _count_before(text: str, start: int) -> int | None:
    preceding = text[max(0, start - 12):start].strip().split()
    if not preceding:
        return None
    token = preceding[-1]
    if token.isdigit():
        return int(token)
    return _NUMBER_WORDS.get(token)


def _scan(text: str) -> dict[str, int]:
    found: dict[str, int] = {}
    taken = [False] * len(text)
    for phrase, room_type in _SYNONYMS:
        for match in re.finditer(rf"(?<![a-z]){re.escape(phrase)}(?![a-z])", text):
            if any(taken[match.start():match.end()]):
                continue
            for i in range(match.start(), match.end()):
                taken[i] = True
            if phrase == "bhk":
                count = _count_before(text, match.start()) or 1
                found["bedroom"] = max(found.get("bedroom", 0), count)
                found.setdefault("living_room", 1)
                found.setdefault("kitchen", 1)
                continue
            count = _count_before(text, match.start())
            found[room_type] = max(found.get(room_type, 0), count or 1)
    return found


def parse_requirements(room_list: str, description: str = "") -> RoomRequirements:
    """Room list counts win; the description only adds room types the list didn't mention."""
    listed = _scan(room_list.lower())
    described = _scan(description.lower())
    counts = dict(listed)
    notes: list[str] = []
    for room_type, count in described.items():
        if room_type not in counts:
            counts[room_type] = count
            notes.append(f"Added {room_type.replace('_', ' ')} from your description.")

    if not counts:
        counts = {"living_room": 1, "kitchen": 1, "bedroom": 1, "bathroom": 1}
        notes.append("No rooms recognised — using a starter 1-bedroom programme.")
    counts.setdefault("living_room", 1)
    counts.setdefault("kitchen", 1)
    if counts.get("bedroom", 0) and not counts.get("bathroom"):
        counts["bathroom"] = 1
        notes.append("Added one bathroom for the bedrooms.")

    for room_type, cap in _MAX_PER_TYPE.items():
        if counts.get(room_type, 0) > cap:
            counts[room_type] = cap
            notes.append(f"Capped {room_type.replace('_', ' ')} count at {cap} for a single floor.")
    counts.pop("hallway", None)
    ordered = {t: counts[t] for t in ROOM_TYPES if counts.get(t)}
    return RoomRequirements(counts=ordered, notes=notes)
