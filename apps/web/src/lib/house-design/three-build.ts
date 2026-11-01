import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  FrontSide,
  IcosahedronGeometry,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from "three";
import { getMaterial } from "./materials";
import type { Prim, Pt } from "./model";
import { isTwoSided, type Surface } from "./surfaces";
import { texturesFor, tintBoost } from "./textures";

/** Merges the model's primitives into one geometry per part, with texture coordinates in world units. */

type Bucket = { position: number[]; normal: number[]; uv: number[] };

// A unit cube as triangles: each face is [normal, u axis, v axis].
const CUBE_FACES: [Vec, Vec, Vec][] = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
];
type Vec = [number, number, number];
const CORNERS: Pt[] = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];

/** Box mapping: project along the strongest axis, so neighbouring pieces line up without any per-wall bookkeeping. */
function worldUV(x: number, y: number, z: number, nx: number, ny: number, nz: number): Pt {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  if (ay >= ax && ay >= az) return [x, z];
  return ax > az ? [z, y] : [x, y];
}

function pushBox(bucket: Bucket, prim: Extract<Prim, { kind: "box" }>) {
  const [cx, cy, cz] = prim.center;
  const [hx, hy, hz] = prim.size.map((v) => v / 2);
  const rot = prim.rot && (prim.rot[0] || prim.rot[1] || prim.rot[2]) ? new Quaternion().setFromEuler(new Euler(prim.rot[0], prim.rot[1], prim.rot[2], "YXZ")) : null;
  const p = new Vector3(), n = new Vector3();
  for (const [normal, uAxis, vAxis] of CUBE_FACES) {
    for (const [cu, cv] of CORNERS) {
      p.set(normal[0] + uAxis[0] * cu + vAxis[0] * cv, normal[1] + uAxis[1] * cu + vAxis[1] * cv, normal[2] + uAxis[2] * cu + vAxis[2] * cv);
      p.x *= hx; p.y *= hy; p.z *= hz;
      n.set(normal[0], normal[1], normal[2]);
      if (rot) { p.applyQuaternion(rot); n.applyQuaternion(rot); }
      p.x += cx; p.y += cy; p.z += cz;
      bucket.position.push(p.x, p.y, p.z);
      bucket.normal.push(n.x, n.y, n.z);
      const uv = worldUV(p.x, p.y, p.z, n.x, n.y, n.z);
      bucket.uv.push(uv[0], uv[1]);
    }
  }
}

function pushGeometry(bucket: Bucket, geometry: BufferGeometry, matrix: Matrix4) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  source.applyMatrix4(matrix);
  const pos = source.getAttribute("position"), nor = source.getAttribute("normal");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    bucket.position.push(x, y, z);
    bucket.normal.push(nx, ny, nz);
    const uv = worldUV(x, y, z, nx, ny, nz);
    bucket.uv.push(uv[0], uv[1]);
  }
  source.dispose();
  if (source !== geometry) geometry.dispose();
}

function pushPolygon(bucket: Bucket, prim: Extract<Prim, { kind: "polygon" }>) {
  const pts = prim.points;
  const a = new Vector3(...pts[0]), b = new Vector3(...pts[1]), c = new Vector3(...pts[2]);
  const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const wantUp = prim.part === "roof" ? 1 : prim.part === "soffit" ? -1 : 0;
  const flip = wantUp !== 0 && Math.sign(normal.y) !== wantUp;
  if (flip) normal.negate();
  for (let i = 1; i < pts.length - 1; i++) {
    const order = flip ? [0, i + 1, i] : [0, i, i + 1];
    for (const index of order) {
      bucket.position.push(...pts[index]);
      bucket.normal.push(normal.x, normal.y, normal.z);
      bucket.uv.push(prim.uv[index][0], prim.uv[index][1]);
    }
  }
}

/** Lumpy sphere with smooth shading, so planting reads as a soft mass and not a faceted ball. */
function jitter(geometry: BufferGeometry, seed: number, amount: number) {
  const pos = geometry.getAttribute("position"), nor = geometry.getAttribute("normal");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const wave = 1 + amount * Math.sin(x * 5.1 + seed) * Math.sin(y * 4.3 + seed * 2) * Math.sin(z * 4.7 + seed * 3);
    nor.setXYZ(i, x, y, z);
    pos.setXYZ(i, x * wave, y * wave, z * wave);
  }
}

