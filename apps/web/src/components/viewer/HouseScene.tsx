"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { BoxGeometry, Vector3, type WebGLRenderer, type Scene } from "three";
import type { FloorPlan, FurnitureItem, RoomType } from "@houseplan/design-schema";
import {
  buildSceneGeometry,
  computeCameraFraming,
  type CameraView,
  type RoomFloor,
  type SceneGeometry,
} from "@/lib/scene-geometry";
import { StaircaseGeometry } from "./StaircaseGeometry";
import { WalkthroughController } from "./WalkthroughController";
import { FurniturePiece } from "./FurnitureGeometry";
import { TerraceExteriorGeometry } from "./TerraceExteriorGeometry";
import { StructuralFrameGeometry } from "./StructuralFrameGeometry";
import type { TerraceConfig, ExteriorConfig } from "@/lib/terrace-catalog";

export type SceneView = CameraView;
export type HouseSceneHandle = {
  captureScreenshot: () => string | null;
  getRenderer: () => WebGLRenderer | null;
  getScene: () => Scene | null;
  fitToView: () => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  focusRoom: (roomId: string) => void;
  viewTerrace: () => void;
};

// ── Architectural Style Themes ──────────────────────────────────
export type ArchStyleId =
  | "modern"
  | "contemporary"
  | "scandinavian"
  | "industrial"
  | "mediterranean"
  | "traditional_indian"
  | "japandi"
  | "neo_classical"
  | "futuristic"
  | "rustic";

export const ARCH_STYLES: { id: ArchStyleId; label: string; emoji: string; desc: string }[] = [
  { id: "modern",            label: "Modern Minimalist",  emoji: "◻️",  desc: "Clean white walls, flat roof, large glass" },
  { id: "contemporary",      label: "Contemporary Luxury", emoji: "💎",  desc: "Bold forms, premium materials, accent lighting" },
  { id: "scandinavian",      label: "Scandinavian",        emoji: "🌿",  desc: "Light wood, white plaster, warm neutrals" },
  { id: "industrial",        label: "Industrial",          emoji: "🔩",  desc: "Exposed concrete, metal accents, dark tones" },
  { id: "mediterranean",     label: "Mediterranean",       emoji: "🏛️",  desc: "Terracotta, arched openings, ochre walls" },
  { id: "traditional_indian",label: "Traditional Indian",  emoji: "🪔",  desc: "Brick red, carved stone, jali motifs" },
  { id: "japandi",           label: "Japandi",             emoji: "🎋",  desc: "Warm wood, wabi-sabi, neutral plaster" },
  { id: "neo_classical",     label: "Neo-Classical",       emoji: "🏛️",  desc: "Ivory columns, cornices, symmetrical facade" },
  { id: "futuristic",        label: "Futuristic",          emoji: "🚀",  desc: "Dark metals, curved edges, accent glow" },
  { id: "rustic",            label: "Rustic",              emoji: "🪵",  desc: "Stone walls, warm timber, earthy tones" },
];

type StyleTheme = {
  wallExterior: { color: string; roughness: number; metalness: number };
  wallInterior: { color: string; roughness: number; metalness: number };
  wallBoundary: { color: string; roughness: number; metalness: number };
  roofColor: string;
  roofRoughness: number;
  groundColor: string;
  plinthColor: string;
  doorColor: string;
  fogColor: string;
  bgColor: string;
  skyColor: string;
  sunIntensity: number;
};

