import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { strToU8, zipSync } from "three/examples/jsm/libs/fflate.module.js";
import { exportSceneAsGLB, prepareSceneForExport, type Export3DOptions } from "../export-3d";
import { triggerDownload } from "../export-2d";
import type { HouseDesign } from "./schema";

export type RenderSize = { id: string; label: string; width: number; height: number };

export const RENDER_SIZES: RenderSize[] = [
  { id: "fhd", label: "Full HD · 1920 × 1080", width: 1920, height: 1080 },
  { id: "qhd", label: "2K · 2560 × 1440", width: 2560, height: 1440 },
  { id: "uhd", label: "4K · 3840 × 2160", width: 3840, height: 2160 },
];

export function exportFileName(project: string, suffix: string): string {
  const slug = project.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "house";
  return `nexora-${slug}-${suffix}`;
}

/** Wavefront MTL for the materials a model uses. Colours and shininess only; OBJ has no good way to carry the rest. */
export function buildMtl(root: THREE.Object3D): string {
  const seen = new Map<string, THREE.MeshStandardMaterial>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      const key = materialKey(obj.material);
      seen.set(key, obj.material);
    }
  });
  const lines: string[] = ["# NEXORA house materials"];
  for (const [name, m] of seen) {
    lines.push(`newmtl ${name}`);
    // Three keeps colours in linear space; MTL viewers expect the display values.
    const shown = m.color.clone().convertLinearToSRGB();
    lines.push(`Kd ${shown.r.toFixed(4)} ${shown.g.toFixed(4)} ${shown.b.toFixed(4)}`);
    lines.push(`Ks ${(m.metalness * 0.6).toFixed(3)} ${(m.metalness * 0.6).toFixed(3)} ${(m.metalness * 0.6).toFixed(3)}`);
    lines.push(`Ns ${Math.round((1 - m.roughness) ** 2 * 900)}`);
    lines.push(`d ${m.opacity.toFixed(3)}`, "illum 2", "");
  }
  return lines.join("\n");
}

const materialKey = (m: THREE.Material) => `m_${m.uuid.replace(/-/g, "").slice(0, 12)}`;

function namedForObj(root: THREE.Group): THREE.Group {
  // OBJExporter writes `usemtl <material.name>`, and the MTL has to use the same names.
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const material = obj.material as THREE.Material;
      material.name = materialKey(material);
    }
  });
  return root;
}

/** OBJ with its MTL, zipped because the two files only work together. */
export function exportObjArchive(liveScene: THREE.Object3D, options: Export3DOptions, baseName: string): Blob {
  const root = namedForObj(prepareSceneForExport(liveScene, options));
  const obj = `mtllib ${baseName}.mtl\n${new OBJExporter().parse(root)}`;
  const zip = zipSync({ [`${baseName}.obj`]: strToU8(obj), [`${baseName}.mtl`]: strToU8(buildMtl(root)) }, { level: 6 });
  const blob = new Blob([zip], { type: "application/zip" });
  triggerDownload(blob, `${baseName}.zip`);
  return blob;
}

/** STL is geometry only, which suits 3D printing a massing model. */
export function exportStl(liveScene: THREE.Object3D, options: Export3DOptions, baseName: string): Blob {
  const root = prepareSceneForExport(liveScene, options);
  root.updateMatrixWorld(true);
  const data = new STLExporter().parse(root, { binary: true });
  const blob = new Blob([data as unknown as ArrayBuffer], { type: "model/stl" });
  triggerDownload(blob, `${baseName}.stl`);
  return blob;
}

/** GLB carries the chosen settings in its metadata, so they travel with the model. */
export async function exportGlb(liveScene: THREE.Object3D, options: Export3DOptions, baseName: string, design: HouseDesign): Promise<void> {
  const root = prepareSceneForExport(liveScene, options);
  root.userData.nexoraDesign = design;
  await exportSceneAsGLB(root, options, `${baseName}.glb`, true);
}
