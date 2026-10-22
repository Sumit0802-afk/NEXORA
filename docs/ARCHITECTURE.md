# Architecture

## Components

- **Web app:** Next.js routes for dashboard, smart design wizard, 2D studio and 3D preview.
- **API:** FastAPI modular monolith for projects, generation, validation and exports.
- **Canonical model:** Versioned JSON shared across the UI and backend.
- **Geometry domain:** Deterministic checks are separate from LLM prompt parsing.
- **Persistence:** PostgreSQL JSONB for design versions and relational ownership metadata.
- **Background work:** Redis/Celery planned for smart generation and exports.
- **Object storage:** Store large exports and user assets outside the relational database.

## Key rule

smart proposes; deterministic code validates. The browser must not be trusted as the final validator. Server-side authorization is required for every project, version and asset operation.

## Planned production improvements

- Replace in-memory project demo repository with SQLAlchemy repositories.
- Add Supabase Auth/JWT validation or another identity provider.
- Implement project ownership checks and role-based sharing.
- Implement persistent generation jobs and Celery worker.
- Add schema migration tooling and automated migration checks.
- Add structured logs, metrics, tracing, rate limits and secrets management.
