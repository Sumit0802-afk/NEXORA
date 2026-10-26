"""Rule-based floor-plan candidate generator.

Each template is a guillotine tree (nested front-to-back / side-to-side splits).
Space along a split goes to each room's minimum size first, then the rest is
shared by preferred size, so rooms tile the plot exactly — inside the boundary
and non-overlapping by construction. Candidates are then checked by the
geometry engine and hard constraints, and ranked with a soft score.

Multi-floor houses reuse the ground floor's room grid on every upper floor and
relabel it (bedrooms, baths over baths, family lounge, terraces), so walls,
the staircase and wet areas stack. Open ground (yards, garden) stays open to sky.

Plan coordinates: x across the plot width, y from the street front (y = 0)
to the rear. Generated plans are conceptual, not construction drawings.
"""

import random
from dataclasses import dataclass, field
from typing import Any

from app.domain.geometry import spatial_issues, validate_floor_plan
from app.domain.requirements import RoomRequirements

M_PER_FT = 0.3048

# type: (preferred width ft, preferred depth ft, minimum side ft, max aspect ratio)
PROGRAM: dict[str, tuple[float, float, float, float]] = {
    "living_room": (14, 16, 10, 2.2),
    "dining_room": (10, 11, 8, 2.2),
    "kitchen": (10, 11, 7, 2.4),
    "bedroom": (12, 12, 9, 2.0),
    "bathroom": (5.5, 8, 4.5, 2.6),
    "staircase": (8, 7.5, 3.5, 3.6),
    "parking": (10, 18, 9, 2.6),
    "study": (9, 10, 7, 2.2),
    "utility": (5, 6, 4, 2.8),
    "hallway": (3.5, 3.5, 3, 60.0),
    "other": (10, 10, 4, 14.0),
}
MASTER_BEDROOM = (13, 13)
CAR_LENGTH_FT = 15.0
CORRIDOR_FT = 3.5
DOOR_FT, MAIN_DOOR_FT, WINDOW_FT, BATH_WINDOW_FT, LIVING_WINDOW_FT = 3.0, 3.5, 4.0, 2.0, 5.0
HABITABLE = {"bedroom", "living_room", "kitchen", "dining_room", "study"}
FLOOR_HEIGHT_FT = 10.0
LEVEL_IDS = ("ground", "first", "second", "third")
FLOOR_NAMES = ("Ground floor", "First floor", "Second floor", "Third floor")


class PlotTooSmall(ValueError):
    pass


# ── Guillotine tree ──────────────────────────────────────────────────────────

@dataclass
class Leaf:
    key: str
    room_type: str
    name: str
    pref_w: float
    pref_d: float
    min_side: float
    fixed: float | None = None  # fixed thickness along the parent split axis (passages)
    min_d: float | None = None  # stricter minimum along y (parking: car length toward the street)

    @property
    def area(self) -> float:
        return self.pref_w * self.pref_d


@dataclass
class Split:
    axis: str  # "y": children stacked front→rear; "x": children side by side
    children: list["Leaf | Split"] = field(default_factory=list)


Node = Leaf | Split


def _pref(node: Node, axis: str) -> float:
    if isinstance(node, Leaf):
        return node.fixed if node.fixed else (node.pref_w if axis == "x" else node.pref_d)
    vals = [_pref(c, axis) for c in node.children]
    return sum(vals) if node.axis == axis else max(vals)


def _min(node: Node, axis: str) -> float:
    if isinstance(node, Leaf):
        if node.fixed:
            return node.fixed
        return node.min_d if axis == "y" and node.min_d else node.min_side
    vals = [_min(c, axis) for c in node.children]
    return sum(vals) if node.axis == axis else max(vals)


def _collect(node: Node, out: dict[str, Leaf]) -> dict[str, Leaf]:
    if isinstance(node, Leaf):
        out[node.key] = node
    else:
        for child in node.children:
            _collect(child, out)
    return out


def _snap(value: float, step: float) -> float:
    return round(round(value / step) * step, 4)


def _sizes(children: list[Node], axis: str, span: float) -> list[float]:
    fixed = [c.fixed if isinstance(c, Leaf) and c.fixed else None for c in children]
    free = max(span - sum(f for f in fixed if f), 0.0)
    flex = [c for c, f in zip(children, fixed) if f is None]
    mins = [_min(c, axis) for c in flex]
    prefs = [max(_pref(c, axis), m) for c, m in zip(flex, mins)]
    total_min, total_pref = sum(mins), sum(prefs)
    if free >= total_pref:
        flex_sizes = [p * free / total_pref for p in prefs]
    elif free >= total_min and total_pref > total_min:
        t = (free - total_min) / (total_pref - total_min)
        flex_sizes = [m + (p - m) * t for m, p in zip(mins, prefs)]
    else:
        flex_sizes = [m * free / (total_min or 1) for m in mins]
    it = iter(flex_sizes)
    return [f if f is not None else next(it) for f in fixed]


def _place(node: Node, x0: float, y0: float, x1: float, y1: float, step: float, out: dict[str, tuple]) -> None:
    if isinstance(node, Leaf):
        out[node.key] = (x0, y0, x1, y1)
        return
    lo, hi = (x0, x1) if node.axis == "x" else (y0, y1)
    sizes = _sizes(node.children, node.axis, hi - lo)
    cursor = lo
    for i, (child, size) in enumerate(zip(node.children, sizes)):
        end = hi if i == len(node.children) - 1 else min(hi, _snap(cursor + size, step))
        if node.axis == "x":
            _place(child, cursor, y0, end, y1, step, out)
        else:
            _place(child, x0, cursor, x1, end, step, out)
        cursor = end


