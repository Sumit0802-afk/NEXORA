"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Euler, MathUtils } from "three";
import type { SceneGeometry, RoomFloor, WallSegment } from "@/lib/scene-geometry";
import { CharacterModel } from "./CharacterModel";

export interface WalkthroughInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
  // Mobile virtual joystick input (-1 to 1)
  joystickX: number;
  joystickY: number;
  // Mobile touch look delta
  touchLookX: number;
  touchLookY: number;
}

export interface WalkthroughControllerProps {
  geometry: SceneGeometry;
  active: boolean;
  isFirstPerson: boolean;
  onToggleFirstPerson: () => void;
  onExit: () => void;
  onRoomChange?: (roomName: string, floorLevel: number) => void;
  targetTeleportRoomId?: string | null;
  onClearTeleport?: () => void;
  targetFloorLevel?: number | null;
  onClearTargetFloor?: () => void;
  mobileInputs?: {
    joystickX: number;
    joystickY: number;
    touchLookX: number;
    touchLookY: number;
  };
}

/**
 * 3D Walkthrough Controller.
 * Handles character kinematics, continuous wall collision, doorway clearance,
 * multi-floor staircase climbing, 1st & 3rd person chase camera, and interior lighting.
 */
export function WalkthroughController({
  geometry,
  active,
  isFirstPerson,
  onToggleFirstPerson,
  onExit,
  onRoomChange,
  targetTeleportRoomId,
  onClearTeleport,
  targetFloorLevel,
  onClearTargetFloor,
  mobileInputs,
}: WalkthroughControllerProps) {
  const { camera, gl } = useThree();

  // Character State
  const charPos = useRef<Vector3>(new Vector3(0, 0, 0));
  const charVel = useRef<Vector3>(new Vector3(0, 0, 0));
  const charFacingY = useRef<number>(0);
  const currentLevelRef = useRef<number>(0);
  const [isMoving, setIsMoving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Camera orientation angles
  const yaw = useRef<number>(0);
  const pitch = useRef<number>(0);
  const isPointerLocked = useRef<boolean>(false);
  const isMouseDown = useRef<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Input state
  const keys = useRef<{
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    shift: boolean;
  }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    shift: false,
  });

  // Safe initial spawn point calculation
  const spawnPoint = useMemo(() => {
    // Priority 1: Ground floor living room
    const groundFloors = geometry.floors.filter((f) => f.level === 0);
    const living = groundFloors.find((f) => f.type === "living_room");
    if (living) {
      return { x: living.centerX, y: living.baseY, z: living.centerZ, level: 0 };
    }
    // Priority 2: Any non-staircase ground floor room
    const anyRoom = groundFloors.find((f) => f.type !== "staircase" && f.type !== "other");
    if (anyRoom) {
      return { x: anyRoom.centerX, y: anyRoom.baseY, z: anyRoom.centerZ, level: 0 };
    }
    // Priority 3: First available floor
    if (geometry.floors[0]) {
      const f = geometry.floors[0];
      return { x: f.centerX, y: f.baseY, z: f.centerZ, level: f.level };
    }
    return { x: 0, y: 0, z: 0, level: 0 };
  }, [geometry.floors]);

  // Initialize or reset position on activation
  useEffect(() => {
    if (active) {
      charPos.current.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
      charVel.current.set(0, 0, 0);
      currentLevelRef.current = spawnPoint.level;
      yaw.current = 0;
      pitch.current = 0;
    }
  }, [active, spawnPoint]);

  // Handle Teleport to a specific room
  useEffect(() => {
    if (!active || !targetTeleportRoomId) return;
    const room = geometry.floors.find((f) => f.id === targetTeleportRoomId);
    if (room) {
      charPos.current.set(room.centerX, room.baseY, room.centerZ);
      charVel.current.set(0, 0, 0);
      currentLevelRef.current = room.level;
      onClearTeleport?.();
    }
  }, [active, targetTeleportRoomId, geometry.floors, onClearTeleport]);

  // Handle Floor Level Switch
  useEffect(() => {
    if (!active || targetFloorLevel === null || targetFloorLevel === undefined) return;
    const targetFloors = geometry.floors.filter((f) => f.level === targetFloorLevel);
    if (targetFloors.length > 0) {
      // Find living room or first room on that floor
      const targetRoom =
        targetFloors.find((f) => f.type === "living_room" || f.type === "bedroom") ||
        targetFloors[0];
      charPos.current.set(targetRoom.centerX, targetRoom.baseY, targetRoom.centerZ);
      charVel.current.set(0, 0, 0);
      currentLevelRef.current = targetFloorLevel;
    }
    onClearTargetFloor?.();
  }, [active, targetFloorLevel, geometry.floors, onClearTargetFloor]);

  // Keyboard Event Listeners
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for exit
      if (e.key === "Escape") {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        } else {
          onExit();
        }
        return;
      }
      if (e.key === "1") {
        if (!isFirstPerson) onToggleFirstPerson();
        return;
      }
      if (e.key === "3") {
        if (isFirstPerson) onToggleFirstPerson();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        // Reset to initial spawn
        charPos.current.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
        charVel.current.set(0, 0, 0);
        currentLevelRef.current = spawnPoint.level;
        return;
      }

      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.backward = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.current.shift = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.backward = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.current.shift = false;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [active, onExit, isFirstPerson, onToggleFirstPerson, spawnPoint]);

  // Pointer Lock and Mouse Look
  useEffect(() => {
    if (!active) return;
    const dom = gl.domElement;

    const handlePointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === dom;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPointerLocked.current) {
        const sens = 0.0024;
        yaw.current -= e.movementX * sens;
        pitch.current = MathUtils.clamp(pitch.current - e.movementY * sens, -1.15, 1.15);
      } else if (isMouseDown.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        const sens = 0.004;
        yaw.current -= dx * sens;
        pitch.current = MathUtils.clamp(pitch.current - dy * sens, -1.15, 1.15);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        // Optional pointer lock request on direct canvas click
        if (!isPointerLocked.current && e.detail > 1) {
          dom.requestPointerLock?.();
        }
      }
    };

    const handleMouseUp = () => {
      isMouseDown.current = false;
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    window.addEventListener("mousemove", handleMouseMove);
    dom.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      window.removeEventListener("mousemove", handleMouseMove);
      dom.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      if (document.pointerLockElement === dom) {
        document.exitPointerLock();
      }
    };
  }, [active, gl.domElement]);

  // Continuous collision detection against walls
  const resolveWallCollisions = useCallback(
    (pos: Vector3, charRadius: number) => {
      const charY = pos.y;
      const walls = geometry.walls;

      // Iterative relaxation solver for corner & doorway stability
      for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < walls.length; i++) {
          const w = walls[i];
          // Check vertical overlap
          if (charY + 0.1 < w.baseY || charY > w.baseY + w.height - 0.1) {
            continue;
          }

          // Transform character position to wall local coordinates
          const dx = pos.x - w.centerX;
          const dz = pos.z - w.centerZ;
          const cos = Math.cos(w.angle);
          const sin = Math.sin(w.angle);

          const lx = dx * cos - dz * sin;
          const lz = dx * sin + dz * cos;

          const halfLen = w.length / 2;
          const halfThick = w.thickness / 2;

          // Closest point on box
          const cx = Math.max(-halfLen, Math.min(halfLen, lx));
          const cz = Math.max(-halfThick, Math.min(halfThick, lz));

          const distSq = (lx - cx) ** 2 + (lz - cz) ** 2;

          if (distSq < charRadius * charRadius && distSq > 0.000001) {
            const dist = Math.sqrt(distSq);
            const overlap = charRadius - dist;
            const nx = (lx - cx) / dist;
            const nz = (lz - cz) / dist;

            // Transform normal back to world
            const wx = nx * cos + nz * sin;
            const wz = -nx * sin + nz * cos;

            pos.x += wx * overlap;
            pos.z += wz * overlap;
          }
        }
      }

      // Constrain within plot boundaries
      const halfW = geometry.plotWidth / 2 - charRadius;
      const halfD = geometry.plotDepth / 2 - charRadius;
      pos.x = MathUtils.clamp(pos.x, -halfW, halfW);
      pos.z = MathUtils.clamp(pos.z, -halfD, halfD);
    },
    [geometry.walls, geometry.plotWidth, geometry.plotDepth]
  );

  // Main Walkthrough Simulation Loop
  useFrame((state, delta) => {
    if (!active) return;

    // Apply Mobile touch look deltas if provided
    if (mobileInputs) {
      if (Math.abs(mobileInputs.touchLookX) > 0.001 || Math.abs(mobileInputs.touchLookY) > 0.001) {
        yaw.current -= mobileInputs.touchLookX * 0.04;
        pitch.current = MathUtils.clamp(pitch.current - mobileInputs.touchLookY * 0.04, -1.15, 1.15);
      }
    }

    // 1. Gather movement input vector
    let moveForward = 0;
    let moveRight = 0;

    if (keys.current.forward) moveForward += 1;
    if (keys.current.backward) moveForward -= 1;
    if (keys.current.left) moveRight -= 1;
    if (keys.current.right) moveRight += 1;

    // Add mobile joystick
    if (mobileInputs) {
      moveRight += mobileInputs.joystickX;
      moveForward -= mobileInputs.joystickY; // upward stick = forward
    }

    const inputLength = Math.sqrt(moveForward * moveForward + moveRight * moveRight);
    const moving = inputLength > 0.05;
    const running = Boolean((keys.current.shift || (mobileInputs && inputLength > 0.85)) && moving);

    setIsMoving(moving);
    setIsRunning(running);

    // 2. Kinematics calculation
    const baseSpeed = running ? 4.5 : 2.5; // meters/sec
    const targetVelX = moving ? (moveRight * Math.cos(yaw.current) + moveForward * Math.sin(yaw.current)) / Math.max(inputLength, 1) * baseSpeed : 0;
    const targetVelZ = moving ? (-moveRight * Math.sin(yaw.current) + moveForward * Math.cos(yaw.current)) / Math.max(inputLength, 1) * baseSpeed : 0;

    // Smooth acceleration / damping
    const dt = Math.min(delta, 0.05);
    charVel.current.x = MathUtils.lerp(charVel.current.x, targetVelX, 14 * dt);
    charVel.current.z = MathUtils.lerp(charVel.current.z, targetVelZ, 14 * dt);

    // Update position
    charPos.current.x += charVel.current.x * dt;
    charPos.current.z += charVel.current.z * dt;

    // 3. Collision Resolution against walls
    const charRadius = 0.35; // 35cm radius allows easy passage through standard 90cm doors
    resolveWallCollisions(charPos.current, charRadius);

    // 4. Room Detection & Staircase Elevation Incline
    const currentLvl = currentLevelRef.current;
    const currentRoom = geometry.floors.find((f) => {
      const margin = 0.1;
      return (
        f.level === currentLvl &&
        charPos.current.x >= f.centerX - f.width / 2 - margin &&
        charPos.current.x <= f.centerX + f.width / 2 + margin &&
        charPos.current.z >= f.centerZ - f.depth / 2 - margin &&
        charPos.current.z <= f.centerZ + f.depth / 2 + margin
      );
    });

    if (currentRoom) {
      onRoomChange?.(currentRoom.name, currentRoom.level);

      // Check if inside staircase room for natural floor climbing
      if (currentRoom.type === "staircase") {
        const floorBase = currentRoom.baseY;
        const nextElevation = floorBase + geometry.wallHeight;

        // Along flight ratio: compute progress along depth or width
        const alongDepth = currentRoom.depth >= currentRoom.width;
        let progress = 0;
        if (alongDepth) {
          const startZ = currentRoom.centerZ - currentRoom.depth / 2;
          progress = MathUtils.clamp((charPos.current.z - startZ) / currentRoom.depth, 0, 1);
        } else {
          const startX = currentRoom.centerX - currentRoom.width / 2;
          progress = MathUtils.clamp((charPos.current.x - startX) / currentRoom.width, 0, 1);
        }

        // Smooth elevation along stairs
        const targetElevation = floorBase + progress * geometry.wallHeight;
        charPos.current.y = MathUtils.lerp(charPos.current.y, targetElevation, 10 * dt);

        // Transition level when reaching near the top landing
        if (progress > 0.88 && currentLevelRef.current < geometry.levelCount - 1) {
          currentLevelRef.current = currentLevelRef.current + 1;
        } else if (progress < 0.12 && currentLevelRef.current > 0) {
          currentLevelRef.current = currentLevelRef.current - 1;
        }
      } else {
        // Natural floor level elevation
        charPos.current.y = MathUtils.lerp(charPos.current.y, currentRoom.baseY, 12 * dt);
      }
    }

    // 5. Character Facing Direction
    if (moving && !isFirstPerson) {
      const moveAngle = Math.atan2(charVel.current.x, charVel.current.z);
      // Smoothly rotate character to face movement direction
      let diff = moveAngle - charFacingY.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      charFacingY.current += diff * 12 * dt;
    } else if (isFirstPerson) {
      charFacingY.current = yaw.current;
    }

    // 6. Camera Rigging (1st Person vs 3rd Person)
    const headBob = moving ? Math.sin(state.clock.elapsedTime * (running ? 14 : 9)) * 0.03 : 0;

    if (isFirstPerson) {
      // Camera placed exactly at eye level (1.64m)
      const eyeY = charPos.current.y + 1.64 + headBob;
      camera.position.set(charPos.current.x, eyeY, charPos.current.z);

      // Rotate camera by pitch and yaw
      const lookDist = 5;
      const targetX = charPos.current.x + Math.sin(yaw.current) * Math.cos(pitch.current) * lookDist;
      const targetY = eyeY + Math.sin(pitch.current) * lookDist;
      const targetZ = charPos.current.z + Math.cos(yaw.current) * Math.cos(pitch.current) * lookDist;
      camera.lookAt(targetX, targetY, targetZ);
    } else {
      // 3rd Person Smooth Follow Chase Camera
      const chaseDist = 2.6;
      const camHeight = 1.35;
      const targetFocusY = charPos.current.y + camHeight;

      // Target character position to look at
      const lookTarget = new Vector3(charPos.current.x, targetFocusY, charPos.current.z);

      // Desired camera position behind character
      const desiredCamX = charPos.current.x - Math.sin(yaw.current) * chaseDist * Math.cos(pitch.current);
      const desiredCamY = targetFocusY + Math.sin(pitch.current) * chaseDist + 0.55;
      const desiredCamZ = charPos.current.z - Math.cos(yaw.current) * chaseDist * Math.cos(pitch.current);

      camera.position.lerp(new Vector3(desiredCamX, desiredCamY, desiredCamZ), 12 * dt);
      camera.lookAt(lookTarget);
    }
  });

  if (!active) return null;

  return (
    <group>
      {/* 3D Animated Human Character */}
      <CharacterModel
        position={[charPos.current.x, charPos.current.y, charPos.current.z]}
        rotationY={charFacingY.current}
        isMoving={isMoving}
        isRunning={isRunning}
        isFirstPerson={isFirstPerson}
      />

      {/* Interior Ambient Fill Light that follows the player */}
      <pointLight
        position={[charPos.current.x, charPos.current.y + 2.4, charPos.current.z]}
        intensity={0.65}
        distance={12}
        color="#FFF6E8"
        castShadow={false}
      />

      {/* Warm Ceiling Lights for each room on active floor for cozy interior exploration */}
      {geometry.floors
        .filter((f) => f.level === currentLevelRef.current)
        .map((floor) => (
          <pointLight
            key={`light-${floor.id}`}
            position={[floor.centerX, floor.baseY + geometry.wallHeight * 0.9, floor.centerZ]}
            intensity={0.7}
            distance={Math.max(floor.width, floor.depth) * 1.5}
            color="#FFF2DC"
            castShadow
            shadow-bias={-0.0005}
          />
        ))}
    </group>
  );
}
