import { POKEMON } from "../../../../packages/shared/pokemon";
import { distance, lineOfSight } from "../../../../packages/shared/rules";
import type { PlayerView, WildView } from "../../../../packages/shared/types";

export function captureGuidance(
  self: PlayerView | undefined,
  target: WildView | undefined,
  capsules: number,
) {
  if (!target || !POKEMON[target.species])
    return "Choose a wild Pokémon; monsters cannot be caught";
  if (!self || self.hp <= 0) return "Visit the Springhouse to heal first";
  if (self.duelId) return "Finish your duel first";
  if (target.hp <= 0) return "Choose a living wild Pokémon";
  if (capsules <= 0) return "No capsules · Visit Mira’s field supply";
  const gap = distance(self, target) - 14;
  if (gap > 0) return `Move ${Math.ceil(gap)}m closer to catch`;
  if (!lineOfSight(self, target)) return "Find a clear view of the Pokémon";
  if (target.activity === "sleep" && !self.moving)
    return "Sleeping · Press F for a quiet catch";
  if (target.hp <= target.maxHp * 0.75)
    return "Ready to catch · H calls your companion back · F throws a capsule";
  return "Use bait or weaken below 75% HP · H calls your companion back · F throws a capsule";
}
export function castWarning(
  target: WildView | PlayerView | undefined,
  now: number,
) {
  if (
    !target ||
    !("species" in target) ||
    !target.cast ||
    target.cast.resolvesAt <= now
  )
    return "";
  const remaining = ((target.cast.resolvesAt - now) / 1000).toFixed(1);
  return `${target.cast.name ?? "Incoming attack"} · ${remaining}s · ${target.cast.interruptible ? "Interrupt or leave the marked ground" : "Leave the marked ground"}`;
}
