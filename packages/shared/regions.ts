import type { Biome } from "./types";

export const WORLD_RADIUS = 300;
export const REGIONS: Array<{
  id: Biome;
  name: string;
  subtitle: string;
  color: string;
  x: number;
  z: number;
  level: string;
}> = [
  {
    id: "town",
    name: "Hearthwick",
    subtitle: "The expedition capital",
    color: "#c8b783",
    x: 0,
    z: -32,
    level: "Safe haven",
  },
  {
    id: "meadow",
    name: "Sunpetal Meadows",
    subtitle: "Windmills, orchards and open skies",
    color: "#8aad62",
    x: -58,
    z: 14,
    level: "1–4",
  },
  {
    id: "forest",
    name: "Lanternwood",
    subtitle: "Beneath the ancient canopy",
    color: "#416f59",
    x: 63,
    z: 30,
    level: "4–7",
  },
  {
    id: "ruins",
    name: "Tideglass Reach",
    subtitle: "The road to the Stormheart",
    color: "#929e99",
    x: 10,
    z: 86,
    level: "7–12",
  },
  {
    id: "desert",
    name: "Amberfall Expanse",
    subtitle: "Lost shrines beneath a copper sun",
    color: "#cda475",
    x: -185,
    z: 12,
    level: "8–12",
  },
  {
    id: "marsh",
    name: "Moonfen",
    subtitle: "Blue mist and luminous roots",
    color: "#668c91",
    x: 184,
    z: 20,
    level: "10–14",
  },
  {
    id: "tundra",
    name: "Frostveil Highlands",
    subtitle: "Where the northern lights awaken",
    color: "#c4d4d7",
    x: 0,
    z: 210,
    level: "14–20",
  },
  {
    id: "highlands",
    name: "Kingsward Vale",
    subtitle: "Autumn pastures and the southern watch",
    color: "#b29a62",
    x: 0,
    z: -188,
    level: "5–9",
  },
];
export const WAYSTONES = REGIONS.map((r) => ({
  ...r,
  z: r.id === "town" ? -58 : r.z,
  id: `waystone-${r.id}`,
  biome: r.id,
  kind: "landmark" as const,
  description: `Discover ${r.name} to unlock travel from other waystones.`,
}));
export const ROADS: Array<Array<[number, number]>> = [
  [
    [0, -66],
    [0, -32],
    [0, -22],
    [-9, -12],
    [-23, 0],
    [-30, 8],
    [-30, 30],
    [-12, 51],
    [8, 61],
    [6, 76],
    [10, 86],
    [0, 125],
    [0, 210],
    [8, 267],
  ],
  [
    [0, -28],
    [10, -28],
    [23, -17],
    [29, 1],
    [29, 20],
    [24, 43],
    [8, 61],
  ],
  [
    [-10, -29],
    [0, -28],
  ],
  [
    [0, -22],
    [-18, -14],
  ],
  [
    [-30, 8],
    [-30, -1],
    [-45, -1],
    [-58, 14],
    [-95, 12],
    [-140, -5],
    [-185, 12],
    [-254, 34],
  ],
  [
    [29, 20],
    [29, 14],
    [44, 14],
    [63, 30],
    [103, 16],
    [143, 5],
    [184, 20],
    [256, 40],
  ],
  [
    [0, -66],
    [-16, -103],
    [0, -145],
    [0, -188],
    [14, -255],
  ],
  [
    [-185, 12],
    [-150, 93],
    [-86, 157],
    [0, 210],
    [84, 159],
    [145, 95],
    [184, 20],
  ],
  [
    [-185, 12],
    [-157, -93],
    [-75, -165],
    [0, -188],
    [80, -163],
    [161, -90],
    [184, 20],
  ],
];
export function regionBiome(x: number, z: number): Biome {
  if (z > 120) return "tundra";
  if (x < -110) return "desert";
  if (x > 110) return "marsh";
  if (z < -100) return "highlands";
  if (z < -12 && Math.abs(x) < 60) return "town";
  return z > 46 ? "ruins" : x > 12 ? "forest" : "meadow";
}

export function isSafeArea(x: number, z: number) {
  return (
    regionBiome(x, z) === "town" ||
    WAYSTONES.some((w) => Math.hypot(w.x - x, w.z - z) < 10)
  );
}
