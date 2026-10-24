"use client";

import { useMemo } from "react";
import type { FloorPlan } from "@houseplan/design-schema";
import type {
  TerraceConfig,
  ExteriorConfig,
  RailingStyle,
  TerraceShadeStructure,
} from "@/lib/terrace-catalog";
import { RAILING_STYLES } from "@/lib/terrace-catalog";
import type { SceneGeometry } from "@/lib/scene-geometry";

interface TerraceExteriorGeometryProps {
  geometry: SceneGeometry;
  terraceConfig?: TerraceConfig;
  exteriorConfig?: ExteriorConfig;
  showRoof?: boolean;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string | null) => void;
}

export function TerraceExteriorGeometry({
  geometry,
  terraceConfig,
  exteriorConfig,
  showRoof = true,
  selectedObjectId,
  onSelectObject,
}: TerraceExteriorGeometryProps) {
  // Derive roof bounds from geometry (same logic as in HouseScene GeneratedHouse)
  const topLevel = geometry.levelCount - 1;
  const topFloors = geometry.floors.filter((f) => f.level === topLevel);
  const plotW = geometry.plotWidth;
  const plotD = geometry.plotDepth;

  const { roofMinX, roofMaxX, roofMinZ, roofMaxZ, roofY } = useMemo(() => {
    if (topFloors.length === 0) return { roofMinX: 0, roofMaxX: plotW, roofMinZ: 0, roofMaxZ: plotD, roofY: 0 };
    const minX = Math.min(...topFloors.map((f) => f.centerX - f.width / 2));
    const maxX = Math.max(...topFloors.map((f) => f.centerX + f.width / 2));
    const minZ = Math.min(...topFloors.map((f) => f.centerZ - f.depth / 2));
    const maxZ = Math.max(...topFloors.map((f) => f.centerZ + f.depth / 2));
    const maxWallTop = geometry.walls.reduce((mx, w) => Math.max(mx, w.baseY + w.height), 0);
    return { roofMinX: minX, roofMaxX: maxX, roofMinZ: minZ, roofMaxZ: maxZ, roofY: maxWallTop };
  }, [topFloors, plotW, plotD, geometry.walls]);

  const roofW = Math.max(roofMaxX - roofMinX, 0);
  const roofD = Math.max(roofMaxZ - roofMinZ, 0);
  const centerX = (roofMinX + roofMaxX) / 2;
  const centerZ = (roofMinZ + roofMaxZ) / 2;

  const parapetH = terraceConfig?.parapetHeight ?? 3.5;
  const railingStyle = terraceConfig?.railingStyle ?? "glass";
  const shade = terraceConfig?.shadeStructure ?? "none";
  const hasMumty = terraceConfig?.hasMumty ?? true;

  const mumtyCoords = useMemo(() => {
    return {
      x: roofMinX + roofW * 0.7,
      z: roofMinZ + roofD * 0.4,
      w: Math.min(8, roofW * 0.35),
      d: Math.min(8, roofD * 0.35),
    };
  }, [roofMinX, roofMinZ, roofW, roofD]);

  const mumtyH = 8.0;

  // ── Render Railing Section around a perimeter line ──
  const renderRailingEdge = (
    key: string,
    x: number,
    z: number,
    length: number,
    rotationY: number
  ) => {
    if (length <= 1) return null;

    switch (railingStyle) {
      case "glass": {
        // Concrete curb base + glass pane + chrome top rail
        const curbH = 0.5;
        const glassH = parapetH - curbH - 0.1;
        return (
          <group key={key} position={[x, roofY, z]} rotation={[0, rotationY, 0]}>
            {/* Curb */}
            <mesh position={[0, curbH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[length, curbH, 0.4]} />
              <meshStandardMaterial color="#EAE8E4" roughness={0.6} />
            </mesh>
            {/* Tempered glass panels */}
            <mesh position={[0, curbH + glassH / 2, 0]}>
              <boxGeometry args={[length - 0.1, glassH, 0.08]} />
              <meshStandardMaterial
                color="#C5DFEE"
                transparent
                opacity={0.35}
                roughness={0.08}
                metalness={0.15}
              />
            </mesh>
            {/* Stainless top handrail */}
            <mesh position={[0, parapetH - 0.05, 0]} castShadow>
              <boxGeometry args={[length, 0.1, 0.12]} />
              <meshStandardMaterial color="#D1D5DB" metalness={0.9} roughness={0.15} />
            </mesh>
          </group>
        );
      }

      case "metal_slats": {
        // Horizontal black steel bars
        const barCount = 4;
        const postSpacing = Math.max(5, length / 4);
        const numPosts = Math.ceil(length / postSpacing) + 1;
        return (
          <group key={key} position={[x, roofY, z]} rotation={[0, rotationY, 0]}>
            {/* Curb */}
            <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
              <boxGeometry args={[length, 0.6, 0.35]} />
              <meshStandardMaterial color="#2E3238" roughness={0.7} />
            </mesh>
            {/* Horizontal bars */}
            {Array.from({ length: barCount }).map((_, bIdx) => {
              const barY = 0.8 + (bIdx * (parapetH - 0.9)) / (barCount - 1);
              return (
                <mesh key={bIdx} position={[0, barY, 0]} castShadow>
                  <boxGeometry args={[length, 0.08, 0.06]} />
                  <meshStandardMaterial color="#1E2024" metalness={0.85} roughness={0.25} />
                </mesh>
              );
            })}
            {/* Posts */}
            {Array.from({ length: numPosts }).map((_, pIdx) => {
              const px = -length / 2 + (pIdx * length) / (numPosts - 1);
              return (
                <mesh key={pIdx} position={[px, parapetH / 2, 0]} castShadow>
                  <boxGeometry args={[0.1, parapetH, 0.1]} />
                  <meshStandardMaterial color="#1E2024" metalness={0.85} roughness={0.25} />
                </mesh>
              );
            })}
          </group>
        );
      }

      case "jali": {
        // Terracotta / carved stone decorative perforated screen
        return (
          <group key={key} position={[x, roofY, z]} rotation={[0, rotationY, 0]}>
            <mesh position={[0, parapetH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[length, parapetH, 0.35]} />
              <meshStandardMaterial color="#C47B4A" roughness={0.8} />
            </mesh>
            {/* Coping stone on top */}
            <mesh position={[0, parapetH + 0.08, 0]} castShadow>
              <boxGeometry args={[length + 0.1, 0.16, 0.45]} />
              <meshStandardMaterial color="#8A4822" roughness={0.7} />
            </mesh>
          </group>
        );
      }

      case "baluster": {
        // Classical balustrade
        return (
          <group key={key} position={[x, roofY, z]} rotation={[0, rotationY, 0]}>
            {/* Bottom plinth */}
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[length, 0.8, 0.5]} />
              <meshStandardMaterial color="#E0D8CA" roughness={0.65} />
            </mesh>
            {/* Baluster run */}
            <mesh position={[0, parapetH / 2 + 0.2, 0]} castShadow>
              <boxGeometry args={[length, parapetH - 1.2, 0.35]} />
              <meshStandardMaterial color="#EAE4D8" roughness={0.6} />
            </mesh>
            {/* Top molded coping */}
            <mesh position={[0, parapetH, 0]} castShadow>
              <boxGeometry args={[length + 0.1, 0.25, 0.55]} />
              <meshStandardMaterial color="#D8CFC0" roughness={0.55} />
            </mesh>
          </group>
        );
      }

      case "solid_parapet":
      default: {
        return (
          <group key={key} position={[x, roofY, z]} rotation={[0, rotationY, 0]}>
            <mesh position={[0, parapetH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[length, parapetH, 0.4]} />
              <meshStandardMaterial color="#EAE8E4" roughness={0.6} />
            </mesh>
            {/* Coping cap */}
            <mesh position={[0, parapetH + 0.06, 0]} castShadow>
              <boxGeometry args={[length + 0.1, 0.12, 0.5]} />
              <meshStandardMaterial color="#424752" roughness={0.4} />
            </mesh>
          </group>
        );
      }
    }
  };

  return (
    <group>
      {/* ── 1. PARAPET / RAILING PERIMETER AROUND ROOF ── */}
      {roofW > 0 && roofD > 0 && (
        <group>
          {/* North edge */}
          {renderRailingEdge("rail-n", centerX, roofMinZ, roofW, 0)}
          {/* South edge */}
          {renderRailingEdge("rail-s", centerX, roofMaxZ, roofW, 0)}
          {/* West edge */}
          {renderRailingEdge("rail-w", roofMinX, centerZ, roofD, Math.PI / 2)}
          {/* East edge */}
          {renderRailingEdge("rail-e", roofMaxX, centerZ, roofD, Math.PI / 2)}
        </group>
      )}

      {/* ── 2. STAIRCASE MUMTY / HEADHOUSE ENCLOSURE ── */}
      {hasMumty && (
        <group position={[mumtyCoords.x, roofY, mumtyCoords.z]}>
          {/* Mumty cabin walls */}
          <mesh position={[0, mumtyH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[mumtyCoords.w, mumtyH, mumtyCoords.d]} />
            <meshStandardMaterial color="#F2EFE9" roughness={0.5} />
          </mesh>
          {/* Mumty roof slab with overhang */}
          <mesh position={[0, mumtyH + 0.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[mumtyCoords.w + 0.8, 0.4, mumtyCoords.d + 0.8]} />
            <meshStandardMaterial color="#3A404D" roughness={0.4} />
          </mesh>
          {/* Exit door onto terrace */}
          <mesh position={[0, 3.5, mumtyCoords.d / 2 + 0.02]} castShadow>
            <boxGeometry args={[3.2, 7.0, 0.1]} />
            <meshStandardMaterial color="#1E2024" roughness={0.4} metalness={0.2} />
          </mesh>
          {/* Overhead water tank atop the mumty */}
          <mesh position={[mumtyCoords.w * 0.2, mumtyH + 2.0, mumtyCoords.d * 0.1]} castShadow>
            <cylinderGeometry args={[1.6, 1.6, 3.2, 20]} />
            <meshStandardMaterial color="#1A1C22" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      )}

      {/* ── 3. TERRACE SHADING STRUCTURES ── */}
      {shade === "pergola" && (
        <group position={[roofMinX + roofW * 0.35, roofY, roofMinZ + roofD * 0.4]}>
          {/* 4 Timber posts */}
          {[-4, 4].map((px) =>
            [-3.5, 3.5].map((pz) => (
              <mesh key={`${px}-${pz}`} position={[px, 4.0, pz]} castShadow>
                <boxGeometry args={[0.4, 8.0, 0.4]} />
                <meshStandardMaterial color="#4A3425" roughness={0.65} />
              </mesh>
            ))
          )}
          {/* Main cross beams */}
          {[-3.5, 3.5].map((pz, idx) => (
            <mesh key={idx} position={[0, 8.1, pz]} castShadow>
              <boxGeometry args={[9.5, 0.4, 0.3]} />
              <meshStandardMaterial color="#3C2A1E" roughness={0.65} />
            </mesh>
          ))}
          {/* 7 Shading slats */}
          {Array.from({ length: 7 }).map((_, sIdx) => {
            const sx = -4.0 + (sIdx * 8.0) / 6;
            return (
              <mesh key={sIdx} position={[sx, 8.4, 0]} castShadow>
                <boxGeometry args={[0.2, 0.25, 8.2]} />
                <meshStandardMaterial color="#553C2B" roughness={0.65} />
              </mesh>
            );
          })}
        </group>
      )}

      {shade === "covered_pavilion" && (
        <group position={[roofMinX + roofW * 0.35, roofY, roofMinZ + roofD * 0.4]}>
          {/* 4 Sturdy pillars */}
          {[-4.5, 4.5].map((px) =>
            [-4, 4].map((pz) => (
              <mesh key={`${px}-${pz}`} position={[px, 4.0, pz]} castShadow>
                <boxGeometry args={[0.7, 8.0, 0.7]} />
                <meshStandardMaterial color="#EAE8E4" roughness={0.5} />
              </mesh>
            ))
          )}
          {/* Solid roof canopy */}
          <mesh position={[0, 8.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[10.5, 0.4, 9.5]} />
            <meshStandardMaterial color="#2E333D" roughness={0.35} />
          </mesh>
        </group>
      )}

      {shade === "sky_lounge" && (
        <group position={[roofMinX + roofW * 0.35, roofY, roofMinZ + roofD * 0.4]}>
          {/* Floor deck */}
          <mesh position={[0, 0.15, 0]} receiveShadow>
            <boxGeometry args={[9.5, 0.3, 8.5]} />
            <meshStandardMaterial color="#D7B58A" roughness={0.5} />
          </mesh>
          {/* Glass enclosed box */}
          <mesh position={[0, 4.0, 0]}>
            <boxGeometry args={[9.0, 7.8, 8.0]} />
            <meshStandardMaterial color="#C5E2F5" transparent opacity={0.35} roughness={0.05} />
          </mesh>
          {/* Flat modern roof */}
          <mesh position={[0, 8.1, 0]} castShadow>
            <boxGeometry args={[9.8, 0.35, 8.8]} />
            <meshStandardMaterial color="#1E2229" roughness={0.3} />
          </mesh>
        </group>
      )}

      {shade === "solar_rack" && (
        <group position={[roofMinX + roofW * 0.4, roofY, roofMinZ + roofD * 0.4]}>
          {/* Steel elevated frame */}
          {[-4, 4].map((px) =>
            [-3, 3].map((pz) => (
              <mesh key={`${px}-${pz}`} position={[px, 2.5, pz]} castShadow>
                <boxGeometry args={[0.2, 5.0, 0.2]} />
                <meshStandardMaterial color="#4A5260" metalness={0.9} roughness={0.2} />
              </mesh>
            ))
          )}
          {/* 4 Tilted Solar PV Panels */}
          {[-2.5, 2.5].map((px) =>
            [-1.5, 1.5].map((pz, idx) => (
              <mesh
                key={`${px}-${pz}-${idx}`}
                position={[px, 5.2, pz]}
                rotation={[-0.42, 0, 0]}
                castShadow
              >
                <boxGeometry args={[4.2, 0.08, 2.6]} />
                <meshStandardMaterial color="#122543" roughness={0.15} metalness={0.7} />
              </mesh>
            ))
          )}
        </group>
      )}

      {shade === "indian_chhatri" && (
        <group position={[roofMinX + roofW * 0.35, roofY, roofMinZ + roofD * 0.4]}>
          {/* 4 Carved stone pillars */}
          {[-3.5, 3.5].map((px) =>
            [-3.5, 3.5].map((pz) => (
              <mesh key={`${px}-${pz}`} position={[px, 4.0, pz]} castShadow>
                <cylinderGeometry args={[0.25, 0.35, 8.0, 12]} />
                <meshStandardMaterial color="#C48458" roughness={0.8} />
              </mesh>
            ))
          )}
          {/* Arched Chhatri Canopy Dome */}
          <mesh position={[0, 8.5, 0]} castShadow>
            <coneGeometry args={[5.2, 2.2, 16]} />
            <meshStandardMaterial color="#944822" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* ── 4. EXTERIOR FACADE & SITE ELEMENTS (Ground Level) ── */}
      {/* Front Entrance Portico */}
      {exteriorConfig?.hasEntrancePortico && (
        <group position={[0, 9.8, -plotD / 2 - 1.5]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[8.0, 0.4, 4.0]} />
            <meshStandardMaterial color="#2B303A" roughness={0.35} />
          </mesh>
          {/* Thin steel support column */}
          <mesh position={[-3.6, -4.8, 1.6]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 9.6, 12]} />
            <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* Front Boundary Wall & Main Gate */}
      {exteriorConfig?.hasBoundaryWall && (
        <group position={[0, 0, -plotD / 2 - 6.0]}>
          {/* Left masonry boundary wall */}
          <mesh position={[-plotW * 0.35, 2.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[plotW * 0.4, 4.4, 0.6]} />
            <meshStandardMaterial color="#EAE8E4" roughness={0.7} />
          </mesh>
          {/* Right masonry boundary wall */}
          <mesh position={[plotW * 0.35, 2.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[plotW * 0.4, 4.4, 0.6]} />
            <meshStandardMaterial color="#EAE8E4" roughness={0.7} />
          </mesh>
          {/* Gate Pillars */}
          {[-plotW * 0.15, plotW * 0.15].map((gx, idx) => (
            <mesh key={idx} position={[gx, 2.8, 0]} castShadow>
              <boxGeometry args={[1.0, 5.6, 1.0]} />
              <meshStandardMaterial color="#2E333D" roughness={0.4} />
            </mesh>
          ))}
          {/* Main Driveway Gate */}
          {exteriorConfig?.hasMainGate && (
            <mesh position={[0, 2.2, 0]} castShadow>
              <boxGeometry args={[plotW * 0.28, 4.2, 0.08]} />
              <meshStandardMaterial color="#1A1C22" metalness={0.9} roughness={0.25} />
            </mesh>
          )}
        </group>
      )}

      {/* Driveway Pavers */}
      {exteriorConfig?.hasDrivewayPavers && (
        <mesh position={[0, -0.02, -plotD / 2 - 3.0]} receiveShadow>
          <boxGeometry args={[11.0, 0.04, 6.0]} />
          <meshStandardMaterial color="#555A64" roughness={0.8} />
        </mesh>
      )}

      {/* Front Garden Lawn */}
      {exteriorConfig?.hasFrontGarden && (
        <group>
          <mesh position={[-plotW * 0.32, -0.01, -plotD / 2 - 3.0]} receiveShadow>
            <boxGeometry args={[plotW * 0.3, 0.06, 5.5]} />
            <meshStandardMaterial color="#386E36" roughness={0.9} />
          </mesh>
          <mesh position={[plotW * 0.32, -0.01, -plotD / 2 - 3.0]} receiveShadow>
            <boxGeometry args={[plotW * 0.3, 0.06, 5.5]} />
            <meshStandardMaterial color="#386E36" roughness={0.9} />
          </mesh>
        </group>
      )}
    </group>
  );
}
