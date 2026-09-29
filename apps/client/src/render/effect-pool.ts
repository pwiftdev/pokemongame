import type { AbstractMesh } from "@babylonjs/core";

type Effect = {
  mesh: AbstractMesh;
  age: number;
  duration: number;
  update: (t: number) => void;
  cleanup?: () => void;
};
export function createEffectPool(limit = 220) {
  const effects: Effect[] = [];
  function release(effect: Effect) {
    effect.mesh.dispose();
    effect.cleanup?.();
  }
  return {
    track(
      mesh: AbstractMesh,
      duration: number,
      update: (t: number) => void,
      cleanup?: () => void,
      delay = 0,
    ) {
      mesh.isPickable = false;
      mesh.setEnabled(delay === 0);
      effects.push({ mesh, duration, update, cleanup, age: -delay });
      if (!delay) update(0);
    },
    update(dt: number, reduced: boolean) {
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.age += dt;
        if (effect.age < 0) continue;
        effect.mesh.setEnabled(true);
        effect.update(Math.min(1, effect.age / effect.duration));
        if (reduced && effect.mesh.name !== "combat number")
          effect.mesh.visibility *= 0.35;
        if (effect.age >= effect.duration) {
          release(effect);
          effects.splice(i, 1);
        }
      }
      while (effects.length > limit) release(effects.shift()!);
    },
    get count() {
      return effects.length;
    },
    get activeNames() {
      return [
        ...new Set(
          effects
            .filter((effect) => effect.age >= 0)
            .map((effect) => effect.mesh.name),
        ),
      ];
    },
    dispose() {
      for (const effect of effects) release(effect);
      effects.length = 0;
    },
  };
}
