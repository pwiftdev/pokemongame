import { describe, expect, it } from "vitest";
import {
  LAKES,
  LANDMARKS,
  geographyWalkable,
  landscapeHeight,
  roadDistance,
} from "../packages/shared/geography";
import { SPAWNS, PLACES } from "../packages/shared/data";
import { ROADS, WAYSTONES } from "../packages/shared/regions";
import { moveWithCollision, walkable } from "../packages/shared/rules";

describe("regional geography", () => {
  it("keeps encounter homes, destinations and travel routes outside new obstacles", () => {
    for (const p of [...SPAWNS, ...PLACES, ...WAYSTONES])
      expect(geographyWalkable(p.x, p.z, 0.6), p.id).toBe(true);
    for (const road of ROADS)
      for (let i = 1; i < road.length; i++) {
        const a = road[i - 1],
          b = road[i],
          steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
        for (let j = 0; j <= steps; j++) {
          const x = a[0] + ((b[0] - a[0]) * j) / steps,
            z = a[1] + ((b[1] - a[1]) * j) / steps;
          expect(geographyWalkable(x, z, 0.6), `${x},${z}`).toBe(true);
          expect(roadDistance(x, z)).toBeLessThan(0.001);
        }
      }
  });
  it("blocks deep water and solid landmarks while allowing the frozen lake", () => {
    for (const lake of LAKES) {
      expect(walkable(lake.x, lake.z), lake.id).toBe(lake.frozen === true);
      expect(landscapeHeight(lake.x, lake.z)).toBeLessThan(lake.level);
      if (!lake.frozen) {
        const x =
            lake.x +
            lake.rx *
              0.94 *
              (1 + 0.065 * Math.sin(lake.x) + 0.035 * Math.sin(lake.z)),
          z = lake.z;
        expect(walkable(x, z)).toBe(true);
        expect(moveWithCollision(x, z, -lake.rx * 0.15, 0).x).toBe(x);
      }
    }
    for (const p of LANDMARKS) expect(walkable(p.x, p.z), p.model).toBe(false);
  });
  it("produces finite continuous terrain and bounded slopes on roads", () => {
    for (let x = -295; x <= 295; x += 5)
      for (let z = -295; z <= 295; z += 5) {
        const h = landscapeHeight(x, z);
        expect(Number.isFinite(h)).toBe(true);
        if (Math.hypot(x, z) < 290)
          expect(Math.abs(h - landscapeHeight(x + 0.01, z))).toBeLessThan(0.2);
      }
    for (const road of ROADS)
      for (let i = 1; i < road.length; i++) {
        const a = road[i - 1],
          b = road[i],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let j = 0; j < length; j++) {
          const x = a[0] + ((b[0] - a[0]) * j) / length,
            z = a[1] + ((b[1] - a[1]) * j) / length;
          expect(
            Math.abs(
              landscapeHeight(x, z) -
                landscapeHeight(
                  x + (b[0] - a[0]) / length,
                  z + (b[1] - a[1]) / length,
                ),
            ),
          ).toBeLessThan(1);
        }
      }
  });
});
