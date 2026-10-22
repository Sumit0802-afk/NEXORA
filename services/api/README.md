# HousePlan API

FastAPI starter backend.

```bash
python -m venv .venv
# Activate your virtual environment, then:
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs`.

Current status:
- Health route implemented.
- In-memory demo project routes implemented.
- Minimal structural floor-plan validation implemented.
- smart generation endpoint is a stub; no model provider is connected.
- Database schema is provided, but ORM/repository integration is not wired.
- No authentication is implemented. Do not expose publicly as-is.
