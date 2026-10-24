"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Compass,
  Info,
  Maximize2,
  Minimize2,
  RotateCw,
  Sun,
  SunMedium,
  Wind,
  X,
  CheckCircle2,
  Sparkles,
  Building2,
  Calendar,
  Clock,
  MapPin,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  Flame,
  Droplets,
  Mountain,
} from "lucide-react";
import type { FloorPlan, RoomType } from "@houseplan/design-schema";
import {
  SITE_PRESETS,
  DEFAULT_OBSTRUCTIONS,
  type SiteLocation,
  type SiteObstructions,
  type ObstructionHeight,
  type VastuZone,
  performArchitecturalAnalysis,
  calculateSolarPosition,
  getDayOfYear,
} from "@/lib/architectural-analysis";

export function ArchitecturalAnalysisModal({
  isOpen,
  onClose,
  plan,
  onUpdateSunPosition,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: FloorPlan;
  onUpdateSunPosition?: (sunPos: [number, number, number]) => void;
}) {
  const [activeTab, setActiveTab] = useState<"sunlight" | "ventilation" | "vastu" | "site">("sunlight");
  const [selectedCity, setSelectedCity] = useState<string>("New Delhi");
  const [customLat, setCustomLat] = useState<number>(28.6139);
  const [customLong, setCustomLong] = useState<number>(77.209);
  const [northAngle, setNorthAngle] = useState<number>(0);
  const [month, setMonth] = useState<number>(3); // March (Equinox)
  const [day, setDay] = useState<number>(21);
  const [solarHour, setSolarHour] = useState<number>(11.5); // 11:30 AM
  const [vastuEnabled, setVastuEnabled] = useState<boolean>(true);
  const [obstructions, setObstructions] = useState<SiteObstructions>(DEFAULT_OBSTRUCTIONS);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const currentLocation: SiteLocation = useMemo(() => {
    const preset = SITE_PRESETS.find((c) => c.city === selectedCity);
    if (preset) return preset;
    return {
      city: "Custom Location",
      country: "",
      latitude: customLat,
      longitude: customLong,
      timezoneOffset: 5.5,
    };
  }, [selectedCity, customLat, customLong]);

  const report = useMemo(() => {
    return performArchitecturalAnalysis(plan, {
      location: currentLocation,
      northAngleDeg: northAngle,
      month,
      day,
      solarHour,
      obstructions,
      vastuEnabled,
    });
  }, [plan, currentLocation, northAngle, month, day, solarHour, obstructions, vastuEnabled]);

  // Sync 3D sun position if callback provided
  useMemo(() => {
    if (onUpdateSunPosition && report?.sunlight?.sunPosition) {
      onUpdateSunPosition(report.sunlight.sunPosition.vector3D);
    }
  }, [report, onUpdateSunPosition]);

  if (!isOpen) return null;

  const sun = report.sunlight.sunPosition;
  const hourInt = Math.floor(solarHour);
  const minuteInt = Math.round((solarHour - hourInt) * 60);
  const timeFormatted = `${hourInt % 12 || 12}:${minuteInt < 10 ? "0" : ""}${minuteInt} ${solarHour >= 12 ? "PM" : "AM"}`;

  const setSeason = (m: number, d: number) => {
    setMonth(m);
    setDay(d);
  };

  const setNorthPreset = (angle: number) => {
    setNorthAngle(angle);
  };

  return (
    <div className="nexora-modal-overlay">
      <div className="nexora-modal-card" style={{ maxWidth: 940, maxHeight: "90vh" }}>
        {/* Header */}
        <div className="nexora-modal-header" style={{ padding: "16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEF3C7",
                color: "#D97706",
                display: "grid",
                placeItems: "center",
              }}
            >
              <SunMedium size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "#241E5C" }}>
                Smart Sunlight, Ventilation & Vastu Assistant
              </h3>
              <p style={{ margin: 0, fontSize: 11.5, color: "#797395" }}>
                Passive architectural analysis based on plot orientation, solar geometry, windows & room layouts
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} title="Close Assistant">
            <X size={16} />
          </button>
        </div>

        {/* Quick Orientation & Context Strip */}
        <div
          style={{
            background: "#FAF9FD",
            borderBottom: "1px solid #ECE7F5",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={14} color="#5146A5" />
            <span style={{ fontWeight: 600, color: "#241E5C" }}>{currentLocation.city}</span>
            <span style={{ color: "#8E88A8" }}>({currentLocation.latitude.toFixed(1)}°N)</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Compass size={14} color="#D97706" />
            <span style={{ fontWeight: 600, color: "#241E5C" }}>
              North: {northAngle}° ({northAngle === 0 ? "True North Up" : `${northAngle}° Clockwise`})
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={14} color="#2563EB" />
            <span style={{ fontWeight: 600, color: "#241E5C" }}>
              {report.site.dateDescription} · {timeFormatted}
            </span>
            <span
              style={{
                fontSize: 10.5,
                padding: "2px 6px",
                borderRadius: 4,
                background: sun.isDaytime ? "#DCFCE7" : "#F3F4F6",
                color: sun.isDaytime ? "#166534" : "#6B7280",
                fontWeight: 700,
              }}
            >
              {sun.isDaytime ? `Alt ${sun.altitudeDeg}° · Az ${sun.azimuthDeg}°` : "Nighttime"}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: "8px 24px 0",
            borderBottom: "1px solid #ECE7F5",
            background: "#FFFFFF",
          }}
        >
          <button
            className={`floor-tab${activeTab === "sunlight" ? " active" : ""}`}
            style={{ borderRadius: "8px 8px 0 0", height: 38 }}
            onClick={() => setActiveTab("sunlight")}
          >
            <Sun size={14} style={{ marginRight: 6 }} /> Sunlight & Daylight
            <small style={{ marginLeft: 4 }}>{report.sunlight.overallScore}% score</small>
          </button>

          <button
            className={`floor-tab${activeTab === "ventilation" ? " active" : ""}`}
            style={{ borderRadius: "8px 8px 0 0", height: 38 }}
            onClick={() => setActiveTab("ventilation")}
          >
            <Wind size={14} style={{ marginRight: 6 }} /> Ventilation & Airflow
            <small style={{ marginLeft: 4 }}>{report.ventilation.overallScore}% score</small>
          </button>

          <button
            className={`floor-tab${activeTab === "vastu" ? " active" : ""}`}
            style={{ borderRadius: "8px 8px 0 0", height: 38 }}
            onClick={() => setActiveTab("vastu")}
          >
            <Sparkles size={14} style={{ marginRight: 6, color: vastuEnabled ? "#D97706" : "#A0A0A0" }} />
            Vastu Assistant
            <small style={{ marginLeft: 4 }}>{vastuEnabled ? `${report.vastu.overallScore}%` : "Off"}</small>
          </button>

          <button
            className={`floor-tab${activeTab === "site" ? " active" : ""}`}
            style={{ borderRadius: "8px 8px 0 0", height: 38 }}
            onClick={() => setActiveTab("site")}
          >
            <Building2 size={14} style={{ marginRight: 6 }} /> Plot & Obstructions
          </button>
        </div>

        {/* Tab Body */}
        <div className="nexora-modal-body" style={{ padding: "20px 24px" }}>
          {/* ──────────────────────────────────────────────────────────
              TAB 1: SUNLIGHT ANALYSIS
             ────────────────────────────────────────────────────────── */}
          {activeTab === "sunlight" && (
            <div>
              {/* Solar Time Scrubber */}
              <div
                style={{
                  background: "#FAF9FD",
                  border: "1px solid #E6E1F2",
                  borderRadius: 12,
                  padding: "16px 20px",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#241E5C" }}>Solar Path Time Scrubber</span>
                    <span style={{ fontSize: 11.5, color: "#797395", marginLeft: 8 }}>
                      Slide to inspect sun angle, live direct sunlight, and shadow orientations
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="chip-btn"
                      onClick={() => setSeason(3, 21)}
                      style={{ background: month === 3 ? "#E0E7FF" : undefined, color: month === 3 ? "#3730A3" : undefined }}
                    >
                      Spring Equinox (Mar 21)
                    </button>
                    <button
                      className="chip-btn"
                      onClick={() => setSeason(6, 21)}
                      style={{ background: month === 6 ? "#FEF3C7" : undefined, color: month === 6 ? "#92400E" : undefined }}
                    >
                      Summer Solstice (Jun 21)
                    </button>
                    <button
                      className="chip-btn"
                      onClick={() => setSeason(12, 21)}
                      style={{ background: month === 12 ? "#E0F2FE" : undefined, color: month === 12 ? "#075985" : undefined }}
                    >
                      Winter Solstice (Dec 21)
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>6:00 AM</span>
                  <input
                    type="range"
                    min="6"
                    max="18"
                    step="0.25"
                    value={solarHour}
                    onChange={(e) => setSolarHour(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "#D97706", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>6:00 PM</span>
                  <div
                    style={{
                      minWidth: 100,
                      textAlign: "center",
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "#FFFFFF",
                      border: "1px solid #D97706",
                      fontWeight: 800,
                      fontSize: 13,
                      color: "#92400E",
                    }}
                  >
                    {timeFormatted}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#797395" }}>
                  <span>Sunrise: ~{Math.floor(sun.sunriseHour)}:00 AM</span>
                  <span>Solar Noon: 12:00 PM (Highest Sun)</span>
                  <span>Sunset: ~{Math.floor(sun.sunsetHour)}:00 PM</span>
                </div>
              </div>

              {/* Overall Daylight Metric Banner */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>
                    Daylight Score
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#15803D", margin: "4px 0" }}>
                    {report.sunlight.overallScore}%
                  </div>
                  <div style={{ fontSize: 11, color: "#166534" }}>
                    {report.sunlight.wellLitRoomsCount} of {report.sunlight.rooms.length} rooms well-illuminated
                  </div>
                </div>

                <div style={{ background: "#FEFCE8", border: "1px solid #FEF08A", padding: "14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#854D0E", fontWeight: 700, textTransform: "uppercase" }}>
                    Average Sun Hours
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#A16207", margin: "4px 0" }}>
                    {report.sunlight.averageSunHours} hrs
                  </div>
                  <div style={{ fontSize: 11, color: "#854D0E" }}>Estimated direct daily sunlight</div>
                </div>

                <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#1E40AF", fontWeight: 700, textTransform: "uppercase" }}>
                    Sun Angle & Compass
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1D4ED8", margin: "8px 0" }}>
                    Alt {sun.altitudeDeg}° · Az {sun.azimuthDeg}°
                  </div>
                  <div style={{ fontSize: 11, color: "#1E40AF" }}>
                    {solarHour < 12 ? "Morning Sun (East)" : solarHour < 14 ? "Midday High Sun" : "Afternoon Sun (West)"}
                  </div>
                </div>
              </div>

              {/* Room by Room Sunlight Cards */}
              <h4 style={{ margin: "0 0 10px", color: "#241E5C" }}>Room-by-Room Daylight Exposure</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                {report.sunlight.rooms.map((room) => {
                  return (
                    <div
                      key={room.roomId}
                      className="version-item-card"
                      style={{
                        flexDirection: "column",
                        alignItems: "stretch",
                        borderColor: selectedRoomId === room.roomId ? "#5146A5" : undefined,
                      }}
                      onClick={() => setSelectedRoomId(room.roomId)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#241E5C" }}>{room.roomName}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 6,
                            background:
                              room.daylightRating === "Excellent"
                                ? "#DCFCE7"
                                : room.daylightRating === "Good"
                                ? "#FEF9C3"
                                : room.daylightRating === "Moderate"
                                ? "#E0E7FF"
                                : "#FEE2E2",
                            color:
                              room.daylightRating === "Excellent"
                                ? "#166534"
                                : room.daylightRating === "Good"
                                ? "#854D0E"
                                : room.daylightRating === "Moderate"
                                ? "#3730A3"
                                : "#991B1B",
                          }}
                        >
                          {room.daylightRating} Daylight
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: "#47406E", marginBottom: 6 }}>
                        <span>☀️ ~{room.directSunHours} hrs direct sun/day</span>
                        <span style={{ margin: "0 6px" }}>·</span>
                        <span>{room.exteriorWindowsCount} window{room.exteriorWindowsCount === 1 ? "" : "s"} ({room.totalWindowWidth} {plan.units})</span>
                      </div>

                      {/* Orientation chips */}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                        {room.cardinalOrientations.map((dir) => (
                          <span
                            key={dir}
                            style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: dir.includes("East")
                                ? "#FEF3C7"
                                : dir.includes("South")
                                ? "#FEE2E2"
                                : dir.includes("West")
                                ? "#FFEDD5"
                                : "#E0E7FF",
                              color: "#302A65",
                              fontWeight: 600,
                            }}
                          >
                            Faces {dir}
                          </span>
                        ))}
                        {room.glareRisk === "High" && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "#FEE2E2",
                              color: "#991B1B",
                              fontWeight: 700,
                            }}
                          >
                            ⚠️ Afternoon Glare Risk
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 10.5, color: "#797395", fontStyle: "italic" }}>
                        {room.notes.join(" ")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Daylight Engineering Simulation Disclaimer */}
              <div
                style={{
                  marginTop: 18,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  fontSize: 11,
                  color: "#6B7280",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: "#9CA3AF" }} />
                <span>
                  <strong>Architectural Simulation Notice:</strong> Daylight calculations are geometric estimations
                  based on solar azimuth/altitude, wall orientations, and configured openings. For certified green
                  building compliance (e.g. LEED / IGBC daylight factor), validated Radiance engineering analysis is
                  recommended.
                </span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              TAB 2: VENTILATION ANALYSIS
             ────────────────────────────────────────────────────────── */}
          {activeTab === "ventilation" && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: "#F0FDFA", border: "1px solid #99F6E4", padding: "14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#115E59", fontWeight: 700, textTransform: "uppercase" }}>
                    Ventilation Index
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#0F766E", margin: "4px 0" }}>
                    {report.ventilation.overallScore}%
                  </div>
                  <div style={{ fontSize: 11, color: "#115E59" }}>
                    {report.ventilation.crossVentilatedRoomsCount} cross-ventilated spaces
                  </div>
                </div>

                <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#1E40AF", fontWeight: 700, textTransform: "uppercase" }}>
                    Passive Cross-Breeze
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#1D4ED8", margin: "4px 0" }}>
                    {report.ventilation.crossVentilatedRoomsCount} Rooms
                  </div>
                  <div style={{ fontSize: 11, color: "#1E40AF" }}>Equipped with dual-aspect openings</div>
                </div>

                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", padding: "14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#991B1B", fontWeight: 700, textTransform: "uppercase" }}>
                    Attention Needed
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#B91C1C", margin: "4px 0" }}>
                    {report.ventilation.stagnantRoomsCount} Rooms
                  </div>
                  <div style={{ fontSize: 11, color: "#991B1B" }}>Limited or single-sided air exchange</div>
                </div>
              </div>

              {/* Actionable Suggestions Callout */}
              {report.ventilation.actionableSuggestions.length > 0 && (
                <div
                  style={{
                    background: "#FEF9C3",
                    border: "1px solid #FDE047",
                    borderRadius: 10,
                    padding: "14px 18px",
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#713F12", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Sparkles size={15} /> Actionable Ventilation Improvements
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#854D0E" }}>
                    {report.ventilation.actionableSuggestions.map((s, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>
                        <strong>{s.roomName}:</strong> {s.suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Room Airflow Pathways */}
              <h4 style={{ margin: "0 0 10px", color: "#241E5C" }}>Room Airflow Pathways</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                {report.ventilation.rooms.map((room) => (
                  <div key={room.roomId} className="version-item-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#241E5C" }}>{room.roomName}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: 6,
                          background: room.crossVentilation ? "#CCFBF1" : room.hasExteriorOpenings ? "#FEF9C3" : "#FEE2E2",
                          color: room.crossVentilation ? "#0F766E" : room.hasExteriorOpenings ? "#854D0E" : "#991B1B",
                        }}
                      >
                        {room.ventilationType}
                      </span>
                    </div>

                    <p style={{ margin: "4px 0 8px", fontSize: 11.5, color: "#47406E", lineHeight: 1.4 }}>
                      {room.airFlowPathDescription}
                    </p>

                    {room.suggestions.length > 0 && (
                      <div style={{ fontSize: 11, color: "#854D0E", background: "#FEFCE8", padding: "6px 8px", borderRadius: 6 }}>
                        💡 {room.suggestions.join(" ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Scientific Disclaimer */}
              <div
                style={{
                  marginTop: 18,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  fontSize: 11,
                  color: "#6B7280",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: "#9CA3AF" }} />
                <span>
                  <strong>Ventilation Analysis Note:</strong> Actual indoor airflow depends on prevailing wind velocity,
                  pressure gradients, window opening percentages, temperature differentials (stack effect), and site microclimate.
                  Analysis represents passive potential from opening distribution.
                </span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              TAB 3: VASTU ASSISTANT (OPTIONAL)
             ────────────────────────────────────────────────────────── */}
          {activeTab === "vastu" && (
            <div>
              {/* Toggle switch for Vastu */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#FAF9FD",
                  border: "1px solid #E6E1F2",
                  borderRadius: 10,
                  padding: "12px 18px",
                  marginBottom: 18,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#241E5C" }}>
                    Vastu Shastra Recommendations Mode
                  </div>
                  <div style={{ fontSize: 11.5, color: "#797395" }}>
                    Enable traditional directional guidance for room positioning and energy zones
                  </div>
                </div>
                <label className="grid-toggle" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={vastuEnabled}
                    onChange={(e) => setVastuEnabled(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontWeight: 700, color: vastuEnabled ? "#D97706" : "#84809A" }}>
                    {vastuEnabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              {!vastuEnabled ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#84809A" }}>
                  <Sparkles size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                  <h4 style={{ margin: "0 0 6px", color: "#47406E" }}>Vastu Guidance is Turned Off</h4>
                  <p style={{ fontSize: 12, maxWidth: 420, margin: "0 auto" }}>
                    Daylight and ventilation simulations remain fully active without traditional directional rules.
                    You can toggle Vastu on at any time using the switch above.
                  </p>
                </div>
              ) : (
                <>
                  {/* Score & Summary */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#FFFBEB",
                      border: "1px solid #FCD34D",
                      borderRadius: 10,
                      padding: "14px 20px",
                      marginBottom: 18,
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309", textTransform: "uppercase" }}>
                        Vastu Alignment Score
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#92400E" }}>
                        {report.vastu.overallScore}% Favorable
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#78350F", maxWidth: 440 }}>
                      Evaluated relative to building orientation ({northAngle}° North). Identifies traditional placement
                      strengths and non-invasive architectural remedies.
                    </div>
                  </div>

                  {/* Room evaluation grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                    {report.vastu.rooms.map((room) => (
                      <div key={room.roomId} className="version-item-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#241E5C" }}>{room.roomName}</span>
                            <span style={{ fontSize: 11, color: "#797395", marginLeft: 6 }}>({room.zone} Zone)</span>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 7px",
                              borderRadius: 6,
                              background:
                                room.suitability === "Favorable"
                                  ? "#DCFCE7"
                                  : room.suitability === "Neutral"
                                  ? "#FEF9C3"
                                  : "#FEE2E2",
                              color:
                                room.suitability === "Favorable"
                                  ? "#166534"
                                  : room.suitability === "Neutral"
                                  ? "#854D0E"
                                  : "#991B1B",
                            }}
                          >
                            {room.suitability} ({room.rating}%)
                          </span>
                        </div>

                        <div style={{ fontSize: 11, color: "#5146A5", fontWeight: 600, marginBottom: 4 }}>
                          Element: {room.element}
                        </div>

                        <p style={{ margin: "2px 0 6px", fontSize: 11.5, color: "#47406E", lineHeight: 1.4 }}>
                          {room.recommendation}
                        </p>

                        {room.remedy && (
                          <div style={{ fontSize: 11, color: "#92400E", background: "#FEF3C7", padding: "6px 8px", borderRadius: 6, marginTop: 4 }}>
                            🌿 {room.remedy}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Vastu Traditional Disclaimer */}
                  <div
                    style={{
                      marginTop: 18,
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      fontSize: 11,
                      color: "#6B7280",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: "#9CA3AF" }} />
                    <span>
                      <strong>Traditional Cultural Disclaimer:</strong> Vastu Shastra suggestions are optional and
                      informational. NEXORA strictly separates cultural spatial principles from structural engineering,
                      building codes, and scientific daylight simulations. No structural elements are altered automatically.
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              TAB 4: SITE & OBSTRUCTIONS
             ────────────────────────────────────────────────────────── */}
          {activeTab === "site" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                {/* Compass & North Direction Control */}
                <div style={{ background: "#FAF9FD", border: "1px solid #E6E1F2", borderRadius: 12, padding: "16px" }}>
                  <h4 style={{ margin: "0 0 8px", color: "#241E5C", display: "flex", alignItems: "center", gap: 6 }}>
                    <Compass size={16} color="#D97706" /> North Orientation Angle
                  </h4>
                  <p style={{ fontSize: 11.5, color: "#797395", margin: "0 0 14px" }}>
                    Set your plot&apos;s true North heading relative to the top of the canvas
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                    {/* Compass dial graphic */}
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        border: "2px solid #5146A5",
                        position: "relative",
                        background: "#FFFFFF",
                        boxShadow: "0 2px 8px rgba(81, 70, 165, 0.15)",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          transform: `rotate(${northAngle}deg)`,
                          transition: "transform 0.1s ease",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 4,
                            left: "calc(50% - 3px)",
                            width: 6,
                            height: 28,
                            background: "#DC2626",
                            clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: 4,
                            left: "calc(50% - 3px)",
                            width: 6,
                            height: 28,
                            background: "#4B5563",
                            clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)",
                          }}
                        />
                      </div>
                      <span style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, color: "#DC2626" }}>N</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#241E5C" }}>
                        Angle: {northAngle}°
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="359"
                        value={northAngle}
                        onChange={(e) => setNorthAngle(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#5146A5", margin: "8px 0" }}
                      />
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button className="chip-btn" onClick={() => setNorthPreset(0)}>0° (North Up)</button>
                        <button className="chip-btn" onClick={() => setNorthPreset(90)}>90° (East Up)</button>
                        <button className="chip-btn" onClick={() => setNorthPreset(180)}>180° (South Up)</button>
                        <button className="chip-btn" onClick={() => setNorthPreset(270)}>270° (West Up)</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* City Location */}
                <div style={{ background: "#FAF9FD", border: "1px solid #E6E1F2", borderRadius: 12, padding: "16px" }}>
                  <h4 style={{ margin: "0 0 8px", color: "#241E5C", display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={16} color="#5146A5" /> Geographic Location
                  </h4>
                  <p style={{ fontSize: 11.5, color: "#797395", margin: "0 0 14px" }}>
                    Determines solar altitude, day length, and local solar trajectory
                  </p>

                  <label style={{ fontSize: 11.5, color: "#47406E", fontWeight: 700 }}>
                    Select City Preset
                    <select
                      className="field"
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      style={{ marginTop: 4 }}
                    >
                      {SITE_PRESETS.map((p) => (
                        <option key={p.city} value={p.city}>
                          {p.city}, {p.country} ({p.latitude.toFixed(1)}°N)
                        </option>
                      ))}
                      <option value="Custom">Custom Coordinates</option>
                    </select>
                  </label>

                  {selectedCity === "Custom" && (
                    <div className="dual-field" style={{ marginTop: 8 }}>
                      <label style={{ fontSize: 11.5 }}>
                        Latitude (°N)
                        <input
                          className="field"
                          type="number"
                          step="0.01"
                          value={customLat}
                          onChange={(e) => setCustomLat(Number(e.target.value))}
                        />
                      </label>
                      <label style={{ fontSize: 11.5 }}>
                        Longitude (°E)
                        <input
                          className="field"
                          type="number"
                          step="0.01"
                          value={customLong}
                          onChange={(e) => setCustomLong(Number(e.target.value))}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Neighboring Obstructions */}
              <div style={{ background: "#FAF9FD", border: "1px solid #E6E1F2", borderRadius: 12, padding: "16px" }}>
                <h4 style={{ margin: "0 0 8px", color: "#241E5C", display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={16} color="#3B82F6" /> Nearby Obstructions & Shading
                </h4>
                <p style={{ fontSize: 11.5, color: "#797395", margin: "0 0 14px" }}>
                  Configure neighboring building heights to account for blocked morning/afternoon sunlight
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {(["north", "east", "south", "west"] as const).map((dir) => (
                    <div key={dir} style={{ background: "#FFFFFF", padding: "10px", borderRadius: 8, border: "1px solid #E5E0F0" }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: "#241E5C", textTransform: "capitalize" }}>
                        {dir} Boundary
                      </label>
                      <select
                        className="field"
                        value={obstructions[dir].height}
                        onChange={(e) =>
                          setObstructions((prev) => ({
                            ...prev,
                            [dir]: { ...prev[dir], height: e.target.value as ObstructionHeight },
                          }))
                        }
                        style={{ margin: "4px 0 0", padding: "6px" }}
                      >
                        <option value="none">No Obstruction (Open)</option>
                        <option value="low">Low (1-2 floors / 15 ft)</option>
                        <option value="medium">Medium (3-4 floors / 35 ft)</option>
                        <option value="tall">Tall High-Rise (6+ floors)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="nexora-modal-footer">
          <button className="button primary" onClick={onClose}>
            Apply & Close Assistant
          </button>
        </div>
      </div>
    </div>
  );
}
