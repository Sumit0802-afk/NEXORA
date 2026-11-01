import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { strToU8, zipSync } from "three/examples/jsm/libs/fflate.module.js";
import type { FloorPlan, Room } from "@houseplan/design-schema";
import { exportSceneAsGLB, prepareSceneForExport, type Export3DOptions } from "../export-3d";
import { triggerDownload } from "../export-2d";
import { baseGeometry, planFingerprint } from "./geometry-engine";
import { buildDesignModel } from "./model";
import { objectFinish, type SceneObject } from "./objects";
import type { DesignVariation, HouseDesign, HouseDesignDocument } from "./schema";
import { isRoofPart, partLabel, surfaceFor } from "./surfaces";
import { applySurface, createPartMaterial, syncMeshes, type PartMaterial } from "./three-build";

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

const manifest = (objects: SceneObject[]) => objects.map(({ id, kind, label, level, elevation, host }) => ({ id, kind, label, level, elevation, host }));

/** GLB or glTF. The model carries the chosen settings and its object list in its metadata, so they travel with it. */
export async function exportGlb(liveScene: THREE.Object3D, options: Export3DOptions, baseName: string, design: HouseDesign, objects: SceneObject[] = [], format: "glb" | "gltf" = "glb"): Promise<void> {
  const root = prepareSceneForExport(liveScene, options);
  root.userData.nexoraDesign = design;
  root.userData.nexoraObjects = manifest(objects);
  await exportSceneAsGLB(root, options, `${baseName}.${format}`, true, format === "gltf");
}

/** Builds a design into a Three.js group without a viewer, so any saved variation can be exported without opening it. */
export function buildDesignScene(plan: FloorPlan, design: HouseDesign): { root: THREE.Group; objects: SceneObject[] } {
  const base = baseGeometry(plan, design);
  const model = buildDesignModel(base.geometry, base.renderPlan, design);
  const rooms = new Map<string, Room>(plan.levels.flatMap((l) => l.rooms).map((r) => [r.id, r]));
  const hosts = new Map(model.objects.map((o) => [o.id, o.host]));
  const units = plan.units === "m" ? 0.3048 : 1;
  const materials = new Map<string, PartMaterial>();
  const root = new THREE.Group();
  root.name = "NEXORA_Designed_House";
  for (const mesh of syncMeshes(new Map(), model.prims).meshes.values()) {
    const own = objectFinish(design, mesh.object, mesh.part, hosts);
    const key = own ? mesh.key : mesh.part;
    let material = materials.get(key);
    if (!material) {
      material = createPartMaterial(mesh.part);
      applySurface(material, { ...surfaceFor(mesh.part, design, plan, "day", rooms), ...own }, units);
      materials.set(key, material);
    }
    const node = new THREE.Mesh(mesh.geometry, material);
    node.name = mesh.object ? `${partLabel(mesh.part)} [${mesh.object}]` : partLabel(mesh.part);
    node.userData = { part: mesh.part, object: mesh.object, roof: isRoofPart(mesh.part), site: !mesh.object && SITE.has(mesh.part) };
    root.add(node);
  }
  return { root, objects: model.objects };
}

const SITE = new Set(["surroundings", "plot", "road", "sidewalk", "roadMark", "water", "path", "hedge", "shrub", "flower", "lampBody", "lampHead", "neighbour"]);

async function variationGlb(plan: FloorPlan, variation: DesignVariation, options: Export3DOptions): Promise<Blob> {
  const { root, objects } = buildDesignScene(plan, variation.design);
  const clean = prepareSceneForExport(root, options);
  clean.userData.nexoraDesign = variation.design;
  clean.userData.nexoraObjects = manifest(objects);
  return exportSceneAsGLB(clean, options, undefined, true, false, false);
}

export async function exportVariation(plan: FloorPlan, variation: DesignVariation, options: Export3DOptions, project: string): Promise<void> {
  triggerDownload(await variationGlb(plan, variation, options), exportFileName(project, `${exportFileName(variation.name, "house.glb").replace(/^nexora-/, "")}`));
}

/** One GLB per saved variation, zipped. */
export async function exportAllVariations(plan: FloorPlan, variations: DesignVariation[], options: Export3DOptions, project: string): Promise<void> {
  const files: Record<string, Uint8Array> = {};
  for (const variation of variations) {
    const blob = await variationGlb(plan, variation, options);
    const name = exportFileName(variation.name, "house.glb").replace(/^nexora-/, "");
    files[name in files ? `${variation.id}-${name}` : name] = new Uint8Array(await blob.arrayBuffer());
  }
  triggerDownload(new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }), exportFileName(project, "variations.zip"));
}

export const PROJECT_FORMAT = "nexora-house-design";

export type ProjectFile = { format: typeof PROJECT_FORMAT; version: 1; savedAt: string; planFingerprint: string; plan: FloorPlan; document: HouseDesignDocument };

/** Everything needed to restore this design later: references, reading, overrides and variations, with a copy of the plan. */
export function exportProjectFile(plan: FloorPlan, document: HouseDesignDocument, project: string) {
  const file: ProjectFile = { format: PROJECT_FORMAT, version: 1, savedAt: new Date().toISOString(), planFingerprint: planFingerprint(plan), plan, document };
  triggerDownload(new Blob([JSON.stringify(file)], { type: "application/json" }), exportFileName(project, "design.json"));
}

/** Null when the text is not a NEXORA design file. */
export function parseProjectFile(text: string): ProjectFile | null {
  try {
    const file = JSON.parse(text) as Partial<ProjectFile>;
    return file.format === PROJECT_FORMAT && file.document && typeof file.planFingerprint === "string" ? (file as ProjectFile) : null;
  } catch {
    return null;
  }
}