const STYLE_THEMES: Record<ArchStyleId, StyleTheme> = {
  modern: {
    wallExterior: { color: "#F8F8F8", roughness: 0.3, metalness: 0.02 },
    wallInterior: { color: "#FAFAFA", roughness: 0.4, metalness: 0.01 },
    wallBoundary: { color: "#E8E8E8", roughness: 0.4, metalness: 0.02 },
    roofColor: "#D0D0D0", roofRoughness: 0.3,
    groundColor: "#E8E5DF", plinthColor: "#2A2A2A",
    doorColor: "#1A1A1A", fogColor: "#F0EFEC", bgColor: "#F0EFEC", skyColor: "#E5F0FF", sunIntensity: 2.4,
  },
  contemporary: {
    wallExterior: { color: "#ECEAE6", roughness: 0.35, metalness: 0.06 },
    wallInterior: { color: "#F5F3EF", roughness: 0.45, metalness: 0.02 },
    wallBoundary: { color: "#D8D4CC", roughness: 0.4, metalness: 0.05 },
    roofColor: "#888888", roofRoughness: 0.2,
    groundColor: "#DEDBD5", plinthColor: "#1E1E1E",
    doorColor: "#4A3728", fogColor: "#EDE9E3", bgColor: "#EDE9E3", skyColor: "#DDEEFF", sunIntensity: 2.6,
  },
  scandinavian: {
    wallExterior: { color: "#F7F4EE", roughness: 0.72, metalness: 0.01 },
    wallInterior: { color: "#FCFAF7", roughness: 0.8, metalness: 0.01 },
    wallBoundary: { color: "#E8E3D8", roughness: 0.7, metalness: 0.01 },
    roofColor: "#BDB5A4", roofRoughness: 0.6,
    groundColor: "#E5E1D8", plinthColor: "#3D3830",
    doorColor: "#6B503A", fogColor: "#F2EFEB", bgColor: "#F2EFEB", skyColor: "#E8F0FA", sunIntensity: 2.0,
  },
  industrial: {
    wallExterior: { color: "#8B8680", roughness: 0.9, metalness: 0.12 },
    wallInterior: { color: "#A0998F", roughness: 0.88, metalness: 0.08 },
    wallBoundary: { color: "#6A6560", roughness: 0.85, metalness: 0.15 },
    roofColor: "#4A4540", roofRoughness: 0.5,
    groundColor: "#6E6A64", plinthColor: "#1A1816",
    doorColor: "#2C2C2C", fogColor: "#D8D4CE", bgColor: "#D8D4CE", skyColor: "#C8D4E0", sunIntensity: 1.8,
  },
  mediterranean: {
    wallExterior: { color: "#E8C98A", roughness: 0.85, metalness: 0.02 },
    wallInterior: { color: "#F0D89E", roughness: 0.88, metalness: 0.01 },
    wallBoundary: { color: "#C8A85C", roughness: 0.8, metalness: 0.02 },
    roofColor: "#C05A2A", roofRoughness: 0.75,
    groundColor: "#D4C08A", plinthColor: "#5A3A10",
    doorColor: "#4A2A10", fogColor: "#F0E8D4", bgColor: "#F0E8D4", skyColor: "#E8F0FF", sunIntensity: 2.8,
  },
  traditional_indian: {
    wallExterior: { color: "#C47B4A", roughness: 0.9, metalness: 0.03 },
    wallInterior: { color: "#D49060", roughness: 0.88, metalness: 0.02 },
    wallBoundary: { color: "#A05A2A", roughness: 0.85, metalness: 0.04 },
    roofColor: "#8A4020", roofRoughness: 0.7,
    groundColor: "#C0A070", plinthColor: "#3A1808",
    doorColor: "#6B3010", fogColor: "#EDE0CC", bgColor: "#EDE0CC", skyColor: "#FFE8D4", sunIntensity: 3.0,
  },
  japandi: {
    wallExterior: { color: "#E8E0D0", roughness: 0.78, metalness: 0.01 },
    wallInterior: { color: "#F0EAE0", roughness: 0.82, metalness: 0.01 },
    wallBoundary: { color: "#D0C8B8", roughness: 0.75, metalness: 0.02 },
    roofColor: "#5A4830", roofRoughness: 0.55,
    groundColor: "#D8D0C0", plinthColor: "#28201A",
    doorColor: "#3A2C1A", fogColor: "#EDE8DF", bgColor: "#EDE8DF", skyColor: "#E0EAF0", sunIntensity: 2.0,
  },
  neo_classical: {
    wallExterior: { color: "#F4F0E8", roughness: 0.6, metalness: 0.04 },
    wallInterior: { color: "#F8F6F0", roughness: 0.65, metalness: 0.02 },
    wallBoundary: { color: "#E0D8CC", roughness: 0.55, metalness: 0.04 },
    roofColor: "#D4CFC0", roofRoughness: 0.4,
    groundColor: "#E0D8C8", plinthColor: "#2A2418",
    doorColor: "#5A4020", fogColor: "#F0EDE6", bgColor: "#F0EDE6", skyColor: "#E8EEFF", sunIntensity: 2.5,
  },
  futuristic: {
    wallExterior: { color: "#2A2E38", roughness: 0.2, metalness: 0.45 },
    wallInterior: { color: "#3A3E48", roughness: 0.3, metalness: 0.35 },
    wallBoundary: { color: "#1E2028", roughness: 0.15, metalness: 0.5 },
    roofColor: "#1A1E28", roofRoughness: 0.1,
    groundColor: "#282C38", plinthColor: "#0A0C12",
    doorColor: "#0A2040", fogColor: "#1A1E28", bgColor: "#1A1E28", skyColor: "#000820", sunIntensity: 1.5,
  },
  rustic: {
    wallExterior: { color: "#9A8A78", roughness: 0.95, metalness: 0.01 },
    wallInterior: { color: "#AE9E8C", roughness: 0.9, metalness: 0.01 },
    wallBoundary: { color: "#8A7A68", roughness: 0.92, metalness: 0.02 },
    roofColor: "#5C3A1A", roofRoughness: 0.85,
    groundColor: "#9A8C74", plinthColor: "#3A2A1A",
    doorColor: "#5A3A1A", fogColor: "#E8E0D4", bgColor: "#E8E0D4", skyColor: "#D8E4EC", sunIntensity: 2.1,
  },
};

