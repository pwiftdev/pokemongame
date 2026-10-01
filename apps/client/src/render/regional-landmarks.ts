import { arenaClearing } from "./arena-clearance";
import { CAMP_SITES } from "../../../../packages/shared/environment-features";
import {
  LAKES,
  LANDMARKS,
  roadDistance,
} from "../../../../packages/shared/geography";
import { terrainHeight } from "../../../../packages/shared/rules";
import type { loadScenery } from "./scenery";
type Scenery = Awaited<ReturnType<typeof loadScenery>>;

export function buildRegionalLandmarks(scenery: Scenery) {
  const place = scenery.place;
  for (const p of LANDMARKS) place(p.model, p.x, p.z, p.height, p.yaw);
  for (const lake of LAKES) {
    const desert = lake.biome === "desert",
      frozen = lake.frozen;
    for (let i = 0; i < 24; i++) {
      const a = i * 2.399,
        edge = 1.14 + (i % 3) * 0.065;
      const x = lake.x + Math.cos(a) * lake.rx * edge,
        z = lake.z + Math.sin(a) * lake.rz * edge;
      if (roadDistance(x, z) < 4 || arenaClearing(x, z, 2)) continue;
      if (i % 4 === 0)
        place(
          frozen
            ? "SnowPine"
            : desert
              ? "OasisPalm"
              : lake.biome === "marsh"
                ? "BareTree"
                : "SilverBirch",
          x,
          z,
          frozen ? 7 + (i % 5) : desert ? 7 + (i % 5) : 5 + (i % 4),
          a,
        );
      else
        place(
          frozen
            ? "Rock_Medium_2"
            : desert
              ? "Sandstone"
              : i % 3
                ? "Grass_Wispy_Tall"
                : "Reeds",
          x,
          z,
          frozen
            ? 1 + (i % 3)
            : desert
              ? 0.7 + (i % 2)
              : i % 3
                ? 1.1 + (i % 3) * 0.25
                : 0.75,
          a,
          undefined,
          true,
        );
    }
    if (!frozen && !desert) {
      for (let i = 0; i < 11; i++)
        place(
          "WaterLily",
          lake.x + Math.cos(i * 2.4) * lake.rx * 0.62,
          lake.z + Math.sin(i * 2.4) * lake.rz * 0.64,
          0.12 + (i % 3) * 0.035,
          i,
          lake.level + 0.03,
          true,
        );
    }
  }
  place("FishingDock", 34, -30, 4.4, 0, -3.05);
  place("Canoe", 39, -31, 0.65, 0.6, -0.05);
  place("FishingDock", -81, -8, 4.4, 0, -2.7);
  place("BrokenDock", 137, 46, 4.4, 0, 0.3);
  place("Canoe", 133, 45, 0.65, 0.5, 3.3);
  place("FishingDock", 209, 16, 4.4, 0, 0.9);
  place("BrokenDock", 220, 86, 4.4, 0.25, 2.3);
  for (let i = 0; i < 6; i++) {
    const x = 29 + i * 6;
    place("Corner_ExteriorWide_Brick", x, 82, 3.5 + (i % 3) * 1.7, 0);
    if (i % 2 === 0) place("CastleWall", x + 1.5, 84, 2.8, 0);
    place("Rock_Medium_2", x + 2, 81, 0.7, i, undefined, true);
  }
  place("DoorFrame_Round_Brick", 48, 86, 7, Math.PI / 2);
  place("FallenLog", 74, 13, 1.3, 0.5);
  place("OldStump", 80, 20, 2.3, 0.3);
  place("FallenLog", 44, 42, 1.5, 2.1);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    place(
      "Mushroom_Common",
      77 + Math.cos(a) * 5,
      29 + Math.sin(a) * 5,
      0.4 + (i % 3) * 0.16,
      a,
      undefined,
      true,
    );
  }
  for (const [x, z, yaw] of CAMP_SITES) {
    place("ExpeditionTent", x, z, 2.7, yaw);
    place("Campfire", x + 4, z + 3, 0.45);
    place("LogPile", x - 3, z + 1, 1.2, yaw);
    place("Chest_Wood", x + 2, z - 1, 0.8, yaw);
    place("Banner_1", x - 2, z + 4, 3.5);
  }
  for (let i = 0; i < 7; i++) {
    const x = -46 + i * 15,
      z = 266 + Math.abs(i - 3) * 2;
    place("Rock_Medium_3", x, z, 12 + (i % 3) * 5, i);
    place("SnowPine", x - 3, z - 10, 8 + (i % 3) * 2, i);
  }
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 5; i++) {
      const x = -75 + i * 5,
        z = -1 - row * 5;
      if (
        roadDistance(x, z) > 5 &&
        !LAKES.some(
          (lake) =>
            Math.hypot((x - lake.x) / lake.rx, (z - lake.z) / lake.rz) < 1.2,
        )
      )
        place("CommonTree_3", x, z, 4.2 + (i % 2), i);
    }
  const crops = {
    Wheat: [] as Array<{
      x: number;
      z: number;
      height: number;
      rotation: number;
    }>,
    Corn: [] as Array<{
      x: number;
      z: number;
      height: number;
      rotation: number;
    }>,
    Pumpkin: [] as Array<{
      x: number;
      z: number;
      height: number;
      rotation: number;
    }>,
  };
  for (const [field, cx, cz] of [
    ["Wheat", -28, -167],
    ["Corn", 39, -157],
    ["Pumpkin", -27, -220],
  ] as const) {
    for (let row = 0; row < 9; row++)
      for (let column = 0; column < 12; column++) {
        const x = cx + column * 0.85,
          z = cz + row * 1.1;
        if (roadDistance(x, z) > 4)
          crops[field].push({
            x,
            z,
            height: field === "Pumpkin" ? 0.55 : field === "Corn" ? 1.4 : 0.85,
            rotation: column * 0.23,
          });
      }
    for (let i = 0; i < 5; i++)
      place("Prop_WoodenFence_Single", cx + i * 2.5, cz - 1.7, 1.2);
    place("Prop_Wagon", cx - 4, cz, 2.2, 1.2);
    place("FarmCrate_Apple", cx - 4, cz + 3, 0.7);
  }
  for (const [name, points] of Object.entries(crops))
    scenery.scatter(name, points);
  for (let i = 0; i < 7; i++)
    place("CastleWall", 27 + i * 3, -204, 2 + (i % 3) * 0.3, 0);
  place("Pennant", 36, -198, 2.5, 0, terrainHeight(36, -198) + 10.5);
  place("Bench", -51, -132, 1.1, 0.4);
}
