import type { Scene } from "@babylonjs/core";
import { REGIONS } from "../../../../packages/shared/regions";
import { terrainHeight, walkable } from "../../../../packages/shared/rules";
import { loadModelLibrary, modelUrls } from "./models";
export async function loadWildlife(scene: Scene) {
  const names = ["Deer", "Stag", "Fox", "Wolf", "Horse", "Alpaca"];
  const library = await loadModelLibrary(scene, modelUrls("animals", names));
  const homes = REGIONS.flatMap((r, ri) =>
    Array.from({ length: 5 }, (_, i) => ({
      id: `wildlife-${ri}-${i}`,
      name:
        r.id === "tundra"
          ? "Wolf"
          : r.id === "desert"
            ? "Alpaca"
            : r.id === "highlands"
              ? "Horse"
              : names[(i + ri) % 4],
      x: r.x + Math.cos(i * 2.4) * 25,
      z: r.z + Math.sin(i * 2.4) * 25,
      phase: ri * 3 + i,
    })),
  );
  const actors = new Map<
    string,
    { actor: ReturnType<typeof library.create>; motion: string; phase: number }
  >();
  let lastFocus = -1,
    lastTime = 0;
  return {
    update(time: number, focus: { x: number; z: number }, reduced: boolean) {
      const dt = Math.min(0.1, Math.max(0, time - lastTime));
      lastTime = time;
      if (time - lastFocus > 0.5) {
        lastFocus = time;
        for (const h of homes) {
          const visible = Math.hypot(focus.x - h.x, focus.z - h.z) < 70;
          if (visible && !actors.has(h.id)) {
            const actor = library.create(
              h.name,
              h.id,
              h.name === "Fox" ? 0.65 : h.name === "Wolf" ? 0.95 : 1.8,
              true,
            );
            actor.meshes.forEach((m) => {
              m.isPickable = false;
              m.metadata = { cameraObstacle: false };
            });
            const x = h.x + Math.sin(h.phase) * 4,
              z = h.z + Math.cos(h.phase) * 4;
            actor.root.position.set(x, terrainHeight(x, z), z);
            actors.set(h.id, { actor, motion: "", phase: h.phase });
          }
          if (!visible && actors.has(h.id)) {
            actors.get(h.id)!.actor.dispose();
            actors.delete(h.id);
          }
        }
      }
      for (const h of homes) {
        const entry = actors.get(h.id);
        if (!entry) continue;
        const walking = !reduced && Math.sin(time * 0.18 + h.phase) > 0.1;
        if (walking) entry.phase += dt * 0.13;
        const t = entry.phase;
        const x = h.x + Math.sin(t) * 4,
          z = h.z + Math.cos(t) * 4;
        const motion = walking && !reduced ? "Walk" : "Eating";
        if (motion !== entry.motion) {
          entry.actor.animations.forEach((a) => a.stop());
          entry.actor.animations
            .find((a) => a.name.endsWith(":" + motion))
            ?.start(true);
          entry.motion = motion;
        }
        if (walking && walkable(x, z)) {
          entry.actor.root.position.set(x, terrainHeight(x, z), z);
          entry.actor.root.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t));
        }
      }
    },
    dispose() {
      actors.forEach((e) => e.actor.dispose());
      library.dispose();
    },
  };
}
