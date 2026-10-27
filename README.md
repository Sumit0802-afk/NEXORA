<!-- Header -->
<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:302A65,50:5146A5,100:FFF4D6&text=NEXORA&fontColor=ffffff&fontSize=80&fontAlignY=38&desc=Design%20homes%20you%20can%20walk%20through.&descAlignY=60&descSize=18&animation=fadeIn" alt="NEXORA — Design homes you can walk through." width="100%" />
</p>

<!-- Views -->
<p align="right">
  <a href="https://github.com/Sumit0802-afk/NEXORA">
    <img src="https://komarev.com/ghpvc/?username=Sumit0802-afk-NEXORA&label=Repo%20Views&color=5146A5&style=flat" alt="Repo views" />
  </a>
</p>

<!-- Typing SVG -->
<p align="center">
  <a href="https://nexorahome.vercel.app">
    <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=22&duration=3500&pause=900&color=5146A5&center=true&vCenter=true&multiline=false&repeat=true&random=false&width=760&height=50&lines=A+home-design+studio+in+your+browser;2D+plans+%C2%B7+3D+walkthrough+%C2%B7+Interior+%C2%B7+Terrace;From+a+plot+of+land+to+a+home+you+can+walk+through" alt="A home-design studio in your browser" />
  </a>
</p>

<!-- Links -->
<p align="center">
  <a href="https://nexorahome.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/Live_Demo-302A65?style=for-the-badge&logo=vercel&logoColor=white" alt="Live demo" />
  </a>&nbsp;
  <a href="https://github.com/Sumit0802-afk/NEXORA" target="_blank">
    <img src="https://img.shields.io/badge/Repository-302A65?style=for-the-badge&logo=github&logoColor=white" alt="Repository" />
  </a>&nbsp;
  <a href="#-quick_start">
    <img src="https://img.shields.io/badge/Quick_Start-302A65?style=for-the-badge&logo=gnubash&logoColor=white" alt="Quick start" />
  </a>&nbsp;
  <a href="#-deploy">
    <img src="https://img.shields.io/badge/Deploy-302A65?style=for-the-badge&logo=rocket&logoColor=white" alt="Deploy" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/React_18-000000?style=flat-square&logo=react&logoColor=61DAFB" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-000000?style=flat-square&logo=typescript&logoColor=3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/FastAPI-000000?style=flat-square&logo=fastapi&logoColor=009688" alt="FastAPI" />
  <img src="https://img.shields.io/badge/SQLAlchemy-000000?style=flat-square&logo=python&logoColor=3776AB" alt="SQLAlchemy" />
  <img src="https://img.shields.io/badge/PostgreSQL-000000?style=flat-square&logo=postgresql&logoColor=4169E1" alt="PostgreSQL" />
</p>

<br>

<!-- At a glance -->
<table align="center">
  <tr>
    <td align="center" width="25%" valign="top">
      <h3>📐</h3>
      <b>2D floor plans</b><br>
      <sub>Rooms, walls, doors and windows on an editable canvas</sub>
    </td>
    <td align="center" width="25%" valign="top">
      <h3>🏠</h3>
      <b>3D walkthrough</b><br>
      <sub>The 3D model is built from the same plan, always in sync</sub>
    </td>
    <td align="center" width="25%" valign="top">
      <h3>📚</h3>
      <b>Design library</b><br>
      <sub>1,200+ generated, checked layouts to start from</sub>
    </td>
    <td align="center" width="25%" valign="top">
      <h3>🌇</h3>
      <b>Terrace designer</b><br>
      <sub>Six styles of real, editable furniture on your roof</sub>
    </td>
  </tr>
</table>

<br>

<blockquote align="center">
  <b>The plan is one source of truth. Draw it once, see it everywhere.</b>
</blockquote>

> **Safety note:** NEXORA produces conceptual layouts, not construction-ready drawings. Have qualified professionals check structure, local building rules, setbacks and services before building.

<!-- From plot to home -->
```mermaid
flowchart LR
    A([📏 Your plot]) --> B[📚 Pick a layout<br/>or start from a photo]
    B --> C[✅ Stairs and terrace<br/>are checked]
    C --> D[✏️ Edit in 2D]
    D --> E[🏠 Walk through in 3D]
    E --> F([📤 Drawings · sheets · 3D model])
```

<br>

<!-- About -->
## `> about.ts`