# ── Room programme ───────────────────────────────────────────────────────────

@dataclass
class Programme:
    leaves: dict[str, Leaf]
    bed_bath_pairs: list[tuple[str, str]]
    common_baths: list[str]
    bedrooms_solo: list[str]
    scale: float
    _store_n: int = 0
    _open_n: int = 0

    def leaf(self, key: str) -> Leaf:
        return self.leaves[key]

    def opt(self, *keys: str) -> list[Leaf]:
        return [self.leaves[k] for k in keys if k in self.leaves]

    def many(self, prefix: str) -> list[Leaf]:
        return [l for k, l in self.leaves.items() if k.startswith(prefix)]

    def store(self) -> Leaf:
        self._store_n += 1
        key = f"store{self._store_n}"
        w, d, m, _ = PROGRAM["utility"]
        leaf = Leaf(key, "utility", "Store", w * self.scale, d * self.scale, m * self.scale)
        self.leaves[key] = leaf
        return leaf


def _make_leaf(key: str, room_type: str, name: str, scale: float, dims: tuple[float, float] | None = None) -> Leaf:
    w, d, m, _ = PROGRAM[room_type]
    if dims:
        w, d = dims
    return Leaf(key, room_type, name, w * scale, d * scale, m * scale)


def _build_programme(counts: dict[str, int], scale: float) -> Programme:
    leaves: dict[str, Leaf] = {}
    for room_type, key, name in (("living_room", "living", "Living Room"), ("dining_room", "dining", "Dining"),
                                 ("kitchen", "kitchen", "Kitchen"), ("staircase", "stair", "Staircase")):
        if counts.get(room_type):
            leaves[key] = _make_leaf(key, room_type, name, scale)
    for room_type, key, name in (("parking", "parking", "Parking"), ("study", "study", "Study"), ("utility", "utility", "Utility")):
        n = counts.get(room_type, 0)
        for i in range(n):
            k = f"{key}{i + 1}" if n > 1 else key
            leaves[k] = _make_leaf(k, room_type, f"{name} {i + 1}" if n > 1 else name, scale)
            if room_type == "parking":
                leaves[k].min_d = CAR_LENGTH_FT * scale

    n_bed, n_bath = counts.get("bedroom", 0), counts.get("bathroom", 0)
    beds = []
    for i in range(n_bed):
        key = f"bed{i + 1}"
        master = i == 0 and n_bed > 1
        name = "Master Bedroom" if master else (f"Bedroom {i + 1}" if n_bed > 1 else "Bedroom")
        leaves[key] = _make_leaf(key, "bedroom", name, scale, MASTER_BEDROOM if master else None)
        beds.append(key)

    # Baths: one common bath off the passage when baths are scarce, the rest attached to bedrooms.
    if n_bath > n_bed:
        attached, common = n_bed, n_bath - n_bed
    elif n_bath <= 1:
        attached, common = 0, n_bath
    else:
        attached, common = n_bath - 1, 1
    pairs, commons = [], []
    for i in range(attached):
        key = f"bath{i + 1}"
        leaves[key] = _make_leaf(key, "bathroom", "Attached Bath" if attached == 1 else f"Bath {i + 1}", scale)
        leaves[key].fixed = 6 * scale
        pairs.append((beds[i], key))
    for j in range(common):
        key = f"bath{attached + j + 1}"
        leaves[key] = _make_leaf(key, "bathroom", "Common Bath" if common == 1 else f"Common Bath {j + 1}", scale)
        commons.append(key)
    return Programme(leaves, pairs, commons, beds[attached:], scale)


def _corridor(p: Programme) -> Leaf:
    return Leaf("hall", "hallway", "Passage", CORRIDOR_FT * p.scale, CORRIDOR_FT * p.scale, 3 * p.scale, fixed=CORRIDOR_FT * p.scale)


def _garden(p: Programme, plot_w: float, plot_l: float, along: str) -> Leaf | None:
    target = sum(l.area for l in p.leaves.values())
    slack = plot_w * plot_l - target * 1.35
    if slack <= plot_w * plot_l * 0.12:
        return None
    if along == "y":
        return Leaf("garden", "other", "Garden / Open space", plot_w, slack / plot_w, 4 * p.scale)
    return Leaf("garden", "other", "Garden / Open space", slack / plot_l, plot_l, 4 * p.scale)


# ── Templates ────────────────────────────────────────────────────────────────

def _filled(p: "Programme", axis: str, nodes: list[Node], span: float, name: str) -> Split:
    """Rooms in a band keep sensible proportions; surplus span becomes open space instead of stretched rooms."""
    split = Split(axis, nodes)
    pref = _pref(split, axis)
    if span > pref * 1.3:
        p._open_n += 1
        extra = span - pref * 1.12
        other_pref = _pref(split, "y" if axis == "x" else "x")
        w, d = (extra, other_pref) if axis == "x" else (other_pref, extra)
        split.children.append(Leaf(f"open{p._open_n}", "other", name, w, d, 4 * p.scale))
    return split

