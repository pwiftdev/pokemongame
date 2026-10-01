import { ROADS, WORLD_RADIUS } from "./regions";
import type { Biome } from "./types";

const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const LAKES = [
  {
    id: "springwater",
    biome: "town",
    x: 35,
    z: -36,
    rx: 10,
    rz: 8,
    level: -0.25,
  },
  { id: "reedbank", biome: "meadow", x: -9, z: 35, rx: 8, rz: 6, level: 0.5 },
  {
    id: "millpond",
    biome: "meadow",
    x: -80,
    z: -15,
    rx: 13,
    rz: 9,
    level: 0.1,
  },
  {
    id: "canopy-pool",
    biome: "forest",
    x: 85,
    z: -1,
    rx: 13,
    rz: 10,
    level: 0.8,
  },
  {
    id: "sunken-court",
    biome: "ruins",
    x: 44,
    z: 70,
    rx: 17,
    rz: 10,
    level: 1.5,
  },
  {
    id: "amber-oasis",
    biome: "desert",
    x: -214,
    z: -25,
    rx: 21,
    rz: 13,
    level: 2.5,
  },
  { id: "moon-pool", biome: "marsh", x: 209, z: 8, rx: 16, rz: 10, level: 3.7 },
  {
    id: "fen-mirror",
    biome: "marsh",
    x: 137,
    z: 40,
    rx: 12,
    rz: 9,
    level: 3.1,
  },
  {
    id: "rootwater",
    biome: "marsh",
    x: 220,
    z: 77,
    rx: 20,
    rz: 13,
    level: 5.1,
  },
  {
    id: "frostglass",
    biome: "tundra",
    x: 39,
    z: 211,
    rx: 23,
    rz: 15,
    level: 11,
    frozen: true,
  },
  {
    id: "vale-pond",
    biome: "highlands",
    x: -43,
    z: -139,
    rx: 15,
    rz: 10,
    level: 5,
  },
] satisfies Array<{
  id: string;
  biome: Biome;
  x: number;
  z: number;
  rx: number;
  rz: number;
  level: number;
  frozen?: boolean;
}>;
export type Lake = (typeof LAKES)[number];
export function lakeDistance(lake: Lake, x: number, z: number) {
  const dx = (x - lake.x) / lake.rx,
    dz = (z - lake.z) / lake.rz;
  const a = Math.atan2(dz, dx);
  return (
    Math.hypot(dx, dz) /
    (1 + 0.065 * Math.sin(a * 3 + lake.x) + 0.035 * Math.sin(a * 7 + lake.z))
  );
}
export function lakeAt(x: number, z: number, margin = 1) {
  return LAKES.find(
    (lake) =>
      Math.abs(x - lake.x) < lake.rx * margin * 1.11 &&
      Math.abs(z - lake.z) < lake.rz * margin * 1.11 &&
      lakeDistance(lake, x, z) < margin,
  );
}
export const LANDMARKS = [
  {
    biome: "forest",
    model: "CoastalCliff",
    x: 102,
    z: -14,
    height: 14,
    radius: 13,
    yaw: -0.65,
  },
  {
    biome: "forest",
    model: "OldStump",
    x: 70,
    z: 55,
    height: 5,
    radius: 2.6,
    yaw: 0,
  },
  {
    biome: "ruins",
    model: "Watchtower",
    x: -34,
    z: 91,
    height: 17,
    radius: 8,
    yaw: 0.4,
  },
  {
    biome: "ruins",
    model: "StoneGate",
    x: 44,
    z: 53,
    height: 9,
    radius: 4.5,
    yaw: 0,
  },
  {
    biome: "desert",
    model: "MesaCliff",
    x: -229,
    z: 46,
    height: 25,
    radius: 9,
    yaw: 1.3,
  },
  {
    biome: "desert",
    model: "MesaCliff",
    x: -198,
    z: 70,
    height: 20,
    radius: 8,
    yaw: 2.6,
  },
  {
    biome: "desert",
    model: "AncientBones",
    x: -245,
    z: -7,
    height: 6,
    radius: 4,
    yaw: 0.4,
  },
  {
    biome: "marsh",
    model: "OldStump",
    x: 206,
    z: 54,
    height: 3.5,
    radius: 2.5,
    yaw: 0,
  },
  {
    biome: "tundra",
    model: "Rock_Medium_3",
    x: -45,
    z: 251,
    height: 20,
    radius: 9,
    yaw: -0.3,
  },
  {
    biome: "tundra",
    model: "Rock_Medium_3",
    x: 47,
    z: 259,
    height: 20,
    radius: 9,
    yaw: 2,
  },
  {
    biome: "highlands",
    model: "Watchtower",
    x: 36,
    z: -198,
    height: 11,
    radius: 5,
    yaw: 0.4,
  },
  {
    biome: "highlands",
    model: "Mill",
    x: -63,
    z: -142,
    height: 13,
    radius: 3.5,
    yaw: 1.5,
  },
] satisfies Array<{
  biome: Biome;
  model: string;
  x: number;
  z: number;
  height: number;
  radius: number;
  yaw: number;
}>;

