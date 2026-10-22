from app.domain.geometry import validate_floor_plan


def test_rejects_missing_plot():
    issues = validate_floor_plan({"levels": [{"rooms": []}]})
    assert any(issue["code"] == "missing_plot" for issue in issues)


def test_accepts_basic_structural_shape():
    design = {
        "plot": {"width": 30, "length": 40},
        "levels": [{
            "rooms": [{
                "id": "room-1",
                "polygon": [[0, 0], [10, 0], [10, 10], [0, 10]],
            }]
        }],
    }
    assert validate_floor_plan(design) == []


def test_rejects_room_without_polygon():
    design = {"plot": {"width": 30, "length": 40}, "levels": [{"rooms": [{"id": "r1"}]}]}
    assert any(issue["code"] == "invalid_room_polygon" for issue in validate_floor_plan(design))
