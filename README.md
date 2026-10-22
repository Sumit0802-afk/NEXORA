<<<<<<< HEAD
# NEXORA

**The Future Takes Shape.**

Smart-powered house design and floor-planning platform with an editable 2D canvas, a synchronized 3D preview, structured smart-assisted layout generation, project persistence, and export workflows.

> **Safety note:** Generated plans are conceptual starting points, not construction-ready drawings. Have qualified professionals verify structural design, local building regulations, setbacks, and electrical/plumbing requirements before construction.

## Monorepo layout

- `apps/web` — Next.js + TypeScript UI
- `services/api` — FastAPI backend, geometry validation, project APIs
- `packages/design-schema` — shared TypeScript design types and starter validation
- `infra` — local Docker Compose services
- `docs` — architecture, API, data model and roadmap
- `database/migrations` — PostgreSQL schema migrations

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker + Docker Compose (recommended for PostgreSQL and Redis)

## Quick start

### 1. Configure environment

```bash
cp .env.example .env
```

Set secrets and connection strings in `.env`. Do not commit real secrets.

### 2. Start infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d postgres redis
```

### 3. Start the API

```bash
cd services/api
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 4. Start the web app

In another terminal:

```bash
cd apps/web
npm install
npm run dev
```

Web app: http://localhost:3000

The frontend currently includes a starter dashboard and studio shell. The 2D/3D canvases and smart workflow are scaffolded for implementation; this repository is a foundation, not a finished production service.

## Core engineering decisions

1. **Canonical floor-plan JSON** is the source of truth for the 2D editor, 3D renderer, validation and exports.
2. smart parses user requirements and proposes candidates; deterministic geometry validation must reject invalid candidates.
3. The API is organized as a modular monolith initially. Background jobs can be split into workers as load grows.
4. Save operations should be version-aware to avoid overwriting concurrent edits.
5. Authentication and project-level authorization must be enforced server-side before public launch.

## Commands

### Web
- `npm run dev` — local development
- `npm run lint` — lint
- `npm run typecheck` — TypeScript type check

### API
- `pytest` — tests
- `ruff check .` — lint
- `mypy app` — type checks

## Suggested build order

1. Finish the canonical schema and geometry tests.
2. Implement 2D editing actions and undo/redo.
3. Add project persistence and versioning.
4. Add deterministic layout candidates and validation.
5. Add structured smart requirement parsing.
6. Derive the 3D scene from the same design JSON.
7. Add exports, sharing, quotas, observability, backups and security hardening.

See `docs/ROADMAP.md` for the phased roadmap.
=======
# NEXORA
>>>>>>> 249180d3127413b739a05f11e21ffd1cf938ab79
