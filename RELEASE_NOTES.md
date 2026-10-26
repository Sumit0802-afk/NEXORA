# NEXORA Studio — v1.0.0-Beta.1 Release Notes

**Architectural Floor Plan & 3D Building Studio**  
*Release Date: October 2026*

---

## 1. Release Overview
NEXORA Studio v1.0.0-beta.1 delivers an end-to-end architectural design, 3D visualization, structural planning, and professional drawing documentation platform. Built on Next.js 14, Three.js, React-Konva, and Zod schemas, NEXORA provides synchronized 2D/3D editing with zero artificial mockups or placeholder workflows.

---

## 2. Key Capabilities Implemented (Steps 10–13)

### Step 10: Professional Drawing Sheets
- **Multi-Sheet Architectural Suite:**
  - **Cover & Summary (Sheet A-001):** Plot boundary, ground coverage, total built-up area, and drawing register.
  - **Dimensioned Floor Plans (Sheets A-101, A-102...):** Scaled plan drawings with room names, area tags, wall thicknesses, door swing arcs, window double-glazing lines, and full exterior dimension chains.
  - **Building Elevations (Sheet A-201):** True 4-facade vector elevations (Front/North, Rear/South, Left/West, Right/East) generated directly from the building's 3D geometry with architectural level datums (Natural Ground ±0.0, Plinth Level, Floor Slabs, Parapet Wall Top).
  - **Building Sections (Sheet A-301):** Cross Section A-A (transverse) and Cross Section B-B (longitudinal) slicing through room bays, staircase waist slabs, floor slabs, plinth beams, and isolated foundation footings.
  - **Architectural Schedules (Sheet A-401):** Automated Door Schedule, Window Schedule, Room Finishes Schedule (flooring material, wall finishes), and project area matrix.
- **Customizable Title Blocks:**
  - Standard architectural border with title block bar (Project Name, Client, Drawing Title, Sheet Number, Scale, Date, Revision Table, North Arrow).
  - Standard ISO A3, ISO A4, US Letter, and Arch D paper size configurations with Landscape and Portrait modes.
- **Printable Multi-Page PDF Compilation:**
  - Export a single sheet or generate a complete multi-page architectural drawing set PDF via `jsPDF`.
  - 3000px high-resolution PNG rasterization and pure vector SVG export.

### Step 11: Structural Planning & Alignment
- **Reinforced Concrete Frame System:**
  - **Columns:** Rectangular (9"×9", 9"×12" / 230×300mm) and circular reinforced concrete columns with center cross marks and dimensional tags.
  - **Beams:** Primary structural beams along load-bearing walls and secondary floor beams connecting column heads.
  - **Foundations:** Isolated reinforced concrete footing pads (3.5×3.5 ft to 4.5×4.5 ft) and plinth tie beams at grade level to resist differential settlement.
- **Automated Structural Grid Generator:**
  - Automatically identifies room corners, wall intersections, and divides long spans exceeding residential thresholds.
- **Multi-Floor Column Alignment Audit:**
  - Detects "floating" or unsupported columns on upper floors that lack continuous column stacks or load-bearing walls beneath.
  - Flags excessive beam spans exceeding recommended residential deflection limits (spans > 18–20 ft / 5.5–6.0 m) with required depth guidelines.
- **Synchronized 2D/3D Visualization:**
  - 2D Canvas: Structural layer with column centerlines, boundary outlines, and dashed beam alignments.
  - 3D Viewer: Real concrete geometry (`StructuralFrameGeometry`) with foundation pads below grade, column stacks, and floor beams.
- **Engineering Disclaimer:** Prominently labels all structural members as preliminary spatial planning guidelines requiring licensed structural engineer certification prior to construction.

### Step 12: Production Readiness & Quality Assurance
- **Full End-to-End Synchronization:**
  - Any edit in 2D (adding/moving rooms, walls, doors, windows, columns, furniture) updates the 3D model and drawing sheets synchronously.
- **Production Build & Test Coverage:**
  - All test suites passing (85+ tests across 12 test files).
  - TypeScript strict compilation: zero type errors (`tsc --noEmit`).
  - Next.js production build verified.

### Step 13: Beta Release & User Feedback
- **User Feedback & Bug Reporting System:**
  - In-app feedback dialog with category selection (Bug Report, Feature Request, Drawing/PDF, Structural, General), 1–5 star rating, detailed message, and optional contact email.
  - Anonymous diagnostics capture (screen resolution, browser, viewport dimensions, project stats) with zero personal identifiable information (PII).
- **Protected Admin Telemetry Dashboard:**
  - Protected administrative console at `/admin/feedback` to review user submissions, filter by category/status, inspect diagnostic payloads, and export feedback data.
- **Error Boundary & Recovery:**
  - `StudioErrorBoundary` protects 2D and 3D viewports, preventing full-page crashes with one-click viewport recovery and automatic error reporting.
- **Version Modal & Changelog:**
  - In-app version dialog displaying release highlights and legal notices.

---

## 3. Supported Technical Specifications
- **Framework:** Next.js 14 (App Router)
- **3D Graphics:** Three.js r171, `@react-three/fiber`, `@react-three/drei`
- **2D Drawing Canvas:** Konva & `react-konva`
- **PDF Generation:** `jsPDF`
- **Schema Validation:** Zod
- **3D Model Formats:** Binary GLB (`.glb`), Wavefront OBJ (`.obj`), PNG Screenshot
- **2D Drawing Formats:** PDF, PNG (300 DPI), SVG

---

## 4. Known Limitations & Next Steps
- Structural rebar reinforcement detailing (stirrups, bar bending schedules) is conceptual and must be certified by a licensed structural engineer.
- Site slope / topography grading is planned for v1.1.
