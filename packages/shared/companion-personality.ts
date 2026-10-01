import type { Temperament } from "./pokemon";

export function companionMood(input: {
  temperament: Temperament;
  phase: number;
  time: number;
  restingFor: number;
  moving: boolean;
  inCombat: boolean;
  fainted: boolean;
  greeting: boolean;
}): "idle" | "idle-variant" | "sleep" | "celebrate" | "defeat" {
  if (input.fainted) return "defeat";
  if (input.moving || input.inCombat) return "idle";
  if (input.greeting) return "celebrate";
  if (input.restingFor < 4) return "idle";
  const cycle = (input.time + input.phase) % 24;
  if (input.temperament === "sleepy" && input.restingFor > 15) return "sleep";
  if (input.temperament === "playful" && cycle < 3) return "celebrate";
  return cycle < (input.temperament === "curious" ? 8 : 4)
    ? "idle-variant"
    : "idle";
}
export function personalityPhase(id: string) {
  let phase = 0;
  for (const char of id) phase = (phase * 31 + char.charCodeAt(0)) % 240;
  return phase / 10;
}
