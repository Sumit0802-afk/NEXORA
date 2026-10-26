import type { FloorPlan, RoomType } from "@houseplan/design-schema";
import { floorName, floorsLabel } from "./floors";
import { polygonArea } from "./geometry";
import { triggerDownload } from "./export-2d";
import jsPDF from "jspdf";

export type SheetType = "cover" | "floorplan" | "elevations" | "sections" | "schedules";

export interface DrawingSheetMeta {
  sheetNumber: string;
  sheetTitle: string;
  projectName: string;
  clientName: string;
  projectNumber: string;
  date: string;
  scale: string;
  drawnBy: string;
  checkedBy: string;
  revision: string;
  notes: string[];
}

export interface PaperFormat {
  id: "a4" | "a3" | "letter" | "arch_d";
  name: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_FORMATS: Record<string, PaperFormat> = {
  a4: { id: "a4", name: "A4 (297 × 210 mm)", widthMm: 297, heightMm: 210 },
  a3: { id: "a3", name: "A3 (420 × 297 mm)", widthMm: 420, heightMm: 297 },
  letter: { id: "letter", name: "US Letter (11 × 8.5 in)", widthMm: 279.4, heightMm: 215.9 },
  arch_d: { id: "arch_d", name: "Arch D (36 × 24 in)", widthMm: 914.4, heightMm: 609.6 },
};

export const DEFAULT_SHEET_META: DrawingSheetMeta = {
  sheetNumber: "A-101",
  sheetTitle: "GROUND FLOOR PLAN",
  projectName: "RESIDENTIAL HOUSE DESIGN",
  clientName: "CLIENT PROJECT",
  projectNumber: "NX-2026-01",
  date: new Date().toISOString().split("T")[0],
  scale: "1:100",
  drawnBy: "NEXORA STUDIO",
  checkedBy: "ARCHITECTURAL DESK",
  revision: "REV-01",
  notes: [
    "1. All dimensions are in indicated units. Do not scale drawings.",
    "2. All structural members (columns, beams, slabs) shown are preliminary guidelines and must be certified by a licensed structural engineer.",
    "3. Verify all door and window rough opening dimensions on site before fabrication.",
    "4. Drawings are subject to local municipal building bylaws and setback regulations.",
  ],
};

/**
 * Generates Front, Rear, Left, and Right building elevation SVGs from actual floor plan geometry.
 */
export function generateElevationsSvg(
  plan: FloorPlan,
  meta: DrawingSheetMeta = DEFAULT_SHEET_META,
  orientation: "landscape" | "portrait" = "landscape"
): string {
  const units = plan.units || "ft";
  const { width: plotW, length: plotL } = plan.plot;
  const levels = plan.levels;
  const levelCount = levels.length;

  const floorHeight = levels[0]?.wallHeight || (units === "ft" ? 10 : 3.0);
  const plinthHeight = units === "ft" ? 1.5 : 0.45;
  const parapetHeight = units === "ft" ? 3.0 : 0.9;
  const totalBuildingHeight = plinthHeight + levelCount * floorHeight + parapetHeight;

  // ViewBox dimensions
  const vw = 1200;
  const vh = 800;
  const margin = 35;
  const drawingW = vw - margin * 2;
  const drawingH = vh - margin * 2;

  // Two elevation viewports side-by-side or stacked:
  // Top: Front Elevation & Rear Elevation
  // Bottom: Left Elevation & Right Elevation
  const paneW = drawingW * 0.46;
  const paneH = drawingH * 0.38;

  const fmt = (n: number) => +n.toFixed(1);

  // Helper to render an elevation facade
  function renderFacade(
    facadeTitle: string,
    width: number,
    baseX: number,
    baseY: number
  ) {
    const scaleFactor = Math.min((paneW * 0.75) / width, (paneH * 0.7) / totalBuildingHeight);
    const drawW = width * scaleFactor;
    const drawH = totalBuildingHeight * scaleFactor;
    const startX = baseX + (paneW - drawW) / 2 + 30;
    const groundY = baseY + paneH - 25;

    let svg = `
      <!-- Facade: ${facadeTitle} -->
      <g>
        <text x="${baseX + paneW / 2}" y="${baseY + 18}" text-anchor="middle" font-size="13" font-weight="800" fill="#1C183C" letter-spacing="1.5">
          ${facadeTitle.toUpperCase()}
        </text>
        
        <!-- Ground Line & Hatch -->
        <line x1="${baseX + 15}" y1="${groundY}" x2="${baseX + paneW - 15}" y2="${groundY}" stroke="#1D1A3F" stroke-width="2.5" />
        <line x1="${baseX + 15}" y1="${groundY + 4}" x2="${baseX + paneW - 15}" y2="${groundY + 4}" stroke="#7B7796" stroke-width="1" stroke-dasharray="3,3" />

        <!-- Plinth Base -->
        <rect x="${startX - 2}" y="${groundY - plinthHeight * scaleFactor}" width="${drawW + 4}" height="${plinthHeight * scaleFactor}" fill="#484252" stroke="#1D1A3F" stroke-width="1.2" />
        <text x="${startX + drawW / 2}" y="${groundY - plinthHeight * scaleFactor * 0.3}" text-anchor="middle" font-size="8" fill="#FFFFFF" font-weight="600">PLINTH</text>
    `;

    // Floor levels
    let currentY = groundY - plinthHeight * scaleFactor;
    levels.forEach((lvl, idx) => {
      const h = (lvl.wallHeight || floorHeight) * scaleFactor;
      const floorTopY = currentY - h;

      // Facade Wall Body
      const wallFill = idx % 2 === 0 ? "#F8F5EE" : "#F3EFE6";
      svg += `
        <rect x="${startX}" y="${floorTopY}" width="${drawW}" height="${h}" fill="${wallFill}" stroke="#2A2652" stroke-width="1.5" />
        <!-- Level Floor Band -->
        <line x1="${startX - 4}" y1="${floorTopY}" x2="${startX + drawW + 4}" y2="${floorTopY}" stroke="#5146A5" stroke-width="1.5" />
      `;

      // Windows / Openings on this facade
      const winCount = Math.max(1, Math.min(3, Math.floor(width / 10)));
      const winW = Math.min(drawW / (winCount + 1), 3.5 * scaleFactor);
      const winH = 4.0 * scaleFactor;
      const winSpacing = (drawW - winCount * winW) / (winCount + 1);

      for (let w = 1; w <= winCount; w++) {
        const wx = startX + winSpacing * w + winW * (w - 1);
        const wy = floorTopY + h * 0.3;
        svg += `
          <!-- Window Unit -->
          <rect x="${wx}" y="${wy}" width="${winW}" height="${winH}" fill="#C8DCF0" stroke="#1A182E" stroke-width="1.2" />
          <line x1="${wx}" y1="${wy + winH / 2}" x2="${wx + winW}" y2="${wy + winH / 2}" stroke="#1A182E" stroke-width="0.8" />
          <line x1="${wx + winW / 2}" y1="${wy}" x2="${wx + winW / 2}" y2="${wy + winH}" stroke="#1A182E" stroke-width="0.8" />
          <!-- Window Sill -->
          <line x1="${wx - 2}" y1="${wy + winH}" x2="${wx + winW + 2}" y2="${wy + winH}" stroke="#3D3A58" stroke-width="2" />
        `;
      }

      // Ground Floor Entrance Door on Front Elevation
      if (idx === 0 && facadeTitle.includes("Front")) {
        const doorW = Math.min(drawW * 0.22, 4.0 * scaleFactor);
        const doorH = 7.0 * scaleFactor;
        const doorX = startX + drawW * 0.15;
        const doorY = groundY - plinthHeight * scaleFactor - doorH;
        svg += `
          <!-- Main Entrance Door -->
          <rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" fill="#784C28" stroke="#1E1610" stroke-width="1.5" />
          <rect x="${doorX + 2}" y="${doorY + 2}" width="${doorW - 4}" height="${doorH / 2 - 4}" fill="#8D5B32" stroke="#4A2E16" stroke-width="0.8" />
          <circle cx="${doorX + doorW * 0.85}" cy="${doorY + doorH * 0.55}" r="2" fill="#E8C868" />
          <text x="${doorX + doorW / 2}" y="${doorY + doorH * 0.8}" text-anchor="middle" font-size="7" font-weight="700" fill="#FFFFFF">ENTRY</text>
        `;
      }

      // Level Datum Callout on the left
      const levelElevation = plinthHeight + idx * floorHeight;
      svg += `
        <g stroke="#5146A5" stroke-width="0.8">
          <line x1="${baseX + 15}" y1="${floorTopY}" x2="${startX - 6}" y2="${floorTopY}" stroke-dasharray="2,2" />
          <circle cx="${startX - 6}" cy="${floorTopY}" r="3" fill="#FFF4D6" />
        </g>
        <text x="${startX - 12}" y="${floorTopY + 3}" text-anchor="end" font-size="8.5" font-weight="700" fill="#1D1A3F">
          ${floorName(idx).toUpperCase()} +${fmt(levelElevation)} ${units}
        </text>
      `;

      currentY = floorTopY;
    });

    // Rooftop Parapet Wall & Terrace Railing
    const parapetH = parapetHeight * scaleFactor;
    svg += `
      <!-- Rooftop Parapet -->
      <rect x="${startX - 1}" y="${currentY - parapetH}" width="${drawW + 2}" height="${parapetH}" fill="#E8E2D5" stroke="#2A2652" stroke-width="1.5" />
      <line x1="${startX - 3}" y1="${currentY - parapetH}" x2="${startX + drawW + 3}" y2="${currentY - parapetH}" stroke="#1D1A3F" stroke-width="2" />
      <!-- Top Level Marker -->
      <text x="${startX - 12}" y="${currentY - parapetH + 3}" text-anchor="end" font-size="8.5" font-weight="700" fill="#7A1D2E">
        ROOF TOP +${fmt(totalBuildingHeight)} ${units}
      </text>
      <!-- Elevation Dimension Line on the right -->
      <g stroke="#484252" stroke-width="0.8">
        <line x1="${startX + drawW + 15}" y1="${groundY}" x2="${startX + drawW + 15}" y2="${currentY - parapetH}" />
        <line x1="${startX + drawW + 10}" y1="${groundY}" x2="${startX + drawW + 20}" y2="${groundY}" />
        <line x1="${startX + drawW + 10}" y1="${currentY - parapetH}" x2="${startX + drawW + 20}" y2="${currentY - parapetH}" />
      </g>
      <text x="${startX + drawW + 25}" y="${groundY - drawH / 2}" text-anchor="middle" transform="rotate(90 ${startX + drawW + 25} ${groundY - drawH / 2})" font-size="9" font-weight="800" fill="#1D1A3F">
        TOTAL HT: ${fmt(totalBuildingHeight)} ${units}
      </text>
    </g>`;

    return svg;
  }

  // Compose all 4 elevations into standard architectural quadrants
  const q1X = margin + 10;
  const q1Y = margin + 20;
  const q2X = margin + drawingW * 0.52;
  const q2Y = margin + 20;
  const q3X = margin + 10;
  const q3Y = margin + drawingH * 0.44;
  const q4X = margin + drawingW * 0.52;
  const q4Y = margin + drawingH * 0.44;

  const contentSvg = `
    <!-- Quadrant 1: Front Elevation (Road Frontage) -->
    ${renderFacade("North / Front Elevation (Road Facing)", plotW, q1X, q1Y)}

    <!-- Quadrant 2: Rear Elevation -->
    ${renderFacade("South / Rear Elevation", plotW, q2X, q2Y)}

    <!-- Quadrant 3: Left (West) Elevation -->
    ${renderFacade("West / Left Side Elevation", plotL, q3X, q3Y)}

    <!-- Quadrant 4: Right (East) Elevation -->
    ${renderFacade("East / Right Side Elevation", plotL, q4X, q4Y)}
  `;

  return wrapWithArchitecturalSheetBorder(contentSvg, vw, vh, {
    ...meta,
    sheetNumber: "A-201",
    sheetTitle: "BUILDING ELEVATIONS (EXTERIOR FACADES)",
  });
}

/**
 * Generates Transverse & Longitudinal Cross-Section SVGs slicing through the building geometry.
 */
export function generateSectionsSvg(
  plan: FloorPlan,
  meta: DrawingSheetMeta = DEFAULT_SHEET_META,
  cutPositionNormalized = 0.5
): string {
  const units = plan.units || "ft";
  const { width: plotW, length: plotL } = plan.plot;
  const levels = plan.levels;
  const levelCount = levels.length;
  const floorHeight = levels[0]?.wallHeight || (units === "ft" ? 10 : 3.0);
  const slabThick = units === "ft" ? 0.65 : 0.2;
  const plinthHeight = units === "ft" ? 1.5 : 0.45;
  const foundationDepth = units === "ft" ? 4.0 : 1.2;
  const parapetHeight = units === "ft" ? 3.0 : 0.9;
  const totalBuildingHeight = plinthHeight + levelCount * floorHeight + parapetHeight;

  const vw = 1200;
  const vh = 800;
  const margin = 35;
  const drawingW = vw - margin * 2;
  const drawingH = vh - margin * 2;

  const paneW = drawingW - 40;
  const paneH = drawingH * 0.42;
  const fmt = (n: number) => +n.toFixed(1);

  function renderSectionCut(title: string, width: number, startY: number) {
    const scaleFactor = Math.min((paneW * 0.8) / width, (paneH * 0.75) / (totalBuildingHeight + foundationDepth));
    const drawW = width * scaleFactor;
    const startX = margin + (paneW - drawW) / 2 + 30;
    const groundY = startY + paneH - 30;

    let svg = `
      <g>
        <text x="${margin + paneW / 2}" y="${startY + 18}" text-anchor="middle" font-size="13" font-weight="800" fill="#1C183C" letter-spacing="1.5">
          ${title.toUpperCase()}
        </text>

        <!-- Ground Line & Below Grade Earth Hatch -->
        <line x1="${margin + 20}" y1="${groundY}" x2="${margin + paneW - 20}" y2="${groundY}" stroke="#1D1A3F" stroke-width="2.5" />
        <rect x="${startX - 15}" y="${groundY}" width="${drawW + 30}" height="${foundationDepth * scaleFactor}" fill="#EDE8DC" stroke="#8E8577" stroke-dasharray="2,2" opacity="0.6"/>
        <text x="${startX - 20}" y="${groundY + 15}" font-size="8" fill="#786F62">EARTH</text>

        <!-- Foundation Footings & Plinth Beam -->
        <rect x="${startX - 4}" y="${groundY}" width="${drawW + 8}" height="${plinthHeight * scaleFactor}" fill="#C8C2B8" stroke="#1D1A3F" stroke-width="1.5" />
        <text x="${startX + drawW / 2}" y="${groundY + plinthHeight * scaleFactor * 0.7}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#2E2838">R.C.C. PLINTH BEAM</text>
    `;

    // Concrete Footing Pads under cut columns
    const colCount = Math.max(2, Math.floor(width / 12) + 1);
    for (let c = 0; c < colCount; c++) {
      const colX = startX + (c / (colCount - 1)) * drawW;
      const padW = 4.0 * scaleFactor;
      const padH = 1.5 * scaleFactor;
      svg += `
        <!-- Isolated Foundation Footing -->
        <rect x="${colX - padW / 2}" y="${groundY + (foundationDepth - 1.5) * scaleFactor}" width="${padW}" height="${padH}" fill="#A8A298" stroke="#1D1A3F" stroke-width="1.2" />
        <rect x="${colX - 1.5 * scaleFactor}" y="${groundY}" width="${3.0 * scaleFactor}" height="${(foundationDepth - 1.5) * scaleFactor}" fill="#BDB7AD" stroke="#1D1A3F" stroke-width="1" />
      `;
    }

    // Floor levels & interior cut rooms
    let currentY = groundY - plinthHeight * scaleFactor;
    levels.forEach((lvl, idx) => {
      const h = (lvl.wallHeight || floorHeight) * scaleFactor;
      const floorTopY = currentY - h;

      // Slab
      svg += `
        <rect x="${startX - 2}" y="${currentY - slabThick * scaleFactor}" width="${drawW + 4}" height="${slabThick * scaleFactor}" fill="#7A7488" stroke="#1A182E" stroke-width="1.2" />
      `;

      // Cut Interior Rooms
      const roomSliceCount = Math.min(3, Math.max(1, lvl.rooms.length));
      const roomW = drawW / roomSliceCount;

      for (let r = 0; r < roomSliceCount; r++) {
        const rx = startX + r * roomW;
        const roomName = lvl.rooms[r]?.name || (r === 0 ? "Living Area" : r === 1 ? "Dining / Stair" : "Bed / Study");
        const roomType = lvl.rooms[r]?.type || "living_room";

        svg += `
          <!-- Interior Room Bay -->
          <rect x="${rx}" y="${floorTopY}" width="${roomW}" height="${h - slabThick * scaleFactor}" fill="#FAF8F5" stroke="#484260" stroke-width="1" stroke-dasharray="1,1" />
          <text x="${rx + roomW / 2}" y="${floorTopY + h * 0.4}" text-anchor="middle" font-size="10" font-weight="700" fill="#2E2848">${roomName.toUpperCase()}</text>
          <text x="${rx + roomW / 2}" y="${floorTopY + h * 0.55}" text-anchor="middle" font-size="8" fill="#6B668B">CLG HT: ${fmt(floorHeight)} ${units}</text>
        `;

        // Render Cut Staircase if staircase room
        if (roomType === "staircase" || r === 1) {
          const stepCount = 8;
          const stepW = (roomW * 0.6) / stepCount;
          const stepH = (h - slabThick * scaleFactor) / stepCount;
          let stairPath = `M ${rx + 10} ${currentY - slabThick * scaleFactor}`;
          for (let s = 1; s <= stepCount; s++) {
            stairPath += ` L ${rx + 10 + s * stepW} ${currentY - (s - 1) * stepH} L ${rx + 10 + s * stepW} ${currentY - s * stepH}`;
          }
          svg += `
            <!-- Staircase Flight Section Cut -->
            <path d="${stairPath}" fill="none" stroke="#5E4E3E" stroke-width="2.5" />
            <line x1="${rx + 10}" y1="${currentY - slabThick * scaleFactor - 8}" x2="${rx + 10 + stepCount * stepW}" y2="${floorTopY + 12}" stroke="#D4A054" stroke-width="1.5" />
            <text x="${rx + 15}" y="${floorTopY + h * 0.8}" font-size="7.5" font-weight="600" fill="#8B6A3E">R.C.C. WAIST SLAB</text>
          `;
        }
      }

      // External Cut Walls (Bold cross section lineweight)
      svg += `
        <rect x="${startX - 2}" y="${floorTopY}" width="${6}" height="${h}" fill="#403A58" stroke="#1D1A3F" stroke-width="1.8" />
        <rect x="${startX + drawW - 4}" y="${floorTopY}" width="${6}" height="${h}" fill="#403A58" stroke="#1D1A3F" stroke-width="1.8" />
        
        <!-- Floor Level Marker -->
        <line x1="${margin + 25}" y1="${floorTopY}" x2="${startX - 8}" y2="${floorTopY}" stroke="#5146A5" stroke-width="0.8" stroke-dasharray="2,2" />
        <text x="${startX - 12}" y="${floorTopY + 3}" text-anchor="end" font-size="8.5" font-weight="700" fill="#1D1A3F">
          ${floorName(idx).toUpperCase()} SLAB +${fmt(plinthHeight + idx * floorHeight)} ${units}
        </text>
      `;

      currentY = floorTopY;
    });

    // Roof Slab & Parapet
    const pHeight = parapetHeight * scaleFactor;
    svg += `
      <rect x="${startX - 4}" y="${currentY - slabThick * scaleFactor}" width="${drawW + 8}" height="${slabThick * scaleFactor}" fill="#5A5468" stroke="#1A182E" stroke-width="1.5" />
      <rect x="${startX - 2}" y="${currentY - pHeight}" width="5" height="${pHeight}" fill="#3C3650" stroke="#1D1A3F" stroke-width="1.5" />
      <rect x="${startX + drawW - 3}" y="${currentY - pHeight}" width="5" height="${pHeight}" fill="#3C3650" stroke="#1D1A3F" stroke-width="1.5" />
      <text x="${startX + drawW / 2}" y="${currentY - 6}" text-anchor="middle" font-size="8" font-weight="700" fill="#4B476D">TERRACE ROOF SLAB</text>
    </g>`;

    return svg;
  }

  const s1Y = margin + 15;
  const s2Y = margin + drawingH * 0.48;

  const contentSvg = `
    <!-- Section A-A: Transverse Cut Across Building -->
    ${renderSectionCut("Cross Section A-A (Transverse Through Living & Staircase)", plotW, s1Y)}

    <!-- Section B-B: Longitudinal Cut -->
    ${renderSectionCut("Cross Section B-B (Longitudinal Through Building)", plotL, s2Y)}
  `;

  return wrapWithArchitecturalSheetBorder(contentSvg, vw, vh, {
    ...meta,
    sheetNumber: "A-301",
    sheetTitle: "BUILDING SECTIONS (STRUCTURAL & SPATIAL CUTS)",
  });
}

/**
 * Generates Architectural Schedules SVG: Door Schedule, Window Schedule, and Room Finishes Schedule.
 */
export function generateSchedulesSvg(
  plan: FloorPlan,
  meta: DrawingSheetMeta = DEFAULT_SHEET_META
): string {
  const units = plan.units || "ft";
  const levels = plan.levels;
  const vw = 1200;
  const vh = 800;
  const margin = 35;
  const drawingW = vw - margin * 2;
  const fmt = (n: number) => +n.toFixed(1);

  // 1. Compile Door Schedule
  const doorMap = new Map<string, { tag: string; width: number; height: number; type: string; count: number }>();
  let doorCounter = 1;
  levels.forEach((lvl) => {
    lvl.openings
      .filter((o) => o.kind === "door")
      .forEach((d) => {
        const key = `${d.width}x${d.height || 7}`;
        const existing = doorMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          doorMap.set(key, {
            tag: `D${doorCounter++}`,
            width: d.width,
            height: d.height || (units === "ft" ? 7.0 : 2.1),
            type: d.width >= 4 ? "Double Leaf Solid Wood" : "Flush Timber Door",
            count: 1,
          });
        }
      });
  });

