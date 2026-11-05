import * as THREE from "three";
import type { FloorPlan } from "@houseplan/design-schema";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { demoPlan } from "../demo-plan";
import { buildSceneGeometry, computeCameraFraming } from "../scene-geometry";
import type { CatalogDesign } from "./catalog";
import { buildDesignScene } from "./export";

/**
 * Real 3D previews for the design catalog: each design is built on a sample two-storey house and rendered with the
 * same engine and materials the studio uses. One shared renderer works through a queue, and only cards on screen ask.
 */

const WIDTH = 640, HEIGHT = 400;

/** The demo plan with its ground floor repeated above, so balconies, roofs and upper windows show. */
const SAMPLE: FloorPlan = (() => {
  const ground = demoPlan.levels[0];
  const tag = (id: string) => `upper-${id}`;
  const upper = {
    ...ground, id: tag(ground.id), elevation: ground.elevation + ground.wallHeight, furniture: [],
    rooms: ground.rooms.map((r) => ({ ...r, id: tag(r.id) })),
    walls: ground.walls.map((w) => ({ ...w, id: tag(w.id) })),
    openings: ground.openings.filter((o) => o.kind === "window").map((o) => ({ ...o, id: tag(o.id), wallId: tag(o.wallId) })),
  };
  return { ...demoPlan, plot: { ...demoPlan.plot, floors: 2 }, levels: [ground, upper] };
})();
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let renderer: THREE.WebGLRenderer | null = null;
let environment: THREE.Texture | null = null;
let failed = false;
let chain: Promise<unknown> = Promise.resolve();

function setup(): THREE.WebGLRenderer | null {
  if (renderer || failed) return renderer;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  } catch {
    failed = true;
    renderer = null;
  }
  return renderer;
}

function sky(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#7FA8D6");
  g.addColorStop(0.75, "#DCE7F0");
  g.addColorStop(1, "#EEF1EC");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function render(entry: CatalogDesign): string | null {
  const gl = setup();
  if (!gl) return null;
  const { root } = buildDesignScene(SAMPLE, entry.design);
  const scene = new THREE.Scene();
  scene.background = sky();
  scene.environment = environment;
  scene.environmentIntensity = 0.55;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = !o.userData.site;
      o.receiveShadow = true;
    }
  });
  scene.add(root);
  const geometry = buildSceneGeometry(SAMPLE);
  const span = Math.max(geometry.plotWidth, geometry.plotDepth);
  const sun = new THREE.DirectionalLight("#FFF3E0", 2.2);
  sun.position.set(-span * 0.6, span * 0.95, -span * 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: span * 4 });
  scene.add(sun, new THREE.HemisphereLight("#EAF2FF", "#B9B09C", 0.45));
  const framing = computeCameraFraming(geometry);
  const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, framing.near, framing.far);
  const [x, y, z] = framing.positions.street;
  camera.position.set(x * 1.02, y * 0.72, z * 1.02);
  camera.lookAt(framing.targetX ?? 0, framing.targetY * 1.3, framing.targetZ ?? 0);
  gl.render(scene, camera);
  const url = gl.domElement.toDataURL("image/jpeg", 0.84);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
  (scene.background as THREE.Texture).dispose();
  return url;
}

export function cachedPreview(id: string): string | undefined {
  return cache.get(id);
}

/** Resolves to a rendered preview, or null where the browser cannot render one; callers then keep the drawing. */
export function renderPreview(entry: CatalogDesign): Promise<string | null> {
  const done = cache.get(entry.id);
  if (done) return Promise.resolve(done);
  const waiting = pending.get(entry.id);
  if (waiting) return waiting;
  const job = chain.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    let url: string | null = null;
    try {
      url = render(entry);
    } catch {
      url = null;
    }
    pending.delete(entry.id);
    if (url) cache.set(entry.id, url);
    return url;
  });
  chain = job;
  pending.set(entry.id, job);
  return job;
}