def _bed_units(p: Programme, axis: str) -> list[Node]:
    """Bedroom (toward the passage) + its attached bath (toward the outside wall)."""
    units: list[Node] = [Split(axis, [p.leaf(bed), p.leaf(bath)]) for bed, bath in p.bed_bath_pairs]
    return units + [p.leaf(b) for b in p.bedrooms_solo]


def _service_columns(p: Programme, extra: list[Leaf]) -> list[Node]:
    """Small rooms that need passage access, each in its own column with a store behind."""
    cols: list[Node] = []
    for key in p.common_baths:
        cols.append(Split("y", [p.leaf(key), p.store()]))
    for leaf in extra:
        cols.append(leaf if leaf.room_type in ("study",) else Split("y", [leaf, p.store()]))
    return cols


def _pad_depth(p: Programme, nodes: list[Node], rear: bool) -> list[Node]:
    """Gives a shallow room a yard so a deep band doesn't stretch it (kitchen → utility yard, bedroom → yard)."""
    band_d = max(_pref(n, "y") for n in nodes)
    out: list[Node] = []
    for node in nodes:
        depth = _pref(node, "y")
        # Only single rooms: stacked columns (bed + bath, bath + store) already absorb extra depth.
        paddable = isinstance(node, Leaf) and node.room_type not in ("parking", "living_room")
        if depth >= band_d * 0.8 or not paddable:
            out.append(node)
            continue
        p._open_n += 1
        kitchen = isinstance(node, Leaf) and node.room_type == "kitchen"
        name = "Utility yard" if kitchen else ("Back yard" if rear else "Front lawn")
        filler = Leaf(f"open{p._open_n}", "other", name, _pref(node, "x"), band_d - depth, 3 * p.scale)
        out.append(Split("y", [node, filler] if rear else [filler, node]))
    return out


def _facing_passage_from_front(node: Node) -> Node:
    """Front-band stacks are mirrored front-to-back so the room that needs the passage still touches it."""
    return Split("y", list(reversed(node.children))) if isinstance(node, Split) and node.axis == "y" else node


def _balance(front: list[Node], rear: list[Node], movable: list[Node], width: float) -> None:
    """Move rooms across the passage while the rear band can't fit side by side."""
    for node in movable:
        if _min(Split("x", rear), "x") <= width:
            return
        candidate_front = front + [_facing_passage_from_front(node)]
        if _min(Split("x", candidate_front), "x") > width:
            continue
        rear.remove(node)
        front[:] = candidate_front


def _template_central(p: Programme, rng: random.Random, w: float, l: float, pad: bool) -> Node:
    front: list[Node] = list(p.many("parking")) + p.opt("living")
    if "dining" in p.leaves:
        front.append(Split("y", [p.leaf("dining"), p.leaf("stair")]) if "stair" in p.leaves else p.leaf("dining"))
    rear_extra = [x for x in p.opt("stair") if "dining" not in p.leaves] + p.many("study")
    utilities = p.many("utility")
    kitchen: Node = Split("y", [p.leaf("kitchen"), *utilities]) if utilities else p.leaf("kitchen")
    beds = _bed_units(p, "y")
    rng.shuffle(beds)
    service = _service_columns(p, rear_extra)
    rear = [kitchen, *service, *beds]
    _balance(front, rear, [*service, *reversed(beds)], w)
    if pad:
        front, rear = _pad_depth(p, front, rear=False), _pad_depth(p, rear, rear=True)
    bands: list[Node] = [_filled(p, "x", front, w, "Sit-out"), _corridor(p), _filled(p, "x", rear, w, "Back yard")]
    garden = _garden(p, w, l, "y")
    return Split("y", bands + ([garden] if garden else []))


def _template_wing(p: Programme, rng: random.Random, w: float, l: float, pad: bool) -> Node:
    front: list[Node] = list(p.many("parking")) + p.opt("living") + list(p.many("study"))
    kd = Split("y", [p.leaf("dining"), p.leaf("kitchen")]) if "dining" in p.leaves else p.leaf("kitchen")
    beds = _bed_units(p, "y")
    rng.shuffle(beds)
    service = _service_columns(p, p.opt("stair") + p.many("utility"))
    rear = [*beds, *service, kd]
    _balance(front, rear, [*service, *beds], w)
    if pad:
        front, rear = _pad_depth(p, front, rear=False), _pad_depth(p, rear, rear=True)
    bands: list[Node] = [_filled(p, "x", front, w, "Sit-out"), _corridor(p), _filled(p, "x", rear, w, "Back yard")]
    garden = _garden(p, w, l, "y")
    return Split("y", bands + ([garden] if garden else []))


def _template_side(p: Programme, rng: random.Random, w: float, l: float, pad: bool) -> Node:
    public: list[Node] = list(p.many("parking")) + p.opt("living", "dining", "kitchen") + list(p.many("utility"))
    beds = _bed_units(p, "x")
    rng.shuffle(beds)
    private: list[Node] = p.opt("stair") + beds + [p.leaf(c) for c in p.common_baths] + list(p.many("study"))
    cols: list[Node] = [_filled(p, "y", public, l, "Open space"), _corridor(p), _filled(p, "y", private, l, "Back yard")]
    garden = _garden(p, w, l, "x")
    return Split("x", cols + ([garden] if garden else []))


