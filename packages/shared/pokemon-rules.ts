import {
  POKEMON,
  STAT_KEYS,
  type Stats,
  type Stat,
  type Evolution,
} from "./pokemon";
import { typeMultiplier, type PokemonType } from "./pokemon-types";
import type { Biome, Creature } from "./types";

export const NATURES: Record<string, { up?: Stat; down?: Stat }> = {
  Hardy: {},
  Adamant: { up: "attack", down: "specialAttack" },
  Modest: { up: "specialAttack", down: "attack" },
  Bold: { up: "defense", down: "attack" },
  Calm: { up: "specialDefense", down: "attack" },
  Jolly: { up: "speed", down: "specialAttack" },
};
export function weakenedPokemon(wild: {
  species: string;
  hp: number;
  maxHp: number;
}) {
  return !!POKEMON[wild.species] && wild.hp < wild.maxHp * 0.3;
}
export function individualValues(seed: string): Stats {
  let hash = 2166136261;
  for (const char of seed)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return Object.fromEntries(
    STAT_KEYS.map((key) => {
      hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
      return [key, (hash >>> 16) % 32];
    }),
  ) as Stats;
}
export function pokemonStats(
  species: string,
  level: number,
  ivs: Stats = individualValues(species),
  nature = "Hardy",
): Stats {
  const base = POKEMON[species].baseStats,
    modifiers = NATURES[nature] ?? NATURES.Hardy;
  const effectiveLevel = Math.min(100, Math.max(1, level) * 3 + 10);
  return Object.fromEntries(
    STAT_KEYS.map((key) => {
      const core = Math.floor(
        ((2 * base[key] + ivs[key]) * effectiveLevel) / 100,
      );
      return [
        key,
        key === "hp"
          ? core + effectiveLevel + 70
          : Math.floor(
              (core + 5) *
                (modifiers.up === key ? 1.1 : modifiers.down === key ? 0.9 : 1),
            ),
      ];
    }),
  ) as Stats;
}
export function availableMoves(species: string, level: number) {
  return POKEMON[species].learnset
    .filter((entry) => entry.level <= level)
    .map((entry) => entry.move);
}
export function equippedMoves(
  species: string,
  level: number,
  existing: string[] = [],
) {
  const available = availableMoves(species, level);
  return [
    ...new Set([
      ...existing.filter((move) => available.includes(move)),
      ...available,
    ]),
  ].slice(0, 4);
}
export function evolutionOptions(
  creature: Pick<Creature, "species" | "level">,
  inventory: Record<string, number>,
  location?: Biome,
): Evolution[] {
  return (POKEMON[creature.species]?.evolutions ?? []).filter(
    (rule) =>
      creature.level >= rule.level &&
      (!rule.item || (inventory[rule.item] ?? 0) > 0) &&
      (!rule.location || rule.location === location),
  );
}
export function pokemonDamage(input: {
  level: number;
  power: number;
  attack: number;
  defense: number;
  type: PokemonType;
  attackerTypes: readonly PokemonType[];
  defenderTypes: readonly PokemonType[];
  critical?: boolean;
  random?: number;
}) {
  if (input.power <= 0) return 0;
  const effectiveness = typeMultiplier(input.type, input.defenderTypes);
  if (!effectiveness) return 0;
  const level = Math.min(100, Math.max(1, input.level) * 3 + 10);
  const base =
    Math.floor(
      Math.floor(
        (((2 * level) / 5 + 2) * input.power * Math.max(1, input.attack)) /
          Math.max(1, input.defense),
      ) / 50,
    ) + 2;
  return Math.max(
    1,
    Math.floor(
      base *
        (input.attackerTypes.includes(input.type) ? 1.5 : 1) *
        effectiveness *
        (input.critical ? 1.5 : 1) *
        (0.85 + Math.max(0, Math.min(1, input.random ?? 1)) * 0.15),
    ),
  );
}
