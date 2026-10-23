"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";

export interface CharacterModelProps {
  position: [number, number, number];
  rotationY: number;
  isMoving: boolean;
  isRunning: boolean;
  isFirstPerson: boolean;
}

/**
 * 3D Animated Human Character Model.
 * Features an architect/designer persona with articulated limbs,
 * procedural walk/run cycles, idle breathing, and smooth kinematics.
 */
export function CharacterModel({
  position,
  rotationY,
  isMoving,
  isRunning,
  isFirstPerson,
}: CharacterModelProps) {
  const rootRef = useRef<Group>(null);
  const torsoRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const leftKneeRef = useRef<Group>(null);
  const rightKneeRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);

  // Materials & Colors
  const skinColor = "#E0B79B";
  const hairColor = "#262220";
  const jacketColor = "#2C3446"; // Navy architect blazer
  const shirtColor = "#F5F6FA";  // Crisp white inner shirt
  const pantsColor = "#3D4451";  // Slate trousers
  const shoeColor = "#FFFFFF";   // White sneakers
  const shoeSoleColor = "#1B1E24";

  useFrame((state, delta) => {
    if (!rootRef.current || isFirstPerson) return;

    const time = state.clock.elapsedTime;
    const speedMultiplier = isRunning ? 13 : 8.5;
    const strideAmp = isRunning ? 0.75 : 0.5;
    const armAmp = isRunning ? 0.65 : 0.42;

    if (isMoving) {
      const walkPhase = time * speedMultiplier;

      // Legs alternate swinging forward and backward
      const leftLegAngle = Math.sin(walkPhase) * strideAmp;
      const rightLegAngle = -Math.sin(walkPhase) * strideAmp;

      if (leftLegRef.current) leftLegRef.current.rotation.x = leftLegAngle;
      if (rightLegRef.current) rightLegRef.current.rotation.x = rightLegAngle;

      // Knees bend naturally when leg swings backward
      if (leftKneeRef.current) {
        leftKneeRef.current.rotation.x = Math.max(0, -Math.sin(walkPhase)) * 0.7;
      }
      if (rightKneeRef.current) {
        rightKneeRef.current.rotation.x = Math.max(0, Math.sin(walkPhase)) * 0.7;
      }

      // Arms swing in opposition to legs
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -Math.sin(walkPhase) * armAmp;
        leftArmRef.current.rotation.z = 0.08 + Math.cos(walkPhase) * 0.05;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = Math.sin(walkPhase) * armAmp;
        rightArmRef.current.rotation.z = -0.08 - Math.cos(walkPhase) * 0.05;
      }

      // Torso natural vertical step bounce & subtle twist
      if (torsoRef.current) {
        torsoRef.current.position.y = 0.88 + Math.abs(Math.sin(walkPhase)) * 0.04;
        torsoRef.current.rotation.y = Math.sin(walkPhase) * 0.08;
      }

      if (headRef.current) {
        headRef.current.rotation.y = -Math.sin(walkPhase) * 0.04;
      }
    } else {
      // Idle animation: breathing and natural weight balance
      const breathPhase = time * 2;
      const swayPhase = time * 1.2;

      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftKneeRef.current) leftKneeRef.current.rotation.x = 0;
      if (rightKneeRef.current) rightKneeRef.current.rotation.x = 0;

      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(breathPhase) * 0.04;
        leftArmRef.current.rotation.z = 0.12 + Math.cos(breathPhase) * 0.02;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -Math.sin(breathPhase) * 0.04;
        rightArmRef.current.rotation.z = -0.12 - Math.cos(breathPhase) * 0.02;
      }

      if (torsoRef.current) {
        torsoRef.current.position.y = 0.88 + Math.sin(breathPhase) * 0.01;
        torsoRef.current.rotation.y = Math.sin(swayPhase) * 0.02;
      }

      if (headRef.current) {
        headRef.current.rotation.x = Math.sin(breathPhase) * 0.02;
      }
    }
  });

  if (isFirstPerson) return null;

  return (
    <group ref={rootRef} position={position} rotation={[0, rotationY, 0]}>
      {/* ── Pelvis & Torso Group ── */}
      <group ref={torsoRef} position={[0, 0.88, 0]}>
        {/* Hips / Waist */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.28, 0.12, 0.18]} />
          <meshStandardMaterial color={pantsColor} roughness={0.7} />
        </mesh>

        {/* Belt */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.29, 0.03, 0.19]} />
          <meshStandardMaterial color="#1A1A1A" roughness={0.4} />
        </mesh>

        {/* Chest / Jacket Torso */}
        <mesh position={[0, 0.24, 0]} castShadow>
          <boxGeometry args={[0.32, 0.36, 0.22]} />
          <meshStandardMaterial color={jacketColor} roughness={0.6} />
        </mesh>

        {/* White Shirt Collar / Center strip */}
        <mesh position={[0, 0.27, 0.112]}>
          <boxGeometry args={[0.08, 0.22, 0.01]} />
          <meshStandardMaterial color={shirtColor} roughness={0.3} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.08, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>

        {/* ── Head Group ── */}
        <group ref={headRef} position={[0, 0.54, 0]}>
          {/* Face */}
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.2, 0.18]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>

          {/* Hair */}
          <mesh position={[0, 0.06, -0.01]} castShadow>
            <boxGeometry args={[0.2, 0.12, 0.2]} />
            <meshStandardMaterial color={hairColor} roughness={0.8} />
          </mesh>

          {/* Modern Glasses Frame */}
          <mesh position={[0, 0.02, 0.095]}>
            <boxGeometry args={[0.15, 0.03, 0.02]} />
            <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.8} />
          </mesh>

          {/* Eyes / Pupils */}
          <mesh position={[-0.04, 0.02, 0.092]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshBasicMaterial color="#1E2024" />
          </mesh>
          <mesh position={[0.04, 0.02, 0.092]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshBasicMaterial color="#1E2024" />
          </mesh>
        </group>

        {/* ── Left Arm (Shoulder Pivot) ── */}
        <group ref={leftArmRef} position={[0.19, 0.38, 0]}>
          {/* Upper Arm */}
          <mesh position={[0, -0.12, 0]} castShadow>
            <boxGeometry args={[0.08, 0.22, 0.09]} />
            <meshStandardMaterial color={jacketColor} roughness={0.6} />
          </mesh>
          {/* Forearm */}
          <mesh position={[0, -0.28, 0]} castShadow>
            <boxGeometry args={[0.07, 0.18, 0.08]} />
            <meshStandardMaterial color={jacketColor} roughness={0.6} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[0.05, 0.07, 0.06]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
        </group>

        {/* ── Right Arm (Shoulder Pivot) ── */}
        <group ref={rightArmRef} position={[-0.19, 0.38, 0]}>
          {/* Upper Arm */}
          <mesh position={[0, -0.12, 0]} castShadow>
            <boxGeometry args={[0.08, 0.22, 0.09]} />
            <meshStandardMaterial color={jacketColor} roughness={0.6} />
          </mesh>
          {/* Forearm */}
          <mesh position={[0, -0.28, 0]} castShadow>
            <boxGeometry args={[0.07, 0.18, 0.08]} />
            <meshStandardMaterial color={jacketColor} roughness={0.6} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[0.05, 0.07, 0.06]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* ── Left Leg (Hip Pivot) ── */}
      <group ref={leftLegRef} position={[0.085, 0.82, 0]}>
        {/* Thigh */}
        <mesh position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.11, 0.38, 0.12]} />
          <meshStandardMaterial color={pantsColor} roughness={0.7} />
        </mesh>
        {/* Knee / Shin */}
        <group ref={leftKneeRef} position={[0, -0.38, 0]}>
          <mesh position={[0, -0.19, 0]} castShadow>
            <boxGeometry args={[0.1, 0.36, 0.11]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} />
          </mesh>
          {/* Sneaker */}
          <mesh position={[0, -0.39, 0.03]} castShadow>
            <boxGeometry args={[0.09, 0.07, 0.18]} />
            <meshStandardMaterial color={shoeColor} roughness={0.4} />
          </mesh>
          {/* Sneaker Sole */}
          <mesh position={[0, -0.425, 0.03]}>
            <boxGeometry args={[0.095, 0.02, 0.19]} />
            <meshStandardMaterial color={shoeSoleColor} roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* ── Right Leg (Hip Pivot) ── */}
      <group ref={rightLegRef} position={[-0.085, 0.82, 0]}>
        {/* Thigh */}
        <mesh position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.11, 0.38, 0.12]} />
          <meshStandardMaterial color={pantsColor} roughness={0.7} />
        </mesh>
        {/* Knee / Shin */}
        <group ref={rightKneeRef} position={[0, -0.38, 0]}>
          <mesh position={[0, -0.19, 0]} castShadow>
            <boxGeometry args={[0.1, 0.36, 0.11]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} />
          </mesh>
          {/* Sneaker */}
          <mesh position={[0, -0.39, 0.03]} castShadow>
            <boxGeometry args={[0.09, 0.07, 0.18]} />
            <meshStandardMaterial color={shoeColor} roughness={0.4} />
          </mesh>
          {/* Sneaker Sole */}
          <mesh position={[0, -0.425, 0.03]}>
            <boxGeometry args={[0.095, 0.02, 0.19]} />
            <meshStandardMaterial color={shoeSoleColor} roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* Subtle Ground Shadow Disc */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.24} />
      </mesh>
    </group>
  );
}
