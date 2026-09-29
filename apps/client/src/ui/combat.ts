import { isSafeArea } from "../../../../packages/shared/regions";
import type { Ability } from "../../../../packages/shared/data";
import { distance, lineOfSight } from "../../../../packages/shared/rules";
import type { PlayerView, WildView } from "../../../../packages/shared/types";
import { RESOURCES, heroClass } from "../../../../packages/shared/classes";

export function abilityAvailability(
  ability: Ability,
  self: PlayerView | undefined,
  target: WildView | PlayerView | undefined,
  cooldownUntil: number,
  now: number,
  duel: boolean,
  serverNow = now,
  gcdUntil = 0,
) {
  if (!self || self.hp <= 0) return "You need healing";
  if ((self.stunUntil ?? 0) > serverNow) return "Briefly stunned";
  if (self.level !== undefined && self.level < (ability.unlock ?? 1))
    return `Unlocks at level ${ability.unlock}`;
  const personal = ["heal", "guard", "evasion"].includes(ability.effect ?? "");
  if (self.cast && self.cast.resolvesAt > serverNow && !ability.offGcd)
    return "Casting";
  if (self.dash && self.dash.until > serverNow) return "Dashing";
  if (cooldownUntil > now) return "Recharging";
  if (!ability.offGcd && gcdUntil > now) return "Recharging";
  if (self.resource !== undefined && self.resource < (ability.cost ?? 0))
    return `Not enough ${RESOURCES[heroClass(self.classId).resource].name}`;
  if (ability.finisher && !self.combo) return "Build combo points first";
  if (ability.effect === "heal")
    return self.hp >= self.maxHp ? "Already at full health" : "Ready";
  if (personal) return "Ready";
  if (ability.aoeSelf)
    return !duel && isSafeArea(self.x, self.z)
      ? "Leave the safe haven to battle"
      : "Ready";
  if (!target || target.hp <= 0) return "Choose a target";
  if (
    duel &&
    ("species" in target ||
      target.id === self.id ||
      target.duelId !== self.duelId)
  )
    return "Choose your duel opponent";
  if (!duel && !("species" in target))
    return "Challenge this trainer at the arena";
  if (ability.effect === "taunt" && !("species" in target))
    return "Only creatures can be taunted";
  if (!duel && isSafeArea(self.x, self.z))
    return "Leave the safe haven to battle";
  if (
    ability.execute &&
    target.hp / Math.max(1, target.maxHp) > ability.execute
  )
    return `Target must be below ${ability.execute * 100}% health`;
  if (distance(self, target) > ability.range) return "Move closer";
  if (!lineOfSight(self, target)) return "Path is blocked";
  return "Ready";
}

/** Whether an ability deserves attention right now: an interrupt, execute or big finisher. */
export function abilityHighlighted(
  ability: Ability,
  self: PlayerView | undefined,
  target: WildView | PlayerView | undefined,
  serverNow: number,
) {
  if (!self || !target || target.hp <= 0) return false;
  const wild = "species" in target ? target : undefined;
  if (
    (ability.interrupt || ability.effect === "stun") &&
    wild?.cast &&
    wild.cast.resolvesAt > serverNow &&
    (wild.cast.interruptible || ability.effect === "stun")
  )
    return true;
  if (ability.execute)
    return target.hp / Math.max(1, target.maxHp) <= ability.execute;
  if (ability.finisher) return (self.combo ?? 0) >= 4;
  if (ability.shatter)
    return !!target.auras?.some(
      (a) => (a.id === "slow" || a.id === "stun") && a.until > serverNow,
    );
  return false;
}
