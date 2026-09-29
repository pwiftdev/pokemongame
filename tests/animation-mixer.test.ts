import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Animation,
  AnimationGroup,
  NullEngine,
  Scene,
  TransformNode,
} from "@babylonjs/core";
import { createAnimationMixer } from "../apps/client/src/render/animation-mixer";
import {
  combatMotion,
  movementScale,
  impactDelay,
} from "../apps/client/src/render/combat-motion";
import { moveAmongCreatures } from "../packages/shared/rules";
import clips from "../apps/client/src/render/hero-clips.json";
import { CLASSES, CLASS_IDS } from "../packages/shared/classes";

const engines: NullEngine[] = [];
afterEach(() => {
  engines.splice(0).forEach((engine) => engine.dispose());
  vi.restoreAllMocks();
});
function fixture() {
  const engine = new NullEngine();
  engines.push(engine);
  vi.spyOn(engine, "getDeltaTime").mockReturnValue(30);
  const scene = new Scene(engine),
    bone = new TransformNode("bone", scene);
  const groups = ["Idle", "Run", "Attack"].map((name) => {
    const group = new AnimationGroup(`hero:${name}`, scene);
    const animation = new Animation(
      name,
      "position.x",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
    );
    animation.setKeys([
      { frame: 0, value: 0 },
      { frame: 30, value: 1 },
    ]);
    group.addTargetedAnimation(animation, bone);
    return group;
  });
  const mixer = createAnimationMixer(scene, groups);
  const step = () => scene.onBeforeAnimationsObservable.notifyObservers(scene);
  return { scene, groups, mixer, step };
}
describe("character animation transitions", () => {
  it("crossfades and normalizes rapid transitions without cutting the outgoing clip", () => {
    const { groups, mixer, step } = fixture();
    mixer.play("Idle");
    mixer.play("Run");
    step();
    expect(groups[0].isStarted).toBe(true);
    expect(groups[0].animatables[0].weight).toBeCloseTo(0.75);
    expect(groups[1].animatables[0].weight).toBeCloseTo(0.25);
    mixer.play("Attack", false, 0.4);
    step();
    expect(
      groups.reduce((sum, g) => sum + (g.animatables[0]?.weight ?? 0), 0),
    ).toBeCloseTo(1);
    for (let i = 0; i < 6; i++) step();
    expect(groups[0].isStarted).toBe(false);
    expect(groups[2].animatables[0].weight).toBe(1);
    mixer.dispose();
  });
  it("holds one-shot end poses, can restart the same attack, and releases observers", () => {
    const { scene, groups, mixer, step } = fixture();
    mixer.play("Attack", false, 0.1);
    for (let i = 0; i < 5; i++) step();
    expect(groups[2].isPlaying).toBe(false);
    mixer.play("Attack", false, 0.1, true);
    expect(groups[2].isPlaying).toBe(true);
    expect(groups[2].animatables[0].weight).toBe(1);
    mixer.dispose();
    expect(groups.every((g) => !g.isStarted)).toBe(true);
    expect(scene.onBeforeAnimationsObservable.hasObservers()).toBe(false);
  });
  it("uses retained class clips with an impact inside each action", () => {
    for (const id of CLASS_IDS)
      for (const ability of CLASSES[id].abilities)
        for (let combo = 0; combo < 3; combo++) {
          const motion = combatMotion(id, ability.id, combo);
          expect([
            ...clips.common,
            ...clips[CLASSES[id].model as keyof typeof clips],
          ]).toContain(motion.clip);
          expect(motion.impact).toBeLessThan(motion.duration);
        }
    expect(combatMotion("knight", "slash", 0).clip).not.toBe(
      combatMotion("knight", "slash", 1).clip,
    );
    expect(combatMotion("mage", "meteor").clip).not.toBe(
      combatMotion("mage", "firebolt").clip,
    );
  });
  it("matches authoritative movement impairments at their expiry boundaries", () => {
    expect(movementScale(1100, 1200, 1000)).toBe(0);
    expect(movementScale(1100, 1200, 1100)).toBe(0.55);
    expect(movementScale(1100, 1200, 1200)).toBe(1);
    expect(movementScale(undefined, undefined, 1000)).toBe(1);
  });
});

describe("impact timing", () => {
  it("holds defeat presentation until the corresponding weapon or spell impact", () => {
    expect(impactDelay("slash", 2, 0.23, true)).toBeCloseTo(0.25);
    expect(impactDelay("meteor", 10, 0.55, true)).toBeCloseTo(1.01);
    expect(impactDelay("frostbolt", 10, 0.22, true)).toBeCloseTo(0.37);
    expect(impactDelay("barrier", 0, 0.05, true)).toBe(0);
  });
});

describe("creature body separation", () => {
  const creature = { x: -12, z: -5, hp: 100 };
  it("blocks penetration but allows retreat, tangential motion and passage after defeat", () => {
    const blocked = moveAmongCreatures(-12, -6.1, 0, 0.4, [creature]);
    expect(Math.hypot(blocked.x + 12, blocked.z + 5)).toBeCloseTo(1.05);
    const slide = moveAmongCreatures(-12, -6.1, 0.3, 0.2, [creature]);
    expect(slide.x).toBeGreaterThan(-12);
    expect(Math.hypot(slide.x + 12, slide.z + 5)).toBeCloseTo(1.05);
    expect(moveAmongCreatures(-12, -5.5, 0, -0.4, [creature]).z).toBeCloseTo(
      -5.9,
    );
    expect(
      moveAmongCreatures(-12, -6.1, 0, 0.4, [{ ...creature, hp: 0 }]).z,
    ).toBeCloseTo(-5.7);
  });
  it("does not eject an already overlapping player or permit movement farther inside", () => {
    expect(moveAmongCreatures(-12, -5.5, 0, 0.1, [creature])).toEqual({
      x: -12,
      z: -5.5,
    });
    expect(moveAmongCreatures(-12, -5, 0, 0, [creature])).toEqual({
      x: -12,
      z: -5,
    });
  });
});
