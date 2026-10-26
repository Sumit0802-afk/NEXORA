import React from "react";

/**
 * Small elevation illustrations for the terrace designer option cards.
 * Inline SVG: no image files to ship or lazy-load.
 */
export type TerraceArtKind =
  | `layout:${string}`
  | `rail:${string}`
  | `shade:${string}`
  | `facade:${string}`
  | `furn:${string}`;

const SKY = "#EAF1FB";
const SLAB = "#CFC8DC";
const WALL = "#E9E4F2";
const WOOD = "#A87B4F";
const STEEL = "#3E3A52";
const GLASS = "#9CCBEA";
const GREEN = "#5FA35A";

function Slab({ y = 82 }: { y?: number }) {
  return (
    <>
      <rect x="0" y={y} width="200" height={110 - y} fill={WALL} />
      <rect x="0" y={y} width="200" height="5" fill={SLAB} />
    </>
  );
}

function Parapet({ x = 10, w = 180, y = 74 }: { x?: number; w?: number; y?: number }) {
  return <rect x={x} y={y} width={w} height={8} fill="#BDB5CF" />;
}

function Sofa({ x, y = 70, c = "#7B68EE" }: { x: number; y?: number; c?: string }) {
  return (
    <g>
      <rect x={x} y={y} width="26" height="7" rx="2" fill={c} />
      <rect x={x} y={y - 6} width="26" height="6" rx="2" fill={c} opacity="0.75" />
    </g>
  );
}

function Tree({ x, y = 72, s = 1 }: { x: number; y?: number; s?: number }) {
  return (
    <g>
      <rect x={x - 1.5 * s} y={y - 6 * s} width={3 * s} height={8 * s} fill="#7A5A3A" />
      <circle cx={x} cy={y - 12 * s} r={9 * s} fill={GREEN} />
    </g>
  );
}

