import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import heroClips from "../apps/client/src/render/hero-clips.json";
import manifest from "../ASSET_MANIFEST.json";
import {
  POKEMON_MODELS,
  CREATURE_MODELS,
  EVOLVED_MODELS,
} from "../apps/client/src/render/creatures";

function readModel(path: string) {
  const bytes = readFileSync(path);
  expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  return JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
}
describe("packaged model integrity", () => {
  it("ships exactly the licensed, hashed files in the manifest", () => {
    const expected = manifest.map((entry) => entry.path).sort();
    const root = "apps/client/public/assets";
    const actual = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name))
      .sort();
    expect(actual).toEqual(expected);
    for (const entry of manifest) {
      const bytes = readFileSync(entry.path);
      expect(createHash("sha256").update(bytes).digest("hex"), entry.path).toBe(
        entry.sha256,
      );
      expect(bytes.length, entry.path).toBe(entry.bytes);
      expect(entry.license).toBe(
        entry.creator.includes("Nintendo")
          ? "LicenseRef-Pokemon-Rights-Reserved"
          : entry.path.startsWith("apps/client/public/assets/fonts/")
            ? "OFL-1.1"
            : entry.source === "World of Pokemon UI Cheatsheet.html"
              ? "LicenseRef-UserProvided"
              : "CC0-1.0",
      );
    }
  });
  it("ships rigged Pokémon, class equipment and animated wildlife", () => {
    for (const name of [
      "Bulbasaur",
      "Ivysaur",
      "Charmander",
      "Charmeleon",
      "Squirtle",
      "Wartortle",
      "Knight",
      "Mage",
      "Rogue",
      "Barbarian",
      "Deer",
      "Stag",
      "Fox",
      "Wolf",
      "Horse",
      "Alpaca",
    ]) {
      const entry = manifest.find(
        (e) => e.name === name && e.kind === "model",
      )!;
      const model = readModel(entry.path);
      expect(model.skins.length, name).toBeGreaterThan(0);
      expect(model.extensionsRequired ?? []).not.toContain(
        "KHR_draco_mesh_compression",
      );
      if (entry.path.includes("/heroes/") || entry.path.includes("/animals/"))
        expect(model.animations.length, name).toBeGreaterThan(5);
    }
    for (const [name, weapon] of [
      ["Knight", "1H_Sword"],
      ["Mage", "2H_Staff"],
      ["Rogue", "Knife"],
      ["Barbarian", "2H_Axe"],
    ]) {
      const model = readModel(
        manifest.find((e) => e.name === name && e.kind === "model")!.path,
      );
      for (const clip of [
        ...heroClips.common,
        ...heroClips[name as keyof typeof heroClips],
      ])
        expect(
          model.animations.some(
            (animation: { name: string }) => animation.name === clip,
          ),
          `${name}:${clip}`,
        ).toBe(true);
      expect(
        model.nodes.some((n: { name: string }) => n.name === weapon),
        name,
      ).toBe(true);
    }
  });
  it("packages a distinct proper 3D model and portrait for all 51 Pokémon", () => {
    expect(POKEMON_MODELS).toHaveLength(51);
    const hashes = new Set<string>();
    for (const name of POKEMON_MODELS) {
      const entry = manifest.find(
        (e) => e.name === name && e.kind === "model",
      )!;
      expect(entry, name).toBeDefined();
      hashes.add(entry.sha256);
      const model = readModel(entry.path);
      expect(model.meshes.length, name).toBeGreaterThan(0);
      expect(model.materials.length, name).toBeGreaterThan(0);
      expect(model.extensionsRequired ?? []).not.toContain(
        "KHR_draco_mesh_compression",
      );
      expect(manifest.some((e) => e.name === `portrait:${name}`)).toBe(true);
    }
    expect(hashes.size).toBe(51);
  });
  it("resolves every model texture locally", () => {
    for (const entry of manifest.filter((entry) =>
      entry.path.endsWith(".glb"),
    )) {
      const model = readModel(entry.path);
      expect(
        model.buffers.every((buffer: { uri?: string }) => !buffer.uri),
      ).toBe(true);
      for (const texture of model.images ?? []) {
        if (!texture.uri || texture.uri.startsWith("data:")) continue;
        expect(texture.uri).not.toMatch(/^(https?:|\/|\.\.)/);
        expect(
          manifest.some(
            (asset) => asset.path === join(dirname(entry.path), texture.uri),
          ),
          entry.path + ":" + texture.uri,
        ).toBe(true);
      }
    }
  });
  it("provides actual rigged clips for all six creature actions and player locomotion", () => {
    const actions = [
      ["Idle", "Flying_Idle"],
      ["Walk", "Fast_Flying", "Run"],
      ["Bite_InPlace", "Bite_Front", "Headbutt", "Punch"],
      ["HitRecieve", "HitReact"],
      ["Death", "No"],
      ["Dance", "Yes", "Flying_Idle"],
    ];
    for (const name of [
      ...CREATURE_MODELS,
      ...EVOLVED_MODELS,
      "Adventurer",
      "Casual_Hoodie",
    ]) {
      const entry = manifest.find((entry) => entry.name === name)!;
      const model = readModel(entry.path);
      expect(model.skins.length, name).toBeGreaterThan(0);
      const clips = model.animations.map(
        (animation: { name: string }) => animation.name,
      );
      for (const candidates of name === "Adventurer" || name === "Casual_Hoodie"
        ? [["Idle"], ["Run"]]
        : actions)
        expect(
          candidates.some((clip) => clips.includes(clip)),
          `${name}: ${candidates}`,
        ).toBe(true);
      for (const animation of model.animations)
        expect(animation.channels.length, name).toBeGreaterThan(0);
    }
  });
});