```typescript
const nexora = {
    tagline: "Design homes you can walk through.",
    what: "A home-design studio in the browser: plan in 2D, explore in 3D, furnish, and plan the terrace",
    liveDemo: "https://nexorahome.vercel.app",
    parts: ["2D editor", "3D viewer", "Design library", "Photo to plan", "Terrace designer", "Interior designer"],
    stack: {
        frontend: ["Next.js 14", "React 18", "TypeScript", "react-konva", "react-three-fiber"],
        backend: ["Python 3.12", "FastAPI", "SQLAlchemy", "Pydantic"],
        database: ["PostgreSQL"],
        hosting: ["Vercel", "Neon"]
    },
    exports: ["2D drawings", "architectural sheets", "3D model"],
    belief: "Draw it once. Every view and every export comes from the same plan."
};
```

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=0:302A65,50:5146A5,100:FFF4D6" alt="" width="100%" />
</p>

<!-- Tech Stack -->
## `> tech_stack`

<p align="center">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=nextjs,react,ts,threejs,python,fastapi,postgres,vercel,git,github&theme=dark&perline=10" alt="Next.js, React, TypeScript, three.js, Python, FastAPI, PostgreSQL, Vercel, Git, GitHub" />
  </a>
</p>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=0:302A65,50:5146A5,100:FFF4D6" alt="" width="100%" />
</p>

<!-- Features -->
## `> features`

<table align="center">
  <tr>
    <td width="33%" valign="top">
      ✏️ &nbsp;<b>2D editor</b><br>
      <sub>Rooms, walls, doors, windows, snapping, measuring and undo/redo</sub>
    </td>
    <td width="33%" valign="top">
      🧊 &nbsp;<b>3D viewer</b><br>
      <sub>Orbit, top and iso views, floor switching, roof on or off, labels</sub>
    </td>
    <td width="33%" valign="top">
      🚶 &nbsp;<b>Walkthrough</b><br>
      <sub>Walk through the house and climb the stairs</sub>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      📚 &nbsp;<b>Design library</b><br>
      <sub>Search, filter by floors, bedrooms and plot size, and favourite</sub>
    </td>
    <td width="33%" valign="top">
      📷 &nbsp;<b>Photo to plan</b><br>
      <sub>Describe a house you like; get estimated layouts for your plot</sub>
    </td>
    <td width="33%" valign="top">
      🪜 &nbsp;<b>Stairs and terrace</b><br>
      <sub>Stairs line up between floors and reach the terrace</sub>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      🌿 &nbsp;<b>Terrace designer</b><br>
      <sub>Seating, planters, pergola, kitchen and lights you can move and recolour</sub>
    </td>
    <td width="33%" valign="top">
      🛋️ &nbsp;<b>Interior designer</b><br>
      <sub>Furnish every room from a catalogue</sub>
    </td>
    <td width="33%" valign="top">
      📤 &nbsp;<b>Exports</b><br>
      <sub>2D drawings, architectural sheets and a 3D model</sub>
    </td>
  </tr>
</table>

<details>
<summary><b>Every feature, in detail</b></summary>
<br>

```typescript
const editor = {
    canvas: "draw rooms and walls, move, resize, split, snap to a grid, measure, undo and redo",
    openings: "doors and windows that slide along their wall",
    floors: "add or duplicate a floor; floors stack to the right height",
    labels: "room names with sizes, switchable on or off in 2D and 3D",
    themes: "light and dark"
};

const library = {
    size: "1,200+ layouts produced and checked by the layout engine",
    honest: "generated layouts, not photographs of real houses",
    filters: ["floors", "bedrooms", "plot size", "style tags", "favourites"],
    open: "adapt a layout to your plot, then open it in the editor"
};

const photoToPlan = {
    input: "a photo (kept on your device) plus what you can see: floors, roof, balcony",
    youSet: ["plot size", "bedrooms and bathrooms", "floors", "staircase side", "terrace style"],
    output: "estimated layouts to review, then edit",
    note: "nothing is read from the photo automatically"
};

const circulation = {
    checks: ["floor heights stack", "stairs on every floor and stacked", "stair not walled in", "terrace reachable",
             "furniture inside the plot and its room"],
    note: "a design check, not a structural check"
};

const accounts = {
    signIn: "email and password, then a one-time code emailed on every sign-in",
    also: ["email verification", "password reset", "change password", "end other sessions"],
    security: "scrypt hashes, server-side sessions, httpOnly cookies, cross-origin writes refused"
};

const feedback = {
    route: "messages go from the server to a private inbox; the address never reaches the browser"
};
```

</details>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=0:302A65,50:5146A5,100:FFF4D6" alt="" width="100%" />
</p>

