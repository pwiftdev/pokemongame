import { describe, expect, it } from "vitest";
import {
  tickPokemonAmbient,
  type AmbientPokemon,
} from "../apps/server/src/pokemon-wildlife";
import { POKEMON } from "../packages/shared/pokemon";
import { SPAWNS } from "../packages/shared/encounters";
import { distance, walkable } from "../packages/shared/rules";
import { isSafeArea } from "../packages/shared/regions";
import { wildMotion } from "../apps/client/src/render/wild-presentation";
import { creatureClip } from "../apps/client/src/render/creature-clips";
import type { WildView } from "../packages/shared/types";
function animal(id = "wild-a", species = "bulbasaur"): AmbientPokemon {
  return {
    id,
    species,
    x: -12,
    z: -5,
    home: { x: -12, z: -5 },
    hp: 100,
    state: "idle",
  };
}
describe("living wildlife", () => {
  it("gives individuals different routines with pauses, bounded homes and no wall crossings", () => {
    const animals = Array.from({ length: 8 }, (_, i) => animal(`herd-${i}`));
    const states = new Set<string>();
    for (let now = 1000; now < 61000; now += 50) {
      for (const a of animals) {
        const before = { x: a.x, z: a.z };
        tickPokemonAmbient(a, [], animals, now);
        expect(walkable(a.x, a.z)).toBe(true);
        expect(distance(a, a.home)).toBeLessThan(9.1);
        expect(distance(a, before)).toBeLessThanOrEqual(0.08);
        states.add(a.state);
      }
    }
    expect(states).toEqual(new Set(["idle", "roam"]));
    expect(new Set(animals.map((a) => `${a.x},${a.z}`)).size).toBeGreaterThan(
      5,
    );
  });
  it("curious Pokémon approach, stop at a respectful distance and face visitors", () => {
    const a = animal();
    const visitor = { id: "trainer", x: -8, z: -5, moving: false };
    for (let now = 1000; now < 5000; now += 50)
      tickPokemonAmbient(a, [visitor], [a], now);
    expect(a.activity).toBe("inspect");
    expect(a.state).toBe("idle");
    expect(distance(a, visitor)).toBeGreaterThan(2);
    expect(distance(a, visitor)).toBeLessThan(3);
    expect(a.yaw).toBeCloseTo(Math.PI / 2);
  });
  it("skittish species flee and territorial warnings require time and respect sanctuary", () => {
    const skittish = Object.values(POKEMON).find(
      (p) => p.temperament === "skittish",
    )!.id;
    const a = animal("shy", skittish);
    const visitor = { id: "trainer", x: -10, z: -5, moving: true };
    const before = distance(a, visitor);
    tickPokemonAmbient(a, [visitor], [a], 1000);
    expect(["flee", "burrow"]).toContain(a.activity);
    expect(distance(a, visitor)).toBeGreaterThan(before);
    const guard = animal("guard", "charmander");
    expect(tickPokemonAmbient(guard, [visitor], [guard], 1000)).toBeUndefined();
    expect(guard.activity).toBe("warn");
    expect(tickPokemonAmbient(guard, [visitor], [guard], 2500)).toBeUndefined();
    expect(tickPokemonAmbient(guard, [visitor], [guard], 3500)).toBe("trainer");
    const town = {
      ...animal("town", "charmander"),
      x: 0,
      z: -32,
      home: { x: 0, z: -32 },
    };
    expect(
      tickPokemonAmbient(town, [{ ...visitor, x: 1, z: -32 }], [town], 9000),
    ).toBeUndefined();
    expect(town.activity).not.toBe("warn");
  });
  it("hostile patrols stay walkable and outside sanctuary", () => {
    const spawns = SPAWNS.filter(
      (s) => !POKEMON[s.species] && !isSafeArea(s.x, s.z),
    );
    for (const spawn of spawns) {
      const a = {
        ...animal(spawn.id, spawn.species),
        x: spawn.x,
        z: spawn.z,
        home: { x: spawn.x, z: spawn.z },
      };
      for (let now = 1000; now < 15000; now += 50) {
        tickPokemonAmbient(a, [], [a], now, true);
        expect(isSafeArea(a.x, a.z), spawn.id).toBe(false);
        expect(distance(a, a.home)).toBeLessThan(9.1);
      }
    }
  });
});
it("selects real walking clips and named sleep clips before idle fallbacks", () => {
  expect(creatureClip(["Idle", "Sleep"], "sleep")).toBe("Sleep");
  expect(creatureClip(["Walk", "model_skeleton|001walk"], "move")).toBe(
    "model_skeleton|001walk",
  );
  expect(creatureClip(["Idle", "Look"], "look")).toBe("Look");
});
it("uses actual travel for gait, keeps attacks readable and suppresses stunned movement", () => {
  const view = { id: "a", state: "roam" } as WildView;
  expect(["idle", "idle-variant"]).toContain(wildMotion(view, 0, 1000).motion);
  expect(wildMotion(view, 1, 1000).motion).toBe("move");
  expect(wildMotion(view, 4, 1000).motion).toBe("run");
  expect(wildMotion({ ...view, state: "attack" }, 0, 1000).motion).toBe(
    "attack",
  );
  expect(wildMotion({ ...view, activity: "feed" }, 0, 1000).motion).toBe(
    "feed",
  );
  expect(
    wildMotion(
      { ...view, auras: [{ id: "stun", until: 2000, duration: 1000 }] },
      4,
      1000,
    ).motion,
  ).toBe("idle");
});
