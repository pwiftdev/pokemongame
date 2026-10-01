import type { WildView } from "../../../../packages/shared/types";
import { creatureSeed } from "../../../../packages/shared/creature-motion";
import type { Motion } from "./creature-clips";

export function wildMotion(
  view: WildView,
  speed: number,
  now: number,
): { motion: Motion; duration?: number } {
  if (view.auras?.some((a) => a.id === "stun" && a.until > now))
    return { motion: "idle" };
  if (view.cast)
    return {
      motion: view.cast.spell ? "special" : "attack",
      duration: Math.max(
        0.25,
        (view.cast.resolvesAt - (view.cast.startedAt ?? now)) / 1000,
      ),
    };
  if (view.state === "attack") return { motion: "attack", duration: 0.65 };
  if (speed > 0.16) {
    const run = speed > 2.5;
    return {
      motion: run ? "run" : "move",
      duration: Math.max(
        run ? 0.35 : 0.65,
        Math.min(1.6, (run ? 2.3 : 1.35) / speed),
      ),
    };
  }
  if (view.activity === "sleep") return { motion: "sleep" };
  if (view.activity === "feed" || view.activity === "drink")
    return { motion: "feed" };
  if (view.activity === "warn" || view.state === "alert")
    return { motion: "alert" };
  if (view.activity === "inspect" || view.activity === "look")
    return { motion: "look" };
  const phase = (now / 1000 + creatureSeed(view.id) * 31) % 13;
  return { motion: phase < 3.5 ? "idle-variant" : "idle" };
}