<!-- Quick Start -->
## `> quick_start`

**You need:** Node.js 20+, Python 3.11+ and PostgreSQL 14 or newer (SQLite also works for trying it out).

```bash
# 1. clone
git clone https://github.com/Sumit0802-afk/NEXORA.git
cd NEXORA

# 2. API  ->  http://localhost:8000
cd services/api
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
cp ../../.env.example .env      # then fill it in, see > config.env
cd ../..

# 3. web app  ->  http://localhost:3000
npm install

# 4. start both together
npm run dev
```

API docs: <http://localhost:8000/docs>. With no email configured in development, sign-in codes are printed in the API terminal.

**Checks**

```bash
npm --workspace apps/web run test    # web tests
npm run lint                         # lint
npx tsc --noEmit -p apps/web         # types
cd services/api && pytest            # API tests
```

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=0:302A65,50:5146A5,100:FFF4D6" alt="" width="100%" />
</p>

<!-- Config -->
## `> config.env`

```bash
# required
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/houseplan   # postgres:// URLs from Neon also work

# when hosted
APP_ENV=production
API_CORS_ORIGINS=              # the website's address, e.g. https://nexorahome.vercel.app

# email (see docs/EMAIL.md)
SMTP_HOST=  SMTP_PORT=  SMTP_USER=  SMTP_PASSWORD=
MAIL_FROM_ADDRESS=             # noreply@your-verified-domain
SUPPORT_INBOX=                 # private inbox for feedback and support; stays on the server

# optional
EMAIL_ASSET_BASE_URL=          # public URL of the web app's /email folder
AI_PROVIDER=mock               # rule-based by default
```

The web app needs nothing locally. When hosted, set `API_PROXY_TARGET` (the API's address) so the site calls its own `/api`.
`.env` files stay on your machine and are ignored by Git.

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=0:302A65,50:5146A5,100:FFF4D6" alt="" width="100%" />
</p>

<!-- Architecture -->
## `> architecture`

```mermaid
flowchart LR
    U([Browser]) --> F[Web app<br/>Next.js on Vercel]
    F -- "/api (rewritten)" --> B[API<br/>FastAPI on Vercel]
    B --> D[(PostgreSQL<br/>Neon)]
    B --> M[Email<br/>SMTP]
    B --> L[Layout engine<br/>and design library]
```

```
NEXORA/
├── apps/web/src/
│   ├── app/                   pages: studio, 3D, sheets, library, photo, login, account
│   ├── components/            editor · viewer · library · exterior · interior · export
│   └── lib/                   layout, circulation, terrace and export logic, API client
├── services/api/app/
│   ├── api/routes/            auth · projects · library · support · generation · validation
│   ├── domain/                layout engine, geometry and circulation checks, library
│   └── core/                  settings, mailer, email templates, security
├── packages/design-schema/    the floor-plan JSON types shared by web and API
├── database/migrations/       PostgreSQL schema
└── docs/                      architecture · API · data model · security · email · roadmap
```

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=0:302A65,50:5146A5,100:FFF4D6" alt="" width="100%" />
</p>

<!-- Deploy -->
## `> deploy`

The live demo runs on free tiers: two Vercel projects from this one repository, and a Neon database.

```yaml
web:
  host: Vercel
  rootDirectory: apps/web
  env:
    API_PROXY_TARGET: https://<your-api>.vercel.app   # no trailing slash

api:
  host: Vercel            # or Render, see render.yaml
  rootDirectory: services/api
  env:
    APP_ENV: production
    DATABASE_URL: <Neon connection string>
    API_CORS_ORIGINS: https://<your-site>.vercel.app
    # plus the email variables from > config.env
```

For reliable email, send from a verified domain and set up SPF, DKIM and DMARC. Steps are in [`docs/EMAIL.md`](docs/EMAIL.md).

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=0:302A65,50:5146A5,100:FFF4D6" alt="" width="100%" />
</p>

<!-- Docs -->
## `> docs`

| Document | What it covers |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the pieces fit |
| [`docs/API.md`](docs/API.md) | API routes |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | The floor-plan JSON and database |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Sign-in, sessions and protections |
| [`docs/EMAIL.md`](docs/EMAIL.md) | Email sender, SPF, DKIM, DMARC |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What comes next |

<br>

<!-- Footer -->
<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=120&color=0:302A65,50:5146A5,100:FFF4D6&section=footer" alt="" width="100%" />
</p>

<p align="center">
  Built by <a href="https://github.com/Sumit0802-afk"><b>Sumit Bhamu</b></a>
</p>
