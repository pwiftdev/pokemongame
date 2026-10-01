import { mkdir, readFile, writeFile } from "node:fs/promises";

const cache = new URL("../../evidence/pokeapi-cache/", import.meta.url);
await mkdir(cache, { recursive: true });
async function api(kind, id) {
  const file = new URL(`${kind}-${id}.json`, cache);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    const response = await fetch(`https://pokeapi.co/api/v2/${kind}/${id}`);
    if (!response.ok) throw new Error(`${kind}/${id}: ${response.status}`);
    const data = await response.json();
    await writeFile(file, JSON.stringify(data));
    return data;
  }
}
const names =
  `bulbasaur ivysaur venusaur charmander charmeleon charizard squirtle wartortle blastoise pichu pikachu raichu eevee vaporeon jolteon flareon pidgey pidgeotto pidgeot caterpie metapod butterfree oddish gloom vileplume poliwag poliwhirl poliwrath gastly haunter gengar geodude graveler golem magnemite magneton magnezone swinub piloswine mamoswine dratini dragonair dragonite abra kadabra alakazam sandshrew sandslash cleffa clefairy clefable`.split(
    " ",
  );
const rows = [];
for (const name of names) {
  const p = await api("pokemon", name);
  const s = await api("pokemon-species", name);
  rows.push({
    id: name,
    number: p.id,
    types: p.types.map((t) => t.type.name),
    stats: p.stats.map((s) => s.base_stat),
    size: p.height / 10,
    catchRate: s.capture_rate,
  });
}
const chart = {};
for (let id = 1; id <= 18; id++) {
  const t = await api("type", id);
  chart[t.name] = Object.fromEntries([
    ...t.damage_relations.double_damage_to.map((t) => [t.name, 2]),
    ...t.damage_relations.half_damage_to.map((t) => [t.name, 0.5]),
    ...t.damage_relations.no_damage_to.map((t) => [t.name, 0]),
  ]);
}
const directory = new URL("../../packages/shared/", import.meta.url);
await writeFile(
  new URL("pokemon-source.json", directory),
  JSON.stringify(rows, null, 2) + "\n",
);
await writeFile(
  new URL("pokemon-chart.json", directory),
  JSON.stringify(chart, null, 2) + "\n",
);
console.log(
  `Imported ${rows.length} species and ${Object.keys(chart).length} types from PokéAPI.`,
);
const pokemonCode = await readFile(new URL("pokemon.ts", directory), "utf8");
const pools = pokemonCode
  .split("export const TYPE_LEARNSETS")[1]
  .split("const levels")[0];
const moveNames = [
  ...new Set([...pools.matchAll(/"([a-z]+(?:-[a-z]+)*)"/g)].map((m) => m[1])),
];
const moves = [];
for (const name of moveNames) {
  const m = await api("move", name);
  moves.push({
    id: name,
    type: m.type.name,
    category: m.damage_class.name,
    power: m.power ?? 0,
    accuracy: m.accuracy ?? 100,
    pp: m.pp,
  });
}
await writeFile(
  new URL("pokemon-move-source.json", directory),
  JSON.stringify(moves, null, 2) + "\n",
);
console.log(`Imported ${moves.length} moves.`);