TEMPLATES = (
    ("central", "Central passage", "Living in front, bedrooms off a central passage at the rear.", _template_central),
    ("wing", "Kitchen-dining wing", "Kitchen and dining grouped as a rear wing beside the bedrooms.", _template_wing),
    ("side", "Public | private split", "Living spaces on one side, bedrooms on the other, joined by a passage.", _template_side),
)


# ── Geometry helpers ─────────────────────────────────────────────────────────

def _shared_edge(a: tuple, b: tuple, eps: float = 0.01):
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    for x, touching in ((ax1, abs(ax1 - bx0) < eps), (ax0, abs(ax0 - bx1) < eps)):
        lo, hi = max(ay0, by0), min(ay1, by1)
        if touching and hi - lo > eps:
            return ((x, lo), (x, hi))
    for y, touching in ((ay1, abs(ay1 - by0) < eps), (ay0, abs(ay0 - by1) < eps)):
        lo, hi = max(ax0, bx0), min(ax1, bx1)
        if touching and hi - lo > eps:
            return ((lo, y), (hi, y))
    return None


def _exterior_edges(r: tuple, w: float, l: float, eps: float = 0.01) -> list[tuple[str, tuple, tuple]]:
    x0, y0, x1, y1 = r
    edges = []
    if abs(y0) < eps:
        edges.append(("front", (x0, y0), (x1, y0)))
    if abs(y1 - l) < eps:
        edges.append(("rear", (x0, y1), (x1, y1)))
    if abs(x0) < eps:
        edges.append(("left", (x0, y0), (x0, y1)))
    if abs(x1 - w) < eps:
        edges.append(("right", (x1, y0), (x1, y1)))
    return edges


def _open_edges(c: "Candidate", key: str, w: float, l: float) -> list[tuple[str, tuple, tuple]]:
    """Walls that face outdoors: the plot boundary, or a yard / open-space room."""
    edges = _exterior_edges(c.rects[key], w, l)
    for other, rect in c.rects.items():
        if other != key and c.leaves[other].room_type == "other":
            seg = _shared_edge(c.rects[key], rect)
            if seg:
                edges.append(("yard", seg[0], seg[1]))
    return edges


def _seg_len(seg: tuple) -> float:
    (ax, ay), (bx, by) = seg
    return abs(bx - ax) + abs(by - ay)


DOOR_TARGETS = {
    "bedroom": ("hallway", "living_room", "dining_room"),
    "bathroom": ("hallway", "living_room", "dining_room"),
    "kitchen": ("dining_room", "hallway", "living_room"),
    "dining_room": ("living_room", "hallway", "kitchen"),
    "study": ("hallway", "living_room", "dining_room"),
    "utility": ("kitchen", "hallway", "dining_room", "staircase", "living_room"),
    "staircase": ("hallway", "living_room", "dining_room"),
    "hallway": ("living_room", "dining_room", "staircase"),
    "other": ("hallway", "living_room", "dining_room", "kitchen"),
    "parking": ("living_room",),
}


# ── Candidate assembly ───────────────────────────────────────────────────────

@dataclass
class Candidate:
    template: str
    mirrored: bool
    label: str
    summary: str
    rects: dict[str, tuple]
    leaves: dict[str, Leaf]
    pairs: list[tuple[str, str]]
    padded: bool = False


def _r(v: float) -> float:
    return round(v, 3)


def _assemble_design(c: Candidate, units: str, w: float, l: float, scale: float) -> tuple[dict, list[str], set[str]]:
    level, notes, has_door = _assemble_level(c, w, l, scale)
    design = {
        "schemaVersion": 1, "projectId": "", "units": units,
        "plot": {"width": w, "length": l, "floors": 1, "shape": "rectangle"},
        "levels": [level],
        "metadata": {"version": 1, "status": "generated"},
    }
    return design, notes, has_door