export function buildPartGeometries(prims: Prim[]): Map<string, BufferGeometry> {
  const buckets = new Map<string, Bucket>();
  const bucketFor = (part: string) => {
    let b = buckets.get(part);
    if (!b) buckets.set(part, (b = { position: [], normal: [], uv: [] }));
    return b;
  };
  const matrix = new Matrix4();
  prims.forEach((prim, index) => {
    const bucket = bucketFor(prim.part);
    switch (prim.kind) {
      case "box":
        pushBox(bucket, prim);
        break;
      case "polygon":
        pushPolygon(bucket, prim);
        break;
      case "cylinder": {
        matrix.makeTranslation(prim.center[0], prim.center[1], prim.center[2]);
        pushGeometry(bucket, new CylinderGeometry(prim.radiusTop, prim.radiusBottom, prim.height, prim.segments ?? 12), matrix);
        break;
      }
      case "blob": {
        const geometry = new IcosahedronGeometry(1, 3);
        jitter(geometry, index, 0.22);
        matrix.compose(new Vector3(...prim.center), new Quaternion(), new Vector3(prim.radius, prim.radius * (prim.squash ?? 1), prim.radius));
        pushGeometry(bucket, geometry, matrix);
        break;
      }
      case "extrude": {
        const shape = new Shape(prim.outline.map(([x, y]) => new Vector2(x, y)));
        for (const hole of prim.holes ?? []) shape.holes.push(new Path(hole.map(([x, y]) => new Vector2(x, y))));
        const geometry = new ExtrudeGeometry(shape, { depth: prim.depth, bevelEnabled: false, steps: 1 });
        matrix.compose(new Vector3(...prim.center), new Quaternion().setFromEuler(new Euler(0, prim.rotY, 0)), new Vector3(1, 1, 1));
        matrix.multiply(new Matrix4().makeTranslation(0, 0, -prim.depth / 2));
        pushGeometry(bucket, geometry, matrix);
        break;
      }
    }
  });
  const out = new Map<string, BufferGeometry>();
  for (const [part, bucket] of buckets) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(bucket.position), 3));
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(bucket.normal), 3));
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array(bucket.uv), 2));
    geometry.computeBoundingSphere();
    out.set(part, geometry);
  }
  return out;
}

export type PartMaterial = MeshStandardMaterial | MeshPhysicalMaterial;

/** Puts a surface onto a material in place, so a colour drag never touches geometry or re-creates shaders. */
export function applySurface(material: PartMaterial, surface: Surface, units: number) {
  const def = getMaterial(surface.materialId);
  const boost = tintBoost(def);
  material.color.set(surface.color);
  if (boost !== 1) material.color.multiplyScalar(boost);
  material.roughness = def.roughness;
  material.metalness = def.metalness;
  const glass = def.category === "glass";
  const textures = glass ? null : texturesFor(def.pattern, def.tile * units);
  const nextMap = textures?.map ?? null, nextNormal = textures?.normalMap ?? null;
  if (material.map !== nextMap || material.normalMap !== nextNormal) {
    material.map = nextMap;
    material.normalMap = nextNormal;
    material.needsUpdate = true;
  }
  const opacity = def.opacity ?? 1;
  if (material.transparent !== opacity < 1) {
    material.transparent = opacity < 1;
    material.needsUpdate = true;
  }
  material.opacity = opacity;
  material.depthWrite = opacity >= 1;
  material.emissive.set(surface.emissive ?? "#000000");
  material.emissiveIntensity = surface.emissiveIntensity ?? 0;
  material.envMapIntensity = glass ? 1.4 : 0.7;
}

export function createPartMaterial(part: string): PartMaterial {
  const glassy = part === "glass" || part === "doorGlass" || part === "railGlass";
  const material = glassy ? new MeshPhysicalMaterial({ clearcoat: 1, clearcoatRoughness: 0.08, reflectivity: 0.9 }) : new MeshStandardMaterial();
  material.side = isTwoSided(part) ? DoubleSide : FrontSide;
  material.color = new Color("#ffffff");
  return material;
}
