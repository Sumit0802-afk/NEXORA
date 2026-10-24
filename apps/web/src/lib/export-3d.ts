import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import type { FloorPlan, FurnitureItem } from "@houseplan/design-schema";
import { buildSceneGeometry } from "./scene-geometry";
import { triggerDownload } from "./export-2d";

export type Export3DOptions = {
  scope?: "all" | "single";
  levelIndex?: number;
  includeFurniture?: boolean;
  includeRoof?: boolean;
  includeTerrace?: boolean;
  projectName?: string;
};

/** Prepares a live Three.js scene for export by filtering out camera rigs, grids, and UI overlays. */
export function prepareSceneForExport(
  liveScene: THREE.Object3D,
  options: Export3DOptions = {}
): THREE.Group {
  const root = new THREE.Group();
  root.name = "NEXORA_House_Model";

  // Traverse children and copy real architectural geometry
  liveScene.traverse((obj) => {
    // Skip cameras, lights, grid, html elements, helpers
    if (
      obj.type === "GridHelper" ||
      obj.type.includes("Camera") ||
      obj.name.includes("Helper") ||
      obj.name === "Grid" ||
      (obj as any).isGrid
    ) {
      return;
    }

    if (obj instanceof THREE.Mesh) {
      // Check if it's the ground floor plane (usually 8x the plot size)
      if (obj.geometry instanceof THREE.PlaneGeometry && obj.geometry.parameters.width > 200) {
        return;
      }

      // Check if roof mesh should be excluded
      if (options.includeRoof === false && (obj.name.includes("Roof") || (obj.parent && obj.parent.name.includes("Roof")))) {
        return;
      }

      // Check if furniture mesh should be excluded
      if (options.includeFurniture === false && (obj.name.includes("Furniture") || (obj.parent && obj.parent.name.includes("furn")))) {
        return;
      }

      // Clone mesh and preserve transform
      const cloned = obj.clone();
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      obj.getWorldPosition(worldPos);
      obj.getWorldQuaternion(worldQuat);
      obj.getWorldScale(worldScale);

      cloned.position.copy(worldPos);
      cloned.quaternion.copy(worldQuat);
      cloned.scale.copy(worldScale);
      root.add(cloned);
    }
  });

  return root;
}

