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
| GET | `/projects/{id}/house-design` | Get the saved house design |
| PUT | `/projects/{id}/house-design` | Save the house design (12 MB limit) |
| POST | `/projects/{id}/house-design/jobs` | Start a reading of up to four reference views. Returns 202 and a job id, or 503 if no provider is configured |
| GET | `/projects/{id}/house-design/jobs/{job_id}` | Job status (`queued`, `running`, `completed`, `failed`) and its result by side of the house |

Auth routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Everything except `/api/health` and `/api/auth/*` requires the session cookie. The first account to register adopts projects created before login existed. The notes below predate this and are partly outdated: the project routes use in-memory storage. They are development scaffolding only. Before production, use a persistent repository, authentication, authorization, request limits, structured error responses, and version-aware writes.

Planned endpoints:
- `GET /jobs/{job_id}`
- `POST /projects/{id}/versions`
- `POST /projects/{id}/export`
- `POST /projects/{id}/share`
