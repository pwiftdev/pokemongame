import { POKEMON } from "./pokemon";
import type { Profile } from "./types";

export const DEX_REWARDS = [
  { count: 10, amount: 100 },
  { count: 25, amount: 300 },
  { count: Object.keys(POKEMON).length, amount: 750 },
];
export function recordPokemon(
  profile: Profile,
  species: string,
  caught = false,
) {
  if (!POKEMON[species]) return false;
  const dex = (profile.pokedex ??= { seen: [], caught: [], rewards: [] });
  let changed = false;
  for (const list of caught ? [dex.seen, dex.caught] : [dex.seen])
    if (!list.includes(species)) {
      list.push(species);
      changed = true;
    }
  return changed;
}
export const CAPTURE_TIMING = { flight: 850, shake: 650, reveal: 700 };
export const EVOLUTION_TIMING = { duration: 3200, reveal: 1984 };

export function capturePresentation(success: boolean, random = Math.random()) {
  const shakes = success
    ? 3
    : Math.min(3, Math.max(1, Math.floor(random * 3) + 1));
  return {
    success,
    shakes,
    duration:
      CAPTURE_TIMING.flight +
      shakes * CAPTURE_TIMING.shake +
      CAPTURE_TIMING.reveal,
  };
}