def _assemble_level(c: Candidate, w: float, l: float, scale: float, index: int = 0,
                    voids: frozenset[str] = frozenset()) -> tuple[dict, list[str], set[str]]:
    """Rooms, walls, doors and windows for one floor. `voids` are open-to-sky areas above the ground
    floor: they count as outdoors for windows but get no room, walls or doors."""
    prefix = "" if index == 0 else f"{LEVEL_IDS[index]}-"
    rooms: list[dict] = []
    walls: list[dict] = []
    openings: list[dict] = []
    notes: list[str] = []
    wall_ids: dict[tuple, str] = {}
    types = {k: c.leaves[k].room_type for k in c.rects}
    bath_of = {bed: bath for bed, bath in c.pairs}
    bed_of = {bath: bed for bed, bath in c.pairs}

    def wall_for(seg: tuple, kind: str) -> str:
        key = ((_r(seg[0][0]), _r(seg[0][1])), (_r(seg[1][0]), _r(seg[1][1])))
        if key not in wall_ids:
            wid = f"{prefix}wall-{len(wall_ids) + 1}"
            wall_ids[key] = wid
            walls.append({"id": wid, "start": list(key[0]), "end": list(key[1]),
                          "thickness": _r((0.75 if kind == "exterior" else 0.5) * scale),
                          "height": _r(10 * scale), "kind": kind})
        return wall_ids[key]

    def add_opening(kind: str, seg: tuple, width: float, wall_kind: str, at: float = 0.5) -> None:
        length = _seg_len(seg)
        width = min(width, length - 1.0 * scale)
        margin = width / 2 + 0.5 * scale
        offset = min(max(length * at, margin), length - margin)
        openings.append({"id": f"{prefix}{kind}-{len(openings) + 1}", "wallId": wall_for(seg, wall_kind), "kind": kind,
                         "offset": _r(offset), "width": _r(width)})

    for key, (x0, y0, x1, y1) in c.rects.items():
        if key in voids:
            continue
        leaf = c.leaves[key]
        rooms.append({"id": f"{prefix}room-{key}", "type": leaf.room_type, "name": leaf.name,
                      "polygon": [[_r(x0), _r(y0)], [_r(x1), _r(y0)], [_r(x1), _r(y1)], [_r(x0), _r(y1)]]})

    has_door: set[str] = set()
    entry_room, entry_side = None, None
    if index == 0:  # the main entrance is on the ground floor only
        entry_room = "living" if "living" in c.rects else "hall"
        entry_edges = sorted(_exterior_edges(c.rects[entry_room], w, l),
                             key=lambda e: (e[0] != "front", -_seg_len((e[1], e[2]))))
        entry_side = entry_edges[0][0] if entry_edges else None
        if entry_edges:
            add_opening("door", (entry_edges[0][1], entry_edges[0][2]), MAIN_DOOR_FT * scale, "exterior", at=0.3)
            has_door.add(entry_room)
        else:
            notes.append("No exterior wall is available for the main entrance.")

    door_min = DOOR_FT * scale + 1.0 * scale
    for key in c.rects:
        rtype = types[key]
        if rtype == "living_room" or key in voids:
            continue
        prefs = DOOR_TARGETS.get(rtype, ("hallway",))
        targets = [bed_of[key]] if key in bed_of else []
        targets += sorted((k for k in c.rects if k != key and types[k] in prefs and k != bath_of.get(key)
                           and k not in voids),
                          key=lambda k: prefs.index(types[k]))
        for other in targets:
            seg = _shared_edge(c.rects[key], c.rects[other])
            if seg and _seg_len(seg) >= door_min:
                # A door already cut into this shared wall serves both rooms; a second one would overlap it.
                if not any(o["wallId"] == wall_for(seg, "interior") and o["kind"] == "door" for o in openings):
                    add_opening("door", seg, DOOR_FT * scale, "interior")
                has_door.add(key)
                break
        else:
            if rtype not in ("hallway", "other", "parking"):
                notes.append(f"{c.leaves[key].name} has no wall shared with a passage or living space for a door.")

    for key in c.rects:
        rtype = types[key]
        if rtype not in HABITABLE and rtype != "bathroom":
            continue
        edges = _open_edges(c, key, w, l)
        if key == entry_room and entry_side:
            edges = [e for e in edges if e[0] != entry_side] or edges
        if not edges:
            continue
        side, a, b = max(edges, key=lambda e: _seg_len((e[1], e[2])))
        size = BATH_WINDOW_FT if rtype == "bathroom" else LIVING_WINDOW_FT if rtype == "living_room" else WINDOW_FT
        at = 0.72 if key == entry_room and side == entry_side else 0.5
        add_opening("window", (a, b), size * scale, "exterior", at=at)

    level = {"id": LEVEL_IDS[index], "elevation": _r(index * FLOOR_HEIGHT_FT * scale),
             "wallHeight": _r(FLOOR_HEIGHT_FT * scale), "rooms": rooms, "walls": walls,
             "openings": openings, "furniture": []}
    return level, notes, has_door


# ── Upper floors ─────────────────────────────────────────────────────────────

