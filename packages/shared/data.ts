import { POKEMON } from "./pokemon";
import { POKEMON_MOVES } from "./pokemon-moves";
import { TYPE_COLORS, TYPE_ELEMENTS } from "./pokemon-types";
import { STORY_PLACES } from "./story";
export { QUESTS, type Quest } from "./story";
export { SPAWNS, type Spawn } from "./encounters";
import { REGIONS, WAYSTONES, WORLD_RADIUS } from "./regions";
import { CLASSES } from "./classes";
import type { Biome, Element } from "./types";
export const BRAND = {
  title: "World of Pokémon",
  subtitle: "The Wildlight Isles",
  currency: "PD",
  island: "Aster Isle",
  version: "First expedition · 0.1",
};
export const ELEMENTS: Record<
  Element,
  { name: string; color: string; strong: Element; weak: Element }
> = {
  leaf: { name: "Leaf", color: "#8aac63", strong: "tide", weak: "flame" },
  flame: { name: "Flame", color: "#e89860", strong: "leaf", weak: "tide" },
  tide: { name: "Tide", color: "#69b8c9", strong: "flame", weak: "leaf" },
  stone: { name: "Stone", color: "#b6a789", strong: "spark", weak: "spirit" },
  spark: { name: "Spark", color: "#e6ca73", strong: "spirit", weak: "stone" },
  spirit: { name: "Spirit", color: "#be9ed7", strong: "stone", weak: "spark" },
};
export interface Ability {
  id: string;
  name: string;
  element: Element;
  power: number;
  cooldown: number;
  range: number;
  effect?:
    | "heal"
    | "guard"
    | "slow"
    | "burn"
    | "stun"
    | "evasion"
    | "poison"
    | "taunt"
    | "stealth";
  description: string;
  mobility?: "blink" | "charge" | "shadowstep";
  /** Class resource spent on use. */
  cost?: number;
  /** Class resource gained when the ability lands. */
  generate?: number;
  /** Combo points gained (rogue). */
  combo?: number;
  /** Extra power for each combo point consumed. */
  finisher?: number;
  /** Ignores and does not trigger the global cooldown. */
  offGcd?: boolean;
  /** Hero level required. */
  unlock?: number;
  /** Cancels the target's spell and locks out its specials. */
  interrupt?: boolean;
  /** Radius of an area hit around the aim point (or the caster when aoeSelf). */
  aoe?: number;
  aoeSelf?: boolean;
  /** Usable only below this fraction of target health. */
  execute?: number;
  /** Triple damage against slowed or stunned targets. */
  shatter?: boolean;
  /** Additional critical strike chance. */
  crit?: number;
}
const abilityRows: [
  string,
  string,
  Element,
  number,
  number,
  number,
  Ability["effect"],
  string,
][] = [
  [
    "leaf-tap",
    "Bramble Tap",
    "leaf",
    12,
    1.2,
    13,
    undefined,
    "A quick lash of living vine.",
  ],
  [
    "vine",
    "Vine Snare",
    "leaf",
    20,
    5,
    16,
    "slow",
    "Entangling vines slow a foe.",
  ],
  [
    "bloom",
    "Bloom",
    "leaf",
    0,
    12,
    0,
    "heal",
    "Restore a little companion health.",
  ],
  [
    "ember",
    "Ember",
    "flame",
    14,
    1.3,
    14,
    undefined,
    "A bright, fast spark of fire.",
  ],
  ["flare", "Sunflare", "flame", 25, 6, 16, "burn", "Scorch a foe over time."],
  [
    "blaze",
    "Blazing Dash",
    "flame",
    34,
    9,
    9,
    undefined,
    "A close-range fiery pounce.",
  ],
  [
    "splash",
    "Water Jet",
    "tide",
    13,
    1.2,
    15,
    undefined,
    "A focused stream of water.",
  ],
  [
    "wave",
    "Tidal Arc",
    "tide",
    26,
    6,
    17,
    "slow",
    "A sweeping wave slows its target.",
  ],
  [
    "mend",
    "Spring Water",
    "tide",
    0,
    12,
    0,
    "heal",
    "Restore companion health.",
  ],
  [
    "pebble",
    "Pebble Shot",
    "stone",
    15,
    1.6,
    14,
    undefined,
    "Launch a polished stone.",
  ],
  [
    "quake",
    "Fault Line",
    "stone",
    32,
    7,
    11,
    "stun",
    "A tremor briefly interrupts attacks.",
  ],
  [
    "shell",
    "Stoneguard",
    "stone",
    0,
    10,
    0,
    "guard",
    "Reduce incoming damage for four seconds.",
  ],
  [
    "zap",
    "Static Dart",
    "spark",
    12,
    1,
    15,
    undefined,
    "A darting bolt of electricity.",
  ],
  [
    "thunder",
    "Thunderclap",
    "spark",
    27,
    6,
    14,
    "stun",
    "A crack of lightning interrupts a foe.",
  ],
  [
    "storm",
    "Storm Lance",
    "spark",
    38,
    10,
    18,
    undefined,
    "Release gathered storm energy.",
  ],
  [
    "wisp",
    "Wisp Bolt",
    "spirit",
    14,
    1.4,
    16,
    undefined,
    "A drifting mote of moonlight.",
  ],
  [
    "dream",
    "Dreambind",
    "spirit",
    21,
    5,
    17,
    "slow",
    "Dream-light slows a foe.",
  ],
  [
    "moon",
    "Moonfall",
    "spirit",
    36,
    9,
    18,
    undefined,
    "A luminous burst of astral energy.",
  ],
  [
    "dodge",
    "Evasive Step",
    "spirit",
    0,
    6,
    0,
    "guard",
    "Brace and evade. Reduces damage for four seconds.",
  ],
];
export const ABILITIES: Record<string, Ability> = Object.fromEntries(
  abilityRows.map(
    ([id, name, element, power, cooldown, range, effect, description]) => [
      id,
      { id, name, element, power, cooldown, range, effect, description },
    ],
  ),
);
export interface Species {
  id: string;
  name: string;
  element: Element;
  biome: Biome;
  baseHp: number;
  power: number;
  difficulty: number;
  moves: string[];
  description: string;
  color: string;
  starter?: boolean;
  companion?: boolean;
  evolution?: { name: string; level: number; cost: number };
}
const speciesRows: Species[] = [
  {
    id: "training-dummy",
    name: "Training dummy",
    element: "stone",
    biome: "town",
    baseHp: 3000,
    power: 0,
    difficulty: 0,
    moves: [],
    description:
      "A wooden practice target. No damage, capture or encounter rewards.",
    color: "#c89e64",
  },
  {
    id: "spriglet",
    name: "Spriglet",
    element: "leaf",
    biome: "meadow",
    baseHp: 90,
    power: 12,
    difficulty: 0.16,
    moves: ["leaf-tap", "vine", "bloom", "dodge"],
    description:
      "A shy woodland mushroom with a blue cap and a gift for finding hidden trails.",
    color: "#92b861",

    evolution: { name: "Verdantail", level: 6, cost: 90 },
  },
  {
    id: "cindercub",
    name: "Cindercub",
    element: "flame",
    biome: "meadow",
    baseHp: 84,
    power: 15,
    difficulty: 0.2,
    moves: ["ember", "flare", "blaze", "dodge"],
    description:
      "A warm-hearted young dragon with sunlit wings and a flickering flame.",
    color: "#e79658",

    evolution: { name: "Solmane", level: 6, cost: 90 },
  },
  {
    id: "brookfin",
    name: "Brookfin",
    element: "tide",
    biome: "meadow",
    baseHp: 98,
    power: 11,
    difficulty: 0.18,
    moves: ["splash", "wave", "mend", "dodge"],
    description:
      "A curious tide spirit with a tall crest and a fearless heart.",
    color: "#7bc5c7",

    evolution: { name: "Tidecrest", level: 6, cost: 90 },
  },
  {
    id: "pebblit",
    name: "Pebblit",
    element: "stone",
    biome: "meadow",
    baseHp: 110,
    power: 10,
    difficulty: 0.22,
    moves: ["pebble", "quake", "shell", "dodge"],
    description:
      "A little winged guardian with a stubborn streak and the heart of a mountain.",
    color: "#b6a883",
  },
  {
    id: "mossprout",
    name: "Mossprout",
    element: "leaf",
    biome: "forest",
    baseHp: 100,
    power: 11,
    difficulty: 0.24,
    moves: ["leaf-tap", "bloom", "vine", "shell"],
    description: "A springy forest sprout that keeps the oldest roots company.",
    color: "#749f64",
  },
  {
    id: "glimmerwing",
    name: "Glimmerwing",
    element: "spirit",
    biome: "forest",
    baseHp: 78,
    power: 16,
    difficulty: 0.29,
    moves: ["wisp", "dream", "moon", "dodge"],
    description: "A luminous forest bee whose tiny wings hum with starlight.",
    color: "#cbb5db",
  },
  {
    id: "voltkit",
    name: "Voltkit",
    element: "spark",
    biome: "forest",
    baseHp: 85,
    power: 14,
    difficulty: 0.27,
    moves: ["zap", "thunder", "storm", "dodge"],
    description:
      "A sprightly cactus that collects static between its branching arms.",
    color: "#e7ca6d",
  },
  {
    id: "duskowl",
    name: "Duskwing",
    element: "spirit",
    biome: "forest",
    baseHp: 94,
    power: 14,
    difficulty: 0.3,
    moves: ["wisp", "dream", "moon", "bloom"],
    description:
      "A moonlit cave bat that watches forest trails from broad wings.",
    color: "#9f96c8",
  },
  {
    id: "cragclaw",
    name: "Cragclaw",
    element: "stone",
    biome: "ruins",
    baseHp: 125,
    power: 15,
    difficulty: 0.36,
    moves: ["pebble", "quake", "shell", "blaze"],
    description:
      "A fierce ruin guardian in a weathered bone mask, carrying relics of an older age.",
    color: "#b5a392",
  },
  {
    id: "coralisk",
    name: "Coralisk",
    element: "tide",
    biome: "ruins",
    baseHp: 105,
    power: 16,
    difficulty: 0.35,
    moves: ["splash", "wave", "mend", "dream"],
    description: "A drifting sea spirit, shaped by salt mist and coral dreams.",
    color: "#87bbb3",
  },
  {
    id: "sunscale",
    name: "Sunscale",
    element: "flame",
    biome: "ruins",
    baseHp: 100,
    power: 18,
    difficulty: 0.38,
    moves: ["ember", "flare", "blaze", "shell"],
    description:
      "A bright-eyed coastal bird with a fiery temper and a fearless stride.",
    color: "#d89871",
  },
  {
    id: "tempest",
    name: "Tempest",
    element: "spark",
    biome: "ruins",
    baseHp: 96,
    power: 19,
    difficulty: 0.4,
    moves: ["zap", "thunder", "storm", "wave"],
    description:
      "A shaggy storm giant drawn to the old observatory by distant thunder.",
    color: "#d9cc8a",
  },
];
export const COMPANIONS: Species[] = Object.values(POKEMON).map((p) => ({
  id: p.id,
  name: p.name,
  element: TYPE_ELEMENTS[p.types[0]],
  biome: p.habitat,
  baseHp: p.baseStats.hp,
  power: p.baseStats.attack / 5,
  difficulty: 1 - p.catchRate / 255,
  moves: p.learnset.slice(0, 4).map((entry) => entry.move),
  description: p.entry,
  color: TYPE_COLORS[p.types[0]],
  starter: ["bulbasaur", "charmander", "squirtle"].includes(p.id),
  companion: true,
  ...(p.evolutions[0]
    ? {
        evolution: {
          name: POKEMON[p.evolutions[0].species].name,
          level: p.evolutions[0].level,
          cost: 90,
        },
      }
    : {}),
}));
Object.assign(ABILITIES, POKEMON_MOVES);
for (const c of Object.values(CLASSES))
  for (const ability of c.abilities) ABILITIES[ability.id] = ability;
