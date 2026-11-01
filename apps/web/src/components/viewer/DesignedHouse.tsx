"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  SRGBColorSpace,
  type BufferGeometry,
  type DirectionalLight,
} from "three";
import type { FloorPlan, Room } from "@houseplan/design-schema";
import type { DesignModel } from "@/lib/house-design/model";
import type { HouseDesign, LightingPreview } from "@/lib/house-design/schema";
import { isRoofPart, partLabel, surfaceFor } from "@/lib/house-design/surfaces";
import { applySurface, buildPartGeometries, createPartMaterial, type PartMaterial } from "@/lib/house-design/three-build";

/** The customized house: one mesh per part, with materials updated in place as the design changes. */
export function DesignedHouse({
  model,
  design,
  plan,
  lighting,
  showRoof,
  selectedPart,
  onPickPart,
}: {
  model: DesignModel;
  design: HouseDesign;
  plan: FloorPlan;
  lighting: LightingPreview;
  showRoof: boolean;
  selectedPart?: string | null;
  onPickPart?: (part: string | null) => void;
}) {
  const geometries = useMemo(() => buildPartGeometries(model.prims), [model]);
  const previous = useRef<Map<string, BufferGeometry> | null>(null);
  useEffect(() => {
    if (previous.current && previous.current !== geometries) previous.current.forEach((g) => g.dispose());
    previous.current = geometries;
  }, [geometries]);
  useEffect(() => () => previous.current?.forEach((g) => g.dispose()), []);

  const materials = useRef(new Map<string, PartMaterial>());
  const parts = useMemo(() => [...geometries.keys()], [geometries]);
  const rooms = useMemo(() => new Map<string, Room>(plan.levels.flatMap((l) => l.rooms).map((r) => [r.id, r])), [plan]);
  const units = plan.units === "m" ? 0.3048 : 1;

  const materialFor = (part: string) => {
    let material = materials.current.get(part);
    if (!material) {
      material = createPartMaterial(part);
      applySurface(material, surfaceFor(part, design, plan, lighting, rooms), units);
      materials.current.set(part, material);
    }
    return material;
  };

  useLayoutEffect(() => {
    for (const part of parts) {
      const material = materialFor(part);
      applySurface(material, surfaceFor(part, design, plan, lighting, rooms), units);
      if (part === selectedPart) {
        material.emissive.set("#5146A5");
        material.emissiveIntensity = 0.28;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, design, lighting, selectedPart, rooms, units]);

  useEffect(() => {
    const store = materials.current;
    return () => {
      store.forEach((m) => m.dispose());
      store.clear();
    };
  }, []);

  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (!onPickPart || e.delta > 3) return;
    e.stopPropagation();
    onPickPart((e.object.userData.part as string) ?? null);
  };

  return (
    <group name="NEXORA_Designed_House">
      {parts.map((part) => {
        const glass = part === "glass" || part === "railGlass" || part === "doorGlass";
        return (
          <mesh
            key={part}
            name={partLabel(part)}
            userData={{ part, site: isSitePart(part) }}
            geometry={geometries.get(part)}
            material={materialFor(part)}
            visible={showRoof || !isRoofPart(part)}
            castShadow={!glass && !isFlatGround(part)}
            receiveShadow={!glass}
            onClick={onPickPart ? pick : undefined}
          />
        );
      })}
    </group>
  );
}

const GROUND_PARTS = new Set(["surroundings", "plot", "road", "sidewalk", "roadMark", "water"]);
const SITE_PARTS = new Set([...GROUND_PARTS, "path", "drive", "hedge", "shrub", "flower", "foliage", "trunk", "neighbour", "lampBody", "lampHead"]);
const isFlatGround = (part: string) => GROUND_PARTS.has(part);
const isSitePart = (part: string) => SITE_PARTS.has(part);

type Mood = {
  top: string;
  horizon: string;
  ground: string;
  clouds: number;
  sun: { color: string; intensity: number; position: [number, number, number] };
  fill: { color: string; intensity: number };
  hemi: { sky: string; ground: string; intensity: number };
  ambient: number;
  environment: number;
  fog: string;
};

const MOODS: Record<LightingPreview, Mood> = {
  day: {
    top: "#6FA3D8", horizon: "#DCE9F3", ground: "#DCE7EE", clouds: 0.55,
    sun: { color: "#FFF3E0", intensity: 2.05, position: [-0.56, 0.92, -0.9] },
    fill: { color: "#CFE2FF", intensity: 0.22 },
    hemi: { sky: "#EAF2FF", ground: "#B9B09C", intensity: 0.42 },
    ambient: 0.04, environment: 0.5, fog: "#DCE7EE",
  },
  golden: {
    top: "#5A6E9C", horizon: "#F7C994", ground: "#EAC9A6", clouds: 0.4,
    sun: { color: "#FFBE82", intensity: 2.1, position: [-0.95, 0.38, -0.8] },
    fill: { color: "#9DB3DE", intensity: 0.2 },
    hemi: { sky: "#FFE3C4", ground: "#8D7A66", intensity: 0.34 },
    ambient: 0.04, environment: 0.42, fog: "#EAC9A6",
  },
  night: {
    top: "#0B1026", horizon: "#27305A", ground: "#141A33", clouds: 0.08,
    sun: { color: "#9FB6E8", intensity: 0.5, position: [-0.5, 0.95, -0.6] },
    fill: { color: "#5A6FA8", intensity: 0.12 },
    hemi: { sky: "#3A4778", ground: "#1A1A22", intensity: 0.3 },
    ambient: 0.06, environment: 0.3, fog: "#141A33",
  },
};

function skyTexture(mood: Mood): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, mood.top);
  sky.addColorStop(1, mood.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = mood.ground;
  ctx.fillRect(0, 256, 1024, 256);
  if (mood.clouds > 0) {
    let seed = 41;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const x = random() * 1024, y = 60 + random() * 150, r = 26 + random() * 74;
      const puff = ctx.createRadialGradient(x, y, 0, x, y, r);
      puff.addColorStop(0, `rgba(255,255,255,${0.32 * mood.clouds})`);
      puff.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = puff;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.9, 0.5);
      ctx.translate(-x, -y);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }
  } else {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let i = 0; i < 300; i++) ctx.fillRect(random() * 1024, random() * 220, 1, 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Sky, reflections and lights for the day, golden-hour and night previews. */
export function DesignAtmosphere({ lighting, span, lights }: { lighting: LightingPreview; span: number; lights: DesignModel["lights"] }) {
  const { gl, scene } = useThree();
  const mood = MOODS[lighting];
  const sunRef = useRef<DirectionalLight | null>(null);

  useEffect(() => {
    const sky = skyTexture(mood);
    const pmrem = new PMREMGenerator(gl);
    const environment = pmrem.fromEquirectangular(sky).texture;
    const before = { background: scene.background, environment: scene.environment };
    scene.background = sky;
    scene.environment = environment;
    scene.environmentIntensity = mood.environment;
    return () => {
      scene.background = before.background;
      scene.environment = before.environment;
      sky.dispose();
      environment.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, mood]);

  useEffect(() => {
    const sun = sunRef.current;
    if (!sun) return;
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
  }, [span]);

  const shadowReach = span * 1.25;
  const [sx, sy, sz] = mood.sun.position;
  const lit = lighting === "day" ? 0 : lighting === "golden" ? 0.45 : 1;

  return (
    <>
      <fog attach="fog" args={[mood.fog, span * 3, span * 8]} />
      <directionalLight
        ref={sunRef}
        position={[span * sx, span * sy, span * sz]}
        intensity={mood.sun.intensity}
        color={mood.sun.color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-shadowReach}
        shadow-camera-right={shadowReach}
        shadow-camera-top={shadowReach}
        shadow-camera-bottom={-shadowReach}
        shadow-camera-far={span * 5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[-span * sx, span * 0.7, -span * sz]} intensity={mood.fill.intensity} color={mood.fill.color} />
      <hemisphereLight args={[mood.hemi.sky, mood.hemi.ground, mood.hemi.intensity]} />
      <ambientLight intensity={mood.ambient} />
      {lit > 0 &&
        lights.map((light, i) => (
          <pointLight key={i} position={light.position} intensity={light.intensity * lit * 4} distance={light.distance} decay={1.6} color="#FFD9A0" />
        ))}
    </>
  );
}
