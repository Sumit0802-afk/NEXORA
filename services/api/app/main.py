from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import health, projects, generation, validation
from app.db.models import Base
from app.db.session import SessionLocal, engine
from app.db.seed import ensure_demo_user

app = FastAPI(
    title="NEXORA API",
    version="0.1.0",
    description="API scaffold for conceptual floor-plan design. Not a construction approval service.",
)


@app.on_event("startup")
def on_startup() -> None:
    # Dev convenience: create any missing tables. database/migrations/001_initial_schema.sql
    # remains the canonical schema for a real Postgres deployment.
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_demo_user(db)

origins = [origin.strip() for origin in settings.api_cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["http://localhost:3000"],
    # The web app's dev server port shifts (3000, 3001, 3002, ...) when the default is busy;
    # allow any localhost port in development rather than hardcoding one.
    allow_origin_regex=r"https?://localhost:\d+" if settings.app_env == "development" else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(generation.router, prefix="/api")
app.include_router(generation.layouts_router, prefix="/api")
app.include_router(validation.router, prefix="/api")
