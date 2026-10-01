import {
  isTraining,
  TRAINING_TARGETS,
} from "../../../../packages/shared/training";
import { practiceSummary } from "./practice";
import { POKEMON } from "../../../../packages/shared/pokemon";
import {
  LEGACY_TYPES,
  TYPE_COLORS,
  typeMultiplier,
} from "../../../../packages/shared/pokemon-types";
import {
  COMBO_MAX,
  RESOURCES,
  heroClass,
} from "../../../../packages/shared/classes";
import {
  AURAS,
  difficulty,
  type AuraView,
} from "../../../../packages/shared/combat-rules";
import { SPECIES } from "../../../../packages/shared/data";
import { heroLevel } from "../../../../packages/shared/hero";
import { creatureName, distance } from "../../../../packages/shared/rules";
import type {
  PlayerView,
  Profile,
  WildView,
} from "../../../../packages/shared/types";
import { creaturePortrait } from "../roster";
import { auraIcon } from "./ability-icons";
import { updateMarkup } from "./dom";
import { escape as esc, icon } from "./icons";

const SWORDS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m4 3 13 13m-2-1 4 4m-4 0 3-3M20 3 7 16m2-1-4 4m4 0-3-3"/></svg>';
const percent = (value: number, max: number) =>
  Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
export function healthTone(value: number, max: number) {
  const health = percent(value, max);
  return health < 20 ? "low" : health <= 50 ? "hurt" : "healthy";
}
function setText(element: Element | null, text: string) {
  if (element && element.textContent !== text) element.textContent = text;
}
function setBar(
  bar: Element | null,
  value: number,
  max: number,
  label?: string,
) {
  if (!bar) return;
  if (bar.matches(".hp-bar, .pet-hp")) {
    const state = healthTone(value, max);
    if (bar.getAttribute("data-health") !== state)
      bar.setAttribute("data-health", state);
  }
  bar.querySelector<HTMLElement>(".fill")!.style.width =
    `${percent(value, max)}%`;
  if (label !== undefined) setText(bar.querySelector(".bar-text"), label);
}
function bar(cls: string, style = "") {
  return `<div class="bar ${cls}" ${style}><span class="fill"></span><span class="bar-text"></span></div>`;
}

/** Buff and debuff icons with remaining time; your own debuffs are highlighted. */
export function auraRow(
  auras: AuraView[] | undefined,
  now: number,
  mine?: string,
) {
  return (auras ?? [])
    .filter((a) => a.until > now)
    .sort(
      (a, b) =>
        Number(AURAS[a.id].debuff) - Number(AURAS[b.id].debuff) ||
        a.until - b.until,
    )
    .map((a) => {
      const left = Math.max(0, a.until - now) / 1000;
      return `<span class="aura ${AURAS[a.id].debuff ? "debuff" : "buff"}${mine && a.source === mine ? " mine" : ""}" data-tooltip="aura:${a.id}:${a.ability ?? ""}">${auraIcon(a.id)}<em>${left >= 10 ? Math.ceil(left) : left.toFixed(0)}</em><i style="--left:${(left / Math.max(0.1, a.duration / 1000)).toFixed(2)}"></i></span>`;
    })
    .join("");
}

