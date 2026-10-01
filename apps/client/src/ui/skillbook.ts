import {
  heroClass,
  abilityUnlocked,
} from "../../../../packages/shared/classes";
import { heroLevel } from "../../../../packages/shared/hero";
import { combatLoadout } from "../../../../packages/shared/skillbook";
import type { Profile } from "../../../../packages/shared/types";
import { abilityIcon } from "./ability-icons";
import { escape as esc } from "./icons";
export function skillbookPanel(profile: Profile, busy = false) {
  const cls = heroClass(profile.classId),
    level = heroLevel(profile),
    loadout = combatLoadout(profile);
  const next = cls.abilities.find((a) => !abilityUnlocked(a, level));
  return `<div class="skillbook-intro" data-combat-busy="${busy}"><div><span class="eyebrow">${esc(cls.role)}</span><h3>${esc(cls.name)} · Level ${level}</h3><p>${esc(cls.description)}</p></div><strong>${next ? `Next: ${esc(next.name)} · Level ${next.unlock}` : "All class skills unlocked"}</strong></div>
  <div class="skillbook-toolbar"><label>Action bar <select id="skill-layout" ${busy ? "disabled" : ""}><option value="row" ${loadout.layout === "row" ? "selected" : ""}>Single row</option><option value="split" ${loadout.layout === "split" ? "selected" : ""}>Two rows</option></select></label><label><input id="skill-labels" type="checkbox" ${loadout.labels ? "checked" : ""} ${busy ? "disabled" : ""}> Show skill names</label><button class="secondary compact" data-action="skill-style" ${busy ? "disabled" : ""}>Save bar style</button><button class="secondary compact" data-action="combat-reset" ${busy ? "disabled" : ""}>Restore automatic loadout</button><button class="secondary compact" data-action="panel:settings">Key bindings</button></div>
  <p class="subtle">${busy ? "Finish combat or your duel before changing equipped skills." : "Choose a slot, then equip a skill. Equipping a skill already on your bar swaps the two slots. Cooldowns stay with the skill."}</p>
  <div class="skillbook-slots">${loadout.slots.map((id, i) => `<div><kbd>${i + 1}</kbd><strong>${id ? esc(cls.abilities.find((a) => a.id === id)?.name ?? "") : "Empty slot"}</strong>${id ? `<button class="secondary compact" data-action="skill-clear:${i}" aria-label="Clear slot ${i + 1}" ${busy ? "disabled" : ""}>×</button>` : ""}</div>`).join("")}</div>
  <div class="skillbook-grid">${cls.abilities
    .map((a) => {
      const learned = abilityUnlocked(a, level),
        slot = loadout.slots.indexOf(a.id);
      return `<article class="skillbook-skill ${learned ? "" : "locked"}"><div class="skillbook-heading">${abilityIcon(a.id)}<div><span class="eyebrow">LEVEL ${a.unlock}${slot >= 0 ? ` · SLOT ${slot + 1}` : ""}</span><h3>${esc(a.name)}</h3></div></div><p>${esc(a.description)}</p><div class="skillbook-meta"><span>${a.cost ? `${a.cost} ${cls.resource}` : a.generate ? `+${a.generate} ${cls.resource}` : "No cost"}</span><span>${a.cooldown ? `${a.cooldown}s cooldown` : "Global cooldown"}</span></div>${learned ? `<div class="skillbook-equip"><select id="skill-slot-${a.id}" aria-label="Slot for ${esc(a.name)}" ${busy ? "disabled" : ""}>${loadout.slots.map((_, i) => `<option value="${i}" ${(slot >= 0 ? slot : Math.max(0, loadout.slots.indexOf(null))) === i ? "selected" : ""}>Slot ${i + 1}</option>`).join("")}</select><button class="primary compact" data-action="skill-equip:${a.id}" ${busy ? "disabled" : ""}>Equip</button></div>` : `<strong class="subtle">Unlocks at level ${a.unlock}</strong>`}</article>`;
    })
    .join("")}</div>`;
}
