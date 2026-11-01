# Architecture

## Components

- **Web app:** Next.js routes for dashboard, smart design wizard, 2D studio and 3D preview.
- **API:** FastAPI modular monolith for projects, generation, validation and exports.
- **Canonical model:** Versioned JSON shared across the UI and backend.
- **Geometry domain:** Deterministic checks are separate from LLM prompt parsing.
- **Persistence:** PostgreSQL JSONB for design versions and relational ownership metadata.
- **Background work:** Redis/Celery planned for smart generation and exports.
- **Object storage:** Store large exports and user assets outside the relational database.

## House design studio

`/studio/[projectId]/design` restyles the 3D house from a photo or a gallery design. `apps/web/src/lib/house-design` holds it: `image-analysis.ts` reads a photo in the browser, `interpret.ts` turns the reading into a design, `model.ts` builds roof, facade, interior and site parts from the plan's scene geometry, and `three-build.ts` merges them into one mesh per part. The floor plan is never changed. Designs are stored per project in `house_designs`, apart from `design_versions`, so a colour change adds no plan version. The optional server reading (`POST /api/house-design/read-image`) needs a configured provider and the user's opt-in.

## Key rule

smart proposes; deterministic code validates. The browser must not be trusted as the final validator. Server-side authorization is required for every project, version and asset operation.

## Planned production improvements

- Replace in-memory project demo repository with SQLAlchemy repositories.
- Add Supabase Auth/JWT validation or another identity provider.
- Implement project ownership checks and role-based sharing.
- Implement persistent generation jobs and Celery worker.
- Add schema migration tooling and automated migration checks.
- Add structured logs, metrics, tracing, rate limits and secrets management.
