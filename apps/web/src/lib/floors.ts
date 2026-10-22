const NAMES = ["Ground floor", "First floor", "Second floor", "Third floor"];
const SHORT = ["Ground", "First", "Second", "Third"];

/** "Ground floor", "First floor"… for a level index (ground = 0). */
export function floorName(index: number): string {
  return NAMES[index] ?? `Floor ${index}`;
}

export function floorShortName(index: number): string {
  return SHORT[index] ?? `Floor ${index}`;
}

/** Indian-style label for a floor count: 1 → "G", 2 → "G+1". */
export function floorsLabel(floors: number): string {
  return floors <= 1 ? "G" : `G+${floors - 1}`;
}