/** Builds an offscreen Three.js hierarchy for exporting when no live 3D viewer is mounted (e.g. in 2D editor or headless). */
export function buildStandaloneThreeScene(
  plan: FloorPlan,
  options: Export3DOptions = {}
): THREE.Group {
  const root = new THREE.Group();
  root.name = `NEXORA_${plan.projectId || "House"}_Model`;

  const topLevel = options.scope === "single" ? options.levelIndex : undefined;
  const geometry = buildSceneGeometry(plan, topLevel);

  // Materials
  const matExteriorWall = new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.75 });
  const matInteriorWall = new THREE.MeshStandardMaterial({ color: 0xedeae1, roughness: 0.85 });
  const matBoundaryWall = new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: 0.8 });
  const matPlinth = new THREE.MeshStandardMaterial({ color: 0x484252, roughness: 0.6 });
  const matDoor = new THREE.MeshStandardMaterial({ color: 0x6e4832, roughness: 0.5 });
  const matDoorHandle = new THREE.MeshStandardMaterial({ color: 0x1f232b, metalness: 0.85, roughness: 0.2 });
  const matWindowFrame = new THREE.MeshStandardMaterial({ color: 0x242830, metalness: 0.5, roughness: 0.4 });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x8ab4f8,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    metalness: 0.1,
  });
  const matFloor = new THREE.MeshStandardMaterial({ color: 0xe6e0d3, roughness: 0.6 });
  const matRoof = new THREE.MeshStandardMaterial({ color: 0x403d52, roughness: 0.8 });
  const matFurniture = new THREE.MeshStandardMaterial({ color: 0x5a504b, roughness: 0.7 });

  // 1. Floor Slabs
  geometry.floors.forEach((f) => {
    if (options.scope === "single" && options.levelIndex !== undefined && f.level !== options.levelIndex) {
      return;
    }
    const slabGeo = new THREE.BoxGeometry(f.width, 0.25, f.depth);
    const slabMesh = new THREE.Mesh(slabGeo, matFloor);
    slabMesh.name = `Floor_${f.name}_${f.id}`;
    slabMesh.position.set(f.centerX, f.baseY + 0.125, f.centerZ);
    root.add(slabMesh);
  });

  // 2. Walls
  geometry.walls.forEach((w) => {
    const wallGeo = new THREE.BoxGeometry(w.length, w.height, w.thickness);
    const wallMat =
      w.kind === "exterior" ? matExteriorWall : w.kind === "interior" ? matInteriorWall : matBoundaryWall;
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.name = `Wall_${w.kind}_${w.id}`;
    wallMesh.position.set(w.centerX, w.baseY + w.height / 2, w.centerZ);
    wallMesh.rotation.set(0, -w.angle, 0);
    root.add(wallMesh);

    // Boundary wall coping
    if (w.kind === "boundary") {
      const capGeo = new THREE.BoxGeometry(w.length + 0.04, 0.06, w.thickness + 0.06);
      const capMesh = new THREE.Mesh(capGeo, matPlinth);
      capMesh.position.set(w.centerX, w.baseY + w.height + 0.03, w.centerZ);
      capMesh.rotation.set(0, -w.angle, 0);
      root.add(capMesh);
    }
  });

  // 3. Doors
  geometry.doors.forEach((d) => {
    const cx = d.hingeX + Math.cos(d.angle) * (d.width / 2);
    const cz = d.hingeZ + Math.sin(d.angle) * (d.width / 2);
    const doorGeo = new THREE.BoxGeometry(d.width, d.height, d.thickness);
    const doorMesh = new THREE.Mesh(doorGeo, matDoor);
    doorMesh.name = `Door_${d.id}`;
    doorMesh.position.set(cx, d.baseY + d.height / 2, cz);
    doorMesh.rotation.set(0, -d.angle, 0);
    root.add(doorMesh);

    // Handle
    const handleGeo = new THREE.BoxGeometry(d.width * 0.14, 0.06, 0.08);
    const handleMesh = new THREE.Mesh(handleGeo, matDoorHandle);
    handleMesh.position.set(cx + Math.cos(-d.angle) * (d.width * 0.35), d.baseY + d.height * 0.5, cz);
    root.add(handleMesh);
  });

  // 4. Windows
  geometry.windows.forEach((p) => {
    const fThick = 0.08;
    const fWidth = 0.08;
    const winGroup = new THREE.Group();
    winGroup.name = `Window_${p.id}`;
    winGroup.position.set(p.centerX, p.baseY + p.height / 2, p.centerZ);
    winGroup.rotation.set(0, -p.angle, 0);

    // Frame
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(p.width, fWidth, fThick), matWindowFrame);
    topFrame.position.set(0, p.height / 2 - fWidth / 2, 0);
    const botFrame = new THREE.Mesh(new THREE.BoxGeometry(p.width, fWidth, fThick * 1.3), matWindowFrame);
    botFrame.position.set(0, -p.height / 2 + fWidth / 2, 0);
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(fWidth, p.height, fThick), matWindowFrame);
    leftFrame.position.set(-p.width / 2 + fWidth / 2, 0, 0);
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(fWidth, p.height, fThick), matWindowFrame);
    rightFrame.position.set(p.width / 2 - fWidth / 2, 0, 0);

    // Glass
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(p.width - fWidth * 2, 0.02), Math.max(p.height - fWidth * 2, 0.02), 0.02),
      matGlass
    );

    winGroup.add(topFrame, botFrame, leftFrame, rightFrame, glass);
    root.add(winGroup);
  });

  // 5. Furniture (if included)
  if (options.includeFurniture !== false) {
    plan.levels.forEach((level, lvIdx) => {
      if (options.scope === "single" && options.levelIndex !== undefined && lvIdx !== options.levelIndex) {
        return;
      }
      const furnItems = (level.furniture || []) as FurnitureItem[];
      furnItems.forEach((item) => {
        const { width: fw, depth: fd, height: fh } = item.dimensions;
        const posX = item.position[0] - geometry.plotWidth / 2;
        const posZ = item.position[1] - geometry.plotDepth / 2;
        const floorY = level.elevation + 0.25;

        const fMesh = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), matFurniture);
        fMesh.name = `Furniture_${item.type}_${item.id}`;
        fMesh.position.set(posX, floorY + fh / 2, posZ);
        fMesh.rotation.set(0, item.rotation || 0, 0);
        root.add(fMesh);
      });
    });
  }

  // 6. Roof (if included)
  if (options.includeRoof !== false && (options.scope !== "single" || options.levelIndex === plan.levels.length - 1)) {
    const topElevation = geometry.floors.reduce((max, f) => Math.max(max, f.baseY), 0);
    const roofY = topElevation + geometry.wallHeight;
    const roofGeo = new THREE.BoxGeometry(geometry.plotWidth * 0.98, 0.35, geometry.plotDepth * 0.98);
    const roofMesh = new THREE.Mesh(roofGeo, matRoof);
    roofMesh.name = "House_Roof_Slab";
    roofMesh.position.set(0, roofY + 0.175, 0);
    root.add(roofMesh);
  }

  return root;
}

/** Exports 3D model as standard binary GLB file. */
export async function exportSceneAsGLB(
  input: THREE.Object3D | FloorPlan,
  options: Export3DOptions = {},
  filename?: string
): Promise<Blob> {
  const objectToExport =
    "schemaVersion" in input
      ? buildStandaloneThreeScene(input, options)
      : prepareSceneForExport(input, options);

  return new Promise<Blob>((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      objectToExport,
      (gltf) => {
        try {
          const blob =
            gltf instanceof ArrayBuffer
              ? new Blob([gltf], { type: "model/gltf-binary" })
              : new Blob([JSON.stringify(gltf, null, 2)], { type: "application/json" });

          const fname = filename || `nexora-${options.projectName || "house-model"}.glb`;
          triggerDownload(blob, fname);
          resolve(blob);
        } catch (err) {
          reject(err);
        }
      },
      (err) => {
        reject(err);
      },
      { binary: true, embedImages: true }
    );
  });
}

/** Exports 3D model as Wavefront OBJ file. */
export async function exportSceneAsOBJ(
  input: THREE.Object3D | FloorPlan,
  options: Export3DOptions = {},
  filename?: string
): Promise<string> {
  const objectToExport =
    "schemaVersion" in input
      ? buildStandaloneThreeScene(input, options)
      : prepareSceneForExport(input, options);

  const exporter = new OBJExporter();
  const result = exporter.parse(objectToExport);
  const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
  const fname = filename || `nexora-${options.projectName || "house-model"}.obj`;
  triggerDownload(blob, fname);
  return result;
}

/** Captures and downloads high-resolution 3D screenshot from WebGLRenderer canvas. */
export function capture3DScreenshot(
  renderer: THREE.WebGLRenderer | null,
  filename?: string
): string | null {
  if (!renderer) return null;
  const dataUrl = renderer.domElement.toDataURL("image/png");
  triggerDownload(dataUrl, filename || "nexora-house-3d-view.png");
  return dataUrl;
}
