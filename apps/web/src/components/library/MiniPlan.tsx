import type { LibraryPreviewRoom } from "@/lib/api";

const FILL: Record<string, string> = {
  living_room: "#F4EAD2", dining_room: "#F7EEDC", kitchen: "#E6F0DC", bedroom: "#E7E4F7", bathroom: "#DDEBF6",
  staircase: "#E2D4C0", parking: "#E4E3E9", study: "#F0E5F3", utility: "#EEEBE4", hallway: "#FBFAF6",
  corridor: "#FBFAF6", balcony: "#E0ECE4", other: "#DCEBD8",
};

/** Small read-only plan drawing from a catalogue preview: rooms only (no text), cheap enough for a long gallery. */
export function MiniPlan({ rooms, width, length, label }: { rooms: LibraryPreviewRoom[]; width: number; length: number; label: string }) {
  const pad = Math.max(width, length) * 0.03;
  const stroke = Math.max(width, length) * 0.012;
  return (
    <svg className="mini-plan" viewBox={`${-pad} ${-pad} ${width + pad * 2} ${length + pad * 2}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {rooms.map(([type, x0, y0, x1, y1, name], i) => (
        <g key={i}>
          <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={FILL[type] ?? "#F2F0EC"} stroke="#2A2652" strokeWidth={stroke} />
          {type === "staircase" &&
            Array.from({ length: Math.max(3, Math.round((y1 - y0) / 1.4)) }).map((_, k, arr) => (
              <line key={k} x1={x0 + 0.5} x2={x1 - 0.5} y1={y0 + ((k + 1) * (y1 - y0)) / (arr.length + 1)} y2={y0 + ((k + 1) * (y1 - y0)) / (arr.length + 1)} stroke="#8A7A60" strokeWidth={stroke * 0.6} />
            ))}
          <title>{name}</title>
        </g>
      ))}
      <rect x={0} y={0} width={width} height={length} fill="none" stroke="#1D1A40" strokeWidth={stroke * 2} />
    </svg>
  );
}
