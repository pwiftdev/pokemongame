import { dressArena } from "./arena";
import {
  FIRE_SOURCES,
  TOWN_TORCHES,
} from "../../../../packages/shared/environment-features";
import { STORY_PLACES } from "../../../../packages/shared/story";
import { HABITATS } from "../../../../packages/shared/encounters";
import { buildRegionalLandmarks } from "./regional-landmarks";
import { loadWildlife } from "./wildlife";
import { WAYSTONES } from "../../../../packages/shared/regions";
import { createTorchFire } from "./fire";
import {
  ArcRotateCamera,
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Scene,
} from "@babylonjs/core";
import { OBSTACLES, PLACES, SPAWNS } from "../../../../packages/shared/data";
import { terrainHeight } from "../../../../packages/shared/rules";
import { createAtmosphere } from "./atmosphere";
import { createWorldLabel } from "./labels";
import { buildTerrain } from "./terrain";
import { loadScenery } from "./scenery";
import { dressBiomes } from "./biome-vegetation";
import { createInlandWater } from "./inland-water";
import { createBiomeLife } from "./biome-life";
import { createWaterfall } from "./waterfall";

export async function buildEnvironment(
  scene: Scene,
  onReady?: Parameters<typeof loadScenery>[1],
) {
  const scenery = await loadScenery(scene, onReady);
  let wildlife: Awaited<ReturnType<typeof loadWildlife>>;
  try {
    wildlife = await loadWildlife(scene);
  } catch (error) {
    scenery.dispose();
    throw error;
  }
  try {
    return assembleEnvironment(scene, scenery, wildlife);
  } catch (error) {
    scenery.dispose();
    wildlife.dispose();
    throw error;
  }
}

