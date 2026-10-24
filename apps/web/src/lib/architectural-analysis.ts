import type { FloorPlan, Room, RoomType, Wall, Opening } from "@houseplan/design-schema";
import { distance, polygonArea } from "./geometry";

// ── City & Location Presets ────────────────────────────────────
export type SiteLocation = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffset: number; // UTC offset in hours
};

export const SITE_PRESETS: SiteLocation[] = [
  { city: "New Delhi",   country: "India",       latitude: 28.6139,  longitude: 77.2090,  timezoneOffset: 5.5 },
  { city: "Mumbai",      country: "India",       latitude: 19.0760,  longitude: 72.8777,  timezoneOffset: 5.5 },
  { city: "Bengaluru",   country: "India",       latitude: 12.9716,  longitude: 77.5946,  timezoneOffset: 5.5 },
  { city: "Chennai",     country: "India",       latitude: 13.0827,  longitude: 80.2707,  timezoneOffset: 5.5 },
  { city: "Kolkata",     country: "India",       latitude: 22.5726,  longitude: 88.3639,  timezoneOffset: 5.5 },
  { city: "Hyderabad",   country: "India",       latitude: 17.3850,  longitude: 78.4867,  timezoneOffset: 5.5 },
  { city: "Ahmedabad",   country: "India",       latitude: 23.0225,  longitude: 72.5714,  timezoneOffset: 5.5 },
  { city: "Dubai",       country: "UAE",         latitude: 25.2048,  longitude: 55.2708,  timezoneOffset: 4.0 },
  { city: "London",      country: "UK",          latitude: 51.5074,  longitude: -0.1278,  timezoneOffset: 0.0 },
  { city: "New York",    country: "USA",         latitude: 40.7128,  longitude: -74.0060, timezoneOffset: -5.0 },
  { city: "San Francisco", country: "USA",       latitude: 37.7749,  longitude: -122.4194, timezoneOffset: -8.0 },
  { city: "Singapore",   country: "Singapore",   latitude: 1.3521,   longitude: 103.8198, timezoneOffset: 8.0 },
  { city: "Sydney",      country: "Australia",   latitude: -33.8688, longitude: 151.2093, timezoneOffset: 10.0 },
  { city: "Tokyo",       country: "Japan",       latitude: 35.6762,  longitude: 139.6503, timezoneOffset: 9.0 },
];

export type ObstructionHeight = "none" | "low" | "medium" | "tall";

export type SiteObstructions = {
  north: { height: ObstructionHeight; setback: number }; // setback in plan units
  east:  { height: ObstructionHeight; setback: number };
  south: { height: ObstructionHeight; setback: number };
  west:  { height: ObstructionHeight; setback: number };
};

export const DEFAULT_OBSTRUCTIONS: SiteObstructions = {
  north: { height: "none", setback: 15 },
  east:  { height: "none", setback: 15 },
  south: { height: "none", setback: 15 },
  west:  { height: "none", setback: 15 },
};

// ── Solar Geometry & Position ──────────────────────────────────
export type SolarPosition = {
  altitudeDeg: number;   // Sun height above horizon (0° = horizon, 90° = zenith)
  azimuthDeg: number;    // Compass heading from True North (0° = N, 90° = E, 180° = S, 270° = W)
  isDaytime: boolean;
  sunriseHour: number;
  sunsetHour: number;
  vector3D: [number, number, number]; // Three.js light vector [x, y, z] relative to building center
};

/**
 * Computes the solar altitude and azimuth using standard astronomical formulas.
 * @param latitude in decimal degrees
 * @param dayOfYear 1 to 365 (e.g. March 21 = ~80, June 21 = ~172, Dec 21 = ~355)
 * @param solarHour 0.0 to 24.0 (e.g. 14.5 = 2:30 PM)
 * @param northAngleDeg plot orientation relative to top of canvas (0° = top is North)
 */
