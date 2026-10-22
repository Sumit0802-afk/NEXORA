export function ProjectPlanPreview({
  plotWidth,
  plotLength,
  roomCount,
}: {
  plotWidth: number;
  plotLength: number;
  roomCount: number;
}) {
  const pad = 6;
  const viewW = plotWidth + pad * 2;
  const viewH = plotLength + pad * 2;
  const cols = roomCount > 2 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(roomCount / cols));
  const cellW = plotWidth / cols;
  const cellH = plotLength / rows;

  const cells = Array.from({ length: roomCount }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { x: pad + col * cellW, y: pad + row * cellH };
  });

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="plan-thumb" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Floor plan preview">
      <rect x={pad} y={pad} width={plotWidth} height={plotLength} fill="#FFFDF7" stroke="#302A65" strokeWidth={0.6} />
      {cells.map((cell, index) => (
        <rect
          key={index}
          x={cell.x}
          y={cell.y}
          width={cellW}
          height={cellH}
          fill={index % 2 === 0 ? "#FFF4D6" : "#F0EDFA"}
          stroke="#5146A5"
          strokeWidth={0.4}
        />
      ))}
      {roomCount === 0 && (
        <text x={viewW / 2} y={viewH / 2} fontSize={3} fill="#A39DBB" textAnchor="middle">Empty plot</text>
      )}
    </svg>
  );
}