  // 2. Compile Window Schedule
  const winMap = new Map<string, { tag: string; width: number; height: number; sill: number; type: string; count: number }>();
  let winCounter = 1;
  levels.forEach((lvl) => {
    lvl.openings
      .filter((o) => o.kind === "window")
      .forEach((w) => {
        const key = `${w.width}x${w.height || 4}`;
        const existing = winMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          winMap.set(key, {
            tag: `W${winCounter++}`,
            width: w.width,
            height: w.height || (units === "ft" ? 4.0 : 1.2),
            sill: w.sillHeight || (units === "ft" ? 3.0 : 0.9),
            type: w.width >= 5 ? "3-Track Sliding Glass" : "2-Track Casement Glass",
            count: 1,
          });
        }
      });
  });

  // 3. Compile Room Areas & Finishes
  const roomRows: { level: string; name: string; type: string; dims: string; area: number; floor: string; wall: string }[] = [];
  levels.forEach((lvl, idx) => {
    lvl.rooms.forEach((r) => {
      const xs = r.polygon.map((p) => p[0]);
      const ys = r.polygon.map((p) => p[1]);
      const rw = Math.max(...xs) - Math.min(...xs);
      const rh = Math.max(...ys) - Math.min(...ys);
      const area = polygonArea(r.polygon as [number, number][]);

      const floorMat = r.interior?.floorMaterial || (r.type === "bathroom" ? "Anti-Skid Ceramic Tile" : r.type === "kitchen" ? "Vitrified Tile" : "Italian Marble");
      const wallFin = r.interior?.wallFinish || (r.type === "bathroom" ? "Glazed Ceramic Dado" : "Acrylic Emulsion Paint");

      roomRows.push({
        level: floorName(idx),
        name: r.name,
        type: r.type,
        dims: `${fmt(rw)} × ${fmt(rh)} ${units}`,
        area,
        floor: floorMat,
        wall: wallFin,
      });
    });
  });

  const doors = Array.from(doorMap.values());
  const windows = Array.from(winMap.values());

  const contentSvg = `
    <!-- Title -->
    <text x="${vw / 2}" y="${margin + 25}" text-anchor="middle" font-size="16" font-weight="900" fill="#1C183C" letter-spacing="2">
      ARCHITECTURAL OPENINGS & ROOM FINISH SCHEDULES
    </text>

    <!-- SECTION 1: DOOR SCHEDULE -->
    <g transform="translate(${margin + 20}, ${margin + 45})">
      <rect x="0" y="0" width="${drawingW * 0.47}" height="24" fill="#2A2652" rx="4" />
      <text x="12" y="16" font-size="11" font-weight="800" fill="#FFF4D6" letter-spacing="1">DOOR SCHEDULE</text>

      <rect x="0" y="28" width="${drawingW * 0.47}" height="${Math.max(doors.length * 20 + 30, 80)}" fill="#FCFCFD" stroke="#D1CCE0" stroke-width="1" />
      <!-- Header -->
      <line x1="0" y1="52" x2="${drawingW * 0.47}" y2="52" stroke="#2A2652" stroke-width="1.2" />
      <text x="12" y="44" font-size="9" font-weight="700" fill="#2E2848">TAG</text>
      <text x="50" y="44" font-size="9" font-weight="700" fill="#2E2848">WIDTH</text>
      <text x="110" y="44" font-size="9" font-weight="700" fill="#2E2848">HEIGHT</text>
      <text x="175" y="44" font-size="9" font-weight="700" fill="#2E2848">DESCRIPTION & MATERIAL</text>
      <text x="${drawingW * 0.47 - 25}" y="44" text-anchor="end" font-size="9" font-weight="700" fill="#2E2848">QTY</text>

      ${doors
        .map(
          (d, i) => `
        <line x1="0" y1="${72 + i * 20}" x2="${drawingW * 0.47}" y2="${72 + i * 20}" stroke="#E6E2F0" stroke-width="0.8" />
        <text x="12" y="${66 + i * 20}" font-size="9" font-weight="800" fill="#5146A5">${d.tag}</text>
        <text x="50" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${fmt(d.width)} ${units}</text>
        <text x="110" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${fmt(d.height)} ${units}</text>
        <text x="175" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${d.type}</text>
        <text x="${drawingW * 0.47 - 25}" y="${66 + i * 20}" text-anchor="end" font-size="9" font-weight="700" fill="#1C183C">${d.count}</text>
      `
        )
        .join("")}
      ${doors.length === 0 ? `<text x="15" y="75" font-size="9" fill="#999">No doors configured yet.</text>` : ""}
    </g>

    <!-- SECTION 2: WINDOW SCHEDULE -->
    <g transform="translate(${margin + drawingW * 0.51}, ${margin + 45})">
      <rect x="0" y="0" width="${drawingW * 0.47}" height="24" fill="#2A2652" rx="4" />
      <text x="12" y="16" font-size="11" font-weight="800" fill="#FFF4D6" letter-spacing="1">WINDOW SCHEDULE</text>

      <rect x="0" y="28" width="${drawingW * 0.47}" height="${Math.max(windows.length * 20 + 30, 80)}" fill="#FCFCFD" stroke="#D1CCE0" stroke-width="1" />
      <line x1="0" y1="52" x2="${drawingW * 0.47}" y2="52" stroke="#2A2652" stroke-width="1.2" />
      <text x="12" y="44" font-size="9" font-weight="700" fill="#2E2848">TAG</text>
      <text x="50" y="44" font-size="9" font-weight="700" fill="#2E2848">WIDTH</text>
      <text x="110" y="44" font-size="9" font-weight="700" fill="#2E2848">HEIGHT</text>
      <text x="170" y="44" font-size="9" font-weight="700" fill="#2E2848">SILL HT</text>
      <text x="235" y="44" font-size="9" font-weight="700" fill="#2E2848">GLAZING / SPEC</text>
      <text x="${drawingW * 0.47 - 25}" y="44" text-anchor="end" font-size="9" font-weight="700" fill="#2E2848">QTY</text>

      ${windows
        .map(
          (w, i) => `
        <line x1="0" y1="${72 + i * 20}" x2="${drawingW * 0.47}" y2="${72 + i * 20}" stroke="#E6E2F0" stroke-width="0.8" />
        <text x="12" y="${66 + i * 20}" font-size="9" font-weight="800" fill="#2B7A9E">${w.tag}</text>
        <text x="50" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${fmt(w.width)} ${units}</text>
        <text x="110" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${fmt(w.height)} ${units}</text>
        <text x="170" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${fmt(w.sill)} ${units}</text>
        <text x="235" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${w.type}</text>
        <text x="${drawingW * 0.47 - 25}" y="${66 + i * 20}" text-anchor="end" font-size="9" font-weight="700" fill="#1C183C">${w.count}</text>
      `
        )
        .join("")}
      ${windows.length === 0 ? `<text x="15" y="75" font-size="9" fill="#999">No windows configured yet.</text>` : ""}
    </g>

    <!-- SECTION 3: ROOM FINISHES & AREA SCHEDULE -->
    <g transform="translate(${margin + 20}, ${margin + 230})">
      <rect x="0" y="0" width="${drawingW - 40}" height="24" fill="#2A2652" rx="4" />
      <text x="12" y="16" font-size="11" font-weight="800" fill="#FFF4D6" letter-spacing="1">ROOM FINISH & AREA SCHEDULE</text>

      <rect x="0" y="28" width="${drawingW - 40}" height="${Math.min(roomRows.length * 20 + 35, 260)}" fill="#FCFCFD" stroke="#D1CCE0" stroke-width="1" />
      <line x1="0" y1="52" x2="${drawingW - 40}" y2="52" stroke="#2A2652" stroke-width="1.2" />
      <text x="12" y="44" font-size="9" font-weight="700" fill="#2E2848">LEVEL</text>
      <text x="110" y="44" font-size="9" font-weight="700" fill="#2E2848">ROOM NAME</text>
      <text x="260" y="44" font-size="9" font-weight="700" fill="#2E2848">DIMENSIONS</text>
      <text x="390" y="44" font-size="9" font-weight="700" fill="#2E2848">FLOOR AREA</text>
      <text x="530" y="44" font-size="9" font-weight="700" fill="#2E2848">FLOOR FINISH SPEC</text>
      <text x="780" y="44" font-size="9" font-weight="700" fill="#2E2848">WALL TREATMENT</text>

      ${roomRows
        .slice(0, 11)
        .map(
          (r, i) => `
        <line x1="0" y1="${72 + i * 20}" x2="${drawingW - 40}" y2="${72 + i * 20}" stroke="#E6E2F0" stroke-width="0.8" />
        <text x="12" y="${66 + i * 20}" font-size="8.5" fill="#6B668B">${r.level}</text>
        <text x="110" y="${66 + i * 20}" font-size="9" font-weight="700" fill="#1C183C">${r.name}</text>
        <text x="260" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${r.dims}</text>
        <text x="390" y="${66 + i * 20}" font-size="9" font-weight="700" fill="#5146A5">${fmt(r.area)} sq ${units}</text>
        <text x="530" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${r.floor}</text>
        <text x="780" y="${66 + i * 20}" font-size="8.5" fill="#3D3A58">${r.wall}</text>
      `
        )
        .join("")}
    </g>
  `;

  return wrapWithArchitecturalSheetBorder(contentSvg, vw, vh, {
    ...meta,
    sheetNumber: "A-401",
    sheetTitle: "ARCHITECTURAL SCHEDULES (DOORS, WINDOWS, FINISHES)",
  });
}