export function calculateSolarPosition(
  latitude: number,
  dayOfYear: number,
  solarHour: number,
  northAngleDeg: number
): SolarPosition {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  // Solar declination (Cooper's equation)
  const declinationRad = 23.45 * rad * Math.sin(((360 / 365) * (dayOfYear - 81)) * rad);

  // Hour angle (15 degrees per hour from solar noon)
  const hourAngleRad = (solarHour - 12) * 15 * rad;
  const latRad = latitude * rad;

  // Solar altitude angle (sin alpha)
  const sinAltitude = Math.sin(latRad) * Math.sin(declinationRad) +
                      Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
  const altitudeRad = Math.asin(Math.max(-1, Math.min(1, sinAltitude)));
  const altitudeDeg = Math.max(0, altitudeRad * deg);

  // Approximate sunrise & sunset hour
  const cosSunriseH = -Math.tan(latRad) * Math.tan(declinationRad);
  const clampedCos = Math.max(-1, Math.min(1, cosSunriseH));
  const sunriseHourAngle = Math.acos(clampedCos) * deg;
  const sunriseHour = Math.max(5, Math.min(7, 12 - sunriseHourAngle / 15));
  const sunsetHour = Math.max(17, Math.min(19, 12 + sunriseHourAngle / 15));

  const isDaytime = solarHour >= sunriseHour && solarHour <= sunsetHour && altitudeDeg > 0.5;

  // Solar azimuth (from North clockwise 0..360)
  let azimuthDeg = 180;
  if (altitudeDeg > 0.1) {
    const cosAzimuth = (Math.sin(declinationRad) * Math.cos(latRad) -
                        Math.cos(declinationRad) * Math.sin(latRad) * Math.cos(hourAngleRad)) /
                        Math.max(0.01, Math.cos(altitudeRad));
    const clampedCosAz = Math.max(-1, Math.min(1, cosAzimuth));
    let az = Math.acos(clampedCosAz) * deg;
    if (solarHour > 12) {
      az = 360 - az;
    }
    azimuthDeg = (az + 360) % 360;
  } else {
    azimuthDeg = solarHour < 12 ? 90 : 270;
  }

  // Adjust relative to building north orientation:
  // In NEXORA 3D, plan X -> world X, plan Y -> world Z (positive Z is down/South by default when North is Up)
  const relativeAzimuthRad = (azimuthDeg - northAngleDeg) * rad;
  const altRad = Math.max(0.05, altitudeDeg * rad);

  // Inverted direction for light position: pointing from the sun to the building
  const lightDist = 80;
  const lx = lightDist * Math.cos(altRad) * Math.sin(relativeAzimuthRad);
  const ly = Math.max(5, lightDist * Math.sin(altRad));
  const lz = -lightDist * Math.cos(altRad) * Math.cos(relativeAzimuthRad);

  return {
    altitudeDeg: Math.round(altitudeDeg * 10) / 10,
    azimuthDeg: Math.round(azimuthDeg * 10) / 10,
    isDaytime,
    sunriseHour: Math.round(sunriseHour * 10) / 10,
    sunsetHour: Math.round(sunsetHour * 10) / 10,
    vector3D: [lx, ly, lz],
  };
}

// ── Day of Year Helper ─────────────────────────────────────────
export function getDayOfYear(month: number, day: number): number {
  const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let total = day;
  for (let i = 0; i < month - 1; i++) {
    total += daysInMonths[i];
  }
  return total;
}

// ── Room Sunlight & Daylight Exposure ──────────────────────────
export type RoomSunlightAnalysis = {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  levelIndex: number;
  exteriorWindowsCount: number;
  totalWindowWidth: number;
  cardinalOrientations: string[]; // e.g. ["East", "South"]
  directSunHours: number;        // Estimated daily direct sunlight hours
  daylightRating: "Excellent" | "Good" | "Moderate" | "Low";
  morningSun: boolean;
  afternoonSun: boolean;
  glareRisk: "Low" | "Moderate" | "High";
  daylightScore: number;         // 0 - 100
  notes: string[];
};

