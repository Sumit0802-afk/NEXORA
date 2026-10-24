"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import type { RoomType } from "@houseplan/design-schema";
import { PlanThumbnail } from "@/components/plan/PlanThumbnail";
import { polygonArea } from "@/lib/geometry";
import { usePlanContext } from "../plan-context";
import { floorName, floorsLabel } from "@/lib/floors";

const TYPE_LABEL: Record<RoomType, string> = {
  living_room: "Living",
  dining_room: "Dining",
  kitchen: "Kitchen",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  staircase: "Staircase",
  parking: "Parking",
  study: "Study",
  utility: "Utility",
  hallway: "Passage",
  corridor: "Corridor",
  balcony: "Balcony",
  other: "Open / other",
};
// Uncovered spaces that don't count toward built-up area.
const OPEN_TYPES = new Set<RoomType>(["parking", "other", "balcony"]);

export default function PlanSheetPage({ params }: { params: { projectId: string } }) {
  const { plan, loadError, projectName, isDemo } = usePlanContext();
  const drawingRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("");
  // Formatted on the client only: server and browser locales differ and would break hydration.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }));
  }, []);

  const icon = { verticalAlign: "middle", marginRight: 6 } as const;
  const fileBase = `${isDemo ? "demo" : params.projectId}-plan`;

  const handlePng = () => {
    const svgs = Array.from(drawingRef.current?.querySelectorAll<SVGSVGElement>(".sheet-drawing svg") ?? []);
    svgs.forEach((svg, i) => exportSvg(svg, svgs.length > 1 ? `${fileBase}-${["ground", "first", "second", "third"][i] ?? i}` : fileBase));
    setStatus(svgs.length > 1 ? `Downloaded ${svgs.length} floor plans as PNG` : "Downloaded plan as PNG");
  };

  const exportSvg = (svg: SVGSVGElement, name: string) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("style", "font-family: Inter, Arial, sans-serif; background: #FFFFFF");
    const [, , vw, vh] = (svg.getAttribute("viewBox") ?? "0 0 1 1").split(" ").map(Number);
    const width = 3000;
    const height = Math.round((width * vh) / vw);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const link = document.createElement("a");
      link.download = `${name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  };

  if (loadError) {
    return <main className="app-shell"><div className="error-state" style={{ margin: 40 }}>
      <h3>Couldn&apos;t load this project</h3>
      <p>{loadError}</p>
      <Link className="button" href="/">Back to dashboard</Link>
    </div></main>;
  }
  if (!plan) return <main className="app-shell"><div className="muted" style={{ padding: 40 }}>Loading project…</div></main>;

  const units = plan.units;
  const areaUnit = units === "ft" ? "sq ft" : "m²";
  const plotArea = plan.plot.width * plan.plot.length;
  const floors = plan.levels.map((level, index) => {
    const schedule = level.rooms
      .map((room) => {
        const xs = room.polygon.map((p) => p[0]);
        const ys = room.polygon.map((p) => p[1]);
        return {
          id: room.id,
          name: room.name,
          type: room.type,
          w: Math.max(...xs) - Math.min(...xs),
          d: Math.max(...ys) - Math.min(...ys),
          area: polygonArea(room.polygon),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return {
      index,
      schedule,
      builtUp: schedule.filter((r) => !OPEN_TYPES.has(r.type)).reduce((sum, r) => sum + r.area, 0),
      open: schedule.filter((r) => OPEN_TYPES.has(r.type)).reduce((sum, r) => sum + r.area, 0),
    };
  });
  const totalBuiltUp = floors.reduce((sum, f) => sum + f.builtUp, 0);
  const groundBuiltUp = floors[0]?.builtUp ?? 0;
  const bedrooms = floors.reduce((n, f) => n + f.schedule.filter((r) => r.type === "bedroom").length, 0);
  const baths = floors.reduce((n, f) => n + f.schedule.filter((r) => r.type === "bathroom").length, 0);
  const multi = plan.levels.length > 1;
  const fmt = (n: number) => +n.toFixed(units === "ft" ? 1 : 2);

  return (
    <main className="app-shell sheet-shell">
      <header className="topbar no-print">
        <Link href={`/studio/${params.projectId}`} className="brand">
          <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text"/>
        </Link>
        <div className="top-actions">
          <span className="muted" style={{ fontSize: 12 }}>{status}</span>
          <Link className="button" href={`/studio/${params.projectId}`}><ArrowLeft size={15} style={icon}/> Back to 2D</Link>
          <button className="button" onClick={handlePng}><Download size={15} style={icon}/> Plan PNG</button>
          <button className="button primary" onClick={() => window.print()}><Printer size={15} style={icon}/> Print / Save PDF</button>
        </div>
      </header>

      <div ref={drawingRef}>
      {floors.map((floor) => (
      <article className="plan-sheet" key={floor.index}>
        <header className="sheet-head">
          <div>
            <div className="eyebrow">{floorName(floor.index)} plan{multi ? ` · sheet ${floor.index + 1} of ${floors.length}` : ""}</div>
            <h1>{projectName}</h1>
            <p className="muted">
              Plot {fmt(plan.plot.width)} × {fmt(plan.plot.length)} {units} · {Math.round(plotArea)} {areaUnit}
              {multi && ` · ${floorsLabel(floors.length)}`}
              {bedrooms > 0 && ` · ${bedrooms} bed`}{baths > 0 && ` · ${baths} bath`}
            </p>
          </div>
          <div className="sheet-meta">
            <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="sheet-wordmark"/>
            <span>{today}</span>
          </div>
        </header>

        <div className="sheet-body">
          <div className="sheet-drawing">
            <PlanThumbnail plan={plan} levelIndex={floor.index} title={`${projectName} ${floorName(floor.index).toLowerCase()} plan`} dimensions className="plan-sheet-svg" />
          </div>

          <aside className="sheet-side">
            <h2>{multi ? `${floorName(floor.index)} rooms` : "Room schedule"}</h2>
            {floor.schedule.length === 0 ? (
              <p className="muted">No rooms on this floor yet. Add rooms in the 2D editor.</p>
            ) : (
              <table className="sheet-table">
                <thead>
                  <tr><th>Room</th><th>Size ({units})</th><th>Area</th></tr>
                </thead>
                <tbody>
                  {floor.schedule.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong><span>{TYPE_LABEL[r.type] ?? r.type}</span></td>
                      <td>{fmt(r.w)} × {fmt(r.d)}</td>
                      <td>{Math.round(r.area)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <dl className="sheet-totals">
              <div><dt>{multi ? "This floor: built-up" : "Built-up (covered rooms)"}</dt><dd>{Math.round(floor.builtUp)} {areaUnit}</dd></div>
              <div><dt>{floor.index === 0 ? "Open / parking" : "Terraces / open"}</dt><dd>{Math.round(floor.open)} {areaUnit}</dd></div>
              {multi && <div><dt>Total built-up, all floors</dt><dd>{Math.round(totalBuiltUp)} {areaUnit}</dd></div>}
              <div><dt>Plot area</dt><dd>{Math.round(plotArea)} {areaUnit}</dd></div>
              <div><dt>Ground coverage</dt><dd>{plotArea > 0 ? Math.round((groundBuiltUp / plotArea) * 100) : 0}%</dd></div>
              {multi && <div><dt>Floor area ratio (FAR)</dt><dd>{plotArea > 0 ? (totalBuiltUp / plotArea).toFixed(2) : "0"}</dd></div>}
            </dl>
          </aside>
        </div>

        <footer className="sheet-foot">
          Concept plan for discussion only. Not a construction drawing; verify dimensions, structure and local bylaws with a licensed architect or engineer.
        </footer>
      </article>
      ))}
      </div>
    </main>
  );
}
