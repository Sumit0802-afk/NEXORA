"use client";

import { useState, useEffect, useRef } from "react";
import {
  Compass,
  Eye,
  Footprints,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  Navigation,
  RotateCcw,
  Sparkles,
  User,
  X,
  ChevronDown,
} from "lucide-react";
import type { SceneGeometry } from "@/lib/scene-geometry";
import { floorName } from "@/lib/floors";

export interface WalkthroughHUDProps {
  geometry: SceneGeometry;
  active: boolean;
  currentRoomName: string;
  currentFloorLevel: number;
  isFirstPerson: boolean;
  onToggleFirstPerson: () => void;
  onExit: () => void;
  onSelectRoom: (roomId: string) => void;
  onSelectFloor: (level: number) => void;
  onResetPosition: () => void;
  onMobileInputChange?: (inputs: {
    joystickX: number;
    joystickY: number;
    touchLookX: number;
    touchLookY: number;
  }) => void;
}

export function WalkthroughHUD({
  geometry,
  active,
  currentRoomName,
  currentFloorLevel,
  isFirstPerson,
  onToggleFirstPerson,
  onExit,
  onSelectRoom,
  onSelectFloor,
  onResetPosition,
  onMobileInputChange,
}: WalkthroughHUDProps) {
  const [showGuide, setShowGuide] = useState(true);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Mobile virtual joystick state
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [joystickThumbPos, setJoystickThumbPos] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickTouchId = useRef<number | null>(null);

  // Mobile touch look pad state
  const lookPadRef = useRef<HTMLDivElement>(null);
  const lookTouchId = useRef<number | null>(null);
  const lastLookTouch = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // Auto-dismiss guide after 7 seconds if user moves
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      setShowGuide(false);
    }, 9000);
    return () => clearTimeout(timer);
  }, [active]);

  // Touch joystick handlers
  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    if (joystickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;
    setIsJoystickActive(true);
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        setIsJoystickActive(false);
        setJoystickThumbPos({ x: 0, y: 0 });
        onMobileInputChange?.({
          joystickX: 0,
          joystickY: 0,
          touchLookX: 0,
          touchLookY: 0,
        });
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }

    setJoystickThumbPos({ x: dx, y: dy });

    const normalizedX = dx / maxRadius;
    const normalizedY = dy / maxRadius;

    onMobileInputChange?.({
      joystickX: normalizedX,
      joystickY: normalizedY,
      touchLookX: 0,
      touchLookY: 0,
    });
  };

  // Touch look pad handlers
  const handleLookTouchStart = (e: React.TouchEvent) => {
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lastLookTouch.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchId.current) {
        const dx = touch.clientX - lastLookTouch.current.x;
        const dy = touch.clientY - lastLookTouch.current.y;
        lastLookTouch.current = { x: touch.clientX, y: touch.clientY };

        onMobileInputChange?.({
          joystickX: joystickThumbPos.x / 40,
          joystickY: joystickThumbPos.y / 40,
          touchLookX: dx * 0.15,
          touchLookY: dy * 0.15,
        });
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        onMobileInputChange?.({
          joystickX: joystickThumbPos.x / 40,
          joystickY: joystickThumbPos.y / 40,
          touchLookX: 0,
          touchLookY: 0,
        });
        break;
      }
    }
  };

  if (!active) return null;

  // Filter rooms for current floor or all floors
  const availableRooms = geometry.floors.filter(
    (f) => f.level === currentFloorLevel && f.type !== "hallway"
  );

  return (
    <div className="walkthrough-overlay">
      {/* ── Top Bar HUD ── */}
      <div className="walkthrough-topbar">
        {/* Left: Location indicator */}
        <div className="walkthrough-location-pill">
          <span className="walkthrough-pulse-dot" />
          <div className="walkthrough-loc-text">
            <span className="walkthrough-loc-room">{currentRoomName || "Inside House"}</span>
            <span className="walkthrough-loc-floor"> · {floorName(currentFloorLevel)}</span>
          </div>
        </div>

        {/* Center: Destination Quick Jump Dropdown */}
        <div className="walkthrough-room-dropdown-container">
          <button
            type="button"
            className="walkthrough-btn secondary"
            onClick={() => setRoomDropdownOpen((v) => !v)}
            title="Teleport to any room"
          >
            <Navigation size={13} style={{ color: "#5146A5" }} />
            <span>Go to Room</span>
            <ChevronDown size={12} />
          </button>

          {roomDropdownOpen && (
            <div className="walkthrough-dropdown-menu">
              <div className="walkthrough-dropdown-head">Teleport to Destination</div>
              <div className="walkthrough-dropdown-list">
                {availableRooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="walkthrough-dropdown-item"
                    onClick={() => {
                      onSelectRoom(r.id);
                      setRoomDropdownOpen(false);
                    }}
                  >
                    <span>{r.name}</span>
                    <span className="walkthrough-dropdown-meta">
                      {Math.round(r.width)}×{Math.round(r.depth)} ft
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floor Switcher */}
        {geometry.levelCount > 1 && (
          <div className="walkthrough-floor-switcher">
            <span className="walkthrough-floor-icon">
              <Layers size={12} />
            </span>
            {Array.from({ length: geometry.levelCount }, (_, i) => i).map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`walkthrough-floor-btn${lvl === currentFloorLevel ? " active" : ""}`}
                onClick={() => onSelectFloor(lvl)}
                title={`Climb to ${floorName(lvl)}`}
              >
                {lvl === 0 ? "Ground" : `Floor ${lvl}`}
              </button>
            ))}
          </div>
        )}

        {/* Right Action Buttons */}
        <div className="walkthrough-topbar-actions">
          {/* First / Third Person Switcher */}
          <button
            type="button"
            className={`walkthrough-btn${isFirstPerson ? " active" : ""}`}
            onClick={onToggleFirstPerson}
            title={isFirstPerson ? "Switch to 3rd-Person character view (Key 3)" : "Switch to 1st-Person eye level view (Key 1)"}
          >
            {isFirstPerson ? <User size={14} /> : <Eye size={14} />}
            <span>{isFirstPerson ? "3rd Person" : "1st Person"}</span>
          </button>

          {/* Reset position button */}
          <button
            type="button"
            className="walkthrough-icon-btn"
            onClick={onResetPosition}
            title="Reset position to main living room (Key R)"
          >
            <RotateCcw size={14} />
          </button>

          {/* Toggle Help Card */}
          <button
            type="button"
            className={`walkthrough-icon-btn${showGuide ? " active" : ""}`}
            onClick={() => setShowGuide((v) => !v)}
            title="Toggle Controls Guide"
          >
            <HelpCircle size={14} />
          </button>

          {/* Exit Walkthrough */}
          <button
            type="button"
            className="walkthrough-btn danger"
            onClick={onExit}
            title="Exit Walkthrough and return to 3D Editor (ESC)"
          >
            <X size={14} style={{ marginRight: 4 }} />
            <span>Exit Walk</span>
            <kbd className="walkthrough-kbd">ESC</kbd>
          </button>
        </div>
      </div>

      {/* ── Controls Guide Card (Floating) ── */}
      {showGuide && (
        <div className="walkthrough-guide-card">
          <div className="walkthrough-guide-header">
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Footprints size={15} style={{ color: "#5146A5" }} />
              <strong>Interactive 3D Walkthrough</strong>
            </div>
            <button
              type="button"
              className="walkthrough-guide-close"
              onClick={() => setShowGuide(false)}
            >
              <X size={13} />
            </button>
          </div>

          <div className="walkthrough-guide-body">
            <div className="walkthrough-guide-row">
              <span className="walkthrough-key-badge">W A S D</span>
              <span>or Arrow keys to walk through rooms</span>
            </div>
            <div className="walkthrough-guide-row">
              <span className="walkthrough-key-badge">Mouse Drag</span>
              <span>or Click & Look 360° around</span>
            </div>
            <div className="walkthrough-guide-row">
              <span className="walkthrough-key-badge">Shift</span>
              <span>Hold to sprint / run</span>
            </div>
            <div className="walkthrough-guide-row">
              <span className="walkthrough-key-badge">1 / 3</span>
              <span>Switch between First Person & Third Person</span>
            </div>
            <div className="walkthrough-guide-row">
              <span className="walkthrough-key-badge">Stairs</span>
              <span>Walk onto stairs to smoothly climb floors</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Touch Controls for Mobile / Tablets ── */}
      {isTouchDevice && (
        <>
          {/* Virtual Joystick (Bottom Left) */}
          <div
            ref={joystickBaseRef}
            className={`walkthrough-touch-joystick${isJoystickActive ? " active" : ""}`}
            onTouchStart={handleJoystickTouchStart}
            onTouchMove={handleJoystickTouchMove}
            onTouchEnd={handleJoystickTouchEnd}
            onTouchCancel={handleJoystickTouchEnd}
          >
            <div
              className="walkthrough-joystick-thumb"
              style={{
                transform: `translate(${joystickThumbPos.x}px, ${joystickThumbPos.y}px)`,
              }}
            />
            <span className="walkthrough-joystick-label">Move</span>
          </div>

          {/* Touch Look Area (Bottom Right) */}
          <div
            ref={lookPadRef}
            className="walkthrough-touch-lookpad"
            onTouchStart={handleLookTouchStart}
            onTouchMove={handleLookTouchMove}
            onTouchEnd={handleLookTouchEnd}
            onTouchCancel={handleLookTouchEnd}
          >
            <div className="walkthrough-lookpad-hint">
              <Compass size={16} />
              <span>Drag to Look</span>
            </div>
          </div>
        </>
      )}

      {/* Bottom Center Prompt Bar */}
      <div className="walkthrough-bottom-prompt">
        <div className="walkthrough-prompt-chip">
          <Footprints size={12} />
          <span>Walk through doorways & climb stairs between floors</span>
        </div>
      </div>
    </div>
  );
}