type FloorMaterialSpec = {
  color: string;
  roughness: number;
  metalness: number;
  label: string;
};

const FLOOR_SPECS: Record<RoomType, FloorMaterialSpec> = {
  living_room: { color: "#D7B58A", roughness: 0.52, metalness: 0.02, label: "Warm Oak Hardwood" },
  dining_room: { color: "#CBA477", roughness: 0.52, metalness: 0.02, label: "Amber Hardwood" },
  bedroom:     { color: "#D3AF86", roughness: 0.65, metalness: 0.0,  label: "Blonde Oak Flooring" },
  study:       { color: "#BE9C75", roughness: 0.48, metalness: 0.04, label: "Refined Walnut" },
  kitchen:     { color: "#D7DCE0", roughness: 0.26, metalness: 0.06, label: "Honed Terrazzo" },
  bathroom:    { color: "#DAE5ED", roughness: 0.18, metalness: 0.08, label: "Carrara Sky Marble" },
  utility:     { color: "#D5CFCE", roughness: 0.45, metalness: 0.02, label: "Matte Porcelain Tile" },
  staircase:   { color: "#C6BEAF", roughness: 0.45, metalness: 0.02, label: "Limestone Steps" },
  hallway:     { color: "#E5DFD4", roughness: 0.52, metalness: 0.02, label: "Travertine Floor" },
  parking:     { color: "#A8A59E", roughness: 0.85, metalness: 0.05, label: "Brushed Pavers" },
  corridor:    { color: "#E5DFD4", roughness: 0.52, metalness: 0.02, label: "Travertine Floor" },
  balcony:     { color: "#C4B49F", roughness: 0.70, metalness: 0.02, label: "Teak Decking" },
  other:       { color: "#C6BBAA", roughness: 0.62, metalness: 0.02, label: "Architectural Pavers" },
};

function getFloorSpec(floor: RoomFloor): FloorMaterialSpec {
  if (floor.type === "other" && /sit|porch|terrace|deck|balcony/i.test(floor.name)) {
    return { color: "#C4B49F", roughness: 0.7, metalness: 0.02, label: "Teak Decking" };
  }
  return FLOOR_SPECS[floor.type] ?? { color: "#E5DFD4", roughness: 0.6, metalness: 0.02, label: "Standard Flooring" };
}

