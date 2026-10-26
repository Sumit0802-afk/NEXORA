export type Units = "ft" | "m";

const UNITS_KEY = "nexora.defaultUnits";

/** Default measurement unit for new designs (stored in this browser). */
export function getDefaultUnits(): Units {
  try {
    const v = window.localStorage.getItem(UNITS_KEY);
    return v === "m" ? "m" : "ft";
  } catch {
    return "ft";
  }
}

export function setDefaultUnits(units: Units): void {
  try {
    window.localStorage.setItem(UNITS_KEY, units);
  } catch {
    /* storage unavailable (private mode): the choice just won't persist */
  }
}
