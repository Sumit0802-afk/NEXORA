import type { FloorPlan, RoomType, Wall, Opening } from "@houseplan/design-schema";
import { floorName } from "./floors";
import { polygonArea } from "./geometry";
import jsPDF from "jspdf";

export type Export2DOptions = {
  levelIndex?: number;
  allFloors?: boolean;
  includeLabels?: boolean;
  includeDimensions?: boolean;
  includeGrid?: boolean;
  includeTitleBlock?: boolean;
  includeNorthArrow?: boolean;
  northAngle?: number;
  projectName?: string;
  units?: "ft" | "m";
};

export type Export2DPdfOptions = Export2DOptions & {
  orientation?: "landscape" | "portrait";
  paperSize?: "a4" | "a3" | "letter";
};

const ROOM_COLORS: Record<RoomType, { fill: string; stroke: string; label: string }> = {
  living_room: { fill: "#F7F1E5", stroke: "#8C6A3E", label: "Living Room" },
  dining_room: { fill: "#F8EFE3", stroke: "#9C6B38", label: "Dining Room" },
  kitchen:     { fill: "#EEF5E8", stroke: "#4E7B42", label: "Kitchen" },
  bedroom:     { fill: "#ECE9F7", stroke: "#5E568F", label: "Bedroom" },
  bathroom:    { fill: "#E2F0F4", stroke: "#3E7B8D", label: "Bathroom" },
  study:       { fill: "#F3ECF6", stroke: "#77508B", label: "Study" },
  staircase:   { fill: "#EDE6DC", stroke: "#6E6254", label: "Staircase" },
  parking:     { fill: "#EAE9EE", stroke: "#5D5970", label: "Parking" },
  utility:     { fill: "#EFECE6", stroke: "#746E65", label: "Utility" },
  corridor:    { fill: "#F3F2F7", stroke: "#656080", label: "Corridor" },
  hallway:     { fill: "#F3F2F7", stroke: "#656080", label: "Hallway" },
  balcony:     { fill: "#E3ECE5", stroke: "#3D7A59", label: "Balcony" },
  other:       { fill: "#EAECE8", stroke: "#5E6E60", label: "Space" },
};

