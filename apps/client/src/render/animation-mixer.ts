import type { AnimationGroup, Scene } from "@babylonjs/core";

export function createAnimationMixer(scene: Scene, groups: AnimationGroup[]) {
  const layers = new Map<
    AnimationGroup,
    { weight: number; age: number; duration: number; loop: boolean }
  >();
  let current: AnimationGroup | undefined;
  const observer = scene.onBeforeAnimationsObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    for (const [group, layer] of layers) {
      layer.age += dt;
      layer.weight += ((group === current ? 1 : -1) * dt) / 0.12;
      layer.weight = Math.max(0, Math.min(1, layer.weight));
      if (!layer.loop && layer.age >= layer.duration) {
        group.goToFrame(group.to);
        group.pause();
      }
      if (layer.weight === 0 && group !== current) {
        group.stop();
        layers.delete(group);
      }
    }
    const total = [...layers.values()].reduce(
      (sum, layer) => sum + layer.weight,
      0,
    );
    for (const [group, layer] of layers)
      group.setWeightForAllAnimatables(layer.weight / Math.max(0.001, total));
  });
  return {
    play(clip: string, loop = true, duration?: number, restart = false) {
      const group = groups.find((g) => g.name.endsWith(`:${clip}`));
      if (!group) return 0;
      const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 30;
      const seconds = Math.max(0.05, (group.to - group.from) / fps);
      if (group === current && !restart) {
        group.speedRatio = duration ? seconds / duration : 1;
        return duration ?? seconds;
      }
      const initial =
        current === group ? (layers.get(group)?.weight ?? 1) : current ? 0 : 1;
      current = group;
      group.stop();
      group.enableBlending = false;
      group.start(true, duration ? seconds / duration : 1);
      group.setWeightForAllAnimatables(initial);
      layers.set(group, {
        weight: initial,
        age: 0,
        duration: duration ?? seconds,
        loop,
      });
      return duration ?? seconds;
    },
    stop() {
      current = undefined;
      for (const group of layers.keys()) group.stop();
      layers.clear();
    },
    get clip() {
      return current?.name.split(":").at(-1);
    },
    dispose() {
      scene.onBeforeAnimationsObservable.remove(observer);
      for (const group of layers.keys()) group.stop();
      layers.clear();
    },
  };
}