function assembleEnvironment(
  scene: Scene,
  scenery: Awaited<ReturnType<typeof loadScenery>>,
  wildlife: Awaited<ReturnType<typeof loadWildlife>>,
) {
  const terrain = buildTerrain(scene);
  const arena = dressArena(scene, scenery);
  buildRegionalLandmarks(scenery);
  const atmosphere = createAtmosphere(scene);
  const place = scenery.place;
  for (const p of STORY_PLACES) {
    if (p.role === "parcel") place("Chest_Wood", p.x, p.z, 0.7);
    else if (p.role === "ward") {
      place("Rock_Medium_2", p.x, p.z, 1.1);
      place("Torch_Metal", p.x + 1, p.z, 2.5);
    } else {
      place("Banner_1", p.x + 2, p.z + 1, 2.4);
      place("BookStand", p.x - 1.5, p.z + 1, 1.1);
    }
  }
  for (const habitat of HABITATS.filter((h) => h.kind === "camp")) {
    place("Prop_WoodenFence_Single", habitat.x + 5, habitat.z + 5, 1.2, 0.7);
    place("Crate_Wooden", habitat.x + 6, habitat.z + 3, 0.8);
    place("Rock_Medium_1", habitat.x - 5, habitat.z + 3, 1.2);
  }
  place("Rock_Medium_3", -81, 3, 2.3);
  place("Rock_Medium_2", -74, 2, 1.5);
  place("CommonTree_3", -67, 40, 6);

  OBSTACLES.slice(0, 5).forEach((o, i) =>
    scenery.cottage(o.x, o.z, i, o.radius / 4.5),
  );
  place("Mill", -35, 10, 9, Math.PI / 2);
  place("Stall_Empty", 10, -29, 2.5, Math.PI);
  place("FarmCrate_Apple", 10, -28, 0.6, 0, 0.8);
  place("BookStand", -1, -22, 1.8, Math.PI);
  place("Banner_1", 1.3, -22, 2.6, Math.PI);
  place("Chest_Wood", -2.1, -22, 0.75);
  place("Prop_Wagon", -15, -39, 2.3, 0.4);
  for (const [x, z] of TOWN_TORCHES) place("Torch_Metal", x, z, 2.5);
  const fire = createTorchFire(scene, FIRE_SOURCES);
  for (const [x, z] of [
    [-7, -30],
    [7, -30],
    [-40, 5],
  ])
    place("Bench", x, z, 1.05, Math.PI / 2);
  place("Cauldron", -40, 7, 0.8);
  place("Prop_Crate", -39, 7.5, 0.85, 0.25);
  place("Lantern_Wall", -39, 7.5, 0.6, 0, 0.85);
  for (const x of [-10, 10, -21])
    for (let i = 0; i < 3; i++)
      place("Prop_WoodenFence_Single", x - 2 + i * 2, -39.5, 1.1);
  place("TwistedTree_1", 35, 23, 13);
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.399,
      radius = 4 + (i % 5) * 1.2;
    place(
      "Mushroom_Common",
      35 + Math.cos(angle) * radius,
      23 + Math.sin(angle) * radius,
      0.5 + (i % 3) * 0.18,
      angle,
      undefined,
      true,
    );
  }
  for (const x of [-5, 5]) place("DoorFrame_Round_Brick", x, 61, 6);
  for (const [x, z, height, rotation] of [
    [-11, 58, 4.8, 0],
    [-10, 69, 3.4, 1.4],
    [18, 66, 5.5, 2.7],
    [20, 55, 3.2, 0.7],
  ]) {
    place("Corner_ExteriorWide_Brick", x, z, height, rotation);
    place(
      "Wall_UnevenBrick_Straight",
      x + 1.2,
      z + 1.8,
      height * 0.45,
      rotation + 0.4,
    );
    for (let i = 0; i < 5; i++)
      place(
        "Prop_Brick1",
        x + Math.sin(i * 2.4) * 2,
        z + Math.cos(i * 2.4) * 2,
        0.25 + (i % 3) * 0.1,
        i,
        undefined,
        true,
      );
  }
  place("Rock_Medium_3", 0, 61, 2.8);
  const bossHome = SPAWNS.find((spawn) => spawn.boss)!;
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    const x = bossHome.x + Math.cos(a) * 8,
      z = bossHome.z + Math.sin(a) * 8;
    if (!terrain.nearPath(x, z, 4))
      place("Rock_Medium_1", x, z, 2 + (i % 3) * 0.4, a);
  }
  const storyPlaceIds = new Set(STORY_PLACES.map((place) => place.id));
  for (const p of PLACES.filter(
    (place) => place.kind !== "landmark" && !storyPlaceIds.has(place.id),
  )) {
    const label = createWorldLabel(scene, p.name);
    label.mesh.position.set(p.x, terrainHeight(p.x, p.z) + 4.2, p.z);
  }
  dressBiomes(scenery);
  const inlandWater = createInlandWater(scene);
  const life = createBiomeLife(scene);
  const waterfall = createWaterfall(scene);
  for (const stone of WAYSTONES) {
    place("DoorFrame_Round_Brick", stone.x, stone.z + 3.5, 5);
    for (const dx of [-3, 3])
      place("Corner_ExteriorWide_Brick", stone.x + dx, stone.z + 3.5, 3.3);
    place("Banner_1", stone.x - 4, stone.z, 3.5);

    if (["desert", "marsh", "tundra", "highlands"].includes(stone.biome)) {
      place("Stall_Empty", stone.x + 9, stone.z - 4, 3.4);
      place("Chest_Wood", stone.x + 8, stone.z - 2, 1);
      place("Bench", stone.x - 8, stone.z - 4, 1.2);
    }
  }
  const glow = new StandardMaterial("tideglass glow", scene);
  glow.diffuseColor = Color3.FromHexString("#b7e9db");
  glow.emissiveColor = glow.diffuseColor.scale(0.5);
  const crystal = MeshBuilder.CreatePolyhedron(
    "tideglass crystal",
    { type: 1, size: 1 },
    scene,
  );
  crystal.material = glow;
  crystal.position.set(0, terrainHeight(0, 61) + 4, 61);
  crystal.scaling.set(0.8, 1.7, 0.8);
  crystal.isPickable = false;
  return {
    update(t: number, reduced: boolean) {
      const focus =
        scene.activeCamera instanceof ArcRotateCamera
          ? scene.activeCamera.target
          : { x: 0, z: -32 };
      wildlife.update(t, focus, reduced);
      scenery.update(t, focus, reduced);
      fire.update(reduced ? 0 : t);
      terrain.water.update(reduced ? 0 : t);
      atmosphere.update(reduced ? 0 : t);
      inlandWater.update(reduced ? 0 : t);
      waterfall.update(reduced ? 0 : t);
      life.update(t, focus, reduced);
      if (!reduced) {
        crystal.rotation.y = t * 0.3;
      }
    },
    setQuality(low: boolean) {
      scenery.setQuality(low);
      life.setQuality(low);
    },
    dispose() {
      arena.dispose();
      wildlife.dispose();
      inlandWater.dispose();
      waterfall.dispose();
      life.dispose();
      fire.dispose();
      scenery.dispose();
      atmosphere.dispose();
    },
  };
}
