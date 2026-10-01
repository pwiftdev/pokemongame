import {
  TRAINING_TARGETS,
  PRACTICE_IDLE_MS,
  practiceDps,
  type PracticeView,
} from "../../../../packages/shared/training";
import { escape as esc } from "./icons";
export function practiceSummary(
  session: PracticeView | undefined,
  target: string,
  now: number,
) {
  if (!session || session.target !== target)
    return "Your session: attack to begin. Damage is personal; dummies grant no XP or currency.";
  return `${now - session.lastHitAt >= PRACTICE_IDLE_MS ? "Last session" : "Your session"}: ${session.damage} damage · ${practiceDps(session, now).toFixed(1)} DPS · ${session.hits} hits · best ${session.bestHit} · ${session.abilities.length} attack types`;
}
export function trainingPanel() {
  return `<section class="training-yard"><span class="eyebrow">PRACTICE BEFORE ADVENTURE</span><h3>Find your rhythm</h3><p>The training yard is east of the arena. Test your attacks and companion moves safely. The finisher dummy starts at 20% health for execute abilities. Targets reset after 10 seconds without damage.</p><div class="social-presets">${TRAINING_TARGETS.map((t) => `<button class="secondary compact" data-action="practice-target:${t.id}">${esc(t.name)}</button>`).join("")}</div><p>Try a basic attack, a class ability, then a follow-up. Compare damage per second and your strongest hit. Practice uses your current level and normal cooldowns.</p></section>`;
}
