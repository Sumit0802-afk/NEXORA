import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.models import Base, User, utc_naive
from app.db.session import get_db
from app.domain import library as lib
from app.domain.circulation import circulation_issues, is_terrace
from app.domain.geometry import spatial_issues
from app.main import app


@pytest.fixture(scope="module")
def small_catalog(tmp_path_factory):
    lib.CACHE_DIR = tmp_path_factory.mktemp("cache")
    c = lib.Catalog()
    c.build(60, use_cache=False)
    return c


@pytest.fixture()
def client(small_catalog, monkeypatch):
    monkeypatch.setattr("app.api.routes.library.catalog", small_catalog)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        user = User(id=uuid.uuid4(), email="lib@example.com", password_hash="x", email_verified_at=utc_naive())
        db.add(user)
        db.commit()
        uid = user.id

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    def _user():
        with Session() as db:
            return db.get(User, uid)

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = _user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_catalogue_entries_are_distinct_valid_and_regenerable(small_catalog):
    assert len(small_catalog.entries) == 60
    signatures = set()
    for entry in small_catalog.entries.values():
        found = small_catalog.design_for(entry["id"])
        assert found, entry["id"]
        design = found["design"]
        assert spatial_issues(design) == [] and circulation_issues(design) == []
        assert lib._signature(design) == entry["id"].removeprefix("NX-").lower() + lib._signature(design)[10:]
        signatures.add(lib._signature(design))
        # Real, editable geometry: walls and openings exist on every floor.
        assert all(level["walls"] and level["openings"] for level in design["levels"])
        assert entry["floors"] == len(design["levels"]) == entry["plot"].get("floors", entry["floors"])
    assert len(signatures) == 60


def test_multi_floor_entries_have_stacked_stairs_and_reachable_terraces(small_catalog):
    multi = [e for e in small_catalog.entries.values() if e["floors"] > 1]
    assert multi
    for entry in multi:
        design = small_catalog.design_for(entry["id"])["design"]
        stairs = [[r for r in lvl["rooms"] if r["type"] == "staircase"] for lvl in design["levels"]]
        assert all(stairs)
        assert circulation_issues(design) == []
        if entry["hasTerrace"]:
            assert any(is_terrace(r) for lvl in design["levels"][1:] for r in lvl["rooms"])


def test_query_filters_sorting_and_paging(small_catalog):
    everything = small_catalog.query(limit=100)
    assert everything["total"] == 60
    duplex = small_catalog.query(floors=[2], limit=100)
    assert duplex["items"] and all(e["floors"] == 2 for e in duplex["items"])
    beds3 = small_catalog.query(bedrooms=[3], limit=100)
    assert all(e["bedrooms"] == 3 for e in beds3["items"])
    tagged = small_catalog.query(tags=["Terrace"], limit=100)
    assert all("Terrace" in e["tags"] for e in tagged["items"])
    big = small_catalog.query(min_area=1500, limit=100)
    assert all(e["plotArea"] >= 1500 for e in big["items"])
    page1 = small_catalog.query(limit=10, offset=0)["items"]
    page2 = small_catalog.query(limit=10, offset=10)["items"]
    assert {e["id"] for e in page1}.isdisjoint({e["id"] for e in page2})
    assert [e["plotArea"] for e in small_catalog.query(sort="area_asc", limit=100)["items"]] == sorted(
        e["plotArea"] for e in everything["items"])
    one = everything["items"][0]
    assert small_catalog.query(q=one["id"])["total"] == 1


def test_facets_report_real_counts(small_catalog):
    f = small_catalog.facets()
    assert f["total"] == 60 and sum(f["floors"].values()) == 60 and sum(f["bedrooms"].values()) == 60


def test_library_requires_login_and_lists_designs(client, small_catalog):
    r = client.get("/api/library?limit=5")
    assert r.status_code == 200
    body = r.json()
    assert body["ready"] and body["total"] == 60 and len(body["items"]) == 5
    assert {"id", "name", "preview", "plot", "floors", "bedrooms", "tags"} <= body["items"][0].keys()
    app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/library").status_code == 401


def test_design_detail_returns_full_plan_and_checks(client, small_catalog):
    entry = next(iter(small_catalog.entries.values()))
    r = client.get(f"/api/library/{entry['id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["design"]["levels"] and body["checks"] == {"spatial": [], "circulation": []}
    assert "conceptual" in body["origin"]
    assert client.get("/api/library/NX-DOESNOTEXIST").status_code == 404


def test_favourites_persist_per_user(client, small_catalog):
    a, b = list(small_catalog.entries)[:2]
    assert client.put(f"/api/library/favourites/{a}").status_code == 204
    assert client.put(f"/api/library/favourites/{a}").status_code == 204  # idempotent
    assert client.put(f"/api/library/favourites/{b}").status_code == 204
    assert sorted(client.get("/api/library/favourites").json()["ids"]) == sorted([a, b])
    only = client.get("/api/library?favourites=true&limit=60").json()
    assert {e["id"] for e in only["items"]} == {a, b} and set(only["favourites"]) == {a, b}
    assert client.delete(f"/api/library/favourites/{a}").status_code == 204
    assert client.get("/api/library/favourites").json()["ids"] == [b]
    assert client.put("/api/library/favourites/NX-NOPE").status_code == 404


def test_reports_while_the_library_is_still_building(client, monkeypatch):
    building = lib.Catalog()
    building.progress = 12
    monkeypatch.setattr("app.api.routes.library.catalog", building)
    body = client.get("/api/library").json()
    assert body["ready"] is False and body["progress"] == 12 and body["items"] == []
    assert client.get("/api/library/anything").status_code == 404


def test_bad_filters_are_rejected(client):
    assert client.get("/api/library?floors=two").status_code == 422
    assert client.get("/api/library?sort=random").status_code == 422
    assert client.get("/api/library?limit=500").status_code == 422


def test_bundled_catalogue_ships_with_the_code():
    from app.domain import library
    assert (library.BUNDLED_DIR / f"library-v{library.ENGINE_VERSION}-1200.json").exists()