export function playerFrameMarkup(profile: Profile) {
  const cls = heroClass(profile.classId),
    resource = RESOURCES[cls.resource];
  const active = profile.creatures.find((c) => c.id === profile.active);
  const pet = active
    ? `<div class="unit-frame pet-frame"><span class="pet-portrait"><img src="${creaturePortrait(active.species, active.evolved)}" alt=""/></span><div class="frame-body"><div class="frame-title"><h4>${esc(creatureName(active))}</h4><span class="pet-level">LV ${active.level}</span></div>${bar("pet-hp")}<div class="pet-orders"><button class="pet-command" data-action="pet:attack" title="Send your companion at your target (G)">Attack<kbd>G</kbd></button><button class="pet-command" data-action="pet:assist" title="Your companion joins whatever you attack">Assist</button><button class="pet-command" data-action="pet:passive" title="Your companion stops fighting and follows (H)">Follow<kbd>H</kbd></button></div></div></div>`
    : `<div class="unit-frame pet-frame empty"><span>No companion deployed</span><button class="text-button" data-action="panel:collection">Deploy a companion</button></div>`;
  return `<div class="unit-frame player-frame ${cls.resource}"><div class="frame-portrait hero"><span class="portrait-clip"><img src="/assets/portraits/${cls.model}.png" alt="${cls.name}"/></span><span class="level-badge">${heroLevel(profile)}</span><span class="combat-flag" title="In combat">${SWORDS}</span></div><div class="frame-body"><div class="frame-title"><h3>${esc(profile.nickname)}</h3><span class="frame-tag">${cls.name.toUpperCase()}</span></div>${bar("hp-bar")}${bar("resource-bar", `style="--resource:${resource.color}" data-tooltip="resource:${cls.resource}"`)}${cls.resource === "energy" ? `<div class="combo-pips" title="Combo points">${"<span></span>".repeat(COMBO_MAX)}</div>` : ""}<small class="frame-detail"></small></div><div class="frame-auras"></div></div>${pet}`;
}
export function updatePlayerFrame(
  root: Element,
  profile: Profile,
  self: PlayerView | undefined,
  duel: boolean,
  serverNow: number,
) {
  if (!self) return;
  const frame = root.querySelector(".player-frame");
  if (!frame) return;
  frame.classList.toggle("in-combat", !!self.inCombat);
  frame.classList.toggle("low-health", self.hp / Math.max(1, self.maxHp) < 0.3);
  setBar(
    frame.querySelector(".hp-bar"),
    self.hp,
    self.maxHp,
    `${self.hp} / ${self.maxHp}`,
  );
  setBar(
    frame.querySelector(".resource-bar"),
    self.resource ?? 0,
    self.resourceMax ?? 100,
    `${self.resource ?? 0} / ${self.resourceMax ?? 100}`,
  );
  frame
    .querySelectorAll(".combo-pips > span")
    .forEach((pip, i) => pip.classList.toggle("on", i < (self.combo ?? 0)));
  setText(
    frame.querySelector(".level-badge"),
    String(self.level ?? heroLevel(profile)),
  );
  setText(
    frame.querySelector(".frame-detail"),
    duel
      ? "NORMALIZED DUEL · LEVEL 10"
      : self.autoTarget
        ? "AUTO ATTACK ON"
        : "",
  );
  updateMarkup(
    frame.querySelector(".frame-auras")!,
    auraRow(self.auras, serverNow),
  );
  const active = profile.creatures.find((c) => c.id === profile.active);
  if (active)
    setBar(
      root.querySelector(".pet-hp"),
      self.pet?.hp ?? active.hp,
      self.pet?.maxHp ?? active.maxHp,
      (self.pet?.hp ?? active.hp) === 0
        ? "Fainted · revive or swap"
        : `${self.pet?.hp ?? active.hp} / ${self.pet?.maxHp ?? active.maxHp}`,
    );
  for (const button of root.querySelectorAll<HTMLButtonElement>(".pet-command"))
    button.classList.toggle(
      "active",
      button.dataset.action === `pet:${self.petMode ?? "assist"}`,
    );
}

