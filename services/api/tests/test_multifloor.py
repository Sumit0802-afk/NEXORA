import pytest
from fastapi.testclient import TestClient

from app.domain.geometry import spatial_issues, validate_floor_plan
from app.domain.layout import generate_candidates, split_floors
from app.domain.requirements import detect_floors, parse_requirements
from app.main import app

client = TestClient(app)


@pytest.mark.parametrize(("text", "floors"), [
    ("modern double-floor home", 2), ("G+1 with parking", 2), ("3BHK g + 2", 3), ("do manzil ghar", 2),
    ("duplex villa", 2), ("G+3 building", 4), ("single floor bungalow", 1), ("a nice home", None),
])
def test_detect_floors(text, floors):
    assert detect_floors(text) == floors


def test_explicit_floors_win_and_add_stairs():
    req = parse_requirements("3 bedrooms, 3 baths, kitchen, living", "single floor", floors=2)
    assert req.floors == 2 and req.counts["staircase"] == 1


def test_split_puts_most_bedrooms_upstairs_with_a_bath_each_floor():
    floors, _ = split_floors({"living_room": 1, "kitchen": 1, "bedroom": 3, "bathroom": 3, "parking": 1}, 2)
    ground, first = floors
    assert ground["bedroom"] == 1 and first["bedroom"] == 2
    assert ground["bathroom"] >= 1 and first["bathroom"] >= 1
    assert "kitchen" in ground and "kitchen" not in first and "parking" not in first
    assert ground["staircase"] == first["staircase"] == 1


def test_split_adds_baths_when_too_few():
    floors, notes = split_floors({"living_room": 1, "kitchen": 1, "bedroom": 2, "bathroom": 1}, 2)
    assert all(f.get("bathroom", 0) >= 1 for f in floors) and notes


@pytest.mark.parametrize(("w", "l", "units", "floors"), [(30, 40, "ft", 2), (30, 50, "ft", 3), (12, 15, "m", 2)])
def test_upper_floors_stack_on_the_ground_grid(w, l, units, floors):
    req = parse_requirements("4 bedrooms, 4 baths, kitchen, living, parking", "", floors)
    result = generate_candidates(req, w, l, units)
    assert result["candidates"], result["rejected"][:2]
    for cand in result["candidates"]:
        design = cand["design"]
        assert design["plot"]["floors"] == floors and len(design["levels"]) == floors
        assert validate_floor_plan(design) == [] and spatial_issues(design) == []
        ground, *uppers = design["levels"]
        assert [lv["elevation"] for lv in design["levels"]] == sorted(lv["elevation"] for lv in design["levels"])
        stair = next(r["polygon"] for r in ground["rooms"] if r["type"] == "staircase")
        ids = [r["id"] for lv in design["levels"] for r in lv["rooms"]] + \
              [x["id"] for lv in design["levels"] for x in lv["walls"] + lv["openings"]]
        assert len(ids) == len(set(ids)), "ids must be unique across floors"
        for level in uppers:
            assert next(r["polygon"] for r in level["rooms"] if r["type"] == "staircase") == stair
            assert all(r["type"] not in ("kitchen", "parking") for r in level["rooms"])
            # main entrance only on the ground floor: no exterior door upstairs
            exterior = {wl["id"] for wl in level["walls"] if wl["kind"] == "exterior"}
            assert not [o for o in level["openings"] if o["kind"] == "door" and o["wallId"] in exterior]
        total_beds = sum(r["type"] == "bedroom" for lv in design["levels"] for r in lv["rooms"])
        assert total_beds == 4


def test_endpoint_reads_floors_from_brief():
    data = client.post("/api/layouts/generate", json={
        "roomList": "3 bedrooms, 3 baths, kitchen, living room, parking",
        "description": "G+1 house", "plotWidth": 30, "plotLength": 40,
    }).json()
    assert data["requirements"]["floors"] == 2
    assert [f["name"] for f in data["floors"]] == ["Ground floor", "First floor"]
    assert data["candidates"] and all(len(c["design"]["levels"]) == 2 for c in data["candidates"])


def test_single_floor_unchanged():
    data = client.post("/api/layouts/generate", json={
        "roomList": "2 bedrooms, 2 baths, kitchen, living room", "plotWidth": 30, "plotLength": 40,
    }).json()
    assert data["requirements"]["floors"] == 1
    assert all(len(c["design"]["levels"]) == 1 for c in data["candidates"])
