from typing import Any

_EPS = 0.05


def _bounds(polygon: list) -> tuple[float, float, float, float]:
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


def spatial_issues(design: dict[str, Any]) -> list[dict[str, str]]:
    """Room-in-plot, positive-size and overlap checks for axis-aligned rooms.

    Kept separate from `validate_floor_plan` so saving a work-in-progress plan
    from the editor is never blocked by these stricter rules.
    """
    issues: list[dict[str, str]] = []
    plot = design.get("plot") or {}
    width, length = plot.get("width", 0), plot.get("length", 0)
    for level in design.get("levels") or []:
        rooms = [r for r in level.get("rooms", []) if isinstance(r, dict) and len(r.get("polygon") or []) >= 3]
        boxes = [(r.get("name", r.get("id", "room")), _bounds(r["polygon"])) for r in rooms]
        for name, (x0, y0, x1, y1) in boxes:
            if x1 - x0 <= 0 or y1 - y0 <= 0:
                issues.append({"code": "room_zero_size", "message": f"{name} has no area."})
            if x0 < -_EPS or y0 < -_EPS or x1 > width + _EPS or y1 > length + _EPS:
                issues.append({"code": "room_outside_plot", "message": f"{name} extends outside the plot."})
        for i, (name_a, a) in enumerate(boxes):
            for name_b, b in boxes[i + 1:]:
                if a[0] < b[2] - _EPS and a[2] > b[0] + _EPS and a[1] < b[3] - _EPS and a[3] > b[1] + _EPS:
                    issues.append({"code": "room_overlap", "message": f"{name_a} overlaps {name_b}."})
        wall_lengths = {
            w.get("id"): abs(w["end"][0] - w["start"][0]) + abs(w["end"][1] - w["start"][1])
            for w in level.get("walls", []) if isinstance(w, dict) and "start" in w and "end" in w
        }
        for opening in level.get("openings", []):
            length_of_wall = wall_lengths.get(opening.get("wallId"))
            if length_of_wall is None:
                issues.append({"code": "opening_without_wall", "message": f"{opening.get('id')} is not on a wall."})
                continue
            half = opening.get("width", 0) / 2
            if opening.get("offset", 0) - half < -_EPS or opening.get("offset", 0) + half > length_of_wall + _EPS:
                issues.append({"code": "opening_off_wall", "message": f"{opening.get('id')} runs past the end of its wall."})
    return issues


def validate_floor_plan(design: dict[str, Any]) -> list[dict[str, str]]:
    """Minimal structural checks; not a building-code or engineering validator."""
    issues: list[dict[str, str]] = []
    plot = design.get("plot")
    levels = design.get("levels")

    if not isinstance(plot, dict):
        issues.append({"code": "missing_plot", "message": "A plot object is required."})
    else:
        for dimension in ("width", "length"):
            value = plot.get(dimension)
            if not isinstance(value, (int, float)) or value <= 0:
                issues.append({"code": f"invalid_plot_{dimension}", "message": f"Plot {dimension} must be positive."})

    if not isinstance(levels, list) or not levels:
        issues.append({"code": "missing_levels", "message": "At least one floor level is required."})
        return issues

    for level_index, level in enumerate(levels):
        if not isinstance(level, dict):
            issues.append({"code": "invalid_level", "message": f"Level {level_index} must be an object."})
            continue
        rooms = level.get("rooms", [])
        if not isinstance(rooms, list):
            issues.append({"code": "invalid_rooms", "message": f"Level {level_index} rooms must be a list."})
            continue
        for room_index, room in enumerate(rooms):
            polygon = room.get("polygon") if isinstance(room, dict) else None
            if not isinstance(polygon, list) or len(polygon) < 3:
                issues.append({
                    "code": "invalid_room_polygon",
                    "message": f"Room {room_index} on level {level_index} needs at least 3 points.",
                })
                continue
            for point in polygon:
                if not isinstance(point, list) or len(point) != 2:
                    issues.append({
                        "code": "invalid_point",
                        "message": f"Room {room_index} has a point that is not [x, y].",
                    })
                    break
                if not all(isinstance(coord, (int, float)) for coord in point):
                    issues.append({
                        "code": "invalid_coordinate",
                        "message": f"Room {room_index} has non-numeric coordinates.",
                    })
                    break
    return issues
