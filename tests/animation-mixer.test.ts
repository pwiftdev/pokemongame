import {
  Animation,
  AnimationGroup,
  NullEngine,
  Scene,
  TransformNode,
} from "@babylonjs/core";
import { expect, it, vi } from "vitest";
import { createAnimationMixer } from "../apps/client/src/render/animation-mixer";
it("keeps steady loops cheap, blends transitions and finishes one-shot reactions", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    root = new TransformNode("pet", scene);
  vi.spyOn(engine, "getDeltaTime").mockReturnValue(20);
  const groups = ["Idle", "HitReact"].map((name) => {
    const group = new AnimationGroup(`pet:${name}`, scene);
    const track = new Animation(
      name,
      "rotation.y",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
    );
    track.setKeys([
      { frame: 0, value: 0 },
      { frame: 30, value: 1 },
    ]);
    group.addTargetedAnimation(track, root);
    return group;
  });
  const fallback = new AnimationGroup("fallback:Idle", scene);
  fallback.addTargetedAnimation(
    groups[0].targetedAnimations[0].animation.clone(),
    root,
  );
  const startFallback = vi.spyOn(fallback, "start");
  const mixer = createAnimationMixer(scene, [...groups, fallback]);
  const tick = (count: number) => {
    for (let i = 0; i < count; i++)
      scene.onBeforeAnimationsObservable.notifyObservers(scene);
  };
  try {
    mixer.play("Idle");
    const weights = vi.spyOn(groups[0], "setWeightForAllAnimatables");
    tick(30);
    expect(weights).not.toHaveBeenCalled();
    expect(groups[0].isPlaying).toBe(true);
    expect(startFallback).not.toHaveBeenCalled();
    mixer.play("HitReact", false, 0.2);
    tick(7);
    expect(weights).toHaveBeenCalled();
    expect(mixer.clip).toBe("HitReact");
    tick(10);
    expect(groups[1].isPlaying).toBe(false);
    mixer.play("Idle");
    tick(10);
    expect(groups[0].isPlaying).toBe(true);
    expect(startFallback).not.toHaveBeenCalled();
    mixer.stop();
    expect(groups[0].isPlaying).toBe(false);
  } finally {
    mixer.dispose();
    scene.dispose();
    engine.dispose();
    vi.restoreAllMocks();
  }
});
