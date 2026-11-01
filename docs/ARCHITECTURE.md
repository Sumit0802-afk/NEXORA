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

`/studio/[projectId]/design` restyles the 3D house from reference images or a gallery design. The code is in `apps/web/src/lib/house-design`:

- **Reading:** `image-analysis.ts` reads each photo in a web worker (`analysis.worker.ts`). The optional server reading runs as a background job: `POST /api/projects/{id}/house-design/jobs`, then poll `GET .../jobs/{jobId}`. Images are not stored.
- **Geometry engine:** `geometry-engine.ts` holds what the plan fixes. `planFingerprint` identifies a layout, so a change to it can be noticed.
- **Design engine:** `design-engine.ts` turns the readings into a design and structured parameters. The main view sets the whole design; a rear or side view only changes objects on its side and adds evidence on the roof and style. A value no image supports has a null confidence and a basis of `not-visible` or `style-default`.
- **Model assembly:** `model.ts` builds named parts, and `three-build.ts` merges them into one mesh for each object's use of a part. Each mesh keeps a signature, so a rebuild only replaces meshes whose shape changed. A finish change touches materials only.

Objects have semantic ids (`wall:…`, `window:…`, `door:…`, `balcony:…`, `roof:…`) that stay the same across rebuilds of one plan. Per-object edits live in `design.overrides`, kept apart from the design's general settings, so undo, variations and compare include them.

The floor plan is never changed. Designs are stored per project in `house_designs`, apart from `design_versions`, so a colour change adds no plan version. The document keeps the reference images in one pool, the parameters, a record of the base model, the variations and earlier designs. The 3D model itself is rebuilt from the plan and design on open, and GLB and glTF exports carry the design and object list in their metadata.

## Key rule

smart proposes; deterministic code validates. The browser must not be trusted as the final validator. Server-side authorization is required for every project, version and asset operation.

## Planned production improvements

- Replace in-memory project demo repository with SQLAlchemy repositories.
- Add Supabase Auth/JWT validation or another identity provider.
- Implement project ownership checks and role-based sharing.
- Implement persistent generation jobs and Celery worker.
- Add schema migration tooling and automated migration checks.
- Add structured logs, metrics, tracing, rate limits and secrets management.
