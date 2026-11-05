"use client";

import { useEffect, useMemo } from "react";
import type { FloorPlan } from "@houseplan/design-schema";
import { boundaryOf } from "@/lib/boundary";
import { boundaryPieces, boundarySurface } from "@/lib/house-design/boundary-model";
import { applySurface, createPartMaterial, syncMeshes } from "@/lib/house-design/three-build";

/** The boundary wall in the plain 3D view. The designed house builds the same pieces into its own model. */
export function BoundaryWalls({ plan }: { plan: FloorPlan }) {
  const settings = boundaryOf(plan);
  const meshes = useMemo(() => [...syncMeshes(new Map(), boundaryPieces(plan).flatMap((p) => p.prims.map((prim) => ({ ...prim, object: p.id })))).meshes.values()], [plan]);
  const units = plan.units === "m" ? 0.3048 : 1;
  const materials = useMemo(() => {
    const out = new Map<string, ReturnType<typeof createPartMaterial>>();
    for (const part of ["compound", "boundaryPillar", "boundaryCoping", "gate"]) {
      const material = createPartMaterial(part);
      applySurface(material, boundarySurface(part, settings)!, units);
      out.set(part, material);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.color, settings.materialId, settings.style, units]);
  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  return (
    <group name="NEXORA_Boundary_Wall">
      {meshes.map((m) => (
        <mesh key={m.key} name={`Boundary ${m.part} [${m.object}]`} userData={{ part: m.part, object: m.object, site: true }} geometry={m.geometry} material={materials.get(m.part)} castShadow receiveShadow />
      ))}
    </group>
  );
}
