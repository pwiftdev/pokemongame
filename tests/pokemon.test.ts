import { describe, expect, it } from "vitest";
import { POKEMON, STAT_KEYS } from "../packages/shared/pokemon";
import { POKEMON_MOVES } from "../packages/shared/pokemon-moves";
import {
  LEGACY_TYPES,
  POKEMON_TYPES,
  typeMultiplier,
} from "../packages/shared/pokemon-types";
import {
  availableMoves,
  equippedMoves,
  evolutionOptions,
  individualValues,
  pokemonDamage,
  pokemonStats,
} from "../packages/shared/pokemon-rules";
import {
  makeCreature,
  useItem,
  gainExperience,
} from "../apps/server/src/gameplay";
import { effectiveness, xpForLevel } from "../packages/shared/rules";
import {
  deployCompanion,
  type CompanionState,
} from "../apps/server/src/companion";
import { normalizeProfile, validateProfile } from "../apps/server/src/profile";
import type { Profile } from "../packages/shared/types";
import { chooseCompanionMove } from "../packages/shared/companion-brain";
import {
  pokemonAvailable,
  temperamentAction,
  worldConditions,
} from "../packages/shared/pokemon-habitats";
import { capturePresentation, recordPokemon } from "../packages/shared/pokedex";

describe("Pokémon rules", () => {
  it("maps hero elements to real dual types and immunities while retaining monster balance", () => {
    expect(effectiveness("spark", "stone", ["ground"])).toBe(0);
    expect(effectiveness("flame", "leaf", ["grass", "steel"])).toBe(4);
    expect(effectiveness("flame", "leaf")).toBe(1.5);
  });
  it("keeps a fainted teammate fainted when experience raises its level", () => {
    const creature = makeCreature("bulbasaur", 2);
    creature.hp = 0;
    gainExperience(creature, xpForLevel(2));
    expect(creature.level).toBe(3);
    expect(creature.hp).toBe(0);
  });
  it("preserves per-creature cooldowns across swaps and cancels the old cast", () => {
    const owner = {
      x: 0,
      z: 0,
      yaw: 0,
      pet: undefined as CompanionState | undefined,
      petCooldowns: new Map<string, Record<string, number>>(),
    };
    owner.pet = deployCompanion(owner, "a");
    owner.pet.cooldowns["pk-vine-whip"] = 20000;
    owner.pet = deployCompanion(owner, "b");
    expect(owner.pet.cooldowns["pk-vine-whip"]).toBeUndefined();
    owner.pet = deployCompanion(owner, "a");
    expect(owner.pet.cooldowns["pk-vine-whip"]).toBe(20000);
    expect(owner.pet.cast).toBeUndefined();
  });
  it("does not consume an evolution stone through the ordinary item command", () => {
    const profile = { inventory: { "water-stone": 1 } } as unknown as Profile;
    expect(() => useItem(profile, "water-stone", false)).toThrow(
      "Companions panel",
    );
    expect(profile.inventory["water-stone"]).toBe(1);
  });
  it("chooses ready moves by matchup and switches to healing when hurt", () => {
    const creature = makeCreature("bulbasaur", 12);
    creature.moves = [
      "pk-tackle",
      "pk-vine-whip",
      "pk-synthesis",
      "pk-protect",
    ];
    const context = {
      now: 100,
      distance: 2,
      cooldowns: {},
      targetTypes: ["water" as const],
      statuses: [],
      guarding: false,
    };
    expect(chooseCompanionMove(creature, context)).toBe(1);
    expect(
      chooseCompanionMove(creature, {
        ...context,
        cooldowns: { "pk-vine-whip": 200 },
      }),
    ).toBe(0);
    creature.hp = 10;
    expect(chooseCompanionMove(creature, context)).toBe(2);
    expect(
      chooseCompanionMove(creature, {
        ...context,
        cooldowns: Object.fromEntries(creature.moves.map((id) => [id, 200])),
      }),
    ).toBe(-1);
  });
  it("gates nighttime and rain visitors using shared authoritative conditions", () => {
    expect(worldConditions(0)).toEqual({ time: "day", weather: "rain" });
    expect(pokemonAvailable("gastly", 0)).toBe(false);
    expect(pokemonAvailable("gastly", 400000)).toBe(true);
    expect(pokemonAvailable("dragonair", 0)).toBe(true);
    expect(pokemonAvailable("dragonair", 200000)).toBe(false);
  });
  it("distinguishes all temperaments and gives territorial visitors warning time", () => {
    expect(temperamentAction("skittish", 3, false, 0).activity).toBe("flee");
    expect(temperamentAction("curious", 6, false, 0).activity).toBe("inspect");
    expect(temperamentAction("sleepy", 3, false, 0).activity).toBe("sleep");
    expect(temperamentAction("playful", 6, false, 0).activity).toBe("play");
    expect(temperamentAction("territorial", 3, false, 1900).aggression).toBe(
      false,
    );
    expect(temperamentAction("territorial", 3, false, 2100).aggression).toBe(
      true,
    );
    expect(
      temperamentAction("territorial", 3, false, 2100, true).aggression,
    ).toBe(false);
  });
  it("bounds capsule shakes and records seen/caught without duplicates", () => {
    expect(capturePresentation(true).shakes).toBe(3);
    expect(capturePresentation(false, 0).shakes).toBe(1);
    expect(capturePresentation(false, 0.99).shakes).toBe(3);
    const profile = {
      pokedex: { seen: [], caught: [], rewards: [] },
    } as unknown as Profile;
    expect(recordPokemon(profile, "eevee")).toBe(true);
    expect(recordPokemon(profile, "eevee")).toBe(false);
    expect(recordPokemon(profile, "eevee", true)).toBe(true);
    expect(recordPokemon(profile, "eevee", true)).toBe(false);
    expect(profile.pokedex).toEqual({
      seen: ["eevee"],
      caught: ["eevee"],
      rewards: [],
    });
  });
  it("provides complete data and reachable evolution lines across eight habitats", () => {
    expect(Object.keys(POKEMON).length).toBeGreaterThanOrEqual(40);
    expect(new Set(Object.values(POKEMON).map((p) => p.habitat)).size).toBe(8);
    expect(Object.keys(POKEMON_MOVES).length).toBeGreaterThanOrEqual(60);
    for (const p of Object.values(POKEMON)) {
      expect(p.learnset.length).toBeGreaterThan(4);
      for (const entry of p.learnset)
        expect(POKEMON_MOVES[entry.move], entry.move).toBeDefined();
      for (const evolution of p.evolutions)
        expect(POKEMON[evolution.species]).toBeDefined();
      expect(STAT_KEYS.every((key) => p.baseStats[key] > 0)).toBe(true);
      expect(equippedMoves(p.id, 20)).toHaveLength(4);
    }
  });
  it("implements all eighteen types, dual resistance and immunity", () => {
    expect(POKEMON_TYPES).toHaveLength(18);
    expect(typeMultiplier("electric", ["ground", "flying"])).toBe(0);
    expect(typeMultiplier("rock", ["fire", "flying"])).toBe(4);
    expect(typeMultiplier("grass", ["fire", "flying"])).toBe(0.25);
    expect(typeMultiplier("dragon", ["fairy"])).toBe(0);
    expect(typeMultiplier("ghost", ["normal"])).toBe(0);
    for (const [legacy, type] of Object.entries(LEGACY_TYPES))
      expect(
        typeMultiplier(legacy as keyof typeof LEGACY_TYPES, ["grass"]),
      ).toBe(typeMultiplier(type, ["grass"]));
  });
  it("calculates level, IV and nature variation deterministically", () => {
    const ivs = individualValues("fixed-identity");
    expect(ivs).toEqual(individualValues("fixed-identity"));
    expect(ivs).not.toEqual(individualValues("another-identity"));
    const stats = pokemonStats("bulbasaur", 5, ivs);
    expect(pokemonStats("bulbasaur", 6, ivs).hp).toBeGreaterThan(stats.hp);
    expect(pokemonStats("bulbasaur", 5, ivs, "Adamant").attack).toBeGreaterThan(
      stats.attack,
    );
    expect(
      pokemonStats("bulbasaur", 5, ivs, "Adamant").specialAttack,
    ).toBeLessThan(stats.specialAttack);
  });
  it("applies defense, STAB, variance, critical hits and immunities in damage", () => {
    const attack = {
      level: 10,
      power: 60,
      attack: 50,
      defense: 50,
      type: "fire" as const,
      attackerTypes: ["fire" as const],
      defenderTypes: ["grass" as const],
      random: 1,
    };
    expect(pokemonDamage(attack)).toBe(69);
    expect(pokemonDamage({ ...attack, critical: true })).toBe(103);
    expect(pokemonDamage({ ...attack, random: 0 })).toBe(58);
    expect(pokemonDamage({ ...attack, attackerTypes: [] })).toBe(46);
    expect(pokemonDamage({ ...attack, defense: 100 })).toBeLessThan(69);
    expect(
      pokemonDamage({ ...attack, type: "electric", defenderTypes: ["ground"] }),
    ).toBe(0);
    expect(pokemonDamage({ ...attack, power: 0 })).toBe(0);
  });
  it("keeps equipped choices, rejects unlearned moves and gates evolution methods", () => {
    expect(availableMoves("squirtle", 1)).toEqual([
      "pk-tackle",
      "pk-water-gun",
    ]);
    expect(equippedMoves("squirtle", 12, ["pk-aqua-tail", "pk-admin"])[0]).toBe(
      "pk-aqua-tail",
    );
    expect(evolutionOptions({ species: "squirtle", level: 5 }, {})).toEqual([]);
    expect(
      evolutionOptions({ species: "squirtle", level: 6 }, {})[0].species,
    ).toBe("wartortle");
    expect(evolutionOptions({ species: "eevee", level: 6 }, {})).toEqual([]);
    expect(
      evolutionOptions({ species: "eevee", level: 6 }, { "water-stone": 1 })[0]
        .species,
    ).toBe("vaporeon");
    expect(
      evolutionOptions({ species: "magneton", level: 12 }, {}, "town"),
    ).toEqual([]);
    expect(
      evolutionOptions({ species: "magneton", level: 12 }, {}, "ruins")[0]
        .species,
    ).toBe("magnezone");
  });
  it("migrates evolved and fainted saves once without changing identity, economy or team", () => {
    const c = makeCreature("bulbasaur", 7);
    delete c.dataVersion;
    delete c.ivs;
    delete c.nature;
    c.evolved = true;
    c.hp = 0;
    c.nickname = "Fern";
    c.xp = 19;
    const profile: Profile = {
      id: "save",
      nickname: "Trainer",
      balance: 123,
      creatures: [c],
      team: [c.id],
      active: c.id,
      inventory: { capsule: 3 },
      quests: {},
      claimed: ["quest"],
      discoveries: ["forest"],
      wins: 2,
      losses: 1,
    };
    normalizeProfile(profile);
    expect(c).toMatchObject({
      species: "ivysaur",
      hp: 0,
      nickname: "Fern",
      xp: 19,
    });
    expect(profile.pokedex?.caught).toContain("ivysaur");
    const saved = structuredClone(profile);
    expect(normalizeProfile(profile)).toEqual(saved);
    expect(profile.balance).toBe(123);
    expect(profile.team).toEqual([c.id]);
    validateProfile(profile);
  });
});
