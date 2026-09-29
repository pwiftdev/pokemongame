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
  const npcs = STORY_PLACES.filter((p) => p.kind === "quest").map((place) => {
    const actor = trainers.create(
      `story:${place.id}`,
      false,
      place.role === "ranger" ? "rogue" : "mage",
    );
    actor.root.position.set(place.x, terrainHeight(place.x, place.z), place.z);
    actor.root.rotation.y = Math.PI;
    for (const mesh of actor.meshes) {
      mesh.isPickable = false;
      mesh.metadata = { castShadow: true };
    }
    return actor;
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
      for (const npc of npcs) npc.dispose();
      for (const name of labels) name.dispose();
      label.dispose();
      marker.dispose();
      material.dispose();
    },
  };
}