export const SPECIES: Record<string, Species> = Object.fromEntries(
  [...speciesRows, ...COMPANIONS].map((s) => [s.id, s]),
);
export const STARTERS = COMPANIONS.filter((s) => s.starter).map((s) => s.id);
export interface Item {
  id: string;
  name: string;
  price: number;
  effect: string;
  value: number;
  description: string;
}
export const ITEMS: Record<string, Item> = Object.fromEntries(
  [
    {
      id: "capsule",
      name: "Taming capsule",
      price: 15,
      effect: "tame",
      value: 1,
      description: "A gentle field capsule. Weaken a wild creature first.",
    },
    {
      id: "prism",
      name: "Prism capsule",
      price: 40,
      effect: "tame",
      value: 1.55,
      description: "A refined capsule with a better chance of taming.",
    },
    {
      id: "potion",
      name: "Spring tonic",
      price: 12,
      effect: "heal",
      value: 45,
      description: "Restore 45 health to your active companion.",
    },
    {
      id: "super-potion",
      name: "Bloom tonic",
      price: 30,
      effect: "heal",
      value: 120,
      description: "Restore 120 health to your active companion.",
    },
    {
      id: "revive",
      name: "Revival seed",
      price: 45,
      effect: "revive",
      value: 0.5,
      description: "Revive a fallen active companion at half health.",
    },
    {
      id: "bait",
      name: "Sweetseed bait",
      price: 10,
      effect: "bait",
      value: 0.15,
      description: "Your next taming attempt gains a 15% chance bonus.",
    },
    {
      id: "cleanse",
      name: "Clearwater leaf",
      price: 14,
      effect: "cleanse",
      value: 1,
      description: "Remove active combat statuses.",
    },
    {
      id: "charm",
      name: "Trail charm",
      price: 80,
      effect: "charm",
      value: 1,
      description: "A wearable golden companion aura. Cosmetic only.",
    },
    {
      id: "rations",
      name: "Trail rations",
      price: 25,
      effect: "teamHeal",
      value: 35,
      description: "Restore 35 health to every teammate outside combat.",
    },
  ].map((i) => [i.id, i]),
);
for (const [id, name] of [
  ["water-stone", "Water Stone"],
  ["fire-stone", "Fire Stone"],
  ["thunder-stone", "Thunder Stone"],
])
  ITEMS[id] = {
    id,
    name,
    price: 60,
    effect: "evolution",
    value: 1,
    description:
      "An evolution stone for Eevee. Use it from the Companions panel at the lodge.",
  };