export function triggerDownload(dataUrlOrBlob: string | Blob, filename: string) {
  if (typeof window === "undefined") return;
  const url = typeof dataUrlOrBlob === "string" ? dataUrlOrBlob : URL.createObjectURL(dataUrlOrBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof dataUrlOrBlob !== "string") {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

/** Generates clean SVG markup for a single level of a floor plan. */
export function generateSingleFloorSvg(
  plan: FloorPlan,
  levelIndex = 0,
  options: Export2DOptions = {}
): string {
  const level = plan.levels[levelIndex] ?? plan.levels[0];
  if (!level) return "";

  const {
    includeLabels = true,
    includeDimensions = true,
    includeGrid = false,
    includeTitleBlock = true,
    includeNorthArrow = true,
    northAngle = 0,
    projectName = plan.projectId || "House Design",
  } = options;

  const units = plan.units || "ft";
  const { width: plotW, length: plotL } = plan.plot;

  // Margin and layout sizing
  const scale = Math.max(plotW, plotL) / 45;
  const pad = scale * 4.5;
  const titleBlockHeight = includeTitleBlock ? scale * 8 : 0;
  const viewBoxW = plotW + pad * 2.5;
  const viewBoxH = plotL + pad * 2.8 + titleBlockHeight;
  const originX = -pad * 1.25;
  const originY = -pad * 1.6;

  const wallStroke = Math.max(scale * 0.45, 0.4);
  const wallMap = new Map<string, Wall>(level.walls.map((w) => [w.id, w]));

  // Calculate total built-up area for this floor
  let floorArea = 0;
  level.rooms.forEach((r) => {
    floorArea += polygonArea(r.polygon as [number, number][]);
  });

  const svgParts: string[] = [];

  // SVG Header
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${originX} ${originY} ${viewBoxW} ${viewBoxH}" width="100%" height="100%" style="background:#FFFFFF; font-family:Inter, Arial, sans-serif;">`
  );

  // Defs & Styles
  svgParts.push(`
    <defs>
      <pattern id="archGrid" width="${scale * 2}" height="${scale * 2}" patternUnits="userSpaceOnUse">
        <path d="M ${scale * 2} 0 L 0 0 0 ${scale * 2}" fill="none" stroke="#E2E2EA" stroke-width="0.3" stroke-dasharray="1,1"/>
      </pattern>
      <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4B4869"/>
      </marker>
    </defs>
  `);

  // Optional Architectural Background Grid
  if (includeGrid) {
    svgParts.push(`<rect x="${originX}" y="${originY}" width="${viewBoxW}" height="${viewBoxH}" fill="url(#archGrid)" opacity="0.6" />`);
  }

  // Border & Frame
  svgParts.push(
    `<rect x="${originX + scale}" y="${originY + scale}" width="${viewBoxW - scale * 2}" height="${viewBoxH - scale * 2}" fill="none" stroke="#221E42" stroke-width="${scale * 0.2}" />`
  );
  svgParts.push(
    `<rect x="${originX + scale * 1.4}" y="${originY + scale * 1.4}" width="${viewBoxW - scale * 2.8}" height="${viewBoxH - scale * 2.8}" fill="none" stroke="#9995AF" stroke-width="${scale * 0.08}" />`
  );

  // Plot Boundary
  svgParts.push(
    `<rect x="0" y="0" width="${plotW}" height="${plotL}" fill="#FCFCFA" stroke="#1D1A3F" stroke-width="${wallStroke * 1.8}" stroke-dasharray="${level.rooms.length === 0 ? "4,4" : "none"}" />`
  );

  // Street / Access indicator
  svgParts.push(
    `<text x="${plotW / 2}" y="${-scale * 0.8}" text-anchor="middle" font-size="${scale * 1.3}" font-weight="700" fill="#6B668B" letter-spacing="2">▲ ROAD / ENTRY FRONTAGE ▲</text>`
  );

  // Rooms
  level.rooms.forEach((room) => {
    const xs = room.polygon.map((p) => p[0]);
    const ys = room.polygon.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rw = maxX - minX;
    const rh = maxY - minY;
    const rArea = polygonArea(room.polygon as [number, number][]);

    const style = ROOM_COLORS[room.type] || ROOM_COLORS.other;
    const pts = room.polygon.map(([x, y]) => `${x},${y}`).join(" ");

    svgParts.push(
      `<polygon points="${pts}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${wallStroke * 0.7}" />`
    );

    // Architectural Room Labels
    if (includeLabels) {
      const cx = minX + rw / 2;
      const cy = minY + rh / 2;
      const fontSize = Math.max(scale * 0.9, Math.min(scale * 1.6, rw / (room.name.length * 0.7 + 1)));

      if (rw > scale * 1.8 && rh > scale * 1.8) {
        svgParts.push(`
          <g text-anchor="middle" pointer-events="none">
            <text x="${cx}" y="${cy - fontSize * 0.4}" font-size="${fontSize}" font-weight="700" fill="#1E1B38">${room.name}</text>
            <text x="${cx}" y="${cy + fontSize * 0.8}" font-size="${fontSize * 0.75}" font-weight="500" fill="#585472">${rw.toFixed(1)} × ${rh.toFixed(1)} ${units}</text>
            <text x="${cx}" y="${cy + fontSize * 1.8}" font-size="${fontSize * 0.65}" font-weight="400" fill="#7C7896">${rArea.toFixed(1)} sq ${units}</text>
          </g>
        `);
      }
    }

    // Special rendering for Staircase
    if (room.type === "staircase") {
      const stepCount = Math.max(6, Math.floor(rh / (scale * 0.6)));
      const stepHeight = rh / stepCount;
      for (let s = 1; s < stepCount; s++) {
        const sy = minY + s * stepHeight;
        svgParts.push(
          `<line x1="${minX + 0.2}" y1="${sy}" x2="${maxX - 0.2}" y2="${sy}" stroke="#8E8577" stroke-width="${scale * 0.12}" stroke-dasharray="2,1" />`
        );
      }
      // Direction arrow
      svgParts.push(
        `<line x1="${minX + rw / 2}" y1="${maxY - rh * 0.2}" x2="${minX + rw / 2}" y2="${minY + rh * 0.2}" stroke="#5E5345" stroke-width="${scale * 0.2}" marker-end="url(#arrow)" />`
      );
      svgParts.push(
        `<text x="${minX + rw / 2 + scale * 0.5}" y="${minY + rh * 0.5}" font-size="${scale * 0.8}" font-weight="600" fill="#5E5345">UP</text>`
      );
    }
  });

  // Terrace furniture (seating, planters, pergola, path…) so the terrace layout appears in sheets and exports
  ((level.furniture ?? []) as Array<{ category?: string; name?: string; type?: string; position?: number[]; rotation?: number; scale?: number[]; dimensions?: { width: number; depth: number }; material?: { color?: string } }>)
    .filter((f) => f.category === "terrace" && f.position && f.dimensions)
    .forEach((f) => {
      const odd = Math.round((f.rotation ?? 0) / (Math.PI / 2)) % 2 !== 0;
      const w = f.dimensions!.width * (f.scale?.[0] ?? 1);
      const d = f.dimensions!.depth * (f.scale?.[2] ?? 1);
      const fw = odd ? d : w;
      const fd = odd ? w : d;
      const path = f.type === "walking_path";
      const color = typeof f.material?.color === "string" ? f.material.color : "#9A8F6F";
      svgParts.push(
        `<rect x="${f.position![0] - fw / 2}" y="${f.position![1] - fd / 2}" width="${fw}" height="${fd}" rx="${Math.min(fw, fd) * 0.1}" fill="${color}" fill-opacity="${path ? 0.3 : 0.8}" stroke="#4B4375" stroke-width="${wallStroke * 0.3}"><title>${String(f.name ?? "").replace(/[<&>]/g, "")}</title></rect>`
      );
    });

  // Walls
  level.walls.forEach((w) => {
    const isInterior = w.kind === "interior";
    const strokeWidth = isInterior ? wallStroke * 0.95 : wallStroke * 1.35;
    const strokeColor = isInterior ? "#48436B" : "#1B1736";
    svgParts.push(
      `<line x1="${w.start[0]}" y1="${w.start[1]}" x2="${w.end[0]}" y2="${w.end[1]}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="square" />`
    );
  });

  // Openings: Doors and Windows
  level.openings.forEach((op) => {
    const host = wallMap.get(op.wallId);
    if (!host) return;

    const [sx, sy] = host.start;
    const [ex, ey] = host.end;
    const len = Math.hypot(ex - sx, ey - sy) || 1;
    const ux = (ex - sx) / len;
    const uy = (ey - sy) / len;
    const nx = -uy;
    const ny = ux;

    const half = op.width / 2;
    const cx = sx + ux * op.offset;
    const cy = sy + uy * op.offset;
    const ax = cx - ux * half;
    const ay = cy - uy * half;
    const bx = cx + ux * half;
    const by = cy + uy * half;

    if (op.kind === "window") {
      // Clear wall underneath
      svgParts.push(
        `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#FFFFFF" stroke-width="${wallStroke * 1.5}" />`
      );
      // Window sill & frame
      svgParts.push(
        `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#1D1A3F" stroke-width="${wallStroke * 0.35}" />`
      );
      // Glazing lines
      const gOffset = scale * 0.18;
      svgParts.push(`
        <line x1="${ax + nx * gOffset}" y1="${ay + ny * gOffset}" x2="${bx + nx * gOffset}" y2="${by + ny * gOffset}" stroke="#2B7A9E" stroke-width="${wallStroke * 0.25}" />
        <line x1="${ax - nx * gOffset}" y1="${ay - ny * gOffset}" x2="${bx - nx * gOffset}" y2="${by - ny * gOffset}" stroke="#2B7A9E" stroke-width="${wallStroke * 0.25}" />
      `);
    } else {
      // Door: Clear wall
      svgParts.push(
        `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#FFFFFF" stroke-width="${wallStroke * 1.5}" />`
      );
      // Door leaf (opened at 90 degrees)
      const leafEndX = ax + nx * op.width;
      const leafEndY = ay + ny * op.width;
      svgParts.push(
        `<line x1="${ax}" y1="${ay}" x2="${leafEndX}" y2="${leafEndY}" stroke="#8B5E3C" stroke-width="${wallStroke * 0.5}" />`
      );
      // Swing arc
      svgParts.push(
        `<path d="M ${bx} ${by} A ${op.width} ${op.width} 0 0 1 ${leafEndX} ${leafEndY}" fill="none" stroke="#9A7B62" stroke-width="${wallStroke * 0.2}" stroke-dasharray="1.5,1.5" />`
      );
    }
  });

  // Exterior Dimensions
  if (includeDimensions) {
    const dimOffset = scale * 1.8;
    const dimColor = "#443F63";
    const dimFs = scale * 0.95;

    // Bottom Dimension (Width)
    const dimY = plotL + dimOffset;
    svgParts.push(`
      <g stroke="${dimColor}" stroke-width="${scale * 0.08}">
        <line x1="0" y1="${plotL + scale * 0.4}" x2="0" y2="${dimY + scale * 0.4}" />
        <line x1="${plotW}" y1="${plotL + scale * 0.4}" x2="${plotW}" y2="${dimY + scale * 0.4}" />
        <line x1="0" y1="${dimY}" x2="${plotW}" y2="${dimY}" />
        <line x1="${-scale * 0.3}" y1="${dimY - scale * 0.3}" x2="${scale * 0.3}" y2="${dimY + scale * 0.3}" stroke-width="${scale * 0.16}" />
        <line x1="${plotW - scale * 0.3}" y1="${dimY - scale * 0.3}" x2="${plotW + scale * 0.3}" y2="${dimY + scale * 0.3}" stroke-width="${scale * 0.16}" />
      </g>
      <text x="${plotW / 2}" y="${dimY - scale * 0.35}" text-anchor="middle" font-size="${dimFs}" font-weight="700" fill="${dimColor}">
        ${plotW.toFixed(1)} ${units}
      </text>
    `);

    // Right Dimension (Length)
    const dimX = plotW + dimOffset;
    svgParts.push(`
      <g stroke="${dimColor}" stroke-width="${scale * 0.08}">
        <line x1="${plotW + scale * 0.4}" y1="0" x2="${dimX + scale * 0.4}" y2="0" />
        <line x1="${plotW + scale * 0.4}" y1="${plotL}" x2="${dimX + scale * 0.4}" y2="${plotL}" />
        <line x1="${dimX}" y1="0" x2="${dimX}" y2="${plotL}" />
        <line x1="${dimX - scale * 0.3}" y1="${-scale * 0.3}" x2="${dimX + scale * 0.3}" y2="${scale * 0.3}" stroke-width="${scale * 0.16}" />
        <line x1="${dimX - scale * 0.3}" y1="${plotL - scale * 0.3}" x2="${dimX + scale * 0.3}" y2="${plotL + scale * 0.3}" stroke-width="${scale * 0.16}" />
      </g>
      <text x="${dimX + scale * 0.5}" y="${plotL / 2}" text-anchor="middle" transform="rotate(90 ${dimX + scale * 0.5} ${plotL / 2})" font-size="${dimFs}" font-weight="700" fill="${dimColor}">
        ${plotL.toFixed(1)} ${units}
      </text>
    `);
  }

  // North Arrow Indicator
  if (includeNorthArrow) {
    const naX = plotW + scale * 0.5;
    const naY = -pad * 0.7;
    const naRadius = scale * 1.5;
    svgParts.push(`
      <g transform="translate(${naX}, ${naY}) rotate(${northAngle})">
        <circle cx="0" cy="0" r="${naRadius}" fill="#FFFFFF" stroke="#221E42" stroke-width="${scale * 0.12}"/>
        <polygon points="0,${-naRadius * 0.85} ${-naRadius * 0.35},${naRadius * 0.65} 0,${naRadius * 0.3} ${naRadius * 0.35},${naRadius * 0.65}" fill="#E53E3E" stroke="#221E42" stroke-width="${scale * 0.06}" />
        <polygon points="0,${-naRadius * 0.85} 0,${naRadius * 0.3} ${naRadius * 0.35},${naRadius * 0.65}" fill="#C53030" />
        <text x="0" y="${-naRadius * 1.1}" text-anchor="middle" font-size="${scale * 0.8}" font-weight="900" fill="#221E42">N</text>
      </g>
    `);
  }

  // Scale Bar
  const sbX = 0;
  const sbY = plotL + pad * 1.8;
  const sbLen = Math.min(plotW * 0.35, 10);
  svgParts.push(`
    <g transform="translate(${sbX}, ${sbY})">
      <rect x="0" y="0" width="${sbLen}" height="${scale * 0.35}" fill="#1D1A3F" />
      <rect x="${sbLen / 2}" y="0" width="${sbLen / 2}" height="${scale * 0.35}" fill="#E2E2EA" stroke="#1D1A3F" stroke-width="${scale * 0.06}" />
      <text x="0" y="${scale * 0.9}" font-size="${scale * 0.65}" fill="#504C6E">0</text>
      <text x="${sbLen / 2}" y="${scale * 0.9}" font-size="${scale * 0.65}" text-anchor="middle" fill="#504C6E">${(sbLen / 2).toFixed(0)}</text>
      <text x="${sbLen}" y="${scale * 0.9}" font-size="${scale * 0.65}" text-anchor="end" fill="#504C6E">${sbLen.toFixed(0)} ${units}</text>
    </g>
  `);

  // Architectural Title Block
  if (includeTitleBlock) {
    const tbX = originX + scale * 2;
    const tbY = plotL + pad * 2.2;
    const tbW = viewBoxW - scale * 4;
    const tbH = scale * 6.5;

    svgParts.push(`
      <g transform="translate(${tbX}, ${tbY})">
        <rect x="0" y="0" width="${tbW}" height="${tbH}" fill="#FBFBFC" stroke="#221E42" stroke-width="${scale * 0.16}" />
        <line x1="${tbW * 0.45}" y1="0" x2="${tbW * 0.45}" y2="${tbH}" stroke="#D1CEE0" stroke-width="${scale * 0.08}" />
        <line x1="${tbW * 0.72}" y1="0" x2="${tbW * 0.72}" y2="${tbH}" stroke="#D1CEE0" stroke-width="${scale * 0.08}" />
        
        <!-- Left: Project & Studio Info -->
        <text x="${scale * 1.2}" y="${scale * 2.0}" font-size="${scale * 1.35}" font-weight="900" fill="#1C183C" letter-spacing="1">NEXORA ARCHITECTURAL STUDIO</text>
        <text x="${scale * 1.2}" y="${scale * 3.6}" font-size="${scale * 1.05}" font-weight="600" fill="#4B476D">PROJECT: ${projectName.toUpperCase()}</text>
        <text x="${scale * 1.2}" y="${scale * 5.0}" font-size="${scale * 0.75}" fill="#787498">PLOT: ${plotW} × ${plotL} ${units} (${(plotW * plotL).toFixed(1)} sq ${units})</text>
        
        <!-- Center: Sheet Details -->
        <text x="${tbW * 0.47}" y="${scale * 2.0}" font-size="${scale * 1.3}" font-weight="800" fill="#1C183C">${floorName(levelIndex).toUpperCase()} PLAN</text>
        <text x="${tbW * 0.47}" y="${scale * 3.6}" font-size="${scale * 0.85}" font-weight="600" fill="#555174">BUILT-UP AREA: ${floorArea.toFixed(1)} sq ${units}</text>
        <text x="${tbW * 0.47}" y="${scale * 5.0}" font-size="${scale * 0.75}" fill="#787498">ROOMS: ${level.rooms.length} | WALLS: ${level.walls.length} | OPENINGS: ${level.openings.length}</text>
        
        <!-- Right: Metadata & Stamp -->
        <text x="${tbW * 0.74}" y="${scale * 1.8}" font-size="${scale * 0.75}" font-weight="600" fill="#6B6789">SCALE: NOT TO SCALE (NTS)</text>
        <text x="${tbW * 0.74}" y="${scale * 3.0}" font-size="${scale * 0.75}" fill="#6B6789">UNITS: ${units.toUpperCase()}</text>
        <text x="${tbW * 0.74}" y="${scale * 4.2}" font-size="${scale * 0.75}" fill="#6B6789">DATE: ${new Date().toISOString().split("T")[0]}</text>
        <text x="${tbW * 0.74}" y="${scale * 5.4}" font-size="${scale * 0.75}" font-weight="700" fill="#5146A5">SHEET A-${levelIndex + 1}</text>
      </g>
    `);
  }

  svgParts.push("</svg>");
  return svgParts.join("\n");
}

/** Exports floor plan as SVG file download. */
export function exportFloorPlanAsSvgFile(
  plan: FloorPlan,
  options: Export2DOptions = {},
  filename?: string
): void {
  const levelIdx = options.levelIndex ?? 0;
  const svgString = generateSingleFloorSvg(plan, levelIdx, options);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const fname = filename || `nexora-${plan.projectId || "design"}-floor-${levelIdx + 1}.svg`;
  triggerDownload(blob, fname);
}

/** Rasterizes SVG to high-resolution PNG (3000px default) on an offscreen canvas and triggers download. */
export async function exportFloorPlanAsPngFile(
  plan: FloorPlan,
  options: Export2DOptions & { width?: number } = {},
  filename?: string
): Promise<void> {
  const levelIdx = options.levelIndex ?? 0;
  const svgString = generateSingleFloorSvg(plan, levelIdx, options);

  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      try {
        const targetWidth = options.width || 3000;
        const targetHeight = Math.round((targetWidth * img.height) / (img.width || 1));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not acquire 2D rendering context");

        // White background for architectural clarity
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/png");
        const fname = filename || `nexora-${plan.projectId || "design"}-floor-${levelIdx + 1}.png`;
        triggerDownload(dataUrl, fname);
        resolve();
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG for PNG rasterization"));
    };

    img.src = url;
  });
}