export type VentilationAnalysis = {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  levelIndex: number;
  hasExteriorOpenings: boolean;
  crossVentilation: boolean;
  openingWallsCount: number;     // Number of distinct walls with openings
  ventilationType: "Cross-Ventilation" | "Corner-Ventilation" | "Single-Sided" | "Stagnant / Enclosed";
  ventilationScore: number;      // 0 - 100
  airFlowPathDescription: string;
  suggestions: string[];
};

// ── Vastu Shastra Module ───────────────────────────────────────
export type VastuZone =
  | "North-East"  // Ishan (Water / Spirituality)
  | "East"        // Purva (Solar / Health)
  | "South-East"  // Agneya (Fire / Kitchen)
  | "South"       // Dakshin (Earth / Rest)
  | "South-West"  // Nairrutya (Earth / Master Bedroom / Stability)
  | "West"        // Pashchim (Water-Air / Dining / Children)
  | "North-West"  // Vayavya (Air / Guest / Utility / Bathroom)
  | "North"       // Uttar (Mercury-Kubera / Living / Wealth)
  | "Center";     // Brahmasthan (Ether / Open Courtyard)

export type RoomVastuEvaluation = {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  zone: VastuZone;
  element: string;
  suitability: "Favorable" | "Neutral" | "Challenging";
  rating: number; // 0 - 100
  recommendation: string;
  remedy?: string;
};

// ── Overall Analysis Report ───────────────────────────────────
export type ArchitecturalAnalysisReport = {
  site: {
    locationName: string;
    latitude: number;
    longitude: number;
    northAngleDeg: number;
    dateDescription: string;
    solarHour: number;
  };
  sunlight: {
    overallScore: number; // 0 - 100
    averageSunHours: number;
    sunPosition: SolarPosition;
    rooms: RoomSunlightAnalysis[];
    wellLitRoomsCount: number;
    lowLightRoomsCount: number;
  };
  ventilation: {
    overallScore: number; // 0 - 100
    crossVentilatedRoomsCount: number;
    stagnantRoomsCount: number;
    rooms: VentilationAnalysis[];
    actionableSuggestions: { roomId: string; roomName: string; suggestion: string }[];
  };
  vastu: {
    enabled: boolean;
    overallScore: number; // 0 - 100
    rooms: RoomVastuEvaluation[];
    zoneCounts: Record<VastuZone, number>;
    summaryNotes: string[];
  };
};

// ── Geometry & Edge Inspection Helpers ─────────────────────────
function boundsOfPolygon(polygon: [number, number][]) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Determine cardinal direction from an angle relative to True North (0 = N, 90 = E, 180 = S, 270 = W) */
export function angleToCardinal(angleDeg: number): string {
  const norm = ((angleDeg % 360) + 360) % 360;
  if (norm >= 337.5 || norm < 22.5) return "North";
  if (norm >= 22.5 && norm < 67.5) return "North-East";
  if (norm >= 67.5 && norm < 112.5) return "East";
  if (norm >= 112.5 && norm < 157.5) return "South-East";
  if (norm >= 157.5 && norm < 202.5) return "South";
  if (norm >= 202.5 && norm < 247.5) return "South-West";
  if (norm >= 247.5 && norm < 292.5) return "West";
  return "North-West";
}

