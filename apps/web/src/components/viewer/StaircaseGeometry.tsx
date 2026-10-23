import { useMemo } from "react";
import type { RoomFloor } from "@/lib/scene-geometry";

interface StaircaseGeometryProps {
  floor: RoomFloor;
  wallHeight: number;
}

/**
 * Procedurally generates an architectural staircase inside rooms of type 'staircase'.
 * Creates realistic steps (treads and risers) rising from floor.baseY to floor.baseY + wallHeight,
 * complete with handrail and balusters.
 */
export function StaircaseGeometry({ floor, wallHeight }: StaircaseGeometryProps) {
  const { treads, handrailPoints, balusters, isAlongDepth } = useMemo(() => {
    // Determine whether the stair flight runs along depth (Z) or width (X)
    const alongDepth = floor.depth >= floor.width;
    const flightLength = alongDepth ? floor.depth * 0.85 : floor.width * 0.85;
    const flightWidth = alongDepth ? floor.width * 0.75 : floor.depth * 0.75;
    const stepCount = 16;
    const riserHeight = wallHeight / stepCount;
    const treadDepth = flightLength / stepCount;

    const treadList: Array<{
      x: number;
      y: number;
      z: number;
      w: number;
      h: number;
      d: number;
    }> = [];

    const balusterList: Array<{ x: number; y: number; z: number }> = [];
    const railPoints: Array<[number, number, number]> = [];

    const startX = alongDepth ? floor.centerX : floor.centerX - flightLength / 2;
    const startZ = alongDepth ? floor.centerZ - flightLength / 2 : floor.centerZ;

    for (let i = 0; i < stepCount; i++) {
      const stepY = floor.baseY + (i + 0.5) * riserHeight;
      const stepX = alongDepth ? startX : startX + (i + 0.5) * treadDepth;
      const stepZ = alongDepth ? startZ + (i + 0.5) * treadDepth : startZ;
      const w = alongDepth ? flightWidth : treadDepth;
      const d = alongDepth ? treadDepth : flightWidth;

      // Solid tread block
      treadList.push({
        x: stepX,
        y: stepY,
        z: stepZ,
        w: Math.max(w - 0.02, 0.1),
        h: riserHeight,
        d: Math.max(d - 0.02, 0.1),
      });

      // Handrail posts on one outer edge every 3 steps
      if (i % 3 === 0 || i === stepCount - 1) {
        const railX = alongDepth ? stepX + flightWidth / 2 - 0.06 : stepX;
        const railZ = alongDepth ? stepZ : stepZ + flightWidth / 2 - 0.06;
        balusterList.push({ x: railX, y: stepY + 0.45, z: railZ });
        railPoints.push([railX, stepY + 0.9, railZ]);
      }
    }

    return {
      treads: treadList,
      handrailPoints: railPoints,
      balusters: balusterList,
      isAlongDepth: alongDepth,
    };
  }, [floor, wallHeight]);

  return (
    <group>
      {/* Step treads */}
      {treads.map((step, idx) => (
        <group key={`step-${idx}`}>
          {/* Main stone / wood tread */}
          <mesh position={[step.x, step.y, step.z]} castShadow receiveShadow>
            <boxGeometry args={[step.w, step.h, step.d]} />
            <meshStandardMaterial
              color="#D4C9B8"
              roughness={0.4}
              metalness={0.05}
            />
          </mesh>
          {/* Step nosing edge highlight */}
          <mesh
            position={[
              step.x,
              step.y + step.h / 2 + 0.01,
              isAlongDepth ? step.z + step.d / 2 - 0.02 : step.z,
            ]}
          >
            <boxGeometry
              args={[
                isAlongDepth ? step.w : 0.04,
                0.02,
                isAlongDepth ? 0.04 : step.d,
              ]}
            />
            <meshStandardMaterial color="#8B6F47" roughness={0.3} metalness={0.1} />
          </mesh>
        </group>
      ))}

      {/* Balusters (vertical posts) */}
      {balusters.map((b, idx) => (
        <mesh key={`bal-${idx}`} position={[b.x, b.y, b.z]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.9, 8]} />
          <meshStandardMaterial color="#22262E" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}

      {/* Handrail diagonal top bar */}
      {handrailPoints.length >= 2 && (
        <group>
          {handrailPoints.slice(0, -1).map((pt, idx) => {
            const next = handrailPoints[idx + 1];
            const mx = (pt[0] + next[0]) / 2;
            const my = (pt[1] + next[1]) / 2;
            const mz = (pt[2] + next[2]) / 2;
            const dx = next[0] - pt[0];
            const dy = next[1] - pt[1];
            const dz = next[2] - pt[2];
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
            const yaw = Math.atan2(dx, dz);

            return (
              <mesh
                key={`rail-${idx}`}
                position={[mx, my, mz]}
                rotation={[0, yaw, -pitch]}
                castShadow
              >
                <boxGeometry args={[0.06, 0.06, length]} />
                <meshStandardMaterial color="#4A3B2C" roughness={0.3} metalness={0.1} />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}
