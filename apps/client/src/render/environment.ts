import { STORY_PLACES } from "../../../../packages/shared/story";
import { HABITATS } from "../../../../packages/shared/encounters";
import { buildRegionalLandmarks } from "./regional-landmarks";
import { loadWildlife } from "./wildlife";
import { WORLD_RADIUS, WAYSTONES } from "../../../../packages/shared/regions";
import { createTorchFire } from "./fire";
import {
  ArcRotateCamera,
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Scene,
} from "@babylonjs/core";
import { OBSTACLES, PLACES, SPAWNS } from "../../../../packages/shared/data";
import { biomeAt, terrainHeight } from "../../../../packages/shared/rules";
import { createAtmosphere } from "./atmosphere";
import { createWorldLabel } from "./labels";
import { buildTerrain } from "./terrain";
import { loadScenery } from "./scenery";

export async function buildEnvironment(scene: Scene) {
  const scenery = await loadScenery(scene);
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
  place("Stall_Empty", -10, -29, 3.1, Math.PI);
  place("FarmCrate_Apple", -10, -28, 0.6, 0, 0.8);
  place("BookStand", -1, -22, 1.8, Math.PI);
  place("Banner_1", 1.3, -22, 2.6, Math.PI);
  place("Chest_Wood", -2.1, -22, 0.75);
  place("Prop_Wagon", -15, -39, 2.3, 0.4);
  const torchPositions = [
    [-6, -24],
    [6, -24],
    [-6, -33],
    [6, -33],
    [-19, -11],
    [23, -3],
    [31, 4],
  ];
  for (const [x, z] of torchPositions) place("Torch_Metal", x, z, 2.5);
  const fire = createTorchFire(scene, torchPositions);
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
  for (const p of PLACES.filter((p) => p.kind !== "landmark")) {
    const label = createWorldLabel(scene, p.name);
    label.mesh.position.set(
      p.x,
      terrainHeight(p.x, p.z) +
        (STORY_PLACES.some((npc) => npc.id === p.id) ? 2.5 : 4.2),
      p.z,
    );
  }
  let seed = 821;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const clear = (x: number, z: number, margin: number) =>
    Math.hypot(x, z) < WORLD_RADIUS - 10 &&
    !terrain.nearPath(x, z, margin) &&
    !OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius + margin) &&
    !SPAWNS.some(
      (s) => Math.hypot(x - s.x, z - s.z) < (s.boss ? 10 : margin),
    ) &&
    !PLACES.some((p) => Math.hypot(x - p.x, z - p.z) < margin + 2);
  const trees = ["CommonTree_1", "CommonTree_3", "CommonTree_5"];
  for (let i = 0; i < 4200; i++) {
    const x = (rand() - 0.5) * (WORLD_RADIUS * 2 - 12),
      z = (rand() - 0.5) * (WORLD_RADIUS * 2 - 12);
    if (!clear(x, z, 4.5)) continue;
    const biome = biomeAt(x, z);
    if (biome === "town" && Math.abs(x) < 25 && z > -49) continue;
    const name =
      biome === "tundra"
        ? "SnowPine"
        : biome === "highlands"
          ? "AutumnTree"
          : biome === "marsh"
            ? "MoonTree"
            : biome === "desert"
              ? "Sandstone"
              : biome === "ruins"
                ? `Rock_Medium_${1 + (i % 3)}`
                : biome === "forest"
                  ? i % 2
                    ? "Pine_1"
                    : "Pine_3"
                  : trees[i % trees.length];
    place(
      name,
      x,
      z,
      biome === "ruins" || biome === "desert" ? 2 + rand() * 5 : 6 + rand() * 7,
      rand() * Math.PI * 2,
    );
  }
  const plants = [
    "Bush_Common",
    "Bush_Common_Flowers",
    "Fern_1",
    "Flower_3_Group",
    "Flower_4_Group",
    "Grass_Common_Short",
    "Grass_Wispy_Tall",
  ];
  for (let i = 0; i < 2600; i++) {
    const x = (rand() - 0.5) * (WORLD_RADIUS * 2 - 12),
      z = (rand() - 0.5) * (WORLD_RADIUS * 2 - 12);
    if (
      !clear(x, z, 2.5) ||
      ["ruins", "desert", "tundra"].includes(biomeAt(x, z))
    )
      continue;
    place(
      plants[i % plants.length],
      x,
      z,
      0.35 + rand() * 0.5,
      rand() * Math.PI * 2,
      undefined,
      true,
    );
  }
  const grass = [[], [], []] as Array<
    Array<{ x: number; z: number; height: number; rotation: number }>
  >;
  for (let i = 0; i < 95000; i++) {
    const x = (rand() - 0.5) * (WORLD_RADIUS * 2 - 12),
      z = (rand() - 0.5) * (WORLD_RADIUS * 2 - 12);
    if (
      !clear(x, z, 1.7) ||
      ["ruins", "desert", "tundra"].includes(biomeAt(x, z))
    )
      continue;
    if (biomeAt(x, z) === "town" && Math.abs(x) < 9 && z > -36) continue;
    const patch = Math.sin(x * 0.31) * Math.cos(z * 0.23);
    if (patch < -0.4) continue;
    const variety = i % 7 < 4 ? 0 : i % 7 < 6 ? 1 : 2;
    for (let cluster = 0; cluster < (variety === 2 ? 1 : 3); cluster++) {
      const px = x + (rand() - 0.5) * 1.6,
        pz = z + (rand() - 0.5) * 1.6;
      if (cluster && !clear(px, pz, 1.7)) continue;
      grass[variety].push({
        x: px,
        z: pz,
        height: 0.3 + rand() * 0.38,
        rotation: rand() * Math.PI * 2,
      });
    }
  }
  ["Grass_Common_Short", "Grass_Wispy_Tall", "Flower_3_Group"].forEach(
    (name, i) =>
      scenery.scatter(
        name,
        grass[i].filter((_, n) => i < 2 || n % 15 === 0),
      ),
  );
  for (let i = 0; i < 38; i++) {
    const a = (i / 38) * Math.PI * 2;
    place(
      `Rock_Medium_${1 + (i % 3)}`,
      Math.sin(a) * (WORLD_RADIUS - 2),
      Math.cos(a) * (WORLD_RADIUS - 2),
      2 + rand() * 2,
      a,
      -0.8,
    );
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 0.67;
    place(
      "Rock_Medium_3",
      Math.sin(a) * (WORLD_RADIUS + 60),
      Math.cos(a) * (WORLD_RADIUS + 80),
      15 + rand() * 12,
      a,
      -4,
    );
  }

  for (const stone of WAYSTONES) {
    place("DoorFrame_Round_Brick", stone.x, stone.z + 3.5, 5);
    for (const dx of [-3, 3])
      place("Corner_ExteriorWide_Brick", stone.x + dx, stone.z + 3.5, 3.3);
    place("Banner_1", stone.x - 4, stone.z, 3.5);

    if (["desert", "marsh", "tundra", "highlands"].includes(stone.biome)) {
      place("Stall_Empty", stone.x + 9, stone.z - 4, 3.4);
      place("Chest_Wood", stone.x + 8, stone.z - 2, 1);
      place("Bench", stone.x - 8, stone.z - 4, 1.2);
      for (let i = 0; i < 7; i++)
        place(
          stone.biome === "marsh"
            ? "TwistedTree_1"
            : "Wall_UnevenBrick_Straight",
          stone.x + Math.cos(i * 1.7) * 16,
          stone.z + Math.sin(i * 1.7) * 16,
          stone.biome === "marsh" ? 12 : 4,
          i,
        );
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
      if (!reduced) {
        crystal.rotation.y = t * 0.3;
      }
    },
    setQuality: scenery.setQuality,
    dispose() {
      wildlife.dispose();
      fire.dispose();
      scenery.dispose();
      atmosphere.dispose();
    },
  };
}
