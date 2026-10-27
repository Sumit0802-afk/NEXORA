<div align="center">

# NEXORA

**Design homes you can walk through.**

2D floor plans, 3D walkthrough and interior design in one home-design studio.

[![Live](https://img.shields.io/badge/live-nexorahome.vercel.app-302A65?style=for-the-badge)](https://nexorahome.vercel.app)
![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)

</div>

> **Safety note:** NEXORA produces conceptual layouts, not construction-ready drawings. Have qualified professionals verify structural design, local building rules, setbacks and services before building anything.

## ✨ What you can do

- **Draw in 2D** – rooms, walls, doors and windows on an editable canvas with undo/redo, snapping and measurements.
- **See it in 3D** – the 3D model is built from the same design data, so edits show up in both views. Walk through it, switch floors, remove the roof.
- **Browse designs** – a library of 1,200+ generated, checked layouts (villas, duplexes, courtyard, L- and U-shaped homes) with search, filters and favourites. These are generated layouts, not photographs of real houses.
- **Start from a photo** – describe the house in a photo (floors, roof, balcony), set your plot, rooms and staircase side, and review proposed layouts. The photo stays on your device and is not analysed automatically.
- **Stairs and terrace** – stairs line up between floors and reach the terrace; a checker flags disconnected stairs, blocked terrace access and furniture outside the boundary.
- **Terrace designer** – six styles (Modern Minimalist, Indian Family, Rooftop Garden, Luxury Lounge, Compact, Party) placed as real furniture you can move, rotate, resize, duplicate and recolour.
- **Interior designer** – furnish every room from a catalogue.
- **Save and export** – projects are saved to your account; export 2D drawings, sheets and 3D models.
- **Light and dark themes**, sign-in with email codes, and a feedback form that reaches the team privately.

## 🧱 Project layout

| Folder | What is in it |
| --- | --- |
| `apps/web` | Next.js + TypeScript app (2D editor, 3D viewer, library, terrace and interior designers) |
| `services/api` | FastAPI backend: layout engine, geometry and circulation checks, design library, auth, projects |
| `packages/design-schema` | Shared TypeScript types and validation for the floor-plan JSON |
| `database/migrations` | PostgreSQL schema migrations |
| `infra` | Local Docker Compose services |
| `docs` | Architecture, API, data model, security, email setup and roadmap |

The **floor-plan JSON** is the single source of truth: the 2D editor, 3D scene, validation and exports all read it.

## 🚀 Run it locally

You need Node.js 20+ and Python 3.11+. Docker is optional (for Postgres).

```bash
# 1. configuration (never commit real secrets)
cp .env.example services/api/.env

# 2. API
cd services/api
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
cd ../..

# 3. web app
npm install

# 4. start both (API on :8000, web on :3000)
npm run dev
```

Open <http://localhost:3000>. API docs: <http://localhost:8000/docs>.

In development, if no email is configured, sign-in and verification codes are printed in the API terminal.

## 🧪 Checks

```bash
npm --workspace apps/web run test       # web tests (Vitest)
npm run lint                            # ESLint
npx tsc --noEmit -p apps/web            # types
cd services/api && pytest               # API tests
```

## ☁️ Deploying

- **Web** – Vercel, root directory `apps/web`. Set `API_PROXY_TARGET` to the API's URL so the site calls its own `/api` (keeps the login cookie first-party).
- **API** – Vercel (root `services/api`) or Render (`render.yaml`), with a Postgres database (for example Neon). Set `APP_ENV=production`, `DATABASE_URL` and `API_CORS_ORIGINS`.
- **Email** – see [docs/EMAIL.md](docs/EMAIL.md). Send from a verified domain with SPF, DKIM and DMARC for reliable delivery.

## 🔐 Security

Passwords are hashed (scrypt), sessions are server-side with httpOnly cookies, every sign-in is confirmed with an emailed code, and cross-origin writes are rejected. More in [docs/SECURITY.md](docs/SECURITY.md).

## 🗺️ Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md).

---

<div align="center">

Built by [Sumit Bhamu](https://github.com/Sumit0802-afk)

</div>