function GeneratedHouse({
  plan,
  geometry,
  cutHeight,
  showLabels,
  selectedRoomId,
  onSelectRoom,
  theme,
  showRoof = true,
  showFurniture = true,
  selectedFurnitureId,
  onSelectFurniture,
}: {
  plan: FloorPlan;
  geometry: SceneGeometry;
  cutHeight: number | null;
  showLabels: boolean;
  selectedRoomId: string | null;
  onSelectRoom?: (id: string | null) => void;
  theme: StyleTheme;
  showRoof?: boolean;
  showFurniture?: boolean;
  selectedFurnitureId?: string | null;
  onSelectFurniture?: (id: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const clip = (base: number, height: number) => (cutHeight === null ? height : Math.min(base + height, cutHeight) - base);
  const slab = geometry.wallHeight * 0.014;

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  const pointer = (id: string | null) => (e: ThreeEvent<PointerEvent>) => {
    if (!onSelectRoom) return;
    e.stopPropagation();
    setHovered(id);
    document.body.style.cursor = id ? "pointer" : "";
  };

  // Compute roof slab bounds from top-level floors
  const topLevel = geometry.levelCount - 1;
  const topFloors = geometry.floors.filter((f) => f.level === topLevel);
  const hasRoof = topFloors.length > 0;
  let roofMinX = 0, roofMaxX = 0, roofMinZ = 0, roofMaxZ = 0, roofY = 0;
  if (hasRoof) {
    roofMinX = Math.min(...topFloors.map((f) => f.centerX - f.width / 2));
    roofMaxX = Math.max(...topFloors.map((f) => f.centerX + f.width / 2));
    roofMinZ = Math.min(...topFloors.map((f) => f.centerZ - f.depth / 2));
    roofMaxZ = Math.max(...topFloors.map((f) => f.centerZ + f.depth / 2));
    const maxWallTop = geometry.walls.reduce((mx, w) => Math.max(mx, w.baseY + w.height), 0);
    roofY = maxWallTop;
  }
  const roofW = roofMaxX - roofMinX;
  const roofD = roofMaxZ - roofMinZ;
  const roofThick = slab * 2.5;

  return (
    <group>
      {/* Foundation plinth */}
      <mesh position={[0, -slab * 2, 0]} receiveShadow>
        <boxGeometry args={[geometry.plotWidth + 0.6, slab * 3.5, geometry.plotDepth + 0.6]} />
        <meshStandardMaterial color={theme.plinthColor} roughness={0.7} />
      </mesh>

      {/* Site plot surface */}
      <mesh position={[0, -slab * 0.1, 0]} receiveShadow>
        <boxGeometry args={[geometry.plotWidth, slab * 0.2, geometry.plotDepth]} />
        <meshStandardMaterial color={theme.groundColor} roughness={0.8} />
      </mesh>

      {/* Roof slab on top floor */}
      {hasRoof && showRoof && cutHeight === null && roofW > 0 && roofD > 0 && (
        <mesh
          position={[(roofMinX + roofMaxX) / 2, roofY + roofThick / 2, (roofMinZ + roofMaxZ) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[roofW + 0.4, roofThick, roofD + 0.4]} />
          <meshStandardMaterial color={theme.roofColor} roughness={theme.roofRoughness} metalness={0.04} />
        </mesh>
      )}

      {/* Individual Room Floors */}
      {geometry.floors.map((floor) => {
        const selected = floor.id === selectedRoomId;
        const hot = floor.id === hovered;
        const spec = getFloorSpec(floor);
        const room = plan.levels[floor.level]?.rooms.find((r) => r.id === floor.id);
        const floorColor = room?.interior?.floorColor ?? spec.color;
        const floorHeight = floor.level > 0 ? slab * 8 : slab * 2;
        const floorY = floor.baseY + (floor.level > 0 && floor.type !== "other" ? slab * 4 : slab);

        return (
          <group key={floor.id}>
            <mesh
              position={[floor.centerX, floorY, floor.centerZ]}
              receiveShadow
              onPointerOver={pointer(floor.id)}
              onPointerOut={pointer(null)}
              onClick={(e) => {
                if (!onSelectRoom) return;
                e.stopPropagation();
                onSelectRoom(floor.id);
              }}
            >
              <boxGeometry args={[Math.max(floor.width - 0.04, 0.02), floorHeight, Math.max(floor.depth - 0.04, 0.02)]} />
              <meshStandardMaterial
                color={floorColor}
                roughness={spec.roughness}
                metalness={spec.metalness}
                emissive={selected ? "#5146A5" : hot ? "#7B71C8" : "#000000"}
                emissiveIntensity={selected ? 0.55 : hot ? 0.22 : 0}
              />
            </mesh>

            {/* Custom room lighting ambiance */}
            {room?.interior?.lightingColor && (
              <pointLight
                position={[floor.centerX, floorY + geometry.wallHeight * 0.7, floor.centerZ]}
                color={room.interior.lightingColor}
                intensity={1.6}
                distance={Math.max(floor.width, floor.depth) * 1.4}
              />
            )}

            {/* Selection outline */}
            {selected && (
              <lineSegments position={[floor.centerX, floorY + floorHeight / 2 + 0.03, floor.centerZ]}>
                <edgesGeometry args={[new BoxGeometry(floor.width, 0.04, floor.depth)]} />
                <lineBasicMaterial color="#FFF4D6" linewidth={3} />
              </lineSegments>
            )}

            {/* Architectural 3D Staircase */}
            {floor.type === "staircase" && (
              <StaircaseGeometry floor={floor} wallHeight={geometry.wallHeight} />
            )}
          </group>
        );
      })}

      {/* 3D Furniture Items */}
      {showFurniture &&
        plan.levels.map((level, lvIdx) => {
          if (cutHeight !== null && level.elevation >= cutHeight) return null;
          const items = (level.furniture || []) as FurnitureItem[];
          const floorY = level.elevation + (lvIdx > 0 ? slab * 4 : slab);
          return (
            <group key={`furn-level-${level.id}`}>
              {items.map((item) => {
                const worldItem: FurnitureItem = {
                  ...item,
                  position: [
                    item.position[0] - geometry.plotWidth / 2,
                    item.position[1] - geometry.plotDepth / 2,
                    0,
                  ],
                };
                return (
                  <FurniturePiece
                    key={item.id}
                    item={worldItem}
                    floorBaseY={floorY}
                    isSelected={selectedFurnitureId === item.id}
                    onSelect={onSelectFurniture}
                    units={plan.units}
                  />
                );
              })}
            </group>
          );
        })}

      {/* Walls */}
      {geometry.walls.map((wall) => {
        if (cutHeight !== null && wall.baseY >= cutHeight) return null;
        const height = clip(wall.baseY, wall.height);
        if (height <= 0) return null;
        const isBoundary = wall.kind === "boundary";
        const mat = wall.kind === "exterior"
          ? theme.wallExterior
          : wall.kind === "interior"
          ? theme.wallInterior
          : theme.wallBoundary;

        return (
          <group key={wall.id} position={[wall.centerX, wall.baseY + height / 2, wall.centerZ]} rotation={[0, -wall.angle, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[wall.length, height, wall.thickness]} />
              <meshStandardMaterial {...mat} />
            </mesh>

            {/* Coping cap on boundary walls */}
            {isBoundary && (
              <mesh position={[0, height / 2 + 0.03, 0]} castShadow>
                <boxGeometry args={[wall.length + 0.04, 0.06, wall.thickness + 0.06]} />
                <meshStandardMaterial color={theme.plinthColor} roughness={0.4} metalness={0.4} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Doors */}
      {geometry.doors.map((door) => {
        if (cutHeight !== null && door.baseY >= cutHeight) return null;
        const height = clip(door.baseY, door.height);
        if (height <= 0) return null;
        const cx = door.hingeX + Math.cos(door.angle) * (door.width / 2);
        const cz = door.hingeZ + Math.sin(door.angle) * (door.width / 2);

        return (
          <group key={door.id} position={[cx, door.baseY + height / 2, cz]} rotation={[0, -door.angle, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[door.width, height, door.thickness]} />
              <meshStandardMaterial color={theme.doorColor} roughness={0.48} metalness={0.04} />
            </mesh>
            <mesh position={[door.width * 0.38, 0, door.thickness / 2 + 0.03]} castShadow>
              <boxGeometry args={[door.width * 0.14, 0.06, 0.04]} />
              <meshStandardMaterial color="#1E222A" roughness={0.25} metalness={0.8} />
            </mesh>
            <mesh position={[door.width * 0.38, 0, -door.thickness / 2 - 0.03]} castShadow>
              <boxGeometry args={[door.width * 0.14, 0.06, 0.04]} />
              <meshStandardMaterial color="#1E222A" roughness={0.25} metalness={0.8} />
            </mesh>
          </group>
        );
      })}

      {/* Windows */}
      {geometry.windows.map((pane) => {
        if (cutHeight !== null && pane.baseY >= cutHeight) return null;
        const height = clip(pane.baseY, pane.height);
        if (height <= 0) return null;
        const fThick = 0.07;
        const fWidth = 0.07;

        return (
          <group key={pane.id} position={[pane.centerX, pane.baseY + height / 2, pane.centerZ]} rotation={[0, -pane.angle, 0]}>
            <mesh position={[0, height / 2 - fWidth / 2, 0]} castShadow>
              <boxGeometry args={[pane.width, fWidth, fThick]} />
              <meshStandardMaterial color="#1F232B" roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[0, -height / 2 + fWidth / 2, 0]} castShadow>
              <boxGeometry args={[pane.width, fWidth, fThick * 1.3]} />
              <meshStandardMaterial color="#1F232B" roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[-pane.width / 2 + fWidth / 2, 0, 0]} castShadow>
              <boxGeometry args={[fWidth, height, fThick]} />
              <meshStandardMaterial color="#1F232B" roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[pane.width / 2 - fWidth / 2, 0, 0]} castShadow>
              <boxGeometry args={[fWidth, height, fThick]} />
              <meshStandardMaterial color="#1F232B" roughness={0.4} metalness={0.5} />
            </mesh>
            {pane.width > 3.2 && (
              <mesh position={[0, 0, 0]} castShadow>
                <boxGeometry args={[fWidth * 0.75, height - fWidth * 2, fThick * 0.85]} />
                <meshStandardMaterial color="#1F232B" roughness={0.4} metalness={0.5} />
              </mesh>
            )}
            <mesh>
              <boxGeometry args={[Math.max(pane.width - fWidth * 1.6, 0.02), Math.max(height - fWidth * 1.6, 0.02), 0.03]} />
              <meshPhysicalMaterial
                color="#BFE3F7"
                transparent
                opacity={0.42}
                roughness={0.06}
                metalness={0.12}
                reflectivity={0.9}
                clearcoat={1}
                clearcoatRoughness={0.1}
              />
            </mesh>
          </group>
        );
      })}

      {/* Room Labels */}
      {showLabels &&
        geometry.floors
          .filter((f) => f.level === geometry.levelCount - 1 && f.type !== "hallway" && Math.min(f.width, f.depth) >= geometry.wallHeight * 0.3)
          .map((floor) => {
            const isSelected = floor.id === selectedRoomId;
            return (
              <Html
                key={`label-${floor.id}`}
                position={[floor.centerX, floor.baseY + slab * 8, floor.centerZ]}
                center
                zIndexRange={[20, 0]}
              >
                <button
                  type="button"
                  className={`room-label-3d${isSelected ? " selected" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRoom?.(floor.id);
                  }}
                  title={`Click to inspect ${floor.name}`}
                >
                  <span className="room-label-dot" />
                  <span className="room-label-name">{floor.name}</span>
                </button>
              </Html>
            );
          })}
    </group>
  );
}

function CameraRig({
  view,
  framing,
  resetToken,
  controlsRef,
  walkthroughMode = false,
}: {
  view: SceneView;
  framing: ReturnType<typeof computeCameraFraming>;
  resetToken: number;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  walkthroughMode?: boolean;
}) {
  const { camera, size } = useThree();
  const aspectBackoff = size.width > 0 && size.height > 0 ? Math.max(1, size.height / size.width) : 1;
  const targetX = framing.targetX ?? 0;
  const targetY = view === "top" ? 0 : framing.targetY;
  const targetZ = framing.targetZ ?? 0;

  useEffect(() => {
    if (walkthroughMode) return;
    const rawPos = framing.positions[view];
    const x = targetX + (rawPos[0] - targetX) * aspectBackoff;
    const y = rawPos[1];
    const z = targetZ + (rawPos[2] - targetZ) * aspectBackoff;

    camera.up.set(0, view === "top" ? 0 : 1, view === "top" ? -1 : 0);
    camera.position.set(x, y, z);
    if ("near" in camera && "far" in camera) {
      camera.near = framing.near;
      camera.far = framing.far;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(targetX, targetY, targetZ);
    if (controlsRef.current) {
      controlsRef.current.target.set(targetX, targetY, targetZ);
      controlsRef.current.update();
    }
  }, [view, framing, camera, resetToken, aspectBackoff, targetX, targetY, targetZ, controlsRef, walkthroughMode]);

  return (
    <OrbitControls
      ref={controlsRef as React.Ref<any>}
      makeDefault
      enabled={!walkthroughMode}
      enableDamping
      dampingFactor={0.07}
      maxPolarAngle={Math.PI / 2.04}
      minDistance={4}
      maxDistance={framing.far * 0.85}
    />
  );
}

function RendererBridge({
  rendererRef,
  sceneRef,
}: {
  rendererRef: React.MutableRefObject<WebGLRenderer | null>;
  sceneRef: React.MutableRefObject<Scene | null>;
}) {
  const { gl, scene } = useThree();
  useEffect(() => {
    rendererRef.current = gl;
    sceneRef.current = scene;
  }, [gl, scene, rendererRef, sceneRef]);
  return null;
}

type HouseSceneProps = {
  plan: FloorPlan;
  view?: SceneView;
  showGrid?: boolean;
  cutaway?: boolean;
  showRoof?: boolean;
  showLabels?: boolean;
  topLevel?: number;
  selectedRoomId?: string | null;
  onSelectRoom?: (id: string | null) => void;
  showFurniture?: boolean;
  selectedFurnitureId?: string | null;
  onSelectFurniture?: (id: string | null) => void;
  /** Optional set of floor indices to hide (they remain in the plan, just not rendered). */
  hiddenLevels?: ReadonlySet<number>;
  /** Architectural style theme to apply. Defaults to 'modern'. */
  styleTheme?: ArchStyleId;
  /** Interactive 3D Walkthrough mode */
  walkthroughMode?: boolean;
  isFirstPerson?: boolean;
  onToggleFirstPerson?: () => void;
  onExitWalkthrough?: () => void;
  onWalkthroughRoomChange?: (roomName: string, floorLevel: number) => void;
  walkthroughTargetRoomId?: string | null;
  onClearWalkthroughTeleport?: () => void;
  walkthroughTargetFloor?: number | null;
  onClearWalkthroughTargetFloor?: () => void;
  mobileWalkthroughInputs?: {
    joystickX: number;
    joystickY: number;
    touchLookX: number;
    touchLookY: number;
  };
  terraceConfig?: TerraceConfig;
  exteriorConfig?: ExteriorConfig;
  selectedTerraceObjectId?: string | null;
  onSelectTerraceObject?: (id: string | null) => void;
  /** Whether to render 3D concrete structural frame (columns, beams, footings) */
  showStructuralFrame?: boolean;
};

export const HouseScene = forwardRef<HouseSceneHandle, HouseSceneProps>(function HouseScene(
  {
    plan,
    view = "perspective",
    showGrid = true,
    cutaway = false,
    showRoof = true,
    showLabels = true,
    topLevel,
    selectedRoomId = null,
    onSelectRoom,
    showFurniture = true,
    selectedFurnitureId = null,
    onSelectFurniture,
    hiddenLevels,
    styleTheme = "modern",
    walkthroughMode = false,
    isFirstPerson = false,
    onToggleFirstPerson,
    onExitWalkthrough,
    onWalkthroughRoomChange,
    walkthroughTargetRoomId,
    onClearWalkthroughTeleport,
    walkthroughTargetFloor,
    onClearWalkthroughTargetFloor,
    mobileWalkthroughInputs,
    terraceConfig,
    exteriorConfig,
    selectedTerraceObjectId = null,
    onSelectTerraceObject,
    showStructuralFrame = true,
  },
  ref
) {
  const geometry = useMemo(() => buildSceneGeometry(plan, topLevel, hiddenLevels), [plan, topLevel, hiddenLevels]);
  const topElevation = geometry.floors.reduce((max, f) => Math.max(max, f.baseY), 0);
  const framing = useMemo(() => computeCameraFraming(geometry), [geometry]);
  const span = Math.max(geometry.plotWidth, geometry.plotDepth);
  const ft = plan.units === "m" ? 0.3048 : 1;
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const threeSceneRef = useRef<Scene | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const theme = STYLE_THEMES[styleTheme] ?? STYLE_THEMES.modern;

  useImperativeHandle(
    ref,
    () => ({
      captureScreenshot: () => rendererRef.current?.domElement.toDataURL("image/png") ?? null,
      getRenderer: () => rendererRef.current,
      getScene: () => threeSceneRef.current,
      fitToView: () => setResetToken((c) => c + 1),
      resetCamera: () => setResetToken((c) => c + 1),
      zoomIn: () => {
        const controls = controlsRef.current;
        if (!controls) return;
        const camera = controls.object;
        const target = controls.target;
        const offset = camera.position.clone().sub(target);
        if (offset.length() > 6) {
          offset.multiplyScalar(0.82);
          camera.position.copy(target).add(offset);
          controls.update();
        }
      },
      zoomOut: () => {
        const controls = controlsRef.current;
        if (!controls) return;
        const camera = controls.object;
        const target = controls.target;
        const offset = camera.position.clone().sub(target);
        if (offset.length() < framing.far * 0.8) {
          offset.multiplyScalar(1.22);
          camera.position.copy(target).add(offset);
          controls.update();
        }
      },
      focusRoom: (roomId: string) => {
        const floor = geometry.floors.find((f) => f.id === roomId);
        const controls = controlsRef.current;
        if (!floor || !controls) return;
        const camera = controls.object;
        const roomTarget = new Vector3(floor.centerX, floor.baseY + geometry.wallHeight * 0.4, floor.centerZ);
        controls.target.copy(roomTarget);
        camera.position.set(floor.centerX + 12, floor.baseY + 16, floor.centerZ + 12);
        camera.lookAt(roomTarget);
        controls.update();
      },
      viewTerrace: () => {
        const controls = controlsRef.current;
        if (!controls) return;
        const topFloors = geometry.floors.filter((f) => f.level === geometry.levelCount - 1);
        const maxWallTop = geometry.walls.reduce((mx, w) => Math.max(mx, w.baseY + w.height), 0);
        const roofY = maxWallTop + geometry.wallHeight * 0.035;
        let cX = 0, cZ = 0;
        if (topFloors.length > 0) {
          cX = topFloors.reduce((s, f) => s + f.centerX, 0) / topFloors.length;
          cZ = topFloors.reduce((s, f) => s + f.centerZ, 0) / topFloors.length;
        }
        const terraceTarget = new Vector3(cX, roofY + 1.2, cZ);
        controls.target.copy(terraceTarget);
        const camDist = Math.max(geometry.plotWidth, geometry.plotDepth) * 0.72;
        controls.object.position.set(cX, roofY + camDist * 0.85, cZ + camDist * 0.72);
        controls.object.lookAt(terraceTarget);
        controls.update();
      },
    }),
    [framing.far, geometry.floors, geometry.wallHeight, geometry.levelCount, geometry.walls, geometry.plotWidth, geometry.plotDepth]
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
      <color attach="background" args={[theme.bgColor]} />
      <fog attach="fog" args={[theme.fogColor, span * 2.8, span * 6]} />

      {/* Primary sun light */}
      <directionalLight
        position={[span * 0.75, span * 1.15, span * 0.55]}
        intensity={theme.sunIntensity}
        color="#FFF9F0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-span * 0.9}
        shadow-camera-right={span * 0.9}
        shadow-camera-top={span * 0.9}
        shadow-camera-bottom={-span * 0.9}
        shadow-camera-far={span * 4.5}
        shadow-bias={-0.0003}
      />

      {/* Sky fill from opposite angle */}
      <directionalLight
        position={[-span * 0.65, span * 0.75, -span * 0.45]}
        intensity={0.65}
        color={theme.skyColor}
      />

      {/* Hemisphere bounce */}
      <hemisphereLight args={["#FFFFFF", "#D8D0C2", 0.9]} />

      {/* Ambient fill */}
      <ambientLight intensity={0.28} color="#FFF8F2" />

      {/* Studio floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06 * ft, 0]} receiveShadow>
        <planeGeometry args={[span * 8, span * 8]} />
        <meshStandardMaterial color={theme.groundColor} roughness={0.9} />
      </mesh>

      {/* Architectural grid */}
      {showGrid && (
        <Grid
          args={[span * 3.5, span * 3.5]}
          cellSize={ft}
          cellColor="#DDD6EA"
          cellThickness={0.5}
          sectionSize={5 * ft}
          sectionColor="#5146A5"
          sectionThickness={1.0}
          fadeDistance={span * 3}
          position={[0, -0.05 * ft, 0]}
        />
      )}

      {/* House geometry */}
      <GeneratedHouse
        plan={plan}
        geometry={geometry}
        cutHeight={cutaway ? topElevation + 4.5 * ft : null}
        showRoof={showRoof}
        showLabels={showLabels && !walkthroughMode}
        selectedRoomId={selectedRoomId}
        onSelectRoom={onSelectRoom}
        theme={theme}
        showFurniture={showFurniture}
        selectedFurnitureId={selectedFurnitureId}
        onSelectFurniture={onSelectFurniture}
      />

      {/* Rooftop Terrace & Exterior Designer Architecture */}
      <TerraceExteriorGeometry
        geometry={geometry}
        terraceConfig={terraceConfig}
        exteriorConfig={exteriorConfig}
        showRoof={showRoof}
        selectedObjectId={selectedTerraceObjectId}
        onSelectObject={onSelectTerraceObject}
      />

      {/* 3D Structural Frame (Concrete Columns, Beams, Footings) */}
      <StructuralFrameGeometry plan={plan} visible={showStructuralFrame} />

      {/* 3D Walkthrough Character, Camera & Interior lighting */}
      <WalkthroughController
        geometry={geometry}
        active={walkthroughMode}
        isFirstPerson={isFirstPerson}
        onToggleFirstPerson={onToggleFirstPerson ?? (() => {})}
        onExit={onExitWalkthrough ?? (() => {})}
        onRoomChange={onWalkthroughRoomChange}
        targetTeleportRoomId={walkthroughTargetRoomId}
        onClearTeleport={onClearWalkthroughTeleport}
        targetFloorLevel={walkthroughTargetFloor}
        onClearTargetFloor={onClearWalkthroughTargetFloor}
        mobileInputs={mobileWalkthroughInputs}
      />

      <CameraRig
        view={view}
        framing={framing}
        resetToken={resetToken}
        controlsRef={controlsRef}
        walkthroughMode={walkthroughMode}
      />
      <RendererBridge rendererRef={rendererRef} sceneRef={threeSceneRef} />
    </Canvas>
  );
});