/** Generates a professional multi-page printable architectural PDF using jsPDF. */
export async function exportFloorPlanAsPdfFile(
  plan: FloorPlan,
  options: Export2DPdfOptions = {},
  filename?: string
): Promise<void> {
  const orientation = options.orientation || "landscape";
  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: options.paperSize || "a4",
  });

  const levelsToExport = options.allFloors
    ? plan.levels.map((_, i) => i)
    : [options.levelIndex ?? 0];

  for (let i = 0; i < levelsToExport.length; i++) {
    const levelIdx = levelsToExport[i];
    if (i > 0) doc.addPage(options.paperSize || "a4", orientation);

    // Rasterize high-res SVG for clean insertion
    const svgString = generateSingleFloorSvg(plan, levelIdx, { ...options, levelIndex: levelIdx });

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const renderWidth = 2400;
          const renderHeight = Math.round((renderWidth * img.height) / (img.width || 1));
          canvas.width = renderWidth;
          canvas.height = renderHeight;

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context creation failed");

          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, renderWidth, renderHeight);
          ctx.drawImage(img, 0, 0, renderWidth, renderHeight);
          URL.revokeObjectURL(url);

          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const margin = 10; // 10mm margins

          const availW = pageWidth - margin * 2;
          const availH = pageHeight - margin * 2;
          const imgAspect = renderWidth / renderHeight;
          const availAspect = availW / availH;

          let drawW = availW;
          let drawH = availH;
          if (imgAspect > availAspect) {
            drawH = availW / imgAspect;
          } else {
            drawW = availH * imgAspect;
          }

          const drawX = margin + (availW - drawW) / 2;
          const drawY = margin + (availH - drawH) / 2;

          doc.addImage(imgData, "JPEG", drawX, drawY, drawW, drawH);
          resolve();
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to rasterize floor ${levelIdx + 1} for PDF`));
      };

      img.src = url;
    });
  }

  const fname = filename || `nexora-${plan.projectId || "design"}-floor-plan.pdf`;
  doc.save(fname);
}
