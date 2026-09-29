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
export const species = () => entries("SPECIES");
export const abilities = () => entries("ABILITIES");
export const items = () => entries("ITEMS");
export const places = () => entries("PLACES");
export const findSpecies = (id: string) =>
  species().find((entry) => entry.id === id) || {
    id,
    name: id,
    element: "leaf",
  };
export const findAbility = (id: string) =>
  abilities().find((entry) => entry.id === id) || { id, name: id, cooldown: 2 };
export const findItem = (id: string) =>
  items().find((entry) => entry.id === id) || { id, name: id };
export const brand = (source.BRAND || {}) as Entry;
export const title = String(brand.title || brand.name || "Pokemon Dollars");
export const currency = String(brand.currency || brand.currencyLabel || "PD");
export function text(entry: Entry, key: string, fallback = "") {
  return String(entry[key] ?? fallback);
}
export function number(entry: Entry, key: string, fallback = 0) {
  return Number(entry[key] ?? fallback);
}
