import * as shared from "../../../../packages/shared/data";

type Entry = Record<string, unknown>;
const source = shared as unknown as Record<string, unknown>;
function entries(name: string): Entry[] {
  const value = source[name];
  if (Array.isArray(value)) return value as Entry[];
  if (value && typeof value === "object")
    return Object.entries(value).map(([id, entry]) => ({
      id,
      ...(entry as Entry),
    }));
  return [];
}
const catalogs = {
  species: entries("SPECIES"),
  abilities: entries("ABILITIES"),
  items: entries("ITEMS"),
  places: entries("PLACES"),
};
const index = (values: Entry[]) =>
  new Map(values.map((entry) => [String(entry.id), entry]));
const speciesById = index(catalogs.species),
  abilitiesById = index(catalogs.abilities),
  itemsById = index(catalogs.items);
export const species = () => catalogs.species;
export const abilities = () => catalogs.abilities;
export const items = () => catalogs.items;
export const places = () => catalogs.places;
export const findSpecies = (id: string) =>
  speciesById.get(id) || { id, name: id, element: "leaf" };
export const findAbility = (id: string) =>
  abilitiesById.get(id) || { id, name: id, cooldown: 2 };
export const findItem = (id: string) => itemsById.get(id) || { id, name: id };
export const brand = (source.BRAND || {}) as Entry;
export const title = String(brand.title || brand.name || "Pokemon Dollars");
export const currency = String(brand.currency || brand.currencyLabel || "PD");
export function text(entry: Entry, key: string, fallback = "") {
  return String(entry[key] ?? fallback);
}
export function number(entry: Entry, key: string, fallback = 0) {
  return Number(entry[key] ?? fallback);
}
