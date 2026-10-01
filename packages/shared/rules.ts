import { geographyWalkable } from "./geography";
import { regionBiome } from "./regions";
import { POKEMON } from "./pokemon";
import {
  LEGACY_TYPES,
  typeMultiplier,
  type PokemonType,
} from "./pokemon-types";
import { pokemonStats } from "./pokemon-rules";
import { ELEMENTS, OBSTACLES, SPECIES, WORLD } from "./data";
import type { Biome, Creature, Element } from "./types";
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const distance = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => Math.hypot(a.x - b.x, a.z - b.z);
export function biomeAt(x: number, z: number): Biome {
  return regionBiome(x, z);
}
export { landscapeHeight as terrainHeight } from "./geography";
export function walkable(x: number, z: number, radius = 0.6): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.hypot(x, z) < WORLD.radius - radius &&
    geographyWalkable(x, z, radius) &&
    OBSTACLES.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + radius)
  );
}
export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
): { x: number; z: number } {
  const nx = x + dx,
    nz = z + dz;
  if (walkable(nx, nz)) return { x: nx, z: nz };
  if (walkable(nx, z)) return { x: nx, z };
  if (walkable(x, nz)) return { x, z: nz };
  return { x, z };
}
export function moveAmongCreatures(
  x: number,
  z: number,
  dx: number,
  dz: number,
  creatures: Iterable<{
    x: number;
    z: number;
    hp: number;
    elite?: boolean;
    boss?: boolean;
  }>,
): { x: number; z: number } {
  let next = moveWithCollision(x, z, dx, dz);
  for (const creature of creatures) {
    if (creature.hp <= 0) continue;
    const radius = creature.boss ? 2.5 : creature.elite ? 1.35 : 1.05;
    const before = Math.hypot(x - creature.x, z - creature.z);
    const after = Math.hypot(next.x - creature.x, next.z - creature.z);
    if (after >= radius || after >= before) continue;
    if (after < 0.001 || before < 0.001) return { x, z };
    if (before < radius) {
      // Already overlapping (after a charge): slide around the body, never deeper.
      const nx = (x - creature.x) / before,
        nz = (z - creature.z) / before;
      const inward = (next.x - x) * nx + (next.z - z) * nz;
      const slide = { x: next.x - inward * nx, z: next.z - inward * nz };
      next = walkable(slide.x, slide.z) ? slide : { x, z };
      continue;
    }
    const proposed = {
      x: creature.x + ((next.x - creature.x) / after) * radius,
      z: creature.z + ((next.z - creature.z) / after) * radius,
    };
    next = walkable(proposed.x, proposed.z) ? proposed : { x, z };
  }
  return next;
}
export function lineOfSight(
  a: { x: number; z: number },
  b: { x: number; z: number },
): boolean {
  const len = distance(a, b);
  const steps = Math.ceil(len / 0.5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    if (OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius))
      return false;
  }
  return true;
}
export function effectiveness(
  attack: Element,
  defend: Element,
  pokemonTypes?: readonly PokemonType[],
): number {
  if (pokemonTypes) return typeMultiplier(LEGACY_TYPES[attack], pokemonTypes);
  return ELEMENTS[attack].strong === defend
    ? 1.5
    : ELEMENTS[attack].weak === defend
      ? 0.7
      : 1;
}
export function maxHp(species: string, level: number, evolved = false): number {
  if (POKEMON[species])
    return pokemonStats(
      evolved ? (POKEMON[species].evolutions[0]?.species ?? species) : species,
      level,
    ).hp;
  return Math.round(
    (SPECIES[species].baseHp + (level - 1) * 9) * (evolved ? 1.3 : 1),
  );
}
export function xpForLevel(level: number): number {
  return 35 + level * 18;
}
export function captureChance(
  difficulty: number,
  hp: number,
  max: number,
  quality = 1,
  status = false,
  bait = false,
): number {
  return clamp(
    (0.3 +
      (1 - hp / Math.max(1, max)) * 0.5 -
      difficulty * 0.35 +
      (status ? 0.1 : 0) +
      (bait ? 0.15 : 0)) *
      quality,
    0.08,
    0.92,
  );
}
export function creatureName(
  creature: Pick<Creature, "nickname" | "species" | "evolved">,
): string {
  return (
    creature.nickname ||
    (creature.evolved && !POKEMON[creature.species]
      ? SPECIES[creature.species].evolution?.name
      : undefined) ||
    SPECIES[creature.species].name
  );
}