export interface Place {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: "heal" | "shop" | "quest" | "stable" | "arena" | "landmark";
  biome: Biome;
  description: string;
}
export const PLACES: Place[] = [
  {
    id: "heal",
    name: "The Springhouse",
    x: -10,
    z: -30,
    kind: "heal",
    biome: "town",
    description: "Rest and restore your entire collection, free of charge.",
  },
  {
    id: "shop",
    name: "Mira’s Field Supply",
    x: 10,
    z: -30,
    kind: "shop",
    biome: "town",
    description: "Taming supplies, tonics, and a little luck for the trail.",
  },
  {
    id: "quest",
    name: "Expedition Board",
    x: 0,
    z: -22,
    kind: "quest",
    biome: "town",
    description:
      "Expedition Captain Iona: Rowan needs help at the Sunpetal windmill. Read your orders here, then follow the western road.",
  },
  {
    id: "stable",
    name: "Companion Lodge",
    x: -16,
    z: -16,
    kind: "stable",
    biome: "town",
    description: "Arrange your team, deploy a friend, and guide ascensions.",
  },
  {
    id: "arena",
    name: "Sunstone Arena",
    x: 23,
    z: -13,
    kind: "arena",
    biome: "town",
    description:
      "Friendly level-10 trainer duels, spectator seating and a practice yard.",
  },
  {
    id: "meadow",
    name: "Sunpetal Meadow",
    x: -30,
    z: 7,
    kind: "landmark",
    biome: "meadow",
    description: "Golden grasses gather beneath the old windmill.",
  },
  {
    id: "forest",
    name: "Lanternwood",
    x: 33,
    z: 22,
    kind: "landmark",
    biome: "forest",
    description: "Bioluminescent flowers illuminate a forest of ancient roots.",
  },
  {
    id: "ruins",
    name: "Tideglass Ruins",
    x: 8,
    z: 61,
    kind: "landmark",
    biome: "ruins",
    description: "Broken coastal arches frame the Stormheart sanctuary.",
  },
];
export const BIOMES = Object.fromEntries(
  REGIONS.map((r) => [r.id, r]),
) as Record<Biome, (typeof REGIONS)[number]>;
PLACES.push(...WAYSTONES);
PLACES.push(...STORY_PLACES);
export const OBSTACLES = [
  { x: -10, z: -35, radius: 3.5 },
  { x: 10, z: -35, radius: 3.5 },
  { x: -21, z: -17, radius: 3 },
  { x: 18, z: -43, radius: 3 },
  { x: -21, z: -44, radius: 3 },
  { x: -35, z: 10, radius: 2.5 },
  { x: 35, z: 23, radius: 3 },
  { x: 0, z: 61, radius: 2 },
  ...STORY_PLACES.filter((p) => p.kind === "quest").map((p) => ({
    x: p.x,
    z: p.z,
    radius: 0.65,
  })),
];
export const WORLD = {
  radius: WORLD_RADIUS,
  spawn: { x: 0, z: -32 },
  speed: 5.5,
  sprint: 8,
  tickMs: 50,
  snapshotMs: 100,
  maxPlayers: 16,
};
