import { POKEMON, type Temperament } from "./pokemon";
import type { Biome } from "./types";
import type { Habitat, Spawn } from "./encounters";

export const POKEMON_HABITATS: Habitat[] = [
  ["town", "Moonlit Gardens", 39, -64],
  ["meadow", "Petal Gathering", -88, 34],
  ["forest", "Berry Canopy", 79, 27],
  ["ruins", "Echo Court", 40, 93],
  ["desert", "Warmstone Hollow", -183, 42],
  ["marsh", "Ripple Pools", 183, 48],
  ["tundra", "Snowroot Herd", -29, 223],
  ["highlands", "Cloudspring Ridge", 27, -214],
].map(([biome, name, x, z]) => ({
  id: `pokemon-${biome}`,
  name: String(name),
  x: Number(x),
  z: Number(z),
  biome: biome as Biome,
  kind: "pokemon",
  description:
    "A living Pokémon habitat. Watch quietly to discover its residents.",
}));
const levels: Record<Biome, number> = {
  town: 2,
  meadow: 3,
  forest: 5,
  ruins: 9,
  desert: 9,
  marsh: 11,
  tundra: 15,
  highlands: 6,
};
export const POKEMON_SPAWNS: Spawn[] = POKEMON_HABITATS.flatMap((habitat) => {
  const residents = Object.values(POKEMON).filter(
    (p) =>
      p.habitat === habitat.biome &&
      !["bulbasaur", "charmander", "squirtle"].includes(p.id),
  );
  return residents.flatMap((p, i) =>
    Array.from({ length: p.rarity === "common" ? 2 : 1 }, (_, member) => {
      const angle = i * 2.399 + member * 0.28,
        radius = 3 + (i % 3) * 2 + member;
      return {
        id: `pokemon-${p.id}-${member}`,
        species: p.id,
        x: habitat.x + Math.cos(angle) * radius,
        z: habitat.z + Math.sin(angle) * radius,
        level: Math.min(
          20,
          levels[habitat.biome] + (p.rarity === "rare" ? 3 : 0),
        ),
        habitat: habitat.id,
      };
    }),
  );
});
export function worldConditions(now: number) {
  const phase = ((now % 600000) + 600000) % 600000;
  return {
    time: phase < 360000 ? ("day" as const) : ("night" as const),
    weather:
      Math.floor(now / 180000) % 3 === 0
        ? ("rain" as const)
        : ("clear" as const),
  };
}
export function pokemonAvailable(species: string, now: number) {
  const p = POKEMON[species],
    conditions = worldConditions(now);
  return (
    !p ||
    ((p.time === "any" || p.time === conditions.time) &&
      (p.weather === "any" || p.weather === conditions.weather))
  );
}
export type PokemonActivity =
  | "rest"
  | "sleep"
  | "drink"
  | "feed"
  | "inspect"
  | "play"
  | "warn"
  | "flee"
  | "burrow";
export function temperamentAction(
  temperament: Temperament,
  distance: number,
  moving: boolean,
  warnedFor: number,
  safe = false,
): { activity: PokemonActivity; speed: number; aggression: boolean } {
  if (temperament === "skittish" && distance < 5)
    return { activity: "flee", speed: 4.8, aggression: false };
  if (temperament === "curious" && distance < 10)
    return {
      activity: "inspect",
      speed: distance > 2.8 ? 1.8 : 0,
      aggression: false,
    };
  if (temperament === "territorial" && distance < 5 && !safe)
    return { activity: "warn", speed: 0, aggression: warnedFor >= 2000 };
  if (temperament === "sleepy")
    return {
      activity: moving && distance < 2 ? "inspect" : "sleep",
      speed: 0,
      aggression: false,
    };
  if (temperament === "playful")
    return { activity: "play", speed: 2.2, aggression: false };
  return { activity: "rest", speed: 0, aggression: false };
}
