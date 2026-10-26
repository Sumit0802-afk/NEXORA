"""Vertical-circulation checks for generated or edited plans (mirrors apps/web/src/lib/circulation.ts).

Geometry only, for axis-aligned room rectangles: stacked staircases, floor elevations, access to terraces and
furniture kept inside the plot. This is not a building-code or structural check.
"""

import re
from typing import Any

_EPS = 0.05
MIN_CONNECTION = 2.5
MIN_STACK_OVERLAP = 0.8
_TERRACE_NAME = re.compile(r"terrace|roof|deck|balcony|sit-?out", re.I)


def _rect(room: dict[str, Any]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in room["polygon"]]
    ys = [p[1] for p in room["polygon"]]
    return min(xs), min(ys), max(xs), max(ys)


def is_terrace(room: dict[str, Any]) -> bool:
    if room.get("type") == "balcony":
        return True
    return room.get("type") == "other" and bool(_TERRACE_NAME.search(room.get("name", "")))


def _overlap(a: tuple, b: tuple) -> float:
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return w * h if w > 0 and h > 0 else 0.0


def _shared_edge(a: tuple, b: tuple) -> float:
    if abs(a[2] - b[0]) <= _EPS or abs(b[2] - a[0]) <= _EPS:
        return max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    if abs(a[3] - b[1]) <= _EPS or abs(b[3] - a[1]) <= _EPS:
        return max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    return 0.0


def _reachable(rooms: list[dict], rects: dict[str, tuple], start: dict) -> set[str]:
    seen = {start["id"]}
    queue = [start]
    while queue:
        cur = queue.pop(0)
        if cur["id"] != start["id"] and cur.get("type") == "bathroom":
            continue  # a bathroom is a dead end, not a through-route
        for nxt in rooms:
            if nxt["id"] in seen:
                continue
            if _shared_edge(rects[cur["id"]], rects[nxt["id"]]) >= MIN_CONNECTION:
                seen.add(nxt["id"])
                queue.append(nxt)
    return seen


def circulation_issues(design: dict[str, Any]) -> list[dict[str, str]]:
    """Problems with stairs, floor elevations and terrace access. Empty list = sound."""
    issues: list[dict[str, str]] = []
    levels = design.get("levels") or []
    multi = len(levels) > 1

    expected = 0.0
    for i, level in enumerate(levels):
        height = level.get("wallHeight", 0)
        if not height or height <= 0:
            issues.append({"code": "invalid_height", "message": f"Floor {i} has an invalid storey height."})
            continue
        if abs(level.get("elevation", 0) - expected) > _EPS:
            issues.append({"code": "invalid_elevation", "message": f"Floor {i} does not start where the floor below ends."})
        expected += height

    stairs = [[r for r in lvl.get("rooms", []) if r.get("type") == "staircase"] for lvl in levels]
    if multi:
        for i, found in enumerate(stairs):
            if not found:
                issues.append({"code": "no_staircase", "message": f"Floor {i} has no staircase."})
        for i in range(1, len(levels)):
            for stair in stairs[i]:
                r = _rect(stair)
                area = max((r[2] - r[0]) * (r[3] - r[1]), _EPS)
                best = max((_overlap(r, _rect(b)) / area for b in stairs[i - 1]), default=0.0)
                if stairs[i - 1] and best < MIN_STACK_OVERLAP:
                    issues.append({"code": "stair_offset", "message": f"The staircase on floor {i} does not line up with the one below."})

    for i, level in enumerate(levels):
        rooms = level.get("rooms", [])
        rects = {r["id"]: _rect(r) for r in rooms}
        for stair in stairs[i]:
            if not any(r["id"] != stair["id"] and _shared_edge(rects[stair["id"]], rects[r["id"]]) >= MIN_CONNECTION for r in rooms):
                issues.append({"code": "blocked_staircase", "message": f"The staircase on floor {i} is walled in."})
        if i == 0 or not stairs[i]:
            continue
        reach = _reachable(rooms, rects, stairs[i][0])
        for room in rooms:
            if is_terrace(room) and room["id"] not in reach:
                issues.append({"code": "terrace_unreachable", "message": f"{room.get('name', 'Terrace')} on floor {i} cannot be reached from the staircase."})

    plot = design.get("plot") or {}
    for i, level in enumerate(levels):
        for item in level.get("furniture", []) or []:
            if not isinstance(item, dict) or "position" not in item:
                continue
            dim = item.get("dimensions") or {}
            scale = item.get("scale") or [1, 1, 1]
            w, d = dim.get("width", 0) * scale[0], dim.get("depth", 0) * scale[2]
            x, y = item["position"][0], item["position"][1]
            if x - w / 2 < -_EPS or y - d / 2 < -_EPS or x + w / 2 > plot.get("width", 0) + _EPS or y + d / 2 > plot.get("length", 0) + _EPS:
                issues.append({"code": "furniture_outside_plot", "message": f"{item.get('name', 'An object')} on floor {i} is outside the plot."})
    return issues