type Segment = {
  x: number;
  z: number;
  dx: number;
  dz: number;
  length2: number;
};
const roadCells = new Map<string, Segment[]>();
for (const road of ROADS)
  for (let i = 1; i < road.length; i++) {
    const [x, z] = road[i - 1],
      [bx, bz] = road[i];
    const segment = {
      x,
      z,
      dx: bx - x,
      dz: bz - z,
      length2: (bx - x) ** 2 + (bz - z) ** 2,
    };
    for (
      let cx = Math.floor((Math.min(x, bx) - 16) / 32);
      cx <= Math.floor((Math.max(x, bx) + 16) / 32);
      cx++
    )
      for (
        let cz = Math.floor((Math.min(z, bz) - 16) / 32);
        cz <= Math.floor((Math.max(z, bz) + 16) / 32);
        cz++
      ) {
        const key = `${cx}:${cz}`;
        if (!roadCells.has(key)) roadCells.set(key, []);
        roadCells.get(key)!.push(segment);
      }
  }
export function roadDistance(x: number, z: number) {
  let closest = 32;
  for (const s of roadCells.get(
    `${Math.floor(x / 32)}:${Math.floor(z / 32)}`,
  ) ?? []) {
    const t = Math.max(
      0,
      Math.min(1, ((x - s.x) * s.dx + (z - s.z) * s.dz) / s.length2),
    );
    closest = Math.min(
      closest,
      Math.hypot(x - s.x - s.dx * t, z - s.z - s.dz * t),
    );
  }
  return closest;
}
export function geographyWalkable(x: number, z: number, radius: number) {
  const lake = lakeAt(x, z, 0.9);
  return (
    (!lake || lake.frozen === true) &&
    LANDMARKS.every((p) => Math.hypot(x - p.x, z - p.z) > p.radius + radius)
  );
}
export function landscapeHeight(x: number, z: number) {
  const inland = smooth(-14, 6, z);
  const hills =
    (0.8 +
      Math.sin(x * 0.075) * Math.cos(z * 0.07) * 0.9 +
      Math.sin((x + z) * 0.035) * 0.45) *
    inland;
  const rise = Math.max(0, z - 38) * 0.035 + Math.max(0, -z - 90) * 0.035;
  const outer = smooth(85, 130, Math.hypot(x, z));
  const ridges = outer * (3 + Math.sin(x * 0.023) * Math.cos(z * 0.026) * 3);
  const wild = smooth(5, 16, roadDistance(x, z));
  const north =
    smooth(130, 220, z) * (4 + Math.sin(x * 0.041 + z * 0.025) * 3.5);
  const dunes =
    smooth(105, 155, -x) *
    (2.2 + Math.sin(x * 0.075 + Math.sin(z * 0.04)) * 2.1);
  const vale =
    smooth(105, 175, -z) * (1.5 + Math.sin(x * 0.05 - z * 0.03) * 1.5);
  let height = Math.max(
    0,
    hills + rise + ridges + (north + dunes + vale) * wild,
  );
  const lake = lakeAt(x, z, 1.38);
  if (lake) {
    const d = lakeDistance(lake, x, z);
    const bed =
      lake.level + (lake.frozen ? -0.07 : -0.8) + smooth(0.75, 1.35, d) * 1.8;
    height += (bed - height) * (1 - smooth(1.08, 1.38, d));
  }
  const coast = smooth(WORLD_RADIUS, WORLD_RADIUS - 10, Math.hypot(x, z));
  return height * coast - Math.max(0, Math.hypot(x, z) - WORLD_RADIUS);
}
