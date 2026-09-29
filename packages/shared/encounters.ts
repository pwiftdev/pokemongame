import type { Biome } from "./types";
export interface Habitat {
  id: string;
  name: string;
  x: number;
  z: number;
  biome: Biome;
  kind: "camp" | "pokemon" | "boss";
  description: string;
}
export const HABITATS: Habitat[] = [
  {
    id: "orchard",
    name: "Overgrown Orchard",
    x: -46,
    z: 12,
    biome: "meadow",
    kind: "camp",
    description:
      "Root monsters have displaced the orchard Pokémon. Levels 1–2.",
  },
  {
    id: "clover",
    name: "Clover Hollow",
    x: -65,
    z: 34,
    biome: "meadow",
    kind: "pokemon",
    description: "Bulbasaur graze beneath the sheltered canopy. Levels 2–3.",
  },
  {
    id: "reedbank",
    name: "Reedbank Pool",
    x: -13,
    z: 26,
    biome: "meadow",
    kind: "pokemon",
    description: "Squirtle gather in the cool reed beds. Level 2.",
  },
  {
    id: "sunrocks",
    name: "Sunlit Rocks",
    x: -77,
    z: 5,
    biome: "meadow",
    kind: "pokemon",
    description: "Charmander bask on the warm rocks. Level 3.",
  },
  {
    id: "roots",
    name: "Tangled Roots",
    x: 53,
    z: 34,
    biome: "forest",
    kind: "camp",
    description: "Forest monsters cluster around the broken wards. Levels 4–5.",
  },
  {
    id: "quarry",
    name: "Tideglass Quarry",
    x: -22,
    z: 60,
    biome: "ruins",
    kind: "camp",
    description: "Stone guardians hold the abandoned quarry. Levels 7–9.",
  },
  {
    id: "sanctuary",
    name: "Stormheart Sanctuary",
    x: -9,
    z: 80,
    biome: "ruins",
    kind: "boss",
    description: "An ancient storm guardian. Level 12 · bring allies.",
  },
  {
    id: "amber",
    name: "Amberfall Nest",
    x: -160,
    z: 44,
    biome: "desert",
    kind: "camp",
    description: "Sunscales nest beside the amber ridge. Levels 8–10.",
  },
  {
    id: "fen",
    name: "Drowned Thicket",
    x: 164,
    z: 50,
    biome: "marsh",
    kind: "camp",
    description: "Marsh beasts guard the flooded roots. Levels 10–12.",
  },
  {
    id: "frost",
    name: "Frostveil Watch",
    x: 27,
    z: 236,
    biome: "tundra",
    kind: "camp",
    description: "Storm creatures haunt the frozen watch. Levels 14–16.",
  },
  {
    id: "vale",
    name: "Kingsward Burrows",
    x: -28,
    z: -211,
    biome: "highlands",
    kind: "camp",
    description: "Burrowing monsters beneath the old pasture. Levels 5–7.",
  },
];
export interface Spawn {
  id: string;
  species: string;
  x: number;
  z: number;
  level: number;
  habitat: string;
  elite?: boolean;
  boss?: boolean;
}
export const SPAWNS: Spawn[] = [
  {
    id: "sprig-1",
    species: "spriglet",
    x: -43,
    z: 9,
    level: 1,
    habitat: "orchard",
  },
  {
    id: "sprig-2",
    species: "spriglet",
    x: -47,
    z: 20,
    level: 2,
    habitat: "orchard",
  },
  {
    id: "bulbasaur-grove",
    species: "bulbasaur",
    x: -65,
    z: 34,
    level: 2,
    habitat: "clover",
  },
  {
    id: "bulbasaur-grove-2",
    species: "bulbasaur",
    x: -71,
    z: 38,
    level: 3,
    habitat: "clover",
  },
  {
    id: "squirtle-pool",
    species: "squirtle",
    x: -13,
    z: 26,
    level: 2,
    habitat: "reedbank",
  },
  {
    id: "squirtle-pool-2",
    species: "squirtle",
    x: -17,
    z: 30,
    level: 2,
    habitat: "reedbank",
  },
  {
    id: "charmander-den",
    species: "charmander",
    x: -77,
    z: 5,
    level: 3,
    habitat: "sunrocks",
  },
  {
    id: "charmander-den-2",
    species: "charmander",
    x: -81,
    z: 10,
    level: 3,
    habitat: "sunrocks",
  },
  {
    id: "moss-1",
    species: "mossprout",
    x: 51,
    z: 31,
    level: 4,
    habitat: "roots",
  },
  { id: "owl-1", species: "duskowl", x: 52, z: 40, level: 5, habitat: "roots" },
  {
    id: "crag-1",
    species: "cragclaw",
    x: -20,
    z: 56,
    level: 7,
    habitat: "quarry",
  },
  {
    id: "elite-ruins",
    species: "cragclaw",
    x: -27,
    z: 65,
    level: 9,
    elite: true,
    habitat: "quarry",
  },
  {
    id: "stormheart",
    species: "tempest",
    x: -9,
    z: 80,
    level: 12,
    boss: true,
    habitat: "sanctuary",
  },
  {
    id: "desert-0",
    species: "sunscale",
    x: -159,
    z: 43,
    level: 8,
    habitat: "amber",
  },
  {
    id: "desert-1",
    species: "cragclaw",
    x: -156,
    z: 49,
    level: 10,
    elite: true,
    habitat: "amber",
  },
  {
    id: "marsh-0",
    species: "coralisk",
    x: 163,
    z: 47,
    level: 10,
    habitat: "fen",
  },
  {
    id: "marsh-1",
    species: "mossprout",
    x: 159,
    z: 54,
    level: 12,
    elite: true,
    habitat: "fen",
  },
  {
    id: "tundra-0",
    species: "tempest",
    x: 25,
    z: 233,
    level: 14,
    habitat: "frost",
  },
  {
    id: "tundra-1",
    species: "cragclaw",
    x: 31,
    z: 240,
    level: 16,
    elite: true,
    habitat: "frost",
  },
  {
    id: "highlands-0",
    species: "pebblit",
    x: -25,
    z: -208,
    level: 5,
    habitat: "vale",
  },
  {
    id: "highlands-1",
    species: "cindercub",
    x: -32,
    z: -215,
    level: 7,
    elite: true,
    habitat: "vale",
  },
];
export const encounterLeash = (boss: boolean) => (boss ? 18 : 12);
export const encounterRespawnMs = (
  boss: boolean,
  elite: boolean,
  pokemon = false,
) => (boss ? 180000 : pokemon ? 60000 : elite ? 150000 : 120000);
export function canRespawn(
  home: { x: number; z: number },
  players: Iterable<{ x: number; z: number; online: boolean }>,
) {
  return !Array.from(players).some(
    (p) => p.online && Math.hypot(p.x - home.x, p.z - home.z) < 18,
  );
}
