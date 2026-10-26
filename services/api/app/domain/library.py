"""House design library built from the layout engine.

Every entry is a real, editable plan produced by `generate_candidates` (rooms, walls, doors, windows, staircases,
terraces) and checked by the geometry and circulation engines. Entries are distinct: duplicates are removed by a hash
of the geometry, so the catalogue size is a count of genuinely different plans, not a multiplier of variants.

An entry stores only its recipe and a small preview; the full design is regenerated on demand (the engine is
deterministic), so the catalogue stays small.
"""

import hashlib
import json
import random
import threading
from collections import Counter
from pathlib import Path
from typing import Any

from app.domain.circulation import circulation_issues, is_terrace
from app.domain.geometry import spatial_issues
from app.domain.layout import PlotTooSmall, generate_candidates
from app.domain.requirements import RoomRequirements

ENGINE_VERSION = "2"
DEFAULT_TARGET = 1200
CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache"

PLOT_WIDTHS = (20, 24, 28, 30, 32, 36, 40, 45, 50, 60)
PLOT_LENGTHS = (30, 36, 40, 45, 50, 60, 70)
EXTRAS = ((), ("parking",), ("study",), ("parking", "study"), ("dining_room", "parking"))
HOME_TYPES = {1: "Bungalow", 2: "Duplex", 3: "Triplex"}
OPEN_NAME = ("garden", "yard", "lawn", "open space")


def _signature(design: dict[str, Any]) -> str:
    parts = []
    for level in design["levels"]:
        for room in sorted(level["rooms"], key=lambda r: (r["type"], r["name"], str(r["polygon"]))):
            parts.append((level["id"], room["type"], [[round(c, 1) for c in p] for p in room["polygon"]]))
    return hashlib.md5(json.dumps(parts).encode()).hexdigest()  # noqa: S324 - not security related


def _has_terrace(design: dict[str, Any]) -> bool:
    """A terrace is an open-to-sky area on an upper floor (ground-floor yards are not terraces)."""
    return any(is_terrace(r) for level in design["levels"][1:] for r in level["rooms"])


def _all_rooms(design: dict[str, Any]) -> list[dict[str, Any]]:
    return [r for level in design["levels"] for r in level["rooms"]]


def _tags(design: dict[str, Any], stats: dict[str, Any], template_label: str, padded: bool) -> list[str]:
    rooms = _all_rooms(design)
    floors = len(design["levels"])
    beds = sum(1 for r in rooms if r["type"] == "bedroom")
    plot = design["plot"]
    plot_area = plot["width"] * plot["length"]
    built = stats.get("builtUpArea", 0)
    mirrored = template_label.endswith("(mirrored)")
    base_label = template_label.replace(" (mirrored)", "")
    tags = [HOME_TYPES.get(floors, f"{floors}-storey"), base_label] + (["Mirrored"] if mirrored else [])
    if built <= 1000:
        tags.append("Compact")
    elif built >= 2400:
        tags.append("Large")
    if beds >= 4:
        tags.append("Family home")
    if plot_area >= 2400 and beds >= 3 and any(r["type"] == "parking" for r in rooms):
        tags.append("Villa")
    if any(r["type"] == "parking" for r in rooms):
        tags.append("Parking")
    if any(r["type"] == "study" for r in rooms):
        tags.append("Study")
    if _has_terrace(design):
        tags.append("Terrace")
    if padded or any(r["type"] == "other" and any(w in r["name"].lower() for w in OPEN_NAME) for r in rooms):
        tags.append("Garden")
    return tags


def _preview(design: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for level in design["levels"]:
        rooms = []
        for r in level["rooms"]:
            xs = [p[0] for p in r["polygon"]]
            ys = [p[1] for p in r["polygon"]]
            rooms.append([r["type"], round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1), r["name"]])
        out.append({"id": level["id"], "rooms": rooms})
    return out


def _entry(recipe: dict[str, Any], cand: dict[str, Any], sig: str) -> dict[str, Any]:
    design = cand["design"]
    rooms = _all_rooms(design)
    floors = len(design["levels"])
    beds = sum(1 for r in rooms if r["type"] == "bedroom")
    baths = sum(1 for r in rooms if r["type"] == "bathroom")
    plot = design["plot"]
    stats = cand.get("stats", {})
    padded = "-yard" in cand["id"]
    tags = _tags(design, stats, cand["label"], padded)
    name = f"{beds} BHK {HOME_TYPES.get(floors, 'House')} · {int(plot['width'])}×{int(plot['length'])} ft · {cand['label']}"
    return {
        "id": "NX-" + sig[:10].upper(),
        "name": name,
        "recipe": {**recipe, "candidateId": cand["id"]},
        "template": cand["template"],
        "templateLabel": cand["label"],
        "summary": cand["summary"],
        "plot": {"width": plot["width"], "length": plot["length"], "units": design["units"]},
        "plotArea": round(plot["width"] * plot["length"]),
        "floors": floors,
        "bedrooms": beds,
        "bathrooms": baths,
        "builtUp": round(stats.get("builtUpArea", 0)),
        "hasTerrace": _has_terrace(design),
        "tags": tags,
        "score": cand.get("score", 0),
        "highlights": (cand.get("highlights") or [])[:3],
        "preview": _preview(design),
    }


