import { threatLeader } from "../../../packages/shared/combat-rules.js";
import { hasAura, applyAura, removeAura } from "./auras.js";
import type { Player, Wild } from "./room.js";
export const hiddenHero = (p: Player, now = Date.now()) =>
  hasAura(p, "stealth", now);
export function revealHero(p: Player) {
  removeAura(p, "stealth");
}
export function vanishHero(p: Player, wilds: Iterable<Wild>, now: number) {
  p.cast = undefined;
  p.auto = undefined;
  p.petTarget = undefined;
  if (p.pet) {
    p.pet.cast = undefined;
    p.pet.command = undefined;
  }
  applyAura(p, "stealth", now, 8000, { ability: "vanish" });
  for (const w of wilds) {
    w.threat.delete(p.profile.id);
    if (w.target === p.profile.id) {
      w.target = threatLeader(w.threat);
      w.cast = undefined;
      w.resetting = !w.target;
      w.state = w.target ? "chase" : "retreat";
      w.retreatSince = now;
    }
  }
}
