# API contract (starter)

Base URL: `/api`

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/projects` | Create a project |
| GET | `/projects` | List projects (demo only) |
| GET | `/projects/{id}` | Get project |
| PUT | `/projects/{id}/design` | Save design |
| POST | `/projects/{id}/generate` | Submit generation request |
| POST | `/projects/{id}/validate` | Run structural checks |

The current project routes use in-memory storage and have no authentication. They are development scaffolding only. Before production, use a persistent repository, authentication, authorization, request limits, structured error responses, and version-aware writes.

Planned endpoints:
- `GET /jobs/{job_id}`
- `POST /projects/{id}/versions`
- `POST /projects/{id}/export`
- `POST /projects/{id}/share`
