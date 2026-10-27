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


def test_database_url_from_hosting_providers_gets_the_psycopg_driver():
    from app.core.config import Settings
    assert Settings(database_url="postgres://u:p@h/db?sslmode=require").database_url == "postgresql+psycopg://u:p@h/db?sslmode=require"
    assert Settings(database_url="postgresql://u:p@h/db").database_url.startswith("postgresql+psycopg://")
    assert Settings(database_url="sqlite:///x.db").database_url == "sqlite:///x.db"
