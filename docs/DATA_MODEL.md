# Canonical design data model

The canonical model is the single source of truth for 2D, 3D, validation and exports.

## Required entities

- `plot`: dimensions, unit, shape and applicable site constraints.
- `levels`: floor elevation, ceiling/wall height and level visibility.
- `rooms`: stable IDs, room type, polygon and room metadata.
- `walls`: start/end points, thickness, height and interior/exterior type.
- `openings`: door/window references to walls, offsets and dimensions.
- `furniture`: asset references, transforms and dimensions.
- `metadata`: schema version, design version and workflow status.

## Coordinate conventions

Pick one internal coordinate system and document it. Convert units at input/output boundaries. Never mix display pixels with model dimensions. The editor should map model units to screen coordinates through a transform.

## Validation layers

1. Schema validation: types, IDs, units and required fields.
2. Geometry validation: finite coordinates, positive dimensions, boundary containment and overlap checks.
3. Connectivity validation: wall/opening relationships and accessible room connections.
4. Preference scoring: natural light, privacy, proximity and circulation.
5. Professional review: local building regulations and construction suitability.