def split_floors(counts: dict[str, int], floors: int,
                 ground_beds: int | None = None) -> tuple[list[dict[str, int]], list[str]]:
    """Room counts per floor: shared rooms on the ground, bedrooms spread with the most upstairs,
    a bath on every floor that has bedrooms (and always on the ground), stairs on every floor."""
    if floors <= 1:
        return [dict(counts)], []
    notes: list[str] = []
    uppers = floors - 1
    n_bed = counts.get("bedroom", 0)
    ground_beds = n_bed // floors if ground_beds is None else min(ground_beds, n_bed)
    rest = n_bed - ground_beds
    beds = [ground_beds] + [rest // uppers + (1 if i < rest % uppers else 0) for i in range(uppers)]

    baths = [1] + [1 if b else 0 for b in beds[1:]]
    n_bath = counts.get("bathroom", 0)
    if n_bath < sum(baths):
        notes.append(f"Added {sum(baths) - n_bath} bathroom(s) so every floor with bedrooms has one.")
    for _ in range(max(n_bath - sum(baths), 0)):
        i = max(range(floors), key=lambda f: (beds[f] - baths[f], f))  # floor with most bedrooms per bath
        baths[i] += 1

    per_floor: list[dict[str, int]] = []
    for i in range(floors):
        floor = {t: n for t, n in counts.items() if t not in ("bedroom", "bathroom", "study")} if i == 0 else {}
        floor["staircase"] = 1
        if beds[i]:
            floor["bedroom"] = beds[i]
        if baths[i]:
            floor["bathroom"] = baths[i]
        per_floor.append(floor)
    if counts.get("study"):
        per_floor[1]["study"] = counts["study"]
    return per_floor, notes


def _stack_floor(ground: Candidate, want: dict[str, int], scale: float, step: float,
                 bed_start: int) -> tuple["Candidate | None", frozenset[str], str]:
    """Relabels the ground floor's room grid for an upper floor so walls and stairs line up."""
    tol = step / 2 + 1e-6
    door_min = DOOR_FT * scale + 1.0 * scale
    leaves: dict[str, Leaf] = {}
    voids, dry, wet = set(), [], []

    def size(k: str) -> tuple[float, float]:
        x0, y0, x1, y1 = ground.rects[k]
        return x1 - x0, y1 - y0

    def area(k: str) -> float:
        return size(k)[0] * size(k)[1]

    def fits(k: str, rtype: str) -> bool:
        short, long_ = sorted(size(k))
        return short + tol >= PROGRAM[rtype][2] * scale and long_ / max(short, 1e-6) <= PROGRAM[rtype][3]

    def put(k: str, rtype: str, name: str) -> None:
        w_, d_ = size(k)
        leaves[k] = Leaf(k, rtype, name, w_, d_, PROGRAM[rtype][2] * scale)

    for key in ground.rects:
        g = ground.leaves[key]
        if g.room_type == "other":
            voids.add(key)
            leaves[key] = Leaf(key, "other", "Open to sky", *size(key), 0.0)
        elif g.room_type in ("staircase", "hallway"):
            leaves[key] = Leaf(key, g.room_type, g.name, g.pref_w, g.pref_d, g.min_side, g.fixed)
        else:
            (wet if g.room_type == "bathroom" else dry).append(key)

    n_bed, n_bath, n_study = want.get("bedroom", 0), want.get("bathroom", 0), want.get("study", 0)
    by_area = sorted(dry, key=area, reverse=True)
    beds = [k for k in by_area if fits(k, "bedroom")][:n_bed]
    if len(beds) < n_bed:
        return None, frozenset(voids), f"only {len(beds)} of {n_bed} bedrooms fit above this ground floor"
    rest = [k for k in by_area if k not in beds]

    hubs = beds + [k for k in ground.rects if ground.leaves[k].room_type == "hallway"]

    def reachable(k: str) -> bool:
        return any((seg := _shared_edge(ground.rects[k], ground.rects[h])) and _seg_len(seg) >= door_min for h in hubs)

    # Baths over baths keep plumbing in one stack, but only where a bedroom or passage can reach them.
    baths = [k for k in wet if reachable(k)][:n_bath]
    spare_wet = [k for k in wet if k not in baths]
    if len(baths) < n_bath:
        extra = sorted((k for k in rest if fits(k, "bathroom") and reachable(k)), key=area)[:n_bath - len(baths)]
        if len(baths) + len(extra) < n_bath:
            return None, frozenset(voids), f"only {len(baths) + len(extra)} of {n_bath} bathrooms fit"
        baths += extra
        rest = [k for k in rest if k not in extra]

    studies = [k for k in rest if fits(k, "study")][:n_study]
    if len(studies) < n_study:
        return None, frozenset(voids), "no room is large enough for the study"
    rest = [k for k in rest if k not in studies]
    lounge = next((k for k in rest if ground.leaves[k].room_type == "living_room" and fits(k, "living_room")), None)

    for i, k in enumerate(beds):
        put(k, "bedroom", f"Bedroom {bed_start + i}")
    for k in studies:
        put(k, "study", "Study")
    if lounge:
        put(lounge, "living_room", "Family Lounge")
        rest.remove(lounge)
    for k in rest + spare_wet:
        small = area(k) < 60 * scale * scale or ground.leaves[k].room_type in ("utility", "bathroom")
        if small and fits(k, "utility"):
            put(k, "utility", "Store")
        else:
            put(k, "other", "Terrace")

    pairs: list[tuple[str, str]] = []
    for bed in beds:
        for bath in baths:
            seg = _shared_edge(ground.rects[bed], ground.rects[bath])
            if bath not in (b for _, b in pairs) and seg and _seg_len(seg) >= door_min:
                pairs.append((bed, bath))
                break
    paired = {b for _, b in pairs}
    commons = [b for b in baths if b not in paired]
    for i, (_, bath) in enumerate(pairs):
        put(bath, "bathroom", "Attached Bath" if len(pairs) == 1 else f"Bath {bed_start + i}")
    for i, bath in enumerate(commons):
        put(bath, "bathroom", "Common Bath" if len(commons) == 1 else f"Common Bath {i + 1}")

    upper = Candidate(ground.template, ground.mirrored, ground.label, ground.summary,
                      ground.rects, leaves, pairs, ground.padded)
    return upper, frozenset(voids), ""


def _hard_failures(c: Candidate, required: dict[str, int], scale: float, step: float) -> list[str]:
    tolerance = step / 2 + 1e-6  # cut lines snap to the grid, so a size can land up to half a step under its minimum
    failures = []
    present: dict[str, int] = {}
    for key, (x0, y0, x1, y1) in c.rects.items():
        leaf = c.leaves[key]
        present[leaf.room_type] = present.get(leaf.room_type, 0) + 1
        short, long_ = sorted((x1 - x0, y1 - y0))
        max_aspect = PROGRAM[leaf.room_type][3]
        if short + tolerance < leaf.min_side:
            failures.append(f"{leaf.name} would be only {short:.1f} wide (minimum {leaf.min_side:.1f}).")
        elif long_ / max(short, 1e-6) > max_aspect:
            failures.append(f"{leaf.name} would be too narrow for its length.")
        if leaf.room_type == "parking" and long_ + tolerance < CAR_LENGTH_FT * scale:
            failures.append("Parking is shorter than a car.")
    for rtype, count in required.items():
        if present.get(rtype, 0) < count:
            failures.append(f"Missing {rtype.replace('_', ' ')}.")
    return failures


def _score(c: Candidate, w: float, l: float, has_door: set[str]) -> tuple[int, dict[str, int], list[str]]:
    types = {k: c.leaves[k].room_type for k in c.rects}
    rooms = [k for k in c.rects if types[k] not in ("hallway", "other")]
    size = {k: (c.rects[k][2] - c.rects[k][0], c.rects[k][3] - c.rects[k][1]) for k in c.rects}

    def ratio(k: str) -> float:
        a = size[k][0] * size[k][1]
        return min(a / c.leaves[k].area, c.leaves[k].area / a)

    fit = sum(ratio(k) for k in rooms) / max(len(rooms), 1)
    prop = sum(1 - min(max((max(size[k]) / max(min(size[k]), 0.01) - 1.5) / 1.5, 0), 1) for k in rooms) / max(len(rooms), 1)

    def adjacent(a_type: str, b_type: str) -> bool:
        return any(_shared_edge(c.rects[a], c.rects[b]) for a in c.rects for b in c.rects
                   if types[a] == a_type and types[b] == b_type)

    wanted = []
    if "kitchen" in types.values():
        wanted.append(adjacent("kitchen", "dining_room") if "dining_room" in types.values()
                      else adjacent("kitchen", "living_room") or adjacent("kitchen", "hallway"))
    wanted += [bool(_shared_edge(c.rects[bed], c.rects[bath])) for bed, bath in c.pairs]
    if "hallway" in types.values():
        wanted.append(adjacent("living_room", "hallway"))
    adj = sum(wanted) / len(wanted) if wanted else 1.0

    habitable = [k for k in rooms if types[k] in HABITABLE]
    lit = [k for k in habitable if _open_edges(c, k, w, l)]
    light = len(lit) / max(len(habitable), 1)

    beds = [k for k in rooms if types[k] == "bedroom"]
    private = [k for k in beds if c.rects[k][1] > 0.01
               and not any(types[o] == "parking" and _shared_edge(c.rects[k], c.rects[o]) for o in c.rects)]
    privacy = len(private) / max(len(beds), 1)
    parking = [k for k in rooms if types[k] == "parking"]
    parking_front = all(c.rects[k][1] < 0.01 for k in parking)

    needs_door = [k for k in rooms if types[k] not in ("living_room", "parking")]
    access = len([k for k in needs_door if k in has_door]) / max(len(needs_door), 1)

    parts = {
        "sizeFit": round(fit * 20), "proportions": round(prop * 15), "adjacency": round(adj * 20),
        "daylight": round(light * 15), "privacy": round(privacy * 10), "access": round(access * 15),
        "streetFront": 5 if parking_front else 0,
    }
    highlights = []
    if habitable and light == 1:
        highlights.append("Every bedroom and living space has a window to the outside.")
    elif lit:
        highlights.append(f"{len(lit)} of {len(habitable)} living spaces get a window to the outside.")
    if c.pairs and all(_shared_edge(c.rects[b], c.rects[t]) for b, t in c.pairs):
        highlights.append("Attached baths open off their bedrooms.")
    if beds and privacy == 1:
        highlights.append("Bedrooms sit away from the street for privacy.")
    if "dining_room" in types.values() and adjacent("kitchen", "dining_room"):
        highlights.append("Kitchen opens straight onto dining.")
    if parking and parking_front:
        highlights.append("Parking faces the street front.")
    if access == 1:
        highlights.append("Every room has a door to a passage or living space.")
    return sum(parts.values()), parts, highlights


def generate_candidates(requirements: RoomRequirements, plot_width: float, plot_length: float,
                        units: str = "ft", seed: int = 0, limit: int = 3) -> dict[str, Any]:
    floors = min(max(getattr(requirements, "floors", 1) or 1, 1), len(LEVEL_IDS))
    n_bed = requirements.counts.get("bedroom", 0)
    if floors == 1 or n_bed // floors == 0:
        return _generate(requirements, plot_width, plot_length, units, seed, limit)
    # When the ground floor is too tight, move its bedrooms upstairs one at a time and try again.
    result: dict[str, Any] | None = None
    for ground_beds in range(n_bed // floors, -1, -1):
        try:
            result = _generate(requirements, plot_width, plot_length, units, seed, limit, ground_beds)
        except PlotTooSmall:
            if ground_beds == 0:
                raise
            continue
        if result["candidates"]:
            if ground_beds < n_bed // floors:
                result["notes"].append(f"Moved bedrooms upstairs to fit the ground floor ({ground_beds} left on the ground).")
            return result
    assert result is not None
    return result


def _generate(requirements: RoomRequirements, plot_width: float, plot_length: float, units: str, seed: int,
              limit: int, ground_beds: int | None = None) -> dict[str, Any]:
    scale = 1.0 if units == "ft" else M_PER_FT
    step = 0.5 if units == "ft" else 0.1
    w, l = float(plot_width), float(plot_length)
    all_counts = {t: n for t, n in requirements.counts.items() if t != "hallway" and n > 0}
    floors = min(max(getattr(requirements, "floors", 1) or 1, 1), len(LEVEL_IDS))
    per_floor, split_notes = split_floors(all_counts, floors, ground_beds)
    counts = per_floor[0]

    floor_min = sum(PROGRAM[t][2] ** 2 * n for t, n in counts.items()) * scale * scale
    if w * l < floor_min * 1.3 or min(w, l) < 15 * scale:
        rooms = sum(counts.values())
        raise PlotTooSmall(f"A {w:g} × {l:g} {units} plot is too small for {rooms} rooms. "
                           "Try a larger plot or fewer rooms.")

    rng_base = random.Random(seed)
    raw: list[Candidate] = []
    for tpl_key, label, summary, build in TEMPLATES:
        tpl_seed = rng_base.random()
        for pad in (False, True) if tpl_key != "side" else (False,):
            programme = _build_programme(counts, scale)
            tree = build(programme, random.Random(tpl_seed), w, l, pad)
            base: dict[str, tuple] = {}
            _place(tree, 0.0, 0.0, w, l, step, base)
            leaves = _collect(tree, {})
            for mirrored in (False, True):
                rects = base if not mirrored else {k: (_r(w - x1), y0, _r(w - x0), y1) for k, (x0, y0, x1, y1) in base.items()}
                raw.append(Candidate(tpl_key, mirrored, label + (" (mirrored)" if mirrored else ""), summary,
                                     rects, leaves, programme.bed_bath_pairs, pad))

    accepted: list[dict] = []
    rejected: list[dict] = []
    seen: set[tuple] = set()
    for c in raw:
        signature = tuple(sorted((c.leaves[k].room_type, *(round(v, 2) for v in r)) for k, r in c.rects.items()))
        if signature in seen:
            continue
        seen.add(signature)
        failures = _hard_failures(c, counts, scale, step)
        design, notes, has_door = _assemble_design(c, units, w, l, scale)
        upper_scores: list[int] = []
        bed_next = counts.get("bedroom", 0) + 1
        for fi in range(1, floors):
            if failures:
                break
            upper, voids, why = _stack_floor(c, per_floor[fi], scale, step, bed_next)
            if upper is None:
                failures.append(f"{FLOOR_NAMES[fi]}: {why}.")
                break
            failures += [f"{FLOOR_NAMES[fi]}: {f}" for f in _hard_failures(upper, per_floor[fi], scale, step)]
            level, up_notes, up_door = _assemble_level(upper, w, l, scale, fi, voids)
            # A store or terrace upstairs that no door reaches has no use: leave it open to sky instead.
            unreachable = {k for k, leaf in upper.leaves.items()
                           if leaf.room_type in ("utility", "other") and k not in voids and k not in up_door}
            if unreachable:
                voids = voids | unreachable
                level, up_notes, up_door = _assemble_level(upper, w, l, scale, fi, voids)
            for key, leaf in upper.leaves.items():
                if leaf.room_type in ("bedroom", "bathroom", "study", "staircase") and key not in up_door:
                    failures.append(f"{FLOOR_NAMES[fi]}: {leaf.name} has no door to a passage or lounge.")
            notes += [f"{FLOOR_NAMES[fi]}: {n}" for n in up_notes]
            design["levels"].append(level)
            upper_scores.append(_score(upper, w, l, up_door)[0])
            bed_next += per_floor[fi].get("bedroom", 0)
        design["plot"]["floors"] = floors
        failures += [i["message"] for i in validate_floor_plan(design) + spatial_issues(design)]
        if failures:
            rejected.append({"label": c.label, "reasons": failures[:3]})
            continue
        total, parts, highlights = _score(c, w, l, has_door)
        if upper_scores:
            # Ground floor carries entrance, parking and daylight; upper floors still count for 40%.
            total = round(total * 0.6 + sum(upper_scores) / len(upper_scores) * 0.4)
            highlights = [f"Walls, staircase and bathrooms line up across all {floors} floors.", *highlights]
        built, room_count = 0.0, 0
        for level in design["levels"]:
            for r in level["rooms"]:
                if r["type"] == "other":
                    continue
                built += (r["polygon"][2][0] - r["polygon"][0][0]) * (r["polygon"][2][1] - r["polygon"][0][1])
                if r["type"] not in ("hallway", "staircase") or level["id"] == "ground":
                    room_count += r["type"] != "hallway"
        accepted.append({
            "id": f"{c.template}{'-yard' if c.padded else ''}{'-mirrored' if c.mirrored else ''}-{seed}",
            "template": c.template, "label": c.label, "summary": c.summary, "score": total, "scores": parts,
            "highlights": highlights, "warnings": notes,
            "stats": {"roomCount": room_count, "builtUpArea": round(built, 1), "plotArea": round(w * l, 1),
                      "floors": floors},
            "design": design,
        })

    accepted.sort(key=lambda a: -a["score"])
    picked: list[dict] = []
    for cand in accepted:  # best of each template first, so the options differ
        if all(p["template"] != cand["template"] for p in picked):
            picked.append(cand)
    for cand in accepted:
        if len(picked) >= limit:
            break
        if cand not in picked:
            picked.append(cand)
    return {"candidates": sorted(picked[:limit], key=lambda a: -a["score"]), "rejected": rejected,
            "floors": [{"name": FLOOR_NAMES[i], "counts": f} for i, f in enumerate(per_floor)],
            "notes": split_notes}
