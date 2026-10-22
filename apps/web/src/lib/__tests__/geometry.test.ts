import { describe, expect, it } from "vitest";
import { distance, nearestEdge, polygonArea, polygonEdges, polygonPerimeter, projectOntoSegment, snapToGrid } from "../geometry";

describe("snapToGrid", () => {
  it("rounds to the nearest grid step", () => {
    expect(snapToGrid(5.2, 0.5)).toBeCloseTo(5);
    expect(snapToGrid(5.3, 0.5)).toBeCloseTo(5.5);
  });

  it("is a no-op for values already on the grid", () => {
    expect(snapToGrid(6, 0.5)).toBeCloseTo(6);
  });

  it("supports grid sizes other than the 0.5 default", () => {
    expect(snapToGrid(7, 2)).toBeCloseTo(8);
    expect(snapToGrid(6, 2)).toBeCloseTo(6);
  });
});

describe("polygonArea / polygonPerimeter", () => {
  it("computes area and perimeter for a simple rectangle", () => {
    const rect: [number, number][] = [[0, 0], [10, 0], [10, 6], [0, 6]];
    expect(polygonArea(rect)).toBeCloseTo(60);
    expect(polygonPerimeter(rect)).toBeCloseTo(32);
  });

  it("gives the same area regardless of winding direction", () => {
    const clockwise: [number, number][] = [[0, 0], [10, 0], [10, 6], [0, 6]];
    const counterClockwise: [number, number][] = [[0, 0], [0, 6], [10, 6], [10, 0]];
    expect(polygonArea(clockwise)).toBeCloseTo(polygonArea(counterClockwise));
  });

  it("returns zero area for a degenerate (zero-size) polygon", () => {
    const point: [number, number][] = [[5, 5], [5, 5], [5, 5], [5, 5]];
    expect(polygonArea(point)).toBeCloseTo(0);
  });
});

describe("projectOntoSegment", () => {
  it("projects a point onto the segment and reports the offset from the start", () => {
    const { point, offset } = projectOntoSegment([5, 3], [0, 0], [10, 0]);
    expect(point).toEqual([5, 0]);
    expect(offset).toBeCloseTo(5);
  });

  it("clamps the projection to the segment's endpoints", () => {
    const { point } = projectOntoSegment([-5, 1], [0, 0], [10, 0]);
    expect(point).toEqual([0, 0]);
  });
});

describe("polygonEdges", () => {
  it("returns each consecutive edge, wrapping back to the first point", () => {
    const edges = polygonEdges([[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(edges).toHaveLength(4);
    expect(edges[3]).toEqual([[0, 10], [0, 0]]);
  });
});

describe("nearestEdge", () => {
  const rooms = [
    [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][],
    [[10, 0], [20, 0], [20, 10], [10, 10]] as [number, number][],
  ];

  it("snaps to the closest edge within tolerance", () => {
    const edge = nearestEdge(rooms, [10.1, 5], 1.5);
    expect(edge).not.toBeNull();
    expect(distance(edge!.start, [10, 0])).toBeLessThan(0.01);
    expect(distance(edge!.end, [10, 10])).toBeLessThan(0.01);
  });

  it("returns null when nothing is within tolerance", () => {
    const edge = nearestEdge(rooms, [10, 5], 0.01);
    expect(edge).not.toBeNull(); // exactly on the shared edge
    const farEdge = nearestEdge(rooms, [5, 5], 0.5); // room interior, far from any edge
    expect(farEdge).toBeNull();
  });

  it("picks the single closest edge across multiple rooms, not just the first room checked", () => {
    const edge = nearestEdge(rooms, [19.9, 5], 1);
    expect(distance(edge!.start, [20, 0])).toBeLessThan(0.01);
  });
});
