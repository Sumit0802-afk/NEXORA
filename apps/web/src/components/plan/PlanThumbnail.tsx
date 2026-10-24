import type { FloorPlan, RoomType } from "@houseplan/design-schema";

const ROOM_FILL: Record<RoomType, string> = {
  living_room: "#F4EAD2",
  dining_room: "#F7EEDC",
  kitchen: "#E6F0DC",
  bedroom: "#E7E4F7",
  bathroom: "#DDEBF6",
  staircase: "#EDE3D6",
  parking: "#ECEBEF",
  study: "#F0E5F3",
  utility: "#EEEBE4",
  hallway: "#FBFAF6",
  corridor: "#FBFAF6",
  balcony: "#E0ECE4",
  other: "#E4F1E2",
};

/** Read-only SVG of a floor plan's ground level: rooms, labels, doors and windows. Street is at the top (y = 0). */
export function PlanThumbnail({ plan, title, dimensions = false, className = "plan-thumbnail", levelIndex = 0 }: { plan: FloorPlan; title?: string; dimensions?: boolean; className?: string; levelIndex?: number }) {
  const level = plan.levels[levelIndex] ?? plan.levels[0];
  const { width: w, length: l } = plan.plot;
  const unit = Math.max(w, l) / 60;
  const pad = unit * 3.4;
  const wall = unit * 0.42;
  const walls = new Map(level.walls.map((x) => [x.id, x]));

  return (
    <svg
      className={className}
      viewBox={`${-pad} ${-pad * 1.6} ${w + pad * 2} ${l + pad * 2.6}`}
      role="img"
      aria-label={title ?? "Floor plan preview"}
    >
      <text x={w / 2} y={-pad * 0.62} textAnchor="middle" className="plan-street" fontSize={unit * 1.7}>
        STREET
      </text>
      {level.rooms.map((room) => {
        const [x0, y0] = room.polygon[0];
        const [x1, y1] = room.polygon[2];
        const rw = x1 - x0;
        const rh = y1 - y0;
        const fs = Math.min(unit * 1.9, rw / (room.name.length * 0.6 + 1), rh / 3.4);
        const showLabel = fs > unit * 0.75 && room.type !== "hallway";
        return (
          <g key={room.id}>
            <rect x={x0} y={y0} width={rw} height={rh} fill={ROOM_FILL[room.type] ?? "#F2F0EC"} stroke="#2A2652" strokeWidth={wall} />
            {showLabel && (
              <>
                <text x={x0 + rw / 2} y={y0 + rh / 2} textAnchor="middle" className="plan-room-name" fontSize={fs}>
                  {room.name}
                </text>
                <text x={x0 + rw / 2} y={y0 + rh / 2 + fs * 1.25} textAnchor="middle" className="plan-room-dims" fontSize={fs * 0.8}>
                  {+rw.toFixed(1)} × {+rh.toFixed(1)}
                </text>
              </>
            )}
          </g>
        );
      })}
      <rect x={0} y={0} width={w} height={l} fill="none" stroke="#1D1A40" strokeWidth={wall * 1.9} />
      {dimensions && (
        <g className="plan-dims" stroke="#6B6880" strokeWidth={wall * 0.35} fontSize={unit * 1.3}>
          <line x1={0} y1={l + pad * 0.6} x2={w} y2={l + pad * 0.6} />
          <line x1={0} y1={l + pad * 0.35} x2={0} y2={l + pad * 0.85} />
          <line x1={w} y1={l + pad * 0.35} x2={w} y2={l + pad * 0.85} />
          <text x={w / 2} y={l + pad * 0.6 - unit * 0.5} textAnchor="middle" stroke="none" fill="#4A4766">
            {+w.toFixed(2)} {plan.units}
          </text>
          <line x1={w + pad * 0.6} y1={0} x2={w + pad * 0.6} y2={l} />
          <line x1={w + pad * 0.35} y1={0} x2={w + pad * 0.85} y2={0} />
          <line x1={w + pad * 0.35} y1={l} x2={w + pad * 0.85} y2={l} />
          <text
            x={w + pad * 0.6 - unit * 0.5}
            y={l / 2}
            textAnchor="middle"
            stroke="none"
            fill="#4A4766"
            transform={`rotate(-90 ${w + pad * 0.6 - unit * 0.5} ${l / 2})`}
          >
            {+l.toFixed(2)} {plan.units}
          </text>
        </g>
      )}
      {level.openings.map((opening) => {
        const host = walls.get(opening.wallId);
        if (!host) return null;
        const [sx, sy] = host.start;
        const [ex, ey] = host.end;
        const len = Math.hypot(ex - sx, ey - sy) || 1;
        const ux = (ex - sx) / len;
        const uy = (ey - sy) / len;
        const half = opening.width / 2;
        const ax = sx + ux * (opening.offset - half);
        const ay = sy + uy * (opening.offset - half);
        const bx = sx + ux * (opening.offset + half);
        const by = sy + uy * (opening.offset + half);
        if (opening.kind === "window") {
          return (
            <g key={opening.id}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#FFFFFF" strokeWidth={wall * 2.2} />
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#4B82C4" strokeWidth={wall * 0.9} />
            </g>
          );
        }
        // Door: gap in the wall plus a quarter swing from the hinge end, opening toward the plot's interior.
        const inward = (-uy) * (w / 2 - (ax + bx) / 2) + ux * (l / 2 - (ay + by) / 2) >= 0;
        const nx = inward ? -uy : uy;
        const ny = inward ? ux : -ux;
        const r = opening.width;
        return (
          <g key={opening.id}>
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#FFFFFF" strokeWidth={wall * 2.4} />
            <path
              d={`M ${ax + nx * r} ${ay + ny * r} A ${r} ${r} 0 0 ${inward ? 0 : 1} ${bx} ${by}`}
              fill="none"
              stroke="#C2410C"
              strokeWidth={wall * 0.45}
            />
            <line x1={ax} y1={ay} x2={ax + nx * r} y2={ay + ny * r} stroke="#C2410C" strokeWidth={wall * 0.55} />
          </g>
        );
      })}
    </svg>
  );
}
