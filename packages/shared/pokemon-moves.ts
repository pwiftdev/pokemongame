import rows from "./pokemon-move-source.json" with { type: "json" };
import { TYPE_ELEMENTS, type PokemonType } from "./pokemon-types";
import type { Ability } from "./data";

export type MoveShape =
  | "melee"
  | "projectile"
  | "beam"
  | "cone"
  | "ground"
  | "self";
export interface PokemonMove extends Ability {
  type: PokemonType;
  category: "physical" | "special" | "status";
  accuracy: number;
  pp: number;
  shape: MoveShape;
  animation: "attack" | "attack-alt" | "special";
  vfx: string;
  anticipation: number;
  travelSpeed: number;
  recovery: number;
}
const effects: Record<string, Ability["effect"]> = {
  synthesis: "heal",
  recover: "heal",
  roost: "heal",
  moonlight: "heal",
  "draining-kiss": "heal",
  withdraw: "guard",
  protect: "guard",
  reflect: "guard",
  "defense-curl": "guard",
  "iron-defense": "guard",
  mist: "guard",
  growth: "guard",
  "rain-dance": "guard",
  "magnet-rise": "evasion",
  agility: "evasion",
  smokescreen: "evasion",
  growl: "slow",
  "string-shot": "slow",
  "rock-tomb": "slow",
  "icy-wind": "slow",
  "mud-slap": "slow",
  "confuse-ray": "slow",
  "thunder-wave": "stun",
  hypnosis: "stun",
  sing: "stun",
  "thunder-shock": "stun",
  "dragon-breath": "stun",
  ember: "burn",
  "fire-spin": "burn",
  "fire-blast": "burn",
  lick: "slow",
};
const beams = new Set([
  "water-gun",
  "solar-beam",
  "ice-beam",
  "psybeam",
  "flash-cannon",
  "thunderbolt",
]);
const cones = new Set([
  "flamethrower",
  "powder-snow",
  "icy-wind",
  "gust",
  "air-cutter",
  "dragon-breath",
]);
const grounds = new Set([
  "earthquake",
  "rock-slide",
  "blizzard",
  "discharge",
  "future-sight",
  "earth-power",
  "hurricane",
]);
function shapeFor(id: string, category: string): MoveShape {
  return category === "status" &&
    ![
      "growl",
      "string-shot",
      "thunder-wave",
      "hypnosis",
      "sing",
      "confuse-ray",
    ].includes(id)
    ? "self"
    : beams.has(id)
      ? "beam"
      : cones.has(id)
        ? "cone"
        : grounds.has(id)
          ? "ground"
          : category === "physical" &&
              ![
                "rock-throw",
                "rock-tomb",
                "razor-leaf",
                "seed-bomb",
                "pin-missile",
                "ice-shard",
              ].includes(id)
            ? "melee"
            : "projectile";
}
export const POKEMON_MOVES: Record<string, PokemonMove> = Object.fromEntries(
  rows.map((row) => {
    const type = row.type as PokemonType,
      shape = shapeFor(row.id, row.category);
    const move: PokemonMove = {
      id: `pk-${row.id}`,
      name: row.id
        .split("-")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" "),
      type,
      element: TYPE_ELEMENTS[type],
      category: row.category as PokemonMove["category"],
      power: row.power,
      accuracy: row.accuracy / 100,
      pp: row.pp,
      cooldown:
        row.category === "status"
          ? 12
          : row.power >= 90
            ? 9
            : row.power >= 60
              ? 6
              : 3,
      range:
        shape === "self"
          ? 0
          : shape === "melee"
            ? 3.2
            : shape === "cone"
              ? 8
              : 15,
      effect: effects[row.id],
      shape,
      animation:
        shape === "melee"
          ? "attack"
          : row.power >= 80
            ? "special"
            : "attack-alt",
      vfx: row.id,
      anticipation: shape === "melee" ? 220 : row.power >= 80 ? 600 : 350,
      travelSpeed: shape === "beam" ? 60 : 20,
      recovery: row.power >= 80 ? 650 : 350,
      ...(shape === "ground" ? { aoe: 3.5 } : {}),
      description: `${type} ${row.category} · ${row.power ? `${row.power} power · ` : ""}${row.accuracy}% accuracy. ${effects[row.id] ?? shape}.`,
    };
    return [move.id, move];
  }),
);