/**
 * Wraps any architectural drawing SVG content inside a formal title block border and project stamp.
 */
export function wrapWithArchitecturalSheetBorder(
  innerSvg: string,
  width: number,
  height: number,
  meta: DrawingSheetMeta
): string {
  const margin = 20;
  const innerMargin = 26;
  const tbHeight = 72;
  const tbY = height - margin - tbHeight;
  const tbW = width - margin * 2;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background:#FFFFFF; font-family:Inter, Arial, sans-serif;">
      <!-- Sheet Outer Border -->
      <rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" fill="none" stroke="#1D1A3F" stroke-width="2.5" />
      <rect x="${innerMargin}" y="${innerMargin}" width="${width - innerMargin * 2}" height="${height - innerMargin * 2}" fill="none" stroke="#8E8AAB" stroke-width="0.8" />

      <!-- Drawing Content Area -->
      ${innerSvg}

      <!-- Architectural Title Block Bar -->
      <g transform="translate(${margin}, ${tbY})">
        <!-- Title Block Box -->
        <rect x="0" y="0" width="${tbW}" height="${tbHeight}" fill="#FAF9FD" stroke="#1D1A3F" stroke-width="2" />
        
        <!-- Column Dividers -->
        <line x1="${tbW * 0.28}" y1="0" x2="${tbW * 0.28}" y2="${tbHeight}" stroke="#3D385E" stroke-width="1.2" />
        <line x1="${tbW * 0.62}" y1="0" x2="${tbW * 0.62}" y2="${tbHeight}" stroke="#3D385E" stroke-width="1.2" />
        <line x1="${tbW * 0.82}" y1="0" x2="${tbW * 0.82}" y2="${tbHeight}" stroke="#3D385E" stroke-width="1.2" />

        <!-- Col 1: Studio & Project Branding -->
        <text x="14" y="22" font-size="14" font-weight="900" fill="#1D1A3F" letter-spacing="1.5">NEXORA ARCHITECTURAL STUDIO</text>
        <text x="14" y="40" font-size="10" font-weight="700" fill="#5146A5">PROJECT: ${meta.projectName.toUpperCase()}</text>
        <text x="14" y="56" font-size="8.5" fill="#6B668B">CLIENT: ${meta.clientName.toUpperCase()} · NO: ${meta.projectNumber}</text>

        <!-- Col 2: Sheet Title & Type -->
        <text x="${tbW * 0.30}" y="20" font-size="8" font-weight="700" fill="#7A7596" letter-spacing="1">DRAWING SHEET</text>
        <text x="${tbW * 0.30}" y="38" font-size="13" font-weight="800" fill="#1D1A3F">${meta.sheetTitle.toUpperCase()}</text>
        <text x="${tbW * 0.30}" y="56" font-size="8.5" fill="#5E587E">PRELIMINARY ARCHITECTURAL DESIGN SET · VERIFY ALL DIMS ON SITE</text>

        <!-- Col 3: Scale & Metadata -->
        <text x="${tbW * 0.64}" y="18" font-size="8" font-weight="600" fill="#6B668B">SCALE: <tspan font-weight="800" fill="#1C183C">${meta.scale}</tspan></text>
        <text x="${tbW * 0.64}" y="34" font-size="8" font-weight="600" fill="#6B668B">DATE: <tspan font-weight="800" fill="#1C183C">${meta.date}</tspan></text>
        <text x="${tbW * 0.64}" y="50" font-size="8" font-weight="600" fill="#6B668B">DRAWN BY: <tspan font-weight="800" fill="#1C183C">${meta.drawnBy}</tspan></text>
        <text x="${tbW * 0.64}" y="64" font-size="8" font-weight="600" fill="#6B668B">STATUS: <tspan font-weight="800" fill="#C53030">PRELIMINARY</tspan></text>

        <!-- Col 4: Sheet Number & Stamp -->
        <text x="${tbW * 0.84}" y="20" font-size="8" font-weight="700" fill="#6B668B">SHEET NO.</text>
        <text x="${tbW * 0.84}" y="46" font-size="20" font-weight="900" fill="#5146A5">${meta.sheetNumber}</text>
        <text x="${tbW * 0.84}" y="62" font-size="8" font-weight="700" fill="#2E2848">${meta.revision}</text>
      </g>
    </svg>
  `;
}

/**
 * Compiles a comprehensive multi-page architectural drawing set PDF containing:
 * - Cover Sheet & Project Info
 * - Dimensioned Floor Plans
 * - 4-Facade Building Elevations
 * - Cross-Sections A-A & B-B
 * - Door, Window & Finish Schedules
 */
export async function exportMultiPageDrawingBookPdf(
  plan: FloorPlan,
  meta: DrawingSheetMeta = DEFAULT_SHEET_META,
  format: "a3" | "a4" = "a3",
  filename?: string
): Promise<void> {
  const paper = PAPER_FORMATS[format] || PAPER_FORMATS.a3;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [paper.widthMm, paper.heightMm],
  });

  // Pages to generate:
  const sheets: { title: string; sheetNo: string; getSvg: () => string }[] = [];

  // Sheet 1: Floor Plans
  plan.levels.forEach((lvl, idx) => {
    sheets.push({
      title: `${floorName(idx).toUpperCase()} PLAN`,
      sheetNo: `A-10${idx + 1}`,
      getSvg: () => {
        const { generateSingleFloorSvg } = require("./export-2d");
        return generateSingleFloorSvg(plan, idx, {
          includeLabels: true,
          includeDimensions: true,
          includeTitleBlock: true,
          includeNorthArrow: true,
          projectName: meta.projectName,
        });
      },
    });
  });

  // Sheet 2: Elevations
  sheets.push({
    title: "BUILDING ELEVATIONS",
    sheetNo: "A-201",
    getSvg: () => generateElevationsSvg(plan, meta),
  });

  // Sheet 3: Sections
  sheets.push({
    title: "BUILDING SECTIONS",
    sheetNo: "A-301",
    getSvg: () => generateSectionsSvg(plan, meta),
  });

  // Sheet 4: Schedules
  sheets.push({
    title: "ARCHITECTURAL SCHEDULES",
    sheetNo: "A-401",
    getSvg: () => generateSchedulesSvg(plan, meta),
  });

  // Render each sheet into PDF
  for (let i = 0; i < sheets.length; i++) {
    if (i > 0) doc.addPage([paper.widthMm, paper.heightMm], "landscape");

    const svgString = sheets[i].getSvg();
    await renderSvgOntoPdfPage(doc, svgString, paper.widthMm, paper.heightMm);
  }

  const fname = filename || `nexora-${plan.projectId || "project"}-complete-drawing-book.pdf`;
  doc.save(fname);
}

async function renderSvgOntoPdfPage(
  doc: jsPDF,
  svgString: string,
  pageWidthMm: number,
  pageHeightMm: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 2.0; // High DPI raster
        canvas.width = Math.round(pageWidthMm * 4 * scale);
        canvas.height = Math.round(pageHeightMm * 4 * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas 2D context");

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        doc.addImage(imgData, "JPEG", 0, 0, pageWidthMm, pageHeightMm);
        resolve();
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG for PDF rendering"));
    };

    img.src = url;
  });
}