function Scene({ kind }: { kind: string }) {
  const [group, id] = kind.split(":");

  if (group === "layout") {
    switch (id) {
      case "open":
        return (
          <>
            <Slab /><Parapet />
            <circle cx="165" cy="22" r="10" fill="#FFD98A" />
            <Sofa x={30} y={70} c="#B7AEDB" />
          </>
        );
      case "garden":
        return (
          <>
            <Slab /><Parapet />
            <rect x="10" y="68" width="180" height="6" fill="#6DB56A" />
            <rect x="24" y="60" width="26" height="9" fill="#8A6A4A" /><circle cx="37" cy="56" r="7" fill={GREEN} />
            <Tree x={90} /><Tree x={140} s={1.2} />
            <rect x="60" y="70" width="8" height="3" fill={SLAB} /><rect x="108" y="70" width="8" height="3" fill={SLAB} />
          </>
        );
      case "pergola":
        return (
          <>
            <Slab /><Parapet />
            <rect x="34" y="34" width="132" height="4" fill={WOOD} />
            {[44, 62, 80, 98, 116, 134, 152].map((x) => <rect key={x} x={x} y="30" width="4" height="8" fill={WOOD} />)}
            <rect x="36" y="38" width="4" height="40" fill={WOOD} /><rect x="160" y="38" width="4" height="40" fill={WOOD} />
            <Sofa x={72} y={70} /><Sofa x={104} y={70} c="#B7AEDB" />
          </>
        );
      case "covered":
        return (
          <>
            <Slab /><Parapet />
            <polygon points="26,40 100,22 174,40" fill="#8B84A8" />
            <rect x="30" y="40" width="140" height="5" fill="#6F6890" />
            {[34, 90, 160].map((x) => <rect key={x} x={x} y="45" width="6" height="33" fill="#CFC8DC" />)}
            <circle cx="100" cy="52" r="5" fill="none" stroke="#6F6890" strokeWidth="1.5" />
            <Sofa x={110} y={70} />
          </>
        );
      case "lounge":
        return (
          <>
            <Slab /><Parapet />
            <rect x="30" y="30" width="86" height="48" fill={GLASS} opacity="0.55" stroke={STEEL} strokeWidth="1.5" />
            <line x1="73" y1="30" x2="73" y2="78" stroke={STEEL} strokeWidth="1.5" />
            <rect x="26" y="26" width="94" height="5" fill={STEEL} />
            <Sofa x={42} y={70} />
            <rect x="128" y="62" width="30" height="8" fill="#6F6890" /><rect x="126" y="58" width="34" height="4" fill={STEEL} />
            <circle cx="170" cy="58" r="4" fill="#FF9A5A" />
          </>
        );
      case "outdoor_dining":
        return (
          <>
            <Slab /><Parapet />
            <polygon points="30,40 100,26 170,40" fill="#D9A25A" />
            {[36, 164].map((x) => <rect key={x} x={x} y="40" width="4" height="38" fill={WOOD} />)}
            <rect x="64" y="64" width="72" height="5" fill={WOOD} /><rect x="70" y="69" width="4" height="9" fill={WOOD} /><rect x="126" y="69" width="4" height="9" fill={WOOD} />
            {[72, 92, 112, 130].map((x) => <rect key={x} x={x} y="56" width="6" height="8" fill="#B7AEDB" />)}
            {[84, 116].map((x) => <circle key={x} cx={x} cy="46" r="3" fill="#FFD98A" />)}
          </>
        );
      case "utility":
        return (
          <>
            <Slab /><Parapet />
            <rect x="24" y="42" width="48" height="36" fill="#D9D2E8" stroke="#B3AACB" />
            <rect x="34" y="52" width="14" height="26" fill="#8B84A8" />
            <ellipse cx="150" cy="40" rx="18" ry="6" fill="#6F8CB0" /><rect x="132" y="40" width="36" height="22" fill="#7C9BC2" /><rect x="132" y="62" width="36" height="3" fill="#5C7BA2" />
            <line x1="84" y1="52" x2="124" y2="52" stroke="#8A7F9E" /><line x1="86" y1="52" x2="86" y2="78" stroke="#8A7F9E" /><line x1="122" y1="52" x2="122" y2="78" stroke="#8A7F9E" />
            {[94, 104, 114].map((x) => <rect key={x} x={x} y="54" width="6" height="14" fill="#F6C4B4" />)}
          </>
        );
      case "solar":
        return (
          <>
            <Slab /><Parapet />
            {[26, 74, 122].map((x) => (
              <g key={x}>
                <polygon points={`${x},60 ${x + 44},50 ${x + 44},62 ${x},72`} fill="#2E4A7A" stroke="#9CB4DA" strokeWidth="0.8" />
                <line x1={x + 22} y1="55" x2={x + 22} y2="67" stroke="#9CB4DA" strokeWidth="0.6" />
                <rect x={x + 4} y="70" width="2.5" height="8" fill={STEEL} /><rect x={x + 38} y="62" width="2.5" height="16" fill={STEEL} />
              </g>
            ))}
            <circle cx="170" cy="20" r="10" fill="#FFD98A" />
          </>
        );
      case "traditional_indian":
        return (
          <>
            <Slab /><Parapet />
            <ellipse cx="100" cy="30" rx="30" ry="14" fill="#C98A56" /><rect x="98" y="12" width="4" height="8" fill="#B87942" />
            <rect x="72" y="42" width="56" height="4" fill="#B87942" />
            {[74, 122].map((x) => <rect key={x} x={x} y="46" width="5" height="32" fill="#E3C9A0" />)}
            <line x1="100" y1="46" x2="100" y2="62" stroke="#7A5A3A" /><rect x="90" y="62" width="20" height="4" rx="1" fill="#C9A24A" />
            {[14, 24, 34].map((x) => <circle key={x} cx={x} cy="68" r="3" fill="none" stroke="#B87942" />)}
          </>
        );
    }
  }

  if (group === "rail") {
    const base = <rect x="0" y="92" width="200" height="18" fill={SLAB} />;
    switch (id) {
      case "glass":
        return <>{base}<rect x="20" y="40" width="160" height="52" fill={GLASS} opacity="0.5" stroke="#6BA6CC" /><rect x="20" y="38" width="160" height="4" fill="#B7BDC9" />{[20, 100, 180].map((x) => <circle key={x} cx={x} cy="88" r="2.5" fill="#B7BDC9" />)}<line x1="30" y1="50" x2="60" y2="80" stroke="#fff" strokeOpacity="0.6" /></>;
      case "metal_slats":
        return <>{base}{[44, 54, 64, 74, 84].map((y) => <rect key={y} x="20" y={y} width="160" height="4" fill={STEEL} />)}{[20, 98, 176].map((x) => <rect key={x} x={x} y="40" width="4" height="52" fill="#2A2740" />)}</>;
      case "jali":
        return (
          <>
            {base}
            <rect x="20" y="40" width="160" height="52" fill="#C98A56" />
            {Array.from({ length: 8 }).flatMap((_, r) =>
              Array.from({ length: 20 }).map((__, c) => (
                <circle key={`${r}-${c}`} cx={28 + c * 8} cy={46 + r * 6} r="1.9" fill="#7A4B2A" />
              ))
            )}
            <rect x="18" y="36" width="164" height="5" fill="#A8693A" />
          </>
        );
      case "baluster":
        return <>{base}<rect x="18" y="38" width="164" height="6" fill="#EDE8F5" stroke="#CFC8DC" />{Array.from({ length: 16 }).map((_, i) => <g key={i}><rect x={26 + i * 10} y="44" width="5" height="40" rx="2" fill="#F4F1FA" stroke="#CFC8DC" /><circle cx={28.5 + i * 10} cy="62" r="4" fill="#F4F1FA" stroke="#CFC8DC" /></g>)}<rect x="18" y="84" width="164" height="8" fill="#EDE8F5" stroke="#CFC8DC" /></>;
      case "solid_parapet":
        return <>{base}<rect x="14" y="38" width="172" height="54" fill="#E7E1F0" stroke="#CFC8DC" /><rect x="10" y="32" width="180" height="8" fill="#CFC8DC" /><line x1="14" y1="65" x2="186" y2="65" stroke="#D5CEE3" /></>;
    }
  }

  if (group === "shade") {
    switch (id) {
      case "none":
        return <><Slab /><Parapet /><circle cx="150" cy="30" r="12" fill="#FFD98A" /><path d="M30 30 q10 -8 20 0 q8 -6 18 2 z" fill="#fff" /></>;
      case "pergola":
        return <><Slab /><Parapet />{[40, 52, 64, 76, 88, 100, 112, 124, 136, 148, 160].map((x) => <rect key={x} x={x} y="28" width="4" height="12" fill={WOOD} />)}<rect x="34" y="38" width="134" height="4" fill={WOOD} />{[38, 162].map((x) => <rect key={x} x={x} y="42" width="5" height="36" fill={WOOD} />)}</>;
      case "covered_pavilion":
        return <><Slab /><Parapet /><polygon points="26,42 100,22 174,42" fill="#8B84A8" /><rect x="30" y="42" width="140" height="5" fill="#6F6890" />{[34, 96, 162].map((x) => <rect key={x} x={x} y="47" width="6" height="31" fill="#CFC8DC" />)}</>;
      case "sky_lounge":
        return <><Slab /><Parapet /><rect x="40" y="30" width="120" height="48" fill={GLASS} opacity="0.55" stroke={STEEL} strokeWidth="1.5" /><line x1="100" y1="30" x2="100" y2="78" stroke={STEEL} strokeWidth="1.5" /><rect x="36" y="26" width="128" height="5" fill={STEEL} /></>;
      case "solar_rack":
        return <><Slab /><Parapet /><polygon points="30,52 170,36 170,50 30,66" fill="#2E4A7A" stroke="#9CB4DA" />{[60, 100, 140].map((x) => <line key={x} x1={x} y1={52 - (x - 30) * 0.114} x2={x} y2={66 - (x - 30) * 0.114} stroke="#9CB4DA" strokeWidth="0.7" />)}<rect x="34" y="64" width="4" height="14" fill={STEEL} /><rect x="162" y="48" width="4" height="30" fill={STEEL} /></>;
      case "indian_chhatri":
        return <><Slab /><Parapet /><ellipse cx="100" cy="34" rx="34" ry="16" fill="#C98A56" /><rect x="98" y="14" width="4" height="8" fill="#B87942" /><rect x="68" y="46" width="64" height="4" fill="#B87942" />{[70, 126].map((x) => <rect key={x} x={x} y="50" width="5" height="28" fill="#E3C9A0" />)}<rect x="90" y="64" width="20" height="4" rx="1" fill="#C9A24A" /></>;
    }
  }

  if (group === "facade") {
    const ground = <rect x="0" y="94" width="200" height="16" fill="#BFD8B5" />;
    switch (id) {
      case "modern":
        return <>{ground}<rect x="30" y="40" width="140" height="54" fill="#F5F3F8" /><rect x="20" y="34" width="160" height="6" fill="#3A3650" /><rect x="40" y="52" width="46" height="28" fill={GLASS} /><rect x="104" y="52" width="46" height="28" fill={GLASS} /><rect x="96" y="60" width="6" height="34" fill="#3A3650" /><rect x="120" y="24" width="50" height="16" fill="#E7E3EF" stroke="#3A3650" /></>;
      case "contemporary":
        return <>{ground}<rect x="30" y="40" width="140" height="54" fill="#E8DDCB" /><rect x="22" y="34" width="156" height="6" fill="#8A6A4A" />{Array.from({ length: 12 }).map((_, i) => <rect key={i} x={40 + i * 5} y="46" width="2.5" height="46" fill="#A87B4F" />)}<rect x="108" y="52" width="46" height="30" fill={GLASS} /><rect x="104" y="48" width="54" height="4" fill="#8A6A4A" /><rect x="154" y="50" width="16" height="44" fill="#C9B79A" /></>;
      case "traditional_indian":
        return <>{ground}<rect x="30" y="38" width="140" height="56" fill="#F0DEC2" /><polygon points="24,38 100,20 176,38" fill="#B5603A" /><rect x="86" y="62" width="28" height="32" fill="#7A4B2A" /><path d="M86 62 q14 -14 28 0" fill="#7A4B2A" />{[40, 142].map((x) => <g key={x}><rect x={x} y="52" width="20" height="26" fill="#C98A56" />{[0, 1, 2].map((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={x + 4 + c * 6} cy={58 + r * 7} r="1.6" fill="#7A4B2A" />))}</g>)}{[78, 122].map((x) => <rect key={x} x={x} y="58" width="4" height="36" fill="#E3C9A0" />)}</>;
      case "luxury":
        return <>{ground}<rect x="24" y="36" width="152" height="58" fill="#F7F4EE" /><rect x="14" y="30" width="172" height="6" fill="#8A6A4A" /><rect x="78" y="36" width="44" height="58" fill="#EFE9DC" /><rect x="74" y="30" width="52" height="5" fill="#8A6A4A" />{[80, 114].map((x) => <rect key={x} x={x} y="36" width="6" height="58" fill="#fff" stroke="#D9D2C2" />)}<rect x="92" y="62" width="16" height="32" fill="#8A6A4A" /><rect x="34" y="50" width="34" height="28" fill={GLASS} /><rect x="132" y="50" width="34" height="28" fill={GLASS} /></>;
      case "minimalist":
        return <>{ground}<rect x="30" y="34" width="140" height="60" fill="#D9D7DF" /><rect x="52" y="48" width="28" height="30" fill="#2A2740" opacity="0.85" /><rect x="120" y="48" width="28" height="30" fill="#2A2740" opacity="0.85" /><rect x="94" y="62" width="12" height="32" fill="#9C98AA" /><line x1="30" y1="86" x2="170" y2="86" stroke="#B9B6C4" /></>;
    }
  }

  if (group === "furn") {
    const floor = <rect x="0" y="86" width="200" height="24" fill="#D8D2E4" />;
    switch (id) {
      case "outdoor_sofa":
        return <>{floor}<rect x="40" y="52" width="120" height="26" rx="6" fill="#8D82D6" /><rect x="30" y="58" width="16" height="28" rx="5" fill="#7B68EE" /><rect x="154" y="58" width="16" height="28" rx="5" fill="#7B68EE" /><rect x="46" y="64" width="108" height="16" rx="4" fill="#B7AEDB" /><rect x="48" y="84" width="6" height="6" fill={STEEL} /><rect x="146" y="84" width="6" height="6" fill={STEEL} /></>;
      case "outdoor_coffee_table":
        return <>{floor}<rect x="48" y="58" width="104" height="8" rx="2" fill={WOOD} /><rect x="56" y="66" width="6" height="22" fill="#7A5A3A" /><rect x="138" y="66" width="6" height="22" fill="#7A5A3A" /><rect x="60" y="76" width="80" height="3" fill="#7A5A3A" /><circle cx="100" cy="52" r="6" fill={GREEN} /></>;
      case "sun_lounger":
        return <>{floor}<polygon points="40,78 110,78 150,50 138,44 100,66 40,66" fill="#F2EFE8" stroke="#BDB5CF" /><rect x="44" y="78" width="4" height="10" fill={STEEL} /><rect x="104" y="78" width="4" height="10" fill={STEEL} /><rect x="40" y="66" width="70" height="6" fill="#8D82D6" opacity="0.7" /></>;
      case "outdoor_dining_set":
        return <>{floor}<rect x="44" y="56" width="112" height="6" rx="2" fill={WOOD} /><rect x="56" y="62" width="5" height="26" fill="#7A5A3A" /><rect x="139" y="62" width="5" height="26" fill="#7A5A3A" />{[50, 78, 112, 140].map((x) => <g key={x}><rect x={x} y="68" width="12" height="4" fill="#B7AEDB" /><rect x={x} y="56" width="3" height="12" fill="#B7AEDB" /><rect x={x + 2} y="72" width="2" height="16" fill={STEEL} /></g>)}</>;
      case "planter_box":
        return <>{floor}<rect x="50" y="62" width="100" height="26" fill="#A9A3B4" /><rect x="50" y="62" width="100" height="4" fill="#C7C2D2" />{[64, 86, 108, 130].map((x) => <circle key={x} cx={x} cy={50 - (x % 3) * 3} r="11" fill={GREEN} />)}</>;
      case "terracotta_planter":
        return <>{floor}<path d="M78 52 h44 q6 0 4 8 l-8 26 q-1 4 -6 4 h-24 q-5 0 -6 -4 l-8 -26 q-2 -8 4 -8 z" fill="#C26842" /><rect x="74" y="48" width="52" height="8" rx="3" fill="#A9532F" /><circle cx="92" cy="34" r="12" fill={GREEN} /><circle cx="110" cy="38" r="10" fill="#4C9449" /></>;
      case "bbq_grill":
        return <>{floor}<rect x="62" y="52" width="76" height="24" rx="10" fill="#2A2740" /><rect x="58" y="50" width="84" height="5" rx="2" fill="#3E3A52" /><rect x="70" y="76" width="4" height="12" fill={STEEL} /><rect x="126" y="76" width="4" height="12" fill={STEEL} /><path d="M86 44 q-4 -8 2 -12 M100 44 q-4 -8 2 -12 M114 44 q-4 -8 2 -12" stroke="#B9B6C4" fill="none" strokeWidth="2" strokeLinecap="round" /><circle cx="92" cy="60" r="3" fill="#FF9A5A" /><circle cx="108" cy="60" r="3" fill="#FFB35A" /></>;
      case "indian_jhula":
        return <><rect x="0" y="86" width="200" height="24" fill="#D8D2E4" /><rect x="40" y="16" width="120" height="6" fill="#8A5A2A" /><rect x="42" y="22" width="6" height="66" fill="#8A5A2A" /><rect x="152" y="22" width="6" height="66" fill="#8A5A2A" /><line x1="70" y1="22" x2="70" y2="64" stroke="#C9A24A" strokeWidth="2" /><line x1="130" y1="22" x2="130" y2="64" stroke="#C9A24A" strokeWidth="2" /><rect x="62" y="62" width="76" height="8" rx="3" fill="#C98A56" /><rect x="64" y="52" width="72" height="10" rx="3" fill="#E06A5A" /></>;
    }
  }

  return null;
}

export function TerraceArt({ kind, label }: { kind: TerraceArtKind; label: string }) {
  return (
    <svg className="tdm-art" viewBox="0 0 200 110" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="110" fill={SKY} />
      <Scene kind={kind} />
    </svg>
  );
}
