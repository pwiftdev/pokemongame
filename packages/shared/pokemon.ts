import source from "./pokemon-source.json" with { type: "json" };
import type { Biome } from "./types";
import type { PokemonType } from "./pokemon-types";

export const STAT_KEYS = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
] as const;
export type Stat = (typeof STAT_KEYS)[number];
export type Stats = Record<Stat, number>;
export type Temperament =
  | "skittish"
  | "curious"
  | "territorial"
  | "sleepy"
  | "playful";
export type Locomotion =
  | "quadruped"
  | "biped"
  | "serpent"
  | "flying"
  | "floating"
  | "swimming"
  | "burrowing";
export interface Evolution {
  species: string;
  level: number;
  item?: string;
  location?: Biome;
}
export interface PokemonSpecies {
  id: string;
  name: string;
  number: number;
  types: PokemonType[];
  baseStats: Stats;
  learnset: { level: number; move: string }[];
  evolutions: Evolution[];
  catchRate: number;
  rarity: "common" | "uncommon" | "rare";
  habitat: Biome;
  time: "any" | "day" | "night";
  weather: "any" | "rain" | "clear";
  temperament: Temperament;
  size: number;
  modelScale: number;
  locomotion: Locomotion;
  entry: string;
}
const families: [string, Biome, Temperament, Locomotion, string][] = [
  [
    "bulbasaur ivysaur venusaur",
    "meadow",
    "curious",
    "quadruped",
    "Gathers sunlight in the flower meadows, then rests with its herd.",
  ],
  [
    "charmander charmeleon charizard",
    "desert",
    "territorial",
    "biped",
    "Basks on warm rocks. Give its flickering tail plenty of space.",
  ],
  [
    "squirtle wartortle blastoise",
    "marsh",
    "playful",
    "swimming",
    "Patrols the reed banks and splashes its companions.",
  ],
  [
    "pichu pikachu raichu",
    "forest",
    "playful",
    "biped",
    "Plays beneath the trees, releasing tiny sparks as it runs.",
  ],
  [
    "eevee vaporeon jolteon flareon",
    "town",
    "curious",
    "quadruped",
    "Approaches quiet visitors and explores sheltered gardens.",
  ],
  [
    "pidgey pidgeotto pidgeot",
    "highlands",
    "skittish",
    "flying",
    "Rides the hillside winds and lands to forage with its flock.",
  ],
  [
    "caterpie metapod butterfree",
    "forest",
    "sleepy",
    "serpent",
    "Rests beneath broad leaves, close to the berry patches.",
  ],
  [
    "oddish gloom vileplume",
    "meadow",
    "sleepy",
    "biped",
    "Sways among the flowers and naps in the soft soil.",
  ],
  [
    "poliwag poliwhirl poliwrath",
    "marsh",
    "curious",
    "swimming",
    "Visits shallow pools to drink and watch the ripples.",
  ],
  [
    "gastly haunter gengar",
    "ruins",
    "playful",
    "floating",
    "Drifts through the ruins after dusk, playing hide and seek.",
  ],
  [
    "geodude graveler golem",
    "desert",
    "territorial",
    "floating",
    "Guards a rocky hollow and warns strangers before fighting.",
  ],
  [
    "magnemite magneton magnezone",
    "ruins",
    "curious",
    "floating",
    "Hovers beside ancient stonework, drawn to its hidden energy.",
  ],
  [
    "swinub piloswine mamoswine",
    "tundra",
    "sleepy",
    "quadruped",
    "Searches the cold ground with its herd, then curls up to rest.",
  ],
  [
    "dratini dragonair dragonite",
    "highlands",
    "skittish",
    "serpent",
    "A rare visitor to the highland springs, easily startled.",
  ],
  [
    "abra kadabra alakazam",
    "forest",
    "sleepy",
    "biped",
    "Meditates in a quiet clearing. Approach slowly while it sleeps.",
  ],
  [
    "sandshrew sandslash",
    "desert",
    "skittish",
    "burrowing",
    "Digs in warm sand and retreats when footsteps grow loud.",
  ],
  [
    "cleffa clefairy clefable",
    "town",
    "curious",
    "biped",
    "Visits the village gardens at night to dance under the stars.",
  ],
];
export const TYPE_LEARNSETS: Partial<Record<PokemonType, string[]>> = {
  grass: [
    "tackle",
    "vine-whip",
    "growth",
    "razor-leaf",
    "synthesis",
    "seed-bomb",
    "solar-beam",
  ],
  fire: [
    "scratch",
    "ember",
    "smokescreen",
    "flame-wheel",
    "flamethrower",
    "fire-spin",
    "fire-blast",
  ],
  water: [
    "tackle",
    "water-gun",
    "withdraw",
    "bubble-beam",
    "aqua-tail",
    "rain-dance",
    "hydro-pump",
  ],
  electric: [
    "quick-attack",
    "thunder-shock",
    "agility",
    "spark",
    "thunder-wave",
    "discharge",
    "thunderbolt",
  ],
  normal: [
    "tackle",
    "quick-attack",
    "growl",
    "bite",
    "swift",
    "take-down",
    "double-edge",
  ],
  flying: [
    "gust",
    "quick-attack",
    "roost",
    "wing-attack",
    "air-cutter",
    "aerial-ace",
    "hurricane",
  ],
  bug: [
    "tackle",
    "bug-bite",
    "string-shot",
    "protect",
    "silver-wind",
    "pin-missile",
    "bug-buzz",
  ],
  ghost: [
    "lick",
    "shadow-ball",
    "hypnosis",
    "night-shade",
    "confuse-ray",
    "hex",
    "dark-pulse",
  ],
  rock: [
    "tackle",
    "rock-throw",
    "defense-curl",
    "rock-tomb",
    "bulldoze",
    "rock-slide",
    "earthquake",
  ],
  ice: [
    "tackle",
    "powder-snow",
    "mist",
    "ice-shard",
    "icy-wind",
    "ice-beam",
    "blizzard",
  ],
  dragon: [
    "wrap",
    "dragon-breath",
    "agility",
    "dragon-tail",
    "aqua-tail",
    "dragon-pulse",
    "outrage",
  ],
  psychic: [
    "confusion",
    "psybeam",
    "recover",
    "reflect",
    "psyshock",
    "psychic",
    "future-sight",
  ],
  ground: [
    "scratch",
    "mud-slap",
    "defense-curl",
    "bulldoze",
    "dig",
    "earth-power",
    "earthquake",
  ],
  fairy: [
    "pound",
    "fairy-wind",
    "sing",
    "disarming-voice",
    "draining-kiss",
    "moonlight",
    "moonblast",
  ],
  steel: [
    "tackle",
    "metal-claw",
    "iron-defense",
    "mirror-shot",
    "flash-cannon",
    "magnet-rise",
    "iron-head",
  ],
};
const levels = [1, 1, 3, 5, 8, 12, 16];
export const POKEMON: Record<string, PokemonSpecies> = Object.fromEntries(
  source.map((row) => {
    const [line, habitat, temperament, style, entry] = families.find(([line]) =>
      line.split(" ").includes(row.id),
    )!;
    const members = line.split(" "),
      stage = members.indexOf(row.id);
    const types = row.types as PokemonType[];
    const poolType = row.id.startsWith("pidge")
      ? "flying"
      : row.id.startsWith("magn")
        ? "steel"
        : types[0];
    const pool = TYPE_LEARNSETS[poolType] ?? TYPE_LEARNSETS.normal!;
    const evolutions: Evolution[] = members[stage + 1]
      ? [{ species: members[stage + 1], level: stage === 0 ? 6 : 12 }]
      : [];
    if (members[0] === "eevee") {
      evolutions.splice(0);
      if (stage === 0)
        for (const [species, item] of [
          ["vaporeon", "water-stone"],
          ["jolteon", "thunder-stone"],
          ["flareon", "fire-stone"],
        ])
          evolutions.push({ species, item, level: 6 });
    }
    if (row.id === "magneton") evolutions[0].location = "ruins";
    const locomotion = ["charizard", "butterfree", "dragonite"].includes(row.id)
      ? "flying"
      : ["graveler", "golem"].includes(row.id)
        ? "biped"
        : style;
    const species: PokemonSpecies = {
      id: row.id,
      name: row.id[0].toUpperCase() + row.id.slice(1),
      number: row.number,
      types,
      baseStats: Object.fromEntries(
        STAT_KEYS.map((key, i) => [key, row.stats[i]]),
      ) as Stats,
      learnset: pool.map((move, i) => ({
        level: levels[i],
        move: `pk-${move}`,
      })),
      evolutions,
      catchRate: row.catchRate,
      rarity:
        members[0] === "dratini" || stage > 1
          ? "rare"
          : stage === 1
            ? "uncommon"
            : "common",
      habitat: ["bulbasaur", "charmander", "squirtle"].includes(row.id)
        ? "meadow"
        : habitat,
      time:
        members[0] === "gastly" || members[0] === "cleffa" ? "night" : "any",
      weather: row.id === "dragonair" ? "rain" : "any",
      temperament,
      size: row.size,
      modelScale: Math.max(0.75, Math.min(2.7, row.size * 1.15)),
      locomotion,
      entry,
    };
    return [row.id, species];
  }),
);
