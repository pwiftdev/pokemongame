import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import heroClips from "../apps/client/src/render/hero-clips.json";
import manifest from "../ASSET_MANIFEST.json";
import {
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
          : "CC0-1.0",
      );
    }
  });
  it("ships rigged Pokémon, class equipment and animated wildlife", () => {
    for (const name of [
      "Bulbasaur",
      "Charmander",
      "Squirtle",
      "Ivysaur",
      "Charmeleon",
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
