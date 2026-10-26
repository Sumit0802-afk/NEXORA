import pytest
from fastapi.testclient import TestClient

from app.domain.geometry import spatial_issues, validate_floor_plan
from app.domain.layout import PROGRAM, PlotTooSmall, generate_candidates
from app.domain.requirements import parse_requirements
from app.main import app


def test_parses_counts_synonyms_and_bhk():
    req = parse_requirements("2 bedrooms, 2 washrooms, kitchen, hall, car parking, stairs")
    assert req.counts == {"living_room": 1, "kitchen": 1, "bedroom": 2, "bathroom": 2,
                          "staircase": 1, "parking": 1}
    assert parse_requirements("3BHK").counts["bedroom"] == 3
    assert parse_requirements("two bedrooms and a study").counts["study"] == 1


def test_description_only_adds_missing_room_types():
    req = parse_requirements("2 bedrooms, 1 bathroom", "Need 4 bedrooms, parking and a dining room")
    assert req.counts["bedroom"] == 2
    assert req.counts["parking"] == 1 and req.counts["dining_room"] == 1


def test_empty_input_falls_back_to_starter_programme():
    req = parse_requirements("", "")
    assert req.counts["bedroom"] == 1 and req.counts["bathroom"] == 1 and req.notes


CASES = [
    ("1 bedroom, 1 bathroom, kitchen, living room", 25, 40, "ft"),
    ("2 bedrooms, 2 bathrooms, kitchen, living room", 30, 40, "ft"),
    ("2 bedrooms, 2 bathrooms, kitchen, living room, staircase, parking", 30, 40, "ft"),
    ("3 bedrooms, 2 bathrooms, kitchen, living, dining, parking", 30, 40, "ft"),
    ("3 bedrooms, 3 bathrooms, kitchen, living, dining, staircase, parking, study", 40, 60, "ft"),
    ("4 bedrooms, 3 bathrooms, kitchen, living, dining, staircase, parking, utility", 60, 80, "ft"),
    ("2 bedrooms, 2 bathrooms, kitchen, living room", 9, 12, "m"),
]


@pytest.mark.parametrize("rooms,width,length,units", CASES)
def test_candidates_are_valid_floor_plans(rooms, width, length, units):
    req = parse_requirements(rooms)
    result = generate_candidates(req, width, length, units)
    assert result["candidates"], result["rejected"]
    scale = 1.0 if units == "ft" else 0.3048
    for cand in result["candidates"]:
        design = cand["design"]
        assert validate_floor_plan(design) == []
        assert spatial_issues(design) == []
        level = design["levels"][0]
        present: dict[str, int] = {}
        for room in level["rooms"]:
            present[room["type"]] = present.get(room["type"], 0) + 1
            (x0, y0), (x1, y1) = room["polygon"][0], room["polygon"][2]
            assert min(x1 - x0, y1 - y0) >= PROGRAM[room["type"]][2] * scale - 0.26
        for room_type, count in req.counts.items():
            assert present.get(room_type, 0) >= count, f"missing {room_type}"
        wall_ids = {w["id"] for w in level["walls"]}
        assert all(o["wallId"] in wall_ids for o in level["openings"])
        assert any(o["kind"] == "door" for o in level["openings"])
        assert any(o["kind"] == "window" for o in level["openings"])
        assert 0 < cand["score"] <= 100


def test_every_room_needing_access_gets_a_door_on_a_typical_brief():
    result = generate_candidates(parse_requirements("2 bedrooms, 2 bathrooms, kitchen, living room"), 30, 40)
    best = result["candidates"][0]
    assert best["warnings"] == []
    assert best["scores"]["access"] == 15


def test_candidates_differ_and_are_ranked():
    result = generate_candidates(parse_requirements("2 bedrooms, 2 bathrooms, kitchen, living room"), 30, 50)
    cands = result["candidates"]
    assert len(cands) == 3
    assert [c["score"] for c in cands] == sorted((c["score"] for c in cands), reverse=True)
    layouts = {tuple(tuple(map(tuple, r["polygon"])) for r in c["design"]["levels"][0]["rooms"]) for c in cands}
    assert len(layouts) == 3


def test_tiny_plot_is_rejected_with_a_clear_reason():
    with pytest.raises(PlotTooSmall):
        generate_candidates(parse_requirements("4 bedrooms, 3 bathrooms, kitchen, living"), 15, 20)


client = TestClient(app)


def test_generate_endpoint_returns_candidates():
    res = client.post("/api/layouts/generate", json={
        "roomList": "2 bedrooms, 2 bathrooms, kitchen, living room", "description": "",
        "plotWidth": 30, "plotLength": 40, "units": "ft",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["requirements"]["counts"]["bedroom"] == 2
    assert len(body["candidates"]) >= 2 and body["message"] is None


def test_generate_endpoint_explains_a_plot_that_is_too_small():
    res = client.post("/api/layouts/generate", json={
        "roomList": "4 bedrooms, 3 bathrooms, kitchen, living", "plotWidth": 15, "plotLength": 20,
    })
    assert res.status_code == 422
    assert "too small" in res.json()["detail"]


def test_generate_endpoint_reports_when_nothing_fits():
    res = client.post("/api/layouts/generate", json={
        "roomList": "2 bedrooms, 2 bathrooms, kitchen, living room, staircase, parking",
        "plotWidth": 20, "plotLength": 30,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["candidates"] == [] and "No layout fits" in body["message"]


@pytest.mark.parametrize("seed", [1, 7, 13, 29])
def test_no_two_doors_share_a_wall_position(seed):
    req = parse_requirements("3 bedroom, 2 bathroom, 1 living room, 1 kitchen, 1 dining room")
    req.floors = 2
    for cand in generate_candidates(req, 30, 50, seed=seed)["candidates"]:
        for level in cand["design"]["levels"]:
            seen = set()
            for o in level["openings"]:
                if o["kind"] != "door":
                    continue
                key = (o["wallId"], o["offset"])
                assert key not in seen, f"{level['id']}: overlapping doors on {o['wallId']}"
                seen.add(key)