describe("modular character assets", () => {
  it("ships both complete modular rigs with bounded animation work and no orphan nodes", () => {
    for (const name of ["Male", "Female"]) {
      const model = readModel(
        `apps/client/public/assets/characters/${name}.glb`,
      );
      const nodes = model.nodes as { name: string; children?: number[] }[];
      for (const part of [
        "Avatar:Head",
        "Avatar:Eyes",
        "Avatar:Brows",
        "Hair:Hair_Long",
        "Hair:Hair_Beard",
      ])
        expect(
          nodes.some((n) => n.name === part),
          `${name} ${part}`,
        ).toBe(true);
      for (const outfit of ["Ranger:", "Peasant:"])
        expect(nodes.some((n) => n.name.startsWith(outfit))).toBe(true);
      const reached = new Set<number>();
      const visit = (id: number) => {
        if (reached.has(id)) return;
        reached.add(id);
        for (const child of nodes[id].children ?? []) visit(child);
      };
      for (const id of model.scenes[model.scene ?? 0].nodes) visit(id);
      expect(reached.size).toBe(nodes.length);
      const clips = model.animations as { name: string; channels: unknown[] }[];
      for (const clip of [
        "Idle",
        "Idle_Armed",
        "Idle_Staff",
        "Idle_Shield",
        "2H_Melee_Attack_Chop",
        "Walking_A",
        "Running_A",
        "Hit_A",
        "Death_A",
        "Spellcast_Shoot",
        "1H_Melee_Attack_Chop",
        "Block_Attack",
      ])
        expect(
          clips.some((a) => a.name === clip),
          `${name} ${clip}`,
        ).toBe(true);
      expect(clips.every((a) => a.channels.length <= 70)).toBe(true);
    }
  });
  it("packages only the six reusable class weapons", () => {
    const model = readModel(
      "apps/client/public/assets/characters/Equipment.glb",
    );
    expect(model.nodes.map((n: { name: string }) => n.name).sort()).toEqual(
      [
        "1H_Sword",
        "Badge_Shield",
        "2H_Staff",
        "Knife",
        "Knife_Offhand",
        "2H_Axe",
      ].sort(),
    );
    expect(model.skins ?? []).toHaveLength(0);
  });
});
