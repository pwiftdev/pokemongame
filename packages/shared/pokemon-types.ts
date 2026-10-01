import chart from "./pokemon-chart.json" with { type: "json" };
import type { Element } from "./types";

export const POKEMON_TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];
export const LEGACY_TYPES: Record<Element, PokemonType> = {
  leaf: "grass",
  flame: "fire",
  tide: "water",
  stone: "rock",
  spark: "electric",
  spirit: "psychic",
};
export const TYPE_ELEMENTS: Record<PokemonType, Element> = {
  normal: "stone",
  fire: "flame",
  water: "tide",
  electric: "spark",
  grass: "leaf",
  ice: "tide",
  fighting: "stone",
  poison: "leaf",
  ground: "stone",
  flying: "spirit",
  psychic: "spirit",
  bug: "leaf",
  rock: "stone",
  ghost: "spirit",
  dragon: "flame",
  dark: "spirit",
  steel: "stone",
  fairy: "spirit",
};
export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: "#b9afa0",
  fire: "#ef864f",
  water: "#62b7e9",
  electric: "#efce53",
  grass: "#82bb60",
  ice: "#a4e4e6",
  fighting: "#bf655a",
  poison: "#b881cf",
  ground: "#c9a271",
  flying: "#b0c8ed",
  psychic: "#ec8bac",
  bug: "#b0bf56",
  rock: "#aa9574",
  ghost: "#9c8cc8",
  dragon: "#9479e4",
  dark: "#887e95",
  steel: "#a7becb",
  fairy: "#edaed4",
};
export function typeMultiplier(
  attack: PokemonType | Element,
  defenders: readonly PokemonType[],
) {
  const type =
    attack in LEGACY_TYPES
      ? LEGACY_TYPES[attack as Element]
      : (attack as PokemonType);
  const row = chart[type] as Partial<Record<PokemonType, number>>;
  return defenders.reduce((result, target) => result * (row[target] ?? 1), 1);
}
