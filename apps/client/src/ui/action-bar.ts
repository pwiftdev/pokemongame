import {
  RESOURCES,
  abilityUnlocked,
  heroClass,
  type ClassId,
} from "../../../../packages/shared/classes";
import { castTiming } from "../../../../packages/shared/combat-timing";
import { DASH } from "../../../../packages/shared/combat";
import { ABILITIES } from "../../../../packages/shared/data";
import { AURAS, type AuraId } from "../../../../packages/shared/combat-rules";
import { abilityIcon } from "./ability-icons";
import { escape as esc } from "./icons";

export function slot(
  action: string,
  icon: string,
  tooltip: string,
  key: string,
  name: string,
  options: { cls?: string; attributes?: string; badge?: string } = {},
) {
  return `<button class="ability ${options.cls ?? ""}" data-action="${action}" data-tooltip="${tooltip}" aria-label="${esc(name)}" ${options.attributes ?? ""}><span class="slot-face">${abilityIcon(icon)}<span class="sweep"></span><span class="cooldown"></span>${options.badge ?? ""}<kbd title="${esc(key)}">${key === "SPACE" ? "SPC" : key}</kbd></span><span class="ability-name">${esc(name)}</span></button>`;
}
export function actionBarMarkup(
  classId: ClassId,
  level: number,
  capsules: number,
) {
  const abilities = heroClass(classId).abilities;
  return `<div class="action-slots">${abilities
    .map((a, i) => {
      const locked = !abilityUnlocked(a, level);
      return slot(
        `ability:${i}`,
        a.id,
        `ability:${a.id}`,
        String(i + 1),
        a.name,
        {
          cls: locked ? "locked" : "",
          attributes: `data-slot="${i}" data-ability="${a.id}"${locked ? " disabled" : ""}`,
          badge: locked ? `<span class="lock">LV ${a.unlock}</span>` : "",
        },
      );
    })
    .join(
      "",
    )}</div><div class="action-slots utility">${slot("dash", "dash", "dash", "SPACE", "Dash", { cls: "dash-ability" })}${slot("tame", "catch", "catch", "F", "Catch", { cls: "tame-ability", badge: `<b class="count">${capsules}</b>` })}</div>`;
}
export interface SlotState {
  /** Seconds until usable, from a cooldown or the global cooldown. */
  remaining: number;
  duration: number;
  /** True when only the global cooldown is running. */
  gcd: boolean;
  reason: string;
  highlight: boolean;
}
export function updateSlot(button: HTMLButtonElement, s: SlotState) {
  const cooling = s.remaining > 0.02;
  button.classList.toggle("on-cooldown", cooling && !s.gcd);
  button.classList.toggle("on-gcd", cooling && s.gcd);
  button.classList.toggle(
    "unusable",
    s.reason.startsWith("Not enough") || s.reason.startsWith("Build"),
  );
  button.classList.toggle(
    "out-of-range",
    s.reason === "Move closer" || s.reason === "Path is blocked",
  );
  button.classList.toggle("highlight", s.highlight && !cooling);
  if (!button.classList.contains("locked")) button.disabled = cooling;
  button.style.setProperty(
    "--sweep",
    String(cooling ? Math.min(1, s.remaining / Math.max(0.01, s.duration)) : 0),
  );
  const label = button.querySelector(".cooldown")!;
  const text =
    cooling && !s.gcd
      ? s.remaining >= 3
        ? String(Math.ceil(s.remaining))
        : s.remaining.toFixed(1)
      : "";
  if (label.textContent !== text) label.textContent = text;
}

/** Tooltip markup for an action bar slot or status icon. */
export function tooltipMarkup(key: string, classId: ClassId, level: number) {
  if (key === "dash")
    return `<strong>Dash</strong><div class="tip-row"><span>Instant</span><span>${DASH.cooldown / 1000} sec cooldown</span></div><p>Dash in your movement direction. You cannot be hit during the first ${DASH.invulnerable}ms.</p>`;
  if (key === "catch")
    return `<strong>Catch Pokémon</strong><div class="tip-row"><span>Uses a taming capsule</span><span>14m range</span></div><p>Weaken a wild Pokémon below 75% health (or use bait), then throw a capsule. Hostile monsters cannot be caught.</p>`;
  if (key.startsWith("resource:")) {
    const resource = RESOURCES[key.slice(9) as keyof typeof RESOURCES];
    return `<strong style="color:${resource.color}">${resource.name}</strong><p>${esc(resource.description)}</p>`;
  }
  if (key.startsWith("aura:")) {
    const [, id, ability] = key.split(":");
    const aura = AURAS[id as AuraId];
    if (!aura) return "";
    return `<strong class="${aura.debuff ? "debuff" : "buff"}">${esc(ABILITIES[ability]?.name && id !== "enrage" ? `${aura.name} · ${ABILITIES[ability].name}` : aura.name)}</strong><p>${esc(aura.description)}</p>`;
  }
  const ability = ABILITIES[key.slice(8)];
  if (!ability) return "";
  const resource = RESOURCES[heroClass(classId).resource];
  const timing = castTiming(ability.id, ability.range);
  const cost = ability.cost
    ? `${ability.cost} ${resource.name}`
    : ability.generate
      ? `Generates ${ability.generate} ${resource.name}`
      : "No cost";
  const reach = ability.aoeSelf
    ? `${ability.aoe}m around you`
    : ability.range
      ? `${ability.range}m range`
      : "Self";
  const cast = timing.stationary
    ? `${(timing.windup / 1000).toFixed(2).replace(/0$/, "")} sec cast`
    : "Instant";
  const cooldown = ability.cooldown
    ? `${ability.cooldown} sec cooldown`
    : ability.offGcd
      ? "No cooldown"
      : "Global cooldown";
  const locked = !abilityUnlocked(ability, level);
  return `<strong>${esc(ability.name)}</strong><div class="tip-row"><span style="color:${resource.color}">${cost}</span><span>${reach}</span></div><div class="tip-row"><span>${cast}</span><span>${cooldown}</span></div>${ability.offGcd ? '<div class="tip-note">Off the global cooldown</div>' : ""}${ability.combo ? `<div class="tip-note">Awards ${ability.combo} combo point${ability.combo > 1 ? "s" : ""}</div>` : ""}<p>${esc(ability.description)}</p>${locked ? `<div class="tip-locked">Unlocks at level ${ability.unlock}</div>` : ""}`;
}