def _recipes() -> list[dict[str, Any]]:
    recipes = []
    for w in PLOT_WIDTHS:
        for length in PLOT_LENGTHS:
            for beds in (1, 2, 3, 4, 5):
                for baths in sorted({max(1, beds - 1), beds}):
                    for extra in EXTRAS:
                        for floors in (1, 2, 3):
                            counts = {"bedroom": beds, "bathroom": baths, "kitchen": 1, "living_room": 1}
                            for e in extra:
                                counts[e] = 1
                            if floors > 1:
                                counts["staircase"] = 1
                            recipes.append({"width": w, "length": length, "units": "ft", "counts": counts, "floors": floors})
    random.Random(2024).shuffle(recipes)  # fixed seed: the same catalogue every time, with good variety
    return recipes


def _generate(recipe: dict[str, Any], seed: int) -> list[dict[str, Any]]:
    req = RoomRequirements(counts=dict(recipe["counts"]), floors=recipe["floors"])
    result = generate_candidates(req, recipe["width"], recipe["length"], recipe["units"], seed, limit=3)
    return result["candidates"]


class Catalog:
    def __init__(self) -> None:
        self.entries: dict[str, dict[str, Any]] = {}
        self.ready = False
        self.progress = 0
        self.target = DEFAULT_TARGET
        self.error: str | None = None
        self._lock = threading.Lock()

    # ── building ──
    def build(self, target: int = DEFAULT_TARGET, use_cache: bool = True) -> None:
        self.target = target
        cache = CACHE_DIR / f"library-v{ENGINE_VERSION}-{target}.json"
        if use_cache and cache.exists():
            try:
                data = json.loads(cache.read_text(encoding="utf8"))
                self._set({e["id"]: e for e in data})
                return
            except (OSError, ValueError, KeyError):
                pass
        seen: set[str] = set()
        entries: dict[str, dict[str, Any]] = {}
        for n, recipe in enumerate(_recipes()):
            if len(entries) >= target:
                break
            seed = n % 3
            try:
                candidates = _generate(recipe, seed)
            except PlotTooSmall:
                continue
            for cand in candidates:
                design = cand["design"]
                if spatial_issues(design) or circulation_issues(design):
                    continue
                sig = _signature(design)
                if sig in seen:
                    continue
                seen.add(sig)
                e = _entry({**recipe, "seed": seed}, cand, sig)
                entries[e["id"]] = e
                self.progress = len(entries)
                if len(entries) >= target:
                    break
        try:
            CACHE_DIR.mkdir(exist_ok=True)
            cache.write_text(json.dumps(list(entries.values())), encoding="utf8")
        except OSError:
            pass  # a read-only checkout just rebuilds next start
        self._set(entries)

    def _set(self, entries: dict[str, dict[str, Any]]) -> None:
        with self._lock:
            self.entries = entries
            self.progress = len(entries)
            self.ready = True

    def build_in_background(self, target: int = DEFAULT_TARGET) -> None:
        def run() -> None:
            try:
                self.build(target)
            except Exception as exc:  # noqa: BLE001 - surfaced through /library status instead of crashing startup
                self.error = str(exc)

        threading.Thread(target=run, name="library-build", daemon=True).start()

    # ── reading ──
    def facets(self) -> dict[str, Any]:
        es = list(self.entries.values())
        tags: Counter[str] = Counter(t for e in es for t in e["tags"])
        return {
            "total": len(es),
            "floors": dict(sorted(Counter(e["floors"] for e in es).items())),
            "bedrooms": dict(sorted(Counter(e["bedrooms"] for e in es).items())),
            "tags": dict(tags.most_common()),
            "plotAreaRange": [min((e["plotArea"] for e in es), default=0), max((e["plotArea"] for e in es), default=0)],
        }

    def query(self, *, q: str = "", tags: list[str] | None = None, floors: list[int] | None = None,
              bedrooms: list[int] | None = None, min_area: int = 0, max_area: int = 10**9,
              ids: set[str] | None = None, sort: str = "score", limit: int = 24, offset: int = 0) -> dict[str, Any]:
        needle = q.strip().lower()
        out = []
        for e in self.entries.values():
            if ids is not None and e["id"] not in ids:
                continue
            if floors and e["floors"] not in floors:
                continue
            if bedrooms and not (e["bedrooms"] in bedrooms or (5 in bedrooms and e["bedrooms"] >= 5)):
                continue
            if not (min_area <= e["plotArea"] <= max_area):
                continue
            if tags and not all(t in e["tags"] for t in tags):
                continue
            if needle and needle not in (e["name"] + " " + " ".join(e["tags"]) + " " + e["id"]).lower():
                continue
            out.append(e)
        keys = {
            "score": lambda e: (-e["score"], e["id"]),
            "area_asc": lambda e: (e["plotArea"], e["id"]),
            "area_desc": lambda e: (-e["plotArea"], e["id"]),
            "bedrooms": lambda e: (-e["bedrooms"], -e["score"], e["id"]),
        }
        out.sort(key=keys.get(sort, keys["score"]))
        return {"total": len(out), "items": out[offset:offset + limit]}

    def design_for(self, entry_id: str) -> dict[str, Any] | None:
        entry = self.entries.get(entry_id)
        if not entry:
            return None
        recipe = entry["recipe"]
        for cand in _generate(recipe, recipe["seed"]):
            if cand["id"] == recipe["candidateId"]:
                return {"entry": entry, "design": cand["design"], "candidate": {k: v for k, v in cand.items() if k != "design"}}
        return None


catalog = Catalog()