type Target = WildView | PlayerView;
export function targetKey(target: Target, duel: boolean) {
  return `${target.id}:${duel}:${"species" in target ? target.species : target.classId}`;
}
export function targetFrameMarkup(
  target: Target,
  profile: Profile,
  duel: boolean,
) {
  if (!("species" in target)) {
    const cls = heroClass(target.classId);
    return `<div class="frame-portrait hero"><span class="portrait-clip"><img src="/assets/portraits/${cls.model}.png" alt=""/></span><span class="level-badge">${duel ? 10 : (target.level ?? 1)}</span><span class="combat-flag">${SWORDS}</span></div><div class="frame-body"><div class="frame-title"><h3>${esc(target.nickname)}</h3><span class="frame-tag">${duel ? "DUEL OPPONENT" : `FELLOW ${cls.name.toUpperCase()}`}</span></div>${duel ? `${bar("hp-bar")}<small class="frame-detail"></small><div class="frame-auras"></div>` : `<button class="text-button" data-action="duel:${esc(target.id)}">Challenge to a duel</button>`}</div><button class="icon-button" data-action="clear-target" aria-label="Clear target">${icon("close")}</button>`;
  }
  if (isTraining(target))
    return `<div class="frame-portrait hero">${icon("arena")}</div><div class="frame-body"><div class="frame-title"><h3>${esc(TRAINING_TARGETS.find((t) => t.id === target.id)?.name ?? "Training dummy")}</h3><span class="frame-tag">PRACTICE TARGET</span></div>${bar("hp-bar")}<small class="frame-detail"></small><div class="frame-auras"></div><p class="practice-summary" role="status"></p><button class="text-button" data-action="practice-reset">Stop & reset session</button></div><button class="icon-button" data-action="clear-target" aria-label="Clear target">${icon("close")}</button>`;
  const species = SPECIES[target.species];
  const rank = target.boss ? "boss" : target.elite ? "elite" : "normal";
  const reaction = species.companion ? "neutral" : "hostile";
  const tag = `${target.boss ? "WORLD BOSS" : target.elite ? "ELITE" : ""}${target.boss || target.elite ? " · " : ""}${species.companion ? "WILD POKÉMON" : "HOSTILE MONSTER"}`;
  const level = heroLevel(profile);
  const partner = profile.creatures.find((c) => c.id === profile.active);
  const types = POKEMON[target.species]?.types ?? [
    LEGACY_TYPES[species.element],
  ];
  const advantage =
    partner &&
    (
      POKEMON[partner.species]?.types ?? [
        LEGACY_TYPES[SPECIES[partner.species].element],
      ]
    ).some((type) => typeMultiplier(type, types) > 1);
  return `<div class="frame-portrait ${rank}"><span class="portrait-clip"><img src="${creaturePortrait(target.species)}" alt=""/></span><span class="level-badge ${difficulty(target.level, level)}">${target.boss ? "??" : target.level}</span><span class="combat-flag" title="You are attacking">${SWORDS}</span></div><div class="frame-body"><div class="frame-title"><h3 class="${reaction}">${esc(target.boss ? "Stormheart" : species.name)}</h3><span class="frame-tag">${tag} · <span style="color:${TYPE_COLORS[types[0]]}">${types.join(" / ").toUpperCase()}</span>${advantage ? ' · <b class="advantage">ADVANTAGE</b>' : ""}</span></div>${bar("hp-bar")}<small class="frame-detail"></small><div class="target-cast hidden"><span class="fill"></span><span class="cast-name"></span><span class="cast-time"></span></div><div class="frame-extras"><div class="frame-auras"></div><span class="tot"></span><span class="threat"></span></div>${species.companion ? `<div class="capture-help"><span>Weaken below 75% or use bait · F: catch · H: stop companion</span><button class="text-button" data-action="use:bait" ${profile.inventory.bait ? "" : "disabled"}>Use bait (${profile.inventory.bait ?? 0})</button></div>` : ""}</div><button class="icon-button" data-action="clear-target" aria-label="Clear target">${icon("close")}</button>`;
}
export function updateTargetFrame(
  card: Element,
  target: Target,
  self: PlayerView | undefined,
  players: PlayerView[],
  serverNow: number,
) {
  if (isTraining(target))
    setText(
      card.querySelector(".practice-summary"),
      practiceSummary(self?.practice, target.id, serverNow),
    );
  card.classList.toggle("attacking", !!self && self.autoTarget === target.id);
  const away = self ? `${Math.round(distance(self, target))}m away` : "";
  setBar(
    card.querySelector(".hp-bar"),
    target.hp,
    target.maxHp,
    `${Math.round(percent(target.hp, target.maxHp))}%`,
  );
  setText(
    card.querySelector(".frame-detail"),
    `${target.hp} / ${target.maxHp} HP · ${away}`,
  );
  updateMarkup(
    card.querySelector(".frame-auras") ?? document.createElement("div"),
    auraRow(target.auras, serverNow, self?.id),
  );
  if (!("species" in target)) return;
  card.classList.toggle("evading", !!target.evading);
  const cast = card.querySelector<HTMLElement>(".target-cast");
  const spell =
    target.cast && target.cast.resolvesAt > serverNow ? target.cast : undefined;
  if (cast) {
    cast.classList.toggle("hidden", !spell);
    if (spell) {
      const start = spell.startedAt ?? serverNow;
      cast.classList.toggle("interruptible", !!spell.interruptible);
      cast.querySelector<HTMLElement>(".fill")!.style.width =
        `${percent(serverNow - start, spell.resolvesAt - start)}%`;
      setText(cast.querySelector(".cast-name"), spell.name ?? "Attack");
      setText(
        cast.querySelector(".cast-time"),
        `${Math.max(0, (spell.resolvesAt - serverNow) / 1000).toFixed(1)}`,
      );
    }
  }
  const victim = target.target
    ? target.target === self?.id
      ? "You"
      : players.find((p) => p.id === target.target)?.nickname
    : undefined;
  const tot = card.querySelector(".tot");
  tot?.classList.toggle("you", victim === "You");
  setText(tot, victim ? `Targeting ${victim}` : "");
  const threat = self && target.threat ? target.threat[self.id] : undefined;
  setText(
    card.querySelector(".threat"),
    threat !== undefined ? `Threat ${threat}%` : "",
  );
}
