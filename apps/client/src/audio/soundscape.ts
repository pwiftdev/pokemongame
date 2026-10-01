import {
  FIRE_SOURCES,
  WATERFALL,
} from "../../../../packages/shared/environment-features";
import { LAKES, roadDistance } from "../../../../packages/shared/geography";
import { regionBiome, WORLD_RADIUS } from "../../../../packages/shared/regions";
import type { Biome } from "../../../../packages/shared/types";
import type { AmbientLayer } from "./mixer";
import type { CueId, Point } from "./catalog";
export function footSurface(point: Point): CueId {
  const biome = regionBiome(point.x, point.z);
  const shore = LAKES.some(
    (lake) =>
      !lake.frozen &&
      Math.abs(
        Math.hypot((point.x - lake.x) / lake.rx, (point.z - lake.z) / lake.rz) -
          1,
      ) < 0.13,
  );
  if (shore || biome === "marsh") return "step-water";
  if (biome === "tundra") return "step-snow";
  if (biome === "desert") return "step-sand";
  if (
    (biome === "town" || biome === "ruins") &&
    roadDistance(point.x, point.z) < 3
  )
    return "step-stone";
  return "step-grass";
}
const fires: Point[] = FIRE_SOURCES.map(([x, z]) => ({ x, z }));
export function soundscape(
  biome: Biome,
  point: Point,
  night: boolean,
  rain = false,
): AmbientLayer[] {
  const layers: AmbientLayer[] = [];
  if (rain && biome !== "desert" && biome !== "tundra")
    layers.push({ id: "rain", volume: 0.65 });
  const exposed =
    biome === "desert" || biome === "tundra" || biome === "highlands";
  layers.push({ id: "wind", volume: exposed ? 0.75 : 0.18 });
  if (
    ["town", "meadow", "forest", "highlands"].includes(biome) &&
    !night &&
    !rain
  )
    layers.push({ id: "birds", volume: biome === "forest" ? 0.8 : 0.45 });
  if (
    biome === "marsh" ||
    (night && ["forest", "meadow", "town"].includes(biome))
  )
    layers.push({ id: "swamp", volume: biome === "marsh" ? 0.7 : 0.28 });
  const distanceFromCenter = Math.hypot(point.x, point.z);
  let water: Point | undefined =
      distanceFromCenter > 0
        ? {
            x: (point.x / distanceFromCenter) * WORLD_RADIUS,
            z: (point.z / distanceFromCenter) * WORLD_RADIUS,
          }
        : undefined,
    closest = Math.abs(WORLD_RADIUS - distanceFromCenter);
  for (const lake of LAKES) {
    if (lake.frozen) continue;
    const d =
      Math.hypot(point.x - lake.x, point.z - lake.z) -
      Math.max(lake.rx, lake.rz);
    if (d < closest) {
      closest = d;
      const length = Math.max(
        0.01,
        Math.hypot(point.x - lake.x, point.z - lake.z),
      );
      water = {
        x: lake.x + ((point.x - lake.x) / length) * lake.rx,
        z: lake.z + ((point.z - lake.z) / length) * lake.rz,
      };
    }
  }
  if (water && closest < 24)
    layers.push({ id: "waves", volume: 0.8, point: water, radius: 28 });
  const waterfall = WATERFALL.bottom;
  if (Math.hypot(point.x - waterfall.x, point.z - waterfall.z) < 42)
    layers.push({ id: "river", volume: 1.25, point: waterfall, radius: 42 });
  const fire = fires.reduce((a, b) =>
    Math.hypot(point.x - a.x, point.z - a.z) <
    Math.hypot(point.x - b.x, point.z - b.z)
      ? a
      : b,
  );
  if (Math.hypot(point.x - fire.x, point.z - fire.z) < 13)
    layers.push({ id: "fire", volume: 0.85, point: fire, radius: 13 });
  return layers;
}
