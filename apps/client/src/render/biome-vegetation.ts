import { arenaClearing } from "./arena-clearance";
import { WORLD_RADIUS } from "../../../../packages/shared/regions";
import { OBSTACLES, PLACES, SPAWNS } from "../../../../packages/shared/data";
import { biomeAt } from "../../../../packages/shared/rules";
import {
  lakeAt,
  LANDMARKS,
  roadDistance,
} from "../../../../packages/shared/geography";
import type { Biome } from "../../../../packages/shared/types";
import type { loadScenery } from "./scenery";

type Point = { x: number; z: number; height: number; rotation: number };
const trees: Record<Biome, string[]> = {
  town: ["CommonTree_1", "SilverBirch"],
  meadow: ["CommonTree_3", "SilverBirch", "CommonTree_5"],
  forest: ["CommonTree_1", "Pine_1", "CommonTree_5", "Pine_3"],
  ruins: ["Rock_Medium_1", "BareTree", "StandingStone"],
  desert: ["CactusTall", "CactusSmall", "Sandstone"],
  marsh: ["MoonTree", "TwistedTree_1", "BareTree"],
  tundra: ["SnowPine", "StandingStone", "Rock_Medium_3"],
  highlands: ["AutumnTree", "GoldenMaple", "SilverBirch"],
};
const groundcover: Record<Biome, string[]> = {
  town: ["Grass_Common_Short", "Flower_3_Group"],
  meadow: [
    "Grass_Common_Short",
    "Grass_Wispy_Tall",
    "Wildflowers",
    "Flower_4_Group",
  ],
  forest: ["Fern_1", "Grass_Common_Short", "Mushroom_Common"],
  ruins: ["Grass_Wispy_Tall", "Fern_1"],
  desert: ["Rock_Medium_1", "CactusSmall"],
  marsh: ["Reeds", "Fern_1", "Mushroom_Common"],
  tundra: ["Rock_Medium_2"],
  highlands: ["Grass_Common_Short", "Flower_4_Group", "Grass_Wispy_Tall"],
};
export function dressBiomes(scenery: Awaited<ReturnType<typeof loadScenery>>) {
  let seed = 821;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const clear = (x: number, z: number, margin: number) =>
    !arenaClearing(x, z, margin) &&
    Math.hypot(x, z) < WORLD_RADIUS - 10 &&
    roadDistance(x, z) > margin &&
    !lakeAt(x, z, 1.2) &&
    !OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius + margin) &&
    !LANDMARKS.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius + margin) &&
    !SPAWNS.some(
      (s) => Math.hypot(x - s.x, z - s.z) < (s.boss ? 10 : margin),
    ) &&
    !PLACES.some((p) => Math.hypot(x - p.x, z - p.z) < margin + 2);
  for (let i = 0; i < 3400; i++) {
    const x = (rand() - 0.5) * 580,
      z = (rand() - 0.5) * 580;
    if (!clear(x, z, 5)) continue;
    const biome = biomeAt(x, z),
      grove = Math.sin(x * 0.09) * Math.cos(z * 0.067);
    if (biome === "town" && Math.abs(x) < 27 && z > -50) continue;
    if (grove < (biome === "forest" ? -0.75 : biome === "marsh" ? -0.3 : 0.12))
      continue;
    const names = trees[biome],
      name = names[i % names.length];
    const height =
      biome === "desert"
        ? 1.2 + rand() * 2.8
        : biome === "ruins"
          ? 1.8 + rand() * 4
          : name.startsWith("Rock")
            ? 2 + rand() * 4
            : name === "StandingStone"
              ? 5 + rand() * 7
              : biome === "forest"
                ? 10 + rand() * 8
                : 6 + rand() * 7;
    scenery.place(name, x, z, height, rand() * Math.PI * 2);
    if (biome === "forest" && i % 5 === 0)
      scenery.place("FallenLog", x + 3, z + 1, 1, rand() * 6, undefined, true);
  }
  const batches = new Map<string, Point[]>();
  for (let i = 0; i < 58000; i++) {
    const x = (rand() - 0.5) * 580,
      z = (rand() - 0.5) * 580;
    const biome = biomeAt(x, z);
    if ((biome === "desert" || biome === "tundra") && i % 12) continue;
    if (!clear(x, z, 1.8) || Math.sin(x * 0.31) * Math.cos(z * 0.23) < -0.32)
      continue;
    if (biome === "town" && Math.abs(x) < 10 && z > -40) continue;
    const names = groundcover[biome],
      name = names[i % names.length];
    if (!batches.has(name)) batches.set(name, []);
    batches.get(name)!.push({
      x,
      z,
      height:
        name === "Reeds"
          ? 0.8 + rand() * 0.6
          : name === "Fern_1"
            ? 0.55 + rand() * 0.5
            : 0.25 + rand() * 0.4,
      rotation: rand() * 6.28,
    });
  }
  const gardens: Array<[string, number, number, number]> = [
    ["Wildflowers", -16, -32, 3],
    ["Flower_4_Group", 16, -32, 3],
    ["Bush_Common_Flowers", -24, -21, 2],
    ["Wildflowers", -48, 5, 5],
    ["Flower_3_Group", -61, 23, 7],
    ["Grass_Wispy_Tall", -75, 22, 7],
    ["Fern_1", 58, 23, 6],
    ["Fern_1", 75, 8, 5],
    ["Mushroom_Common", 40, 28, 4],
    ["Reeds", 196, 6, 5],
    ["Reeds", 224, 15, 4],
    ["Fern_1", 144, 38, 4],
    ["Grass_Wispy_Tall", -41, -175, 7],
    ["Wildflowers", 15, -178, 5],
  ];
  for (const [name, cx, cz, radius] of gardens) {
    if (!batches.has(name)) batches.set(name, []);
    for (let i = 0; i < 180; i++) {
      const a = rand() * Math.PI * 2,
        r = Math.sqrt(rand()) * radius,
        x = cx + Math.cos(a) * r,
        z = cz + Math.sin(a) * r;
      if (clear(x, z, 1.6))
        batches.get(name)!.push({
          x,
          z,
          height:
            name === "Reeds"
              ? 0.8 + rand() * 0.5
              : name === "Bush_Common_Flowers"
                ? 0.5 + rand() * 0.4
                : 0.4 + rand() * 0.35,
          rotation: a,
        });
    }
  }
  for (const [name, points] of batches) scenery.scatter(name, points);
  for (let i = 0; i < 52; i++) {
    const a = (i / 52) * Math.PI * 2,
      x = Math.sin(a) * (WORLD_RADIUS - 3),
      z = Math.cos(a) * (WORLD_RADIUS - 3);
    scenery.place(
      i % 4 === 0 ? "CoastalCliff" : "Rock_Medium_3",
      x,
      z,
      3 + rand() * 8,
      a,
      -0.6,
    );
  }
}
