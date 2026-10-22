"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { WebGLRenderer } from "three";
import type { FloorPlan, RoomType } from "@houseplan/design-schema";
import {
  buildSceneGeometry,
  computeCameraFraming,
  type CameraView,
  type RoomFloor,
  type SceneGeometry,
} from "@/lib/scene-geometry";

export type SceneView = CameraView;
export type HouseSceneHandle = { captureScreenshot: () => string | null; fitToView: () => void };

const FLOOR_COLOR: Record<RoomType, string> = {
  living_room: "#D9B892",
  dining_room: "#D4B58E",
  bedroom: "#C99F72",
  study: "#CFAE88",
  kitchen: "#E6E1D6",
  bathroom: "#D5E3EC",
  utility: "#DCD6CA",
  staircase: "#BFAE9A",
  hallway: "#EEE7DA",
  parking: "#B8B5AE",
  other: "#9EC27F",
};
const WALL_COLOR = { exterior: "#F2EEE6", interior: "#FBF9F5", boundary: "#CDC4B4" } as const;

function floorColor(floor: RoomFloor): string {
  if (floor.type === "other" && /sit|porch|terrace|deck/i.test(floor.name)) return "#D8CDBD";
  return FLOOR_COLOR[floor.type] ?? "#E8E2D6";
}

