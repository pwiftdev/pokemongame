import { npcAppearance, type NpcRole } from "./npc-appearance";
import { PLACES } from "../../../../packages/shared/data";
import { createTorchFire } from "./fire";
import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Scene,
} from "@babylonjs/core";
import {
  STORY_PLACES,
  currentQuest,
  questDestination,
} from "../../../../packages/shared/story";
import { terrainHeight } from "../../../../packages/shared/rules";
import type { Profile } from "../../../../packages/shared/types";
import { createWorldLabel } from "./labels";
import type { loadTrainers } from "./trainer";

export function createStoryWorld(
  scene: Scene,
  trainers: Awaited<ReturnType<typeof loadTrainers>>,
) {
  const wards = STORY_PLACES.filter((p) => p.role === "ward");
  const fire = createTorchFire(
    scene,
    wards.map((p) => [p.x + 1, p.z]),
  );
  fire.setActive([]);
  const observer = scene.onBeforeRenderObservable.add(() =>
    fire.update(performance.now() / 1000),
  );
  const citizens = [
    ...STORY_PLACES.filter((p) => p.kind === "quest").map((p) => ({
      ...p,
      role: p.role as NpcRole,
    })),
    ...(
      [
        ["heal", "healer", "Lina · Springhouse healer", -1.8, 0],
        ["shop", "merchant", "Mira · Field supplies", 1.8, 0],
        ["quest", "captain", "Captain Iona · Expeditions", 2.3, -1.6],
        ["stable", "keeper", "Borin · Companion keeper", 0, -2],
        ["arena", "marshal", "Marshal Vale · Arena", 0, -8.5],
      ] as const
    ).map(([id, role, name, dx, dz]) => {
      const place = PLACES.find((p) => p.id === id)!;
      return { id, role, name, x: place.x + dx, z: place.z + dz };
    }),
  ];
  const npcs = citizens.map((place) => {
    const preset = npcAppearance(place.role);
    const actor = trainers.create(
      `npc:${place.id}`,
      false,
      preset.classId,
      preset.appearance,
      preset.armed,
    );
    actor.root.position.set(place.x, terrainHeight(place.x, place.z), place.z);
    actor.root.rotation.y = Math.PI;
    for (const mesh of actor.meshes) {
      mesh.isPickable = false;
      mesh.metadata = { ...mesh.metadata, castShadow: true, npc: place.id };
    }
    const [name, role] = place.name.split(" · ");
    const label = createWorldLabel(scene, name);
    label.update(name, role);
    label.mesh.position.set(
      place.x,
      terrainHeight(place.x, place.z) + actor.height + 0.35,
      place.z,
    );
    return { actor, label };
  });
  const labels = STORY_PLACES.filter((p) => p.kind === "landmark").map(
    (place) => {
      const label = createWorldLabel(scene, place.name);
      label.mesh.position.set(
        place.x,
        terrainHeight(place.x, place.z) + 2.6,
        place.z,
      );
      return label;
    },
  );
  const marker = MeshBuilder.CreateTorus(
    "Story objective",
    { diameter: 2.2, thickness: 0.07, tessellation: 40 },
    scene,
  );
  const material = new StandardMaterial("Story gold", scene);
  material.diffuseColor = Color3.FromHexString("#eac96f");
  material.emissiveColor = Color3.FromHexString("#9c6c22");
  marker.material = material;
  marker.isPickable = false;
  marker.setEnabled(false);
  const label = createWorldLabel(scene, "◆ QUEST OBJECTIVE");
  label.mesh.setEnabled(false);
  return {
    setProfile(profile: Profile) {
      fire.setActive(
        wards.map(
          (p) =>
            !!profile.quests[
              `objective:${p.id === "tide-beacon" ? "story-beacon" : "story-wards"}:${p.id}`
            ],
        ),
      );
      const quest = currentQuest(profile);
      const destination = quest && questDestination(profile, quest);
      marker.setEnabled(!!destination);
      label.mesh.setEnabled(!!destination);
      if (!destination) return;
      marker.position.set(
        destination.x,
        terrainHeight(destination.x, destination.z) + 0.13,
        destination.z,
      );
      label.mesh.position.copyFrom(marker.position);
      label.mesh.position.y += 3.0;
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      fire.dispose();
      for (const npc of npcs) {
        npc.actor.dispose();
        npc.label.dispose();
      }
      for (const name of labels) name.dispose();
      label.dispose();
      marker.dispose();
      material.dispose();
    },
  };
}