/** Determines which Vastu zone a point (in plan coordinates) occupies relative to plot center and North orientation */
export function calculateVastuZone(
  point: [number, number],
  plotWidth: number,
  plotLength: number,
  northAngleDeg: number
): VastuZone {
  const cx = plotWidth / 2;
  const cy = plotLength / 2;
  const dx = point[0] - cx;
  const dy = point[1] - cy;
  const distFromCenter = Math.hypot(dx, dy);
  const maxSpan = Math.hypot(plotWidth, plotLength);

  // Center zone (Brahmasthan): inner 20% radius of the plot
  if (distFromCenter < maxSpan * 0.15) {
    return "Center";
  }

  // In plan coordinates: +X is right, +Y is down.
  // Standard plan angle: 0 = right (+X), 90 = down (+Y), 180 = left (-X), 270 = up (-Y).
  // When northAngleDeg = 0: top (-Y) is North.
  // So standard North vector in plan is [0, -1] (angle 270° in canvas math).
  const planAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 to 180
  // Bearing from North: angle from (0, -1) clockwise
  let bearingFromTop = (planAngleDeg + 90 + 360) % 360;
  // Account for rotated North
  let bearingFromTrueNorth = (bearingFromTop - northAngleDeg + 360) % 360;

  if (bearingFromTrueNorth >= 337.5 || bearingFromTrueNorth < 22.5) return "North";
  if (bearingFromTrueNorth >= 22.5 && bearingFromTrueNorth < 67.5) return "North-East";
  if (bearingFromTrueNorth >= 67.5 && bearingFromTrueNorth < 112.5) return "East";
  if (bearingFromTrueNorth >= 112.5 && bearingFromTrueNorth < 157.5) return "South-East";
  if (bearingFromTrueNorth >= 157.5 && bearingFromTrueNorth < 202.5) return "South";
  if (bearingFromTrueNorth >= 202.5 && bearingFromTrueNorth < 247.5) return "South-West";
  if (bearingFromTrueNorth >= 247.5 && bearingFromTrueNorth < 292.5) return "West";
  return "North-West";
}

