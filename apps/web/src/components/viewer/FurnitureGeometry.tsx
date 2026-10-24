"use client";

import { useMemo, useState } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, Vector3 } from "three";
import type { FurnitureItem } from "@houseplan/design-schema";

interface FurniturePieceProps {
  item: FurnitureItem;
  floorBaseY: number;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  units?: "ft" | "m";
}

export function FurniturePiece({
  item,
  floorBaseY,
  isSelected = false,
  onSelect,
  units = "ft",
}: FurniturePieceProps) {
  const [hovered, setHovered] = useState(false);

  const { width: w, depth: d, height: h } = item.dimensions;
  const sx = item.scale?.[0] ?? 1;
  const sy = item.scale?.[1] ?? 1;
  const sz = item.scale?.[2] ?? 1;

  const mat = (item.material || {}) as Record<string, any>;
  const primaryColor: string = typeof mat.color === "string" ? mat.color : "#4A4D54";
  const secondaryColor: string = typeof mat.secondaryColor === "string" ? mat.secondaryColor : "#E5E1D8";

  // Coordinates: item.position[0] is X, item.position[1] is Z in 3D world (since Y is up)
  const posX = item.position[0];
  const posZ = item.position[1];
  const rotY = item.rotation ?? 0;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(item.id);
  };

  const renderGeometry = () => {
    switch (item.type) {
      // ── BEDS ──────────────────────────────────────────────────────
      case "bed_king":
      case "bed_queen": {
        const frameH = 0.8;
        const matH = 0.9;
        const headH = h;
        return (
          <group>
            {/* Wooden bed frame base */}
            <mesh position={[0, frameH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, frameH, d]} />
              <meshStandardMaterial color="#3E342F" roughness={0.7} />
            </mesh>
            {/* Soft mattress */}
            <mesh position={[0, frameH + matH / 2, -0.1]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.94, matH, d * 0.94]} />
              <meshStandardMaterial color={secondaryColor} roughness={0.8} />
            </mesh>
            {/* Quilt / Duvet */}
            <mesh position={[0, frameH + matH + 0.05, -d * 0.15]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.95, 0.12, d * 0.65]} />
              <meshStandardMaterial color={primaryColor} roughness={0.75} />
            </mesh>
            {/* 2 Pillows */}
            <mesh position={[-w * 0.25, frameH + matH + 0.15, d * 0.35]} castShadow>
              <boxGeometry args={[w * 0.38, 0.25, d * 0.2]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.85} />
            </mesh>
            <mesh position={[w * 0.25, frameH + matH + 0.15, d * 0.35]} castShadow>
              <boxGeometry args={[w * 0.38, 0.25, d * 0.2]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.85} />
            </mesh>
            {/* Upholstered headboard */}
            <mesh position={[0, headH / 2, d / 2 - 0.15]} castShadow receiveShadow>
              <boxGeometry args={[w * 1.02, headH, 0.3]} />
              <meshStandardMaterial color={primaryColor} roughness={0.65} />
            </mesh>
          </group>
        );
      }

      // ── SOFAS ─────────────────────────────────────────────────────
      case "sofa_3seater":
      case "sofa_sectional": {
        const isSec = item.type === "sofa_sectional";
        const seatH = 1.3;
        const backH = h - seatH;
        return (
          <group>
            {/* Base frame & legs */}
            <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, 0.5, d]} />
              <meshStandardMaterial color="#2E2824" roughness={0.6} />
            </mesh>
            {/* Thick seating cushion */}
            <mesh position={[0, seatH / 2 + 0.3, 0.1]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.96, 0.6, d * 0.85]} />
              <meshStandardMaterial color={primaryColor} roughness={0.7} />
            </mesh>
            {/* Backrest */}
            <mesh position={[0, seatH + backH / 2, d / 2 - 0.25]} castShadow receiveShadow>
              <boxGeometry args={[w, backH, 0.5]} />
              <meshStandardMaterial color={primaryColor} roughness={0.7} />
            </mesh>
            {/* Left armrest */}
            <mesh position={[-w / 2 + 0.25, seatH * 0.85, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.5, seatH * 0.9, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.7} />
            </mesh>
            {/* Right armrest (or open if sectional) */}
            {!isSec && (
              <mesh position={[w / 2 - 0.25, seatH * 0.85, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.5, seatH * 0.9, d]} />
                <meshStandardMaterial color={primaryColor} roughness={0.7} />
              </mesh>
            )}
            {/* Chaise return for sectional */}
            {isSec && (
              <mesh position={[w / 2 - 1.5, seatH / 2 + 0.3, -d * 0.35]} castShadow receiveShadow>
                <boxGeometry args={[2.5, 0.6, d * 0.7]} />
                <meshStandardMaterial color={primaryColor} roughness={0.7} />
              </mesh>
            )}
          </group>
        );
      }

      // ── COFFEE TABLE ──────────────────────────────────────────────
      case "coffee_table": {
        return (
          <group>
            {/* Table top */}
            <mesh position={[0, h - 0.08, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, 0.16, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.4} metalness={0.1} />
            </mesh>
            {/* 4 Sleek metal legs */}
            {[-w * 0.42, w * 0.42].map((x) =>
              [-d * 0.42, d * 0.42].map((z) => (
                <mesh key={`${x}-${z}`} position={[x, (h - 0.16) / 2, z]} castShadow>
                  <boxGeometry args={[0.1, h - 0.16, 0.1]} />
                  <meshStandardMaterial color="#1F1F1F" roughness={0.3} metalness={0.8} />
                </mesh>
              ))
            )}
            {/* Lower shelf */}
            <mesh position={[0, (h - 0.16) * 0.35, 0]} receiveShadow>
              <boxGeometry args={[w * 0.85, 0.08, d * 0.85]} />
              <meshStandardMaterial color="#3A332E" roughness={0.6} />
            </mesh>
          </group>
        );
      }

      // ── TV UNIT / MEDIA CONSOLE ───────────────────────────────────
      case "tv_unit": {
        const cabH = 1.6;
        return (
          <group>
            {/* Low media cabinet */}
            <mesh position={[0, cabH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, cabH, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.5} />
            </mesh>
            {/* TV Stand foot */}
            <mesh position={[0, cabH + 0.1, 0]} castShadow>
              <boxGeometry args={[w * 0.35, 0.08, d * 0.45]} />
              <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, cabH + 0.35, 0]} castShadow>
              <boxGeometry args={[0.15, 0.5, 0.15]} />
              <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Large OLED TV Screen */}
            <mesh position={[0, cabH + 1.8, 0]} castShadow>
              <boxGeometry args={[w * 0.8, 2.4, 0.1]} />
              <meshStandardMaterial color="#0A0A0E" roughness={0.1} metalness={0.5} />
            </mesh>
          </group>
        );
      }

      // ── WARDROBE ──────────────────────────────────────────────────
      case "wardrobe": {
        return (
          <group>
            {/* Main wardrobe carcass */}
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.6} />
            </mesh>
            {/* 3 Door division lines / handles */}
            {[-w * 0.3, 0, w * 0.3].map((hx, idx) => (
              <mesh key={idx} position={[hx, h * 0.5, d / 2 + 0.03]} castShadow>
                <boxGeometry args={[0.06, 0.8, 0.04]} />
                <meshStandardMaterial color="#D9D5CC" metalness={0.9} roughness={0.2} />
              </mesh>
            ))}
          </group>
        );
      }

      // ── NIGHTSTAND ────────────────────────────────────────────────
      case "nightstand": {
        return (
          <group>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.65} />
            </mesh>
            {/* Drawer pulls */}
            <mesh position={[0, h * 0.7, d / 2 + 0.02]} castShadow>
              <boxGeometry args={[w * 0.4, 0.05, 0.03]} />
              <meshStandardMaterial color="#E0DCD5" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, h * 0.3, d / 2 + 0.02]} castShadow>
              <boxGeometry args={[w * 0.4, 0.05, 0.03]} />
              <meshStandardMaterial color="#E0DCD5" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      }

      // ── DRESSER WITH MIRROR ───────────────────────────────────────
      case "dresser": {
        const tableH = 2.4;
        return (
          <group>
            {/* Vanity desk */}
            <mesh position={[0, tableH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, tableH, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.6} />
            </mesh>
            {/* Back mirror */}
            <mesh position={[0, tableH + (h - tableH) / 2, d / 2 - 0.1]} castShadow>
              <boxGeometry args={[w * 0.8, h - tableH, 0.08]} />
              <meshStandardMaterial color="#A4C2E0" roughness={0.05} metalness={0.95} />
            </mesh>
          </group>
        );
      }

      // ── KITCHEN MODULAR COUNTER ───────────────────────────────────
      case "kitchen_counter": {
        const counterTopThick = 0.15;
        return (
          <group>
            {/* Base cabinets */}
            <mesh position={[0, (h - counterTopThick) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h - counterTopThick, d]} />
              <meshStandardMaterial color="#2E343B" roughness={0.5} />
            </mesh>
            {/* Polished stone countertop */}
            <mesh position={[0, h - counterTopThick / 2, 0.05]} castShadow receiveShadow>
              <boxGeometry args={[w + 0.1, counterTopThick, d + 0.1]} />
              <meshStandardMaterial color={primaryColor} roughness={0.2} metalness={0.08} />
            </mesh>
          </group>
        );
      }

      // ── KITCHEN SINK ──────────────────────────────────────────────
      case "kitchen_sink": {
        const counterTopThick = 0.15;
        return (
          <group>
            <mesh position={[0, (h - counterTopThick) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h - counterTopThick, d]} />
              <meshStandardMaterial color="#2E343B" roughness={0.5} />
            </mesh>
            <mesh position={[0, h - counterTopThick / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w + 0.1, counterTopThick, d + 0.1]} />
              <meshStandardMaterial color="#E8ECEE" roughness={0.2} metalness={0.08} />
            </mesh>
            {/* Sink basin cutout */}
            <mesh position={[0, h - 0.1, 0]}>
              <boxGeometry args={[w * 0.7, 0.3, d * 0.6]} />
              <meshStandardMaterial color="#7E8790" roughness={0.25} metalness={0.8} />
            </mesh>
            {/* Chrome faucet */}
            <mesh position={[0, h + 0.5, d * 0.3]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 1.0, 12]} />
              <meshStandardMaterial color="#CCCCCC" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        );
      }

      // ── REFRIGERATOR ──────────────────────────────────────────────
      case "refrigerator": {
        return (
          <group>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.25} metalness={0.7} />
            </mesh>
            {/* Left & right door seam */}
            <mesh position={[0, h * 0.55, d / 2 + 0.02]} castShadow>
              <boxGeometry args={[0.02, h * 0.8, 0.02]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
            {/* Handles */}
            <mesh position={[-0.1, h * 0.5, d / 2 + 0.05]} castShadow>
              <boxGeometry args={[0.04, 1.2, 0.04]} />
              <meshStandardMaterial color="#EEEEEE" metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0.1, h * 0.5, d / 2 + 0.05]} castShadow>
              <boxGeometry args={[0.04, 1.2, 0.04]} />
              <meshStandardMaterial color="#EEEEEE" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        );
      }

      // ── BATHROOM TOILET ───────────────────────────────────────────
      case "toilet": {
        return (
          <group>
            {/* Cistern tank at the back */}
            <mesh position={[0, 1.8, d / 2 - 0.4]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.9, 1.6, 0.7]} />
              <meshStandardMaterial color="#F7FBFD" roughness={0.15} />
            </mesh>
            {/* Bowl */}
            <mesh position={[0, 0.9, -0.2]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.75, 1.4, d * 0.75]} />
              <meshStandardMaterial color="#F7FBFD" roughness={0.15} />
            </mesh>
            {/* Toilet seat lid */}
            <mesh position={[0, 1.65, -0.2]} castShadow>
              <boxGeometry args={[w * 0.8, 0.08, d * 0.75]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.2} />
            </mesh>
          </group>
        );
      }

      // ── VANITY SINK & MIRROR ──────────────────────────────────────
      case "vanity_sink": {
        const cabinetH = 2.4;
        return (
          <group>
            {/* Base vanity cabinet */}
            <mesh position={[0, cabinetH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, cabinetH, d]} />
              <meshStandardMaterial color="#3C434C" roughness={0.5} />
            </mesh>
            {/* Ceramic basin top */}
            <mesh position={[0, cabinetH + 0.1, 0]} castShadow receiveShadow>
              <boxGeometry args={[w + 0.05, 0.2, d + 0.05]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.15} />
            </mesh>
            {/* Chrome mixer tap */}
            <mesh position={[0, cabinetH + 0.4, d * 0.3]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.6, 12]} />
              <meshStandardMaterial color="#D1D5DB" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Mirror on wall */}
            <mesh position={[0, cabinetH + 2.0, d / 2 - 0.05]} castShadow>
              <boxGeometry args={[w * 0.85, 2.5, 0.06]} />
              <meshStandardMaterial color="#B0C8E2" roughness={0.05} metalness={0.9} />
            </mesh>
          </group>
        );
      }

      // ── BATHTUB ───────────────────────────────────────────────────
      case "bathtub": {
        return (
          <group>
            {/* Outer tub shell */}
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#F8FBFD" roughness={0.15} />
            </mesh>
            {/* Water interior */}
            <mesh position={[0, h * 0.75, 0]}>
              <boxGeometry args={[w * 0.82, 0.1, d * 0.82]} />
              <meshStandardMaterial color="#8AC1E8" roughness={0.05} metalness={0.1} transparent opacity={0.8} />
            </mesh>
          </group>
        );
      }

      // ── SHOWER ENCLOSURE ──────────────────────────────────────────
      case "shower_stall": {
        return (
          <group>
            {/* Base shower tray */}
            <mesh position={[0, 0.15, 0]} receiveShadow>
              <boxGeometry args={[w, 0.3, d]} />
              <meshStandardMaterial color="#E2E8F0" roughness={0.4} />
            </mesh>
            {/* Tempered glass panels */}
            <mesh position={[0, h / 2 + 0.15, 0]}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#D1E7F5" roughness={0.1} transparent opacity={0.35} />
            </mesh>
            {/* Chrome overhead rain shower */}
            <mesh position={[0, h - 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.06, 16]} />
              <meshStandardMaterial color="#CCCCCC" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        );
      }

      // ── DINING TABLE ──────────────────────────────────────────────
      case "dining_table_6":
      case "dining_table_4": {
        return (
          <group>
            {/* Solid wood/marble top */}
            <mesh position={[0, h - 0.1, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, 0.2, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.5} />
            </mesh>
            {/* 4 Sturdy corner legs */}
            {[-w * 0.42, w * 0.42].map((x) =>
              [-d * 0.42, d * 0.42].map((z) => (
                <mesh key={`${x}-${z}`} position={[x, (h - 0.2) / 2, z]} castShadow>
                  <boxGeometry args={[0.2, h - 0.2, 0.2]} />
                  <meshStandardMaterial color="#2B2420" roughness={0.6} />
                </mesh>
              ))
            )}
          </group>
        );
      }

      // ── DINING / ACCENT CHAIR ─────────────────────────────────────
      case "dining_chair":
      case "armchair": {
        const isArm = item.type === "armchair";
        return (
          <group>
            {/* Seat cushion */}
            <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.9, 0.3, d * 0.9]} />
              <meshStandardMaterial color={primaryColor} roughness={0.7} />
            </mesh>
            {/* Backrest */}
            <mesh position={[0, 2.3, d / 2 - 0.15]} castShadow>
              <boxGeometry args={[w * 0.85, 1.5, 0.2]} />
              <meshStandardMaterial color={primaryColor} roughness={0.7} />
            </mesh>
            {/* Legs */}
            {[-w * 0.38, w * 0.38].map((x) =>
              [-d * 0.38, d * 0.38].map((z) => (
                <mesh key={`${x}-${z}`} position={[x, 0.65, z]} castShadow>
                  <cylinderGeometry args={[0.06, 0.04, 1.3, 10]} />
                  <meshStandardMaterial color="#221C18" roughness={0.5} />
                </mesh>
              ))
            )}
          </group>
        );
      }

      // ── OFFICE DESK ───────────────────────────────────────────────
      case "office_desk": {
        return (
          <group>
            {/* Desktop slab */}
            <mesh position={[0, h - 0.08, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, 0.16, d]} />
              <meshStandardMaterial color={primaryColor} roughness={0.5} />
            </mesh>
            {/* Side drawer pedestal */}
            <mesh position={[w * 0.32, (h - 0.16) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.3, h - 0.16, d * 0.9]} />
              <meshStandardMaterial color="#322C28" roughness={0.6} />
            </mesh>
            {/* Left metal leg frame */}
            <mesh position={[-w * 0.45, (h - 0.16) / 2, 0]} castShadow>
              <boxGeometry args={[0.1, h - 0.16, d * 0.8]} />
              <meshStandardMaterial color="#1E1E1E" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      }

      // ── OFFICE CHAIR ──────────────────────────────────────────────
      case "office_chair": {
        return (
          <group>
            {/* 5-star wheeled base & cylinder */}
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 1.0, 12]} />
              <meshStandardMaterial color="#1A1A1A" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Contoured seat */}
            <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.9, 0.25, d * 0.9]} />
              <meshStandardMaterial color={primaryColor} roughness={0.7} />
            </mesh>
            {/* Mesh back */}
            <mesh position={[0, 2.3, d * 0.3]} castShadow>
              <boxGeometry args={[w * 0.85, 1.8, 0.15]} />
              <meshStandardMaterial color="#22262C" roughness={0.8} />
            </mesh>
          </group>
        );
      }

      // ── FLOOR LAMP ────────────────────────────────────────────────
      case "floor_lamp": {
        return (
          <group>
            {/* Base plate */}
            <mesh position={[0, 0.05, 0]} castShadow>
              <cylinderGeometry args={[0.5, 0.5, 0.1, 20]} />
              <meshStandardMaterial color="#1E1E1E" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Slim pole */}
            <mesh position={[0, h / 2, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, h - 1.0, 12]} />
              <meshStandardMaterial color="#D1B875" metalness={0.85} roughness={0.15} />
            </mesh>
            {/* Glowing fabric drum shade */}
            <mesh position={[0, h - 0.6, 0]}>
              <cylinderGeometry args={[0.6, 0.7, 1.0, 24]} />
              <meshStandardMaterial
                color="#FFF1D0"
                emissive="#FFD988"
                emissiveIntensity={0.6}
                roughness={0.6}
              />
            </mesh>
            <pointLight position={[0, h - 0.6, 0]} color="#FFE4A0" intensity={1.5} distance={10} />
          </group>
        );
      }

      // ── AREA RUG ──────────────────────────────────────────────────
      case "area_rug": {
        return (
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[w, 0.04, d]} />
            <meshStandardMaterial color={primaryColor} roughness={0.95} />
          </mesh>
        );
      }

      // ── INDOOR PLANT ──────────────────────────────────────────────
      case "indoor_plant": {
        return (
          <group>
            {/* Ceramic cylindrical pot */}
            <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.6, 0.5, 1.8, 16]} />
              <meshStandardMaterial color="#E8E4DD" roughness={0.4} />
            </mesh>
            {/* Soil */}
            <mesh position={[0, 1.75, 0]}>
              <cylinderGeometry args={[0.58, 0.58, 0.1, 16]} />
              <meshStandardMaterial color="#2B1D12" roughness={0.9} />
            </mesh>
            {/* Green leaf clusters */}
            <mesh position={[0, 2.5, 0]} castShadow>
              <sphereGeometry args={[0.9, 12, 12]} />
              <meshStandardMaterial color="#306230" roughness={0.7} />
            </mesh>
          </group>
        );
      }

      // ── PENDANT CEILING LIGHT ─────────────────────────────────────
      case "ceiling_light": {
        return (
          <group position={[0, 7.5, 0]}>
            <mesh position={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[0.4, 0.7, 0.8, 20]} />
              <meshStandardMaterial color="#D1B875" metalness={0.9} roughness={0.15} />
            </mesh>
            <pointLight position={[0, -0.2, 0]} color="#FFF3D6" intensity={2.2} distance={12} />
          </group>
        );
      }

      // Default fallback generic item
      default: {
        return (
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={primaryColor} roughness={0.6} />
          </mesh>
        );
      }
    }
  };

  return (
    <group
      position={[posX, floorBaseY, posZ]}
      rotation={[0, -rotY, 0]}
      scale={[sx, sy, sz]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {renderGeometry()}

      {/* Selection outline indicator */}
      {(isSelected || hovered) && (
        <lineSegments position={[0, h / 2, 0]}>
          <edgesGeometry args={[new BoxGeometry(w + 0.1, h + 0.1, d + 0.1)]} />
          <lineBasicMaterial
            color={isSelected ? "#FFD700" : "#7B68EE"}
            linewidth={isSelected ? 3 : 1}
          />
        </lineSegments>
      )}
    </group>
  );
}