function GeneratedHouse({
  geometry,
  cutHeight,
  showLabels,
  selectedRoomId,
  onSelectRoom,
}: {
  geometry: SceneGeometry;
  cutHeight: number | null;
  showLabels: boolean;
  selectedRoomId: string | null;
  onSelectRoom?: (id: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const clip = (base: number, height: number) => (cutHeight === null ? height : Math.min(base + height, cutHeight) - base);
  const slab = geometry.wallHeight * 0.012;

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  const pointer = (id: string | null) => (e: ThreeEvent<PointerEvent>) => {
    if (!onSelectRoom) return;
    e.stopPropagation();
    setHovered(id);
    document.body.style.cursor = id ? "pointer" : "";
  };

  return (
    <group>
      <mesh position={[0, -slab, 0]} receiveShadow>
        <boxGeometry args={[geometry.plotWidth, slab * 2, geometry.plotDepth]} />
        <meshStandardMaterial color="#E4DCCB" />
      </mesh>

      {geometry.floors.map((floor) => {
        const selected = floor.id === selectedRoomId;
        const hot = floor.id === hovered;
        return (
          <mesh
            key={floor.id}
            position={[floor.centerX, floor.baseY + (floor.level > 0 && floor.type !== "other" ? slab * 4 : slab), floor.centerZ]}
            receiveShadow
            onPointerOver={pointer(floor.id)}
            onPointerOut={pointer(null)}
            onClick={(e) => {
              if (!onSelectRoom) return;
              e.stopPropagation();
              onSelectRoom(floor.id);
            }}
          >
            <boxGeometry args={[Math.max(floor.width - 0.04, 0.01), floor.level > 0 ? slab * 8 : slab * 2, Math.max(floor.depth - 0.04, 0.01)]} />
            <meshStandardMaterial
              color={floorColor(floor)}
              emissive={selected ? "#5146A5" : hot ? "#8A80D0" : "#000000"}
              emissiveIntensity={selected ? 0.45 : hot ? 0.18 : 0}
              roughness={floor.type === "bathroom" || floor.type === "kitchen" ? 0.35 : 0.8}
            />
          </mesh>
        );
      })}

      {geometry.walls.map((wall) => {
        if (cutHeight !== null && wall.baseY >= cutHeight) return null;
        const height = clip(wall.baseY, wall.height);
        if (height <= 0) return null;
        return (
          <mesh
            key={wall.id}
            position={[wall.centerX, wall.baseY + height / 2, wall.centerZ]}
            rotation={[0, -wall.angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[wall.length, height, wall.thickness]} />
            <meshStandardMaterial color={WALL_COLOR[wall.kind]} roughness={0.9} />
          </mesh>
        );
      })}

      {geometry.doors.map((door) => {
        if (cutHeight !== null && door.baseY >= cutHeight) return null;
        const height = clip(door.baseY, door.height);
        const cx = door.hingeX + Math.cos(door.angle) * (door.width / 2);
        const cz = door.hingeZ + Math.sin(door.angle) * (door.width / 2);
        return (
          <mesh key={door.id} position={[cx, door.baseY + height / 2, cz]} rotation={[0, -door.angle, 0]} castShadow>
            <boxGeometry args={[door.width, height, door.thickness]} />
            <meshStandardMaterial color="#8B5E3C" roughness={0.6} />
          </mesh>
        );
      })}

      {geometry.windows.map((pane) => {
        if (cutHeight !== null && pane.baseY >= cutHeight) return null;
        const height = clip(pane.baseY, pane.height);
        return (
          <mesh key={pane.id} position={[pane.centerX, pane.baseY + height / 2, pane.centerZ]} rotation={[0, -pane.angle, 0]}>
            <boxGeometry args={[pane.width, height, 0.06]} />
            <meshPhysicalMaterial color="#BFD8EE" transparent opacity={0.38} roughness={0.05} metalness={0.1} />
          </mesh>
        );
      })}

      {showLabels &&
        geometry.floors
          .filter((f) => f.level === geometry.levelCount - 1 && f.type !== "hallway" && Math.min(f.width, f.depth) >= geometry.wallHeight * 0.35)
          .map((floor) => (
            <Html key={`label-${floor.id}`} position={[floor.centerX, floor.baseY + slab * 6, floor.centerZ]} center zIndexRange={[20, 0]}>
              <span className={`room-label-3d${floor.id === selectedRoomId ? " selected" : ""}`}>{floor.name}</span>
            </Html>
          ))}
    </group>
  );
}

function CameraRig({
  view,
  framing,
  resetToken,
}: {
  view: SceneView;
  framing: ReturnType<typeof computeCameraFraming>;
  resetToken: number;
}) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  // Framing assumes a landscape viewport; back off in a narrow one so the plot still fits side to side.
  const aspectBackoff = size.width > 0 && size.height > 0 ? Math.max(1, size.height / size.width) : 1;

  useEffect(() => {
    const [x, y, z] = framing.positions[view].map((v) => v * aspectBackoff) as [number, number, number];
    const ty = view === "top" ? 0 : framing.targetY;
    camera.up.set(0, view === "top" ? 0 : 1, view === "top" ? -1 : 0);
    camera.position.set(x, y + ty, z);
    if ("near" in camera && "far" in camera) {
      camera.near = framing.near;
      camera.far = framing.far;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, ty, 0);
    controlsRef.current?.target.set(0, ty, 0);
    controlsRef.current?.update();
    // Re-frame only when the view or framing changes, not on every plan edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, framing.distance, framing.targetY, camera, resetToken, aspectBackoff]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.05} />;
}

function RendererBridge({ rendererRef }: { rendererRef: React.MutableRefObject<WebGLRenderer | null> }) {
  const { gl } = useThree();
  useEffect(() => {
    rendererRef.current = gl;
  }, [gl, rendererRef]);
  return null;
}

type HouseSceneProps = {
  plan: FloorPlan;
  view?: SceneView;
  showGrid?: boolean;
  cutaway?: boolean;
  showLabels?: boolean;
  /** Highest floor to show (0 = ground); floors above are hidden. Default: all floors. */
  topLevel?: number;
  selectedRoomId?: string | null;
  onSelectRoom?: (id: string | null) => void;
};

export const HouseScene = forwardRef<HouseSceneHandle, HouseSceneProps>(function HouseScene(
  { plan, view = "perspective", showGrid = true, cutaway = false, showLabels = true, topLevel, selectedRoomId = null, onSelectRoom },
  ref
) {
  const geometry = useMemo(() => buildSceneGeometry(plan, topLevel), [plan, topLevel]);
  const topElevation = geometry.floors.reduce((max, f) => Math.max(max, f.baseY), 0);
  const framing = useMemo(() => computeCameraFraming(geometry), [geometry]);
  const span = Math.max(geometry.plotWidth, geometry.plotDepth);
  const ft = plan.units === "m" ? 0.3048 : 1;
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const [resetToken, setResetToken] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      captureScreenshot: () => rendererRef.current?.domElement.toDataURL("image/png") ?? null,
      fitToView: () => setResetToken((c) => c + 1),
    }),
    []
  );

  return (
    <Canvas
      camera={{ position: framing.positions[view], fov: 45, near: framing.near, far: framing.far }}
      shadows
      flat
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onPointerMissed={() => onSelectRoom?.(null)}
    >
      <color attach="background" args={["#F3EFE7"]} />
      <fog attach="fog" args={["#F3EFE7", span * 3, span * 6]} />
      <hemisphereLight args={["#FFFFFF", "#D9CFBF", 1.1]} />
      <directionalLight
        position={[span * 0.55, span * 0.9, span * 0.35]}
        intensity={1.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-far={span * 4}
        shadow-bias={-0.0004}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05 * ft, 0]} receiveShadow>
        <planeGeometry args={[span * 6, span * 6]} />
        <meshStandardMaterial color="#EAE5DA" />
      </mesh>
      {showGrid && (
        <Grid
          args={[span * 3, span * 3]}
          cellSize={ft}
          cellColor="#E3DDEB"
          cellThickness={0.4}
          sectionSize={5 * ft}
          sectionColor="#CFC7E8"
          sectionThickness={0.8}
          fadeDistance={span * 3.5}
          position={[0, -0.04 * ft, 0]}
        />
      )}
      <GeneratedHouse
        geometry={geometry}
        cutHeight={cutaway ? topElevation + 4.5 * ft : null}
        showLabels={showLabels}
        selectedRoomId={selectedRoomId}
        onSelectRoom={onSelectRoom}
      />
      <CameraRig view={view} framing={framing} resetToken={resetToken} />
      <RendererBridge rendererRef={rendererRef} />
    </Canvas>
  );
});
