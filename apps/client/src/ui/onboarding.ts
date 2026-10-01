import { STARTERS } from "../../../../packages/shared/data";
import { creaturePortrait } from "../roster";
import { findSpecies, text } from "./data";
import { escape as esc } from "./icons";

export function pokemonWelcomeMarkup() {
  return `<div class="pokemon-welcome"><div class="welcome-partners" aria-label="Starter Pokémon">${STARTERS.map((id) => `<img src="${creaturePortrait(id)}" alt="${esc(text(findSpecies(id), "name"))}" width="64" height="64" draggable="false" />`).join("")}</div><p>Your first Pokémon is waiting.<br /><span>Build your team. Train, evolve, and battle together.</span></p></div>`;
}

export function onboardingSteps(step: 1 | 2) {
  return `<nav class="wop-steps" aria-label="Adventure setup"><span ${step === 1 ? 'aria-current="step"' : ""}>01 · Trainer</span><span ${step === 2 ? 'aria-current="step"' : ""}>02 · First Pokémon</span></nav>`;
}
