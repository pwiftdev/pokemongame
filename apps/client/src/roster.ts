import { POKEMON } from "../../../packages/shared/pokemon";
export const POKEMON_MODELS = Object.values(POKEMON).map((p) => p.name);
export const SPECIES_MODELS: Record<string, string> = {
  ...Object.fromEntries(Object.values(POKEMON).map((p) => [p.id, p.name])),
  spriglet: "Mushnub",
  cindercub: "Dragon",
  brookfin: "Glub",
  pebblit: "Goleling",
  mossprout: "GreenSpikyBlob",
  glimmerwing: "Armabee",
  voltkit: "Cactoro",
  duskowl: "Hywirl",
  cragclaw: "Orc_Skull",
  coralisk: "Squidle",
  sunscale: "Birb",
  tempest: "Yeti",
};
export const EVOLVED_MODELS: Record<string, string> = {
  bulbasaur: "Ivysaur",
  charmander: "Charmeleon",
  squirtle: "Wartortle",
  spriglet: "Mushnub_Evolved",
  cindercub: "Dragon_Evolved",
  brookfin: "Glub_Evolved",
};

export function creaturePortrait(species: string, evolved = false) {
  const name = (evolved && EVOLVED_MODELS[species]) || SPECIES_MODELS[species];
  return `/assets/portraits/${name || "Mushnub"}.png`;
}
