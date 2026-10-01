export const CREATURE_CLIPS = {
  "idle-variant": ["Idle_Variant", "Idle"],
  run: ["Run", "model_skeleton|001run", "Fast_Flying", "Walk"],
  "attack-alt": [
    "Attack_Alt",
    "Headbutt",
    "model_skeleton|001fight_b",
    "Bite_InPlace",
  ],
  special: ["Special", "Punch", "model_skeleton|001fight_b", "Bite_InPlace"],
  sleep: ["Sleep", "Idle"],
  feed: ["Feed", "Idle_Variant", "Idle"],
  look: ["Look", "Idle_Variant", "Idle"],
  alert: ["Alert", "Idle_Variant", "Idle"],
  idle: ["model_skeleton|001aidle", "Idle", "Flying_Idle"],
  move: [
    "model_skeleton|001walk",
    "Walk",
    "Fast_Flying",
    "model_skeleton|001run",
    "Run",
  ],
  attack: [
    "model_skeleton|001fight_b",
    "Bite_InPlace",
    "Bite_Front",
    "Headbutt",
    "Punch",
  ],
  hit: ["model_skeleton|001fight_d", "HitRecieve", "HitReact"],
  defeat: ["model_skeleton|001ko", "Death", "No"],
  celebrate: ["Dance", "Yes", "Flying_Idle", "model_skeleton|001jump_s"],
} as const;
export type Motion = keyof typeof CREATURE_CLIPS;
export function creatureClip(names: string[], motion: Motion) {
  return CREATURE_CLIPS[motion].find((clip) => names.includes(clip));
}
export function loopMotion(motion: Motion) {
  return !["attack", "attack-alt", "special", "hit", "defeat"].includes(motion);
}
export function motionDuration(motion: Motion, phase: number) {
  const duration: Partial<Record<Motion, number>> = {
    idle: 3.2,
    "idle-variant": 3.8,
    sleep: 4,
    feed: 3,
    look: 3.5,
    alert: 1.8,
    move: 1,
    run: 0.65,
    celebrate: 1.5,
  };
  return duration[motion] ? duration[motion]! * (0.9 + phase * 0.2) : undefined;
}