// ── Core Analysis Implementation ───────────────────────────────
export function performArchitecturalAnalysis(
  plan: FloorPlan,
  options: {
    location?: SiteLocation;
    northAngleDeg?: number;
    month?: number;        // 1 - 12
    day?: number;          // 1 - 31
    solarHour?: number;    // 6.0 - 18.0
    obstructions?: SiteObstructions;
    vastuEnabled?: boolean;
  }
): ArchitecturalAnalysisReport {
  const location = options.location ?? SITE_PRESETS[0];
  const northAngle = options.northAngleDeg ?? 0;
  const month = options.month ?? 3;
  const day = options.day ?? 21;
  const solarHour = options.solarHour ?? 11.5;
  const obstructions = options.obstructions ?? DEFAULT_OBSTRUCTIONS;
  const vastuEnabled = options.vastuEnabled ?? true;

  const dayOfYear = getDayOfYear(month, day);
  const sunPos = calculateSolarPosition(location.latitude, dayOfYear, solarHour, northAngle);

  const sunlightRooms: RoomSunlightAnalysis[] = [];
  const ventilationRooms: VentilationAnalysis[] = [];
  const vastuRooms: RoomVastuEvaluation[] = [];

  const zoneCounts: Record<VastuZone, number> = {
    "North-East": 0,
    East: 0,
    "South-East": 0,
    South: 0,
    "South-West": 0,
    West: 0,
    "North-West": 0,
    North: 0,
    Center: 0,
  };

  plan.levels.forEach((level, levelIdx) => {
    const walls = level.walls ?? [];
    const openings = level.openings ?? [];

    level.rooms.forEach((room) => {
      const bounds = boundsOfPolygon(room.polygon as [number, number][]);
      const roomCenterX = (bounds.minX + bounds.maxX) / 2;
      const roomCenterY = (bounds.minY + bounds.maxY) / 2;

      // Identify which room walls have windows/openings
      const roomOpenings = openings.filter((o) => {
        const w = walls.find((wall) => wall.id === o.wallId);
        if (!w) return false;
        // Check if wall is within or adjacent to room bounds
        const midX = (w.start[0] + w.end[0]) / 2;
        const midY = (w.start[1] + w.end[1]) / 2;
        return (
          midX >= bounds.minX - 0.5 &&
          midX <= bounds.maxX + 0.5 &&
          midY >= bounds.minY - 0.5 &&
          midY <= bounds.maxY + 0.5
        );
      });

      const windows = roomOpenings.filter((o) => o.kind === "window");
      const doors = roomOpenings.filter((o) => o.kind === "door");
      const extWindowsCount = windows.length;
      const totalWindowWidth = windows.reduce((sum, w) => sum + w.width, 0);

      // Identify orientations of walls with windows
      const orientations = new Set<string>();
      windows.forEach((win) => {
        const host = walls.find((w) => w.id === win.wallId);
        if (!host) return;
        const isHorizontal = Math.abs(host.end[1] - host.start[1]) < 0.2;
        // Determine outward normal facing direction
        let normalAngleDeg = 0;
        if (isHorizontal) {
          // Top wall of room faces North in canvas (bearing 0 relative to canvas), bottom faces South
          normalAngleDeg = host.start[1] <= bounds.minY + 0.5 ? 0 : 180;
        } else {
          // Left wall faces West in canvas (bearing 270), right wall faces East (bearing 90)
          normalAngleDeg = host.start[0] <= bounds.minX + 0.5 ? 270 : 90;
        }
        // Offset by configured North orientation
        const trueBearing = (normalAngleDeg + northAngle + 360) % 360;
        orientations.add(angleToCardinal(trueBearing));
      });

      const cardinalList = Array.from(orientations);
      const hasEast = cardinalList.some((c) => c.includes("East"));
      const hasSouth = cardinalList.some((c) => c.includes("South"));
      const hasWest = cardinalList.some((c) => c.includes("West"));
      const hasNorth = cardinalList.some((c) => c.includes("North") && !c.includes("East") && !c.includes("West"));

      // Estimate direct sunlight hours
      let directHours = 0;
      if (hasEast) directHours += 3.5;
      if (hasSouth) directHours += 4.5;
      if (hasWest) directHours += 3.5;
      if (hasNorth) directHours += 1.0;
      if (extWindowsCount === 0) directHours = 0;

      // Obstruction reduction
      if (hasEast && obstructions.east.height !== "none") directHours = Math.max(1, directHours - (obstructions.east.height === "tall" ? 2.5 : 1.2));
      if (hasWest && obstructions.west.height !== "none") directHours = Math.max(1, directHours - (obstructions.west.height === "tall" ? 2.5 : 1.2));
      if (hasSouth && obstructions.south.height !== "none") directHours = Math.max(1, directHours - (obstructions.south.height === "tall" ? 3.0 : 1.5));

      directHours = Math.round(directHours * 10) / 10;

      let daylightRating: RoomSunlightAnalysis["daylightRating"] = "Low";
      let daylightScore = 20;
      if (directHours >= 5.0) {
        daylightRating = "Excellent";
        daylightScore = 95;
      } else if (directHours >= 3.0) {
        daylightRating = "Good";
        daylightScore = 80;
      } else if (directHours >= 1.5) {
        daylightRating = "Moderate";
        daylightScore = 60;
      } else if (extWindowsCount > 0) {
        daylightRating = "Moderate";
        daylightScore = 45;
      }

      const glareRisk: RoomSunlightAnalysis["glareRisk"] = hasWest && totalWindowWidth >= 5 ? "High" : hasWest ? "Moderate" : "Low";
      const notes: string[] = [];
      if (hasEast) notes.push("Receives warm, low-glare morning sunlight.");
      if (hasSouth) notes.push("Deep winter solar gain from the south.");
      if (hasWest) notes.push("Afternoon sun exposure; consider solar shading or louvers.");
      if (hasNorth) notes.push("Consistent, glare-free diffuse daylight.");
      if (extWindowsCount === 0) notes.push("Windowless space; relies on artificial illumination.");

      sunlightRooms.push({
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        levelIndex: levelIdx,
        exteriorWindowsCount: extWindowsCount,
        totalWindowWidth,
        cardinalOrientations: cardinalList,
        directSunHours: directHours,
        daylightRating,
        morningSun: hasEast,
        afternoonSun: hasWest,
        glareRisk,
        daylightScore,
        notes,
      });

      // ── Ventilation Analysis ──
      const distinctWalls = new Set(roomOpenings.map((o) => o.wallId)).size;
      const hasExtOpenings = extWindowsCount > 0 || (room.type === "balcony");
      let ventType: VentilationAnalysis["ventilationType"] = "Stagnant / Enclosed";
      let ventScore = 25;
      let crossVent = false;
      let airflowDesc = "Limited passive airflow. Dependent on doorway circulation.";
      const ventSuggestions: string[] = [];

      if (distinctWalls >= 2 && hasExtOpenings) {
        ventType = "Cross-Ventilation";
        ventScore = 90;
        crossVent = true;
        airflowDesc = "Excellent cross-ventilation corridor between opposing/adjacent walls.";
      } else if (distinctWalls === 1 && hasExtOpenings) {
        ventType = "Single-Sided";
        ventScore = 60;
        airflowDesc = "Single-sided ventilation. Generates moderate air change rate.";
        ventSuggestions.push("Add a secondary window on an adjacent wall to enable a natural breeze corridor.");
      } else if (!hasExtOpenings && doors.length > 0) {
        ventType = "Stagnant / Enclosed";
        ventScore = 35;
        airflowDesc = "Interior room with no exterior opening. Relies on hallway air transfer.";
        ventSuggestions.push("Consider clerestory wall vents, door louvers, or a dedicated exhaust duct.");
      }

      ventilationRooms.push({
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        levelIndex: levelIdx,
        hasExteriorOpenings: hasExtOpenings,
        crossVentilation: crossVent,
        openingWallsCount: distinctWalls,
        ventilationType: ventType,
        ventilationScore: ventScore,
        airFlowPathDescription: airflowDesc,
        suggestions: ventSuggestions,
      });

      // ── Vastu Shastra Evaluation ──
      const zone = calculateVastuZone([roomCenterX, roomCenterY], plan.plot.width, plan.plot.length, northAngle);
      zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;

      const vastuEval = evaluateRoomVastu(room.type, room.name, zone);
      vastuRooms.push({
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        zone,
        element: vastuEval.element,
        suitability: vastuEval.suitability,
        rating: vastuEval.rating,
        recommendation: vastuEval.recommendation,
        remedy: vastuEval.remedy,
      });
    });
  });

  const overallSunScore = Math.round(
    sunlightRooms.reduce((sum, r) => sum + r.daylightScore, 0) / Math.max(1, sunlightRooms.length)
  );
  const avgSunHours = Math.round(
    (sunlightRooms.reduce((sum, r) => sum + r.directSunHours, 0) / Math.max(1, sunlightRooms.length)) * 10
  ) / 10;
  const overallVentScore = Math.round(
    ventilationRooms.reduce((sum, r) => sum + r.ventilationScore, 0) / Math.max(1, ventilationRooms.length)
  );
  const overallVastuScore = Math.round(
    vastuRooms.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, vastuRooms.length)
  );

  const actionableSuggestions: { roomId: string; roomName: string; suggestion: string }[] = [];
  ventilationRooms.forEach((vr) => {
    vr.suggestions.forEach((s) => {
      actionableSuggestions.push({ roomId: vr.roomId, roomName: vr.roomName, suggestion: s });
    });
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return {
    site: {
      locationName: `${location.city}, ${location.country}`,
      latitude: location.latitude,
      longitude: location.longitude,
      northAngleDeg: northAngle,
      dateDescription: `${monthNames[month - 1]} ${day}`,
      solarHour,
    },
    sunlight: {
      overallScore: overallSunScore,
      averageSunHours: avgSunHours,
      sunPosition: sunPos,
      rooms: sunlightRooms,
      wellLitRoomsCount: sunlightRooms.filter((r) => r.daylightRating === "Excellent" || r.daylightRating === "Good").length,
      lowLightRoomsCount: sunlightRooms.filter((r) => r.daylightRating === "Low").length,
    },
    ventilation: {
      overallScore: overallVentScore,
      crossVentilatedRoomsCount: ventilationRooms.filter((r) => r.crossVentilation).length,
      stagnantRoomsCount: ventilationRooms.filter((r) => r.ventilationType === "Stagnant / Enclosed").length,
      rooms: ventilationRooms,
      actionableSuggestions,
    },
    vastu: {
      enabled: vastuEnabled,
      overallScore: overallVastuScore,
      rooms: vastuRooms,
      zoneCounts,
      summaryNotes: [
        `Building oriented ${northAngle === 0 ? "True North" : `${northAngle}° from North`}.`,
        vastuRooms.filter((r) => r.suitability === "Favorable").length + " rooms align favorably with traditional zones.",
      ],
    },
  };
}

// ── Vastu Evaluation Logic ─────────────────────────────────────
function evaluateRoomVastu(
  type: RoomType,
  name: string,
  zone: VastuZone
): { suitability: "Favorable" | "Neutral" | "Challenging"; rating: number; element: string; recommendation: string; remedy?: string } {
  const isMasterBed = /master/i.test(name) || (type === "bedroom" && !/guest|child/i.test(name));
  const isKitchen = type === "kitchen";
  const isLiving = type === "living_room";
  const isBathroom = type === "bathroom";
  const isStudy = type === "study";
  const isStairs = type === "staircase";
  const isBalcony = type === "balcony";

  switch (zone) {
    case "North-East": // Ishan - Water
      if (isLiving || isStudy || /puja|prayer|mandir/i.test(name)) {
        return {
          element: "Water (Jal)",
          suitability: "Favorable",
          rating: 95,
          recommendation: "North-East (Ishan) is the sacred zone of clarity, wisdom, and light. Excellent for Living, Prayer, or Study.",
        };
      }
      if (isKitchen) {
        return {
          element: "Water (Jal)",
          suitability: "Challenging",
          rating: 40,
          recommendation: "Kitchen placed in the Water zone can cause an elemental clash (Fire vs Water).",
          remedy: "Traditional remedy: Place a bronze bell or brass vessel near the kitchen entrance and use warm yellow tones.",
        };
      }
      if (isBathroom) {
        return {
          element: "Water (Jal)",
          suitability: "Challenging",
          rating: 35,
          recommendation: "North-East is traditionally not recommended for sanitary fixtures or heavy plumbing.",
          remedy: "Traditional remedy: Keep bathroom door closed, add sea-salt bowl in a copper dish, or use aromatic diffusers.",
        };
      }
      return {
        element: "Water (Jal)",
        suitability: "Neutral",
        rating: 70,
        recommendation: "Light, uncluttered open space is encouraged in the North-East zone.",
      };

    case "East": // Purva - Solar / Life
      if (isLiving || isStudy || isBalcony || type === "hallway") {
        return {
          element: "Solar (Surya)",
          suitability: "Favorable",
          rating: 90,
          recommendation: "East is ideal for welcoming morning sunlight, social areas, and quiet study.",
        };
      }
      return {
        element: "Solar (Surya)",
        suitability: "Neutral",
        rating: 75,
        recommendation: "Eastern placement brings invigorating sunrise energy.",
      };

    case "South-East": // Agneya - Fire
      if (isKitchen || /utility|pantry/i.test(name)) {
        return {
          element: "Fire (Agni)",
          suitability: "Favorable",
          rating: 98,
          recommendation: "South-East is the traditional Agni (Fire) zone. Perfect location for the kitchen and cooking hob.",
        };
      }
      if (isMasterBed) {
        return {
          element: "Fire (Agni)",
          suitability: "Challenging",
          rating: 45,
          recommendation: "Master bedroom in the Fire zone is traditionally thought to increase restlessness.",
          remedy: "Traditional remedy: Decorate with cooling pastel greens or soft blues and ensure the bed headboard faces South.",
        };
      }
      return {
        element: "Fire (Agni)",
        suitability: "Neutral",
        rating: 70,
        recommendation: "Suitable for electrical equipment, heat-producing utilities, and dining.",
      };

    case "South": // Dakshin - Earth & Strength
      if (isMasterBed || isStairs || type === "bedroom") {
        return {
          element: "Earth (Prithvi)",
          suitability: "Favorable",
          rating: 88,
          recommendation: "South provides grounded stability and sound sleep. Well suited for bedrooms and staircases.",
        };
      }
      return {
        element: "Earth (Prithvi)",
        suitability: "Neutral",
        rating: 75,
        recommendation: "South zone supports heavier architectural massing.",
      };

    case "South-West": // Nairrutya - Stability & Earth
      if (isMasterBed) {
        return {
          element: "Earth (Prithvi / Nairrutya)",
          suitability: "Favorable",
          rating: 98,
          recommendation: "South-West is the supreme position for the Master Bedroom, providing stability, authority, and prosperity.",
        };
      }
      if (isStairs) {
        return {
          element: "Earth (Prithvi)",
          suitability: "Favorable",
          rating: 90,
          recommendation: "Heaviest zone of the house; ideal for solid staircases and vertical loads.",
        };
      }
      if (isBathroom) {
        return {
          element: "Earth (Prithvi)",
          suitability: "Challenging",
          rating: 45,
          recommendation: "Water drains in the South-West are traditionally avoided to preserve financial grounding.",
          remedy: "Traditional remedy: Keep toilets along the western wall of the room and use earth-toned tile accents.",
        };
      }
      return {
        element: "Earth (Prithvi)",
        suitability: "Neutral",
        rating: 75,
        recommendation: "Heaviest corner of the residence; maintain solid masonry.",
      };

    case "West": // Pashchim - Water / Space
      if (type === "dining_room" || type === "bedroom" || isStudy) {
        return {
          element: "Water & Space (Varuna)",
          suitability: "Favorable",
          rating: 88,
          recommendation: "West is favorable for dining rooms, study spaces, and children's bedrooms.",
        };
      }
      return {
        element: "Water & Space (Varuna)",
        suitability: "Neutral",
        rating: 75,
        recommendation: "Good for dining, recreation, or storage.",
      };

    case "North-West": // Vayavya - Air / Movement
      if (isBathroom || /guest/i.test(name) || type === "utility" || type === "parking") {
        return {
          element: "Air (Vayu)",
          suitability: "Favorable",
          rating: 92,
          recommendation: "North-West is ruled by Vayu (Air). Ideal for guest bedrooms, bathrooms, and utility areas.",
        };
      }
      if (isKitchen) {
        return {
          element: "Air (Vayu)",
          suitability: "Neutral",
          rating: 80,
          recommendation: "North-West serves as an acceptable secondary alternative for the kitchen.",
        };
      }
      return {
        element: "Air (Vayu)",
        suitability: "Neutral",
        rating: 75,
        recommendation: "Zone of circulation and change.",
      };

    case "North": // Uttar - Mercury / Wealth
      if (isLiving || isStudy || type === "hallway" || isBalcony) {
        return {
          element: "Mercury / Kubera",
          suitability: "Favorable",
          rating: 92,
          recommendation: "North is ruled by Kubera (prosperity). Ideal for main entrances, living rooms, and study.",
        };
      }
      return {
        element: "Mercury / Kubera",
        suitability: "Neutral",
        rating: 75,
        recommendation: "Keep North areas open, well-illuminated, and uncluttered.",
      };

    case "Center": // Brahmasthan - Space
      if (type === "living_room" || type === "hallway" || isBalcony) {
        return {
          element: "Ether (Akasha)",
          suitability: "Favorable",
          rating: 95,
          recommendation: "Brahmasthan is the open heart of the home. Best kept open as a central foyer or light court.",
        };
      }
      if (isBathroom || isKitchen || isStairs) {
        return {
          element: "Ether (Akasha)",
          suitability: "Challenging",
          rating: 30,
          recommendation: "Heavy structures, stairwells, or plumbing fixtures in the exact center are discouraged.",
          remedy: "Traditional remedy: Keep the central floor clean, uncluttered, and illuminated with a warm ceiling chandelier or skylight.",
        };
      }
      return {
        element: "Ether (Akasha)",
        suitability: "Neutral",
        rating: 70,
        recommendation: "Central spatial hub.",
      };
  }
}
