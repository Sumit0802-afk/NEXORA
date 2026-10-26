"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { FloorPlan, Column, Beam, FoundationFooting } from "@houseplan/design-schema";

interface StructuralFrameGeometryProps {
  plan: FloorPlan;
  visible?: boolean;
  wireframeOnly?: boolean;
}

export function StructuralFrameGeometry({
  plan,
  visible = true,
  wireframeOnly = false,
}: StructuralFrameGeometryProps) {
  const { width: plotW, length: plotL } = plan.plot;

  // Concrete Materials
  const colMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8E8984",
        roughness: 0.8,
        metalness: 0.1,
        wireframe: wireframeOnly,
      }),
    [wireframeOnly]
  );

  const beamMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#7D7873",
        roughness: 0.75,
        metalness: 0.1,
        wireframe: wireframeOnly,
      }),
    [wireframeOnly]
  );

  const footingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#6D6864",
        roughness: 0.85,
        metalness: 0.05,
        wireframe: wireframeOnly,
      }),
    [wireframeOnly]
  );

  if (!visible) return null;

  return (
    <group name="Structural_Frame_System">
      {plan.levels.map((lvl, lvIdx) => {
        const elevation = lvl.elevation;
        const wallH = lvl.wallHeight;
        const columns = (lvl.columns || []) as Column[];
        const beams = (lvl.beams || []) as Beam[];
        const footings = (lvl.foundations || []) as FoundationFooting[];

        return (
          <group key={`struct-lvl-${lvl.id}`}>
            {/* 1. Reinforced Concrete Columns */}
            {columns.map((c) => {
              const cx = c.position[0] - plotW / 2;
              const cz = c.position[1] - plotL / 2;
              const colH = wallH;
              const cw = c.width || 0.75;
              const cd = c.depth || 0.75;

              return (
                <group key={c.id} position={[cx, elevation + colH / 2, cz]}>
                  <mesh castShadow receiveShadow material={colMaterial}>
                    <boxGeometry args={[cw, colH, cd]} />
                  </mesh>

                  {/* Reinforcement Edge Highlights */}
                  <lineSegments>
                    <edgesGeometry args={[new THREE.BoxGeometry(cw, colH, cd)]} />
                    <lineBasicMaterial color="#3D3A38" linewidth={1.5} />
                  </lineSegments>
                </group>
              );
            })}

            {/* 2. Reinforced Concrete Beams */}
            {beams.map((b) => {
              const startX = b.start[0] - plotW / 2;
              const startZ = b.start[1] - plotL / 2;
              const endX = b.end[0] - plotW / 2;
              const endZ = b.end[1] - plotL / 2;

              const dx = endX - startX;
              const dz = endZ - startZ;
              const length = Math.hypot(dx, dz);
              if (length <= 0.01) return null;

              const angle = Math.atan2(dz, dx);
              const midX = (startX + endX) / 2;
              const midZ = (startZ + endZ) / 2;
              const beamDepth = b.depth || 1.25;
              const beamWidth = b.width || 0.75;
              const beamY = elevation + wallH - beamDepth / 2;

              return (
                <group key={b.id} position={[midX, beamY, midZ]} rotation={[0, -angle, 0]}>
                  <mesh castShadow receiveShadow material={beamMaterial}>
                    <boxGeometry args={[length, beamDepth, beamWidth]} />
                  </mesh>
                  <lineSegments>
                    <edgesGeometry args={[new THREE.BoxGeometry(length, beamDepth, beamWidth)]} />
                    <lineBasicMaterial color="#3D3A38" />
                  </lineSegments>
                </group>
              );
            })}

            {/* 3. Foundation Footing Pads (for Ground Level) */}
            {lvIdx === 0 &&
              footings.map((f) => {
                const fx = f.position[0] - plotW / 2;
                const fz = f.position[1] - plotL / 2;
                const padW = f.width || 4.0;
                const padL = f.length || 4.0;
                const padD = f.depth || 1.5;
                const padY = elevation - padD / 2;

                return (
                  <group key={f.id} position={[fx, padY, fz]}>
                    <mesh receiveShadow material={footingMaterial}>
                      <boxGeometry args={[padW, padD, padL]} />
                    </mesh>
                    <lineSegments>
                      <edgesGeometry args={[new THREE.BoxGeometry(padW, padD, padL)]} />
                      <lineBasicMaterial color="#2E2B2A" />
                    </lineSegments>
                  </group>
                );
              })}
          </group>
        );
      })}
    </group>
  );
}
