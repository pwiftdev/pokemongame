import { chooseCompanionMove } from "../../../packages/shared/companion-brain.js";
import { POKEMON } from "../../../packages/shared/pokemon.js";
import { POKEMON_MOVES } from "../../../packages/shared/pokemon-moves.js";
import { LEGACY_TYPES } from "../../../packages/shared/pokemon-types.js";
import { SPECIES } from "../../../packages/shared/data.js";
import { shapeContains } from "../../../packages/shared/combat.js";
import {
  distance,
  moveWithCollision,
  walkable,
} from "../../../packages/shared/rules.js";
import type { HeroCast } from "../../../packages/shared/combat.js";
import type { Creature, WildView } from "../../../packages/shared/types.js";
import type { AuraHolder } from "./auras.js";
import type { Player } from "./room.js";

export function deployCompanion(
  owner: Pick<Player, "x" | "z" | "yaw" | "pet" | "petCooldowns">,
  id: string,
) {
  owner.petCooldowns ??= new Map();
  if (owner.pet) owner.petCooldowns.set(owner.pet.id, owner.pet.cooldowns);
  const pet = createCompanion(id, owner);
  pet.cooldowns = owner.petCooldowns.get(id) ?? {};
  owner.petCooldowns.set(id, pet.cooldowns);
  return pet;
}

export interface CompanionState extends AuraHolder {
  id: string;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  nextAction: number;
  cooldowns: Record<string, number>;
  cast?: HeroCast;
  command?: { slot: number; target: string };
  dodging: boolean;
}
export function createCompanion(
  id: string,
  owner: { x: number; z: number; yaw: number },
): CompanionState {
  const x = owner.x - Math.cos(owner.yaw) * 1.8,
    z = owner.z + Math.sin(owner.yaw) * 1.8;
  return {
    id,
    x: walkable(x, z) ? x : owner.x,
    z: walkable(x, z) ? z : owner.z,
    yaw: owner.yaw,
    moving: false,
    nextAction: 0,
    cooldowns: {},
    auras: new Map(),
    guardUntil: 0,
    slowUntil: 0,
    stunUntil: 0,
    dodging: false,
  };
}
export function companionMoveSlot(
  pet: CompanionState,
  creature: Creature,
  target: Pick<WildView, "x" | "z" | "species" | "auras">,
  now: number,
) {
  return (
    pet.command?.slot ??
    chooseCompanionMove(creature, {
      now,
      distance: distance(pet, target),
      cooldowns: pet.cooldowns,
      targetTypes: POKEMON[target.species]?.types ?? [
        LEGACY_TYPES[SPECIES[target.species].element],
      ],
      statuses: (target.auras ?? []).map((a) => a.id),
      guarding: pet.guardUntil > now,
    })
  );
}
export function moveCompanion(
  pet: CompanionState,
  owner: { x: number; z: number; yaw: number },
  creature: Creature,
  target: Pick<WildView, "x" | "z" | "species" | "auras"> | undefined,
  hazards: Iterable<Pick<WildView, "cast" | "x" | "z">>,
  now: number,
) {
  pet.moving = false;
  pet.dodging = false;
  if (creature.hp <= 0 || pet.stunUntil > now) return;
  let destination = {
    x: owner.x - Math.cos(owner.yaw) * 1.8,
    z: owner.z + Math.sin(owner.yaw) * 1.8,
  };
  if (target) {
    const slot = companionMoveSlot(pet, creature, target, now),
      move = POKEMON_MOVES[creature.moves[slot]];
    const range =
      move?.shape === "self" ? 2 : Math.max(2, (move?.range ?? 3) * 0.65);
    const d = Math.max(0.1, distance(pet, target));
    destination = {
      x: target.x + ((pet.x - target.x) / d) * range,
      z: target.z + ((pet.z - target.z) / d) * range,
    };
  }
  for (const hazard of hazards) {
    if (!hazard.cast || !shapeContains(hazard.cast, pet)) continue;
    const yaw =
      hazard.cast.yaw ?? Math.atan2(pet.x - hazard.x, pet.z - hazard.z);
    destination = {
      x: pet.x + Math.cos(yaw) * 6,
      z: pet.z - Math.sin(yaw) * 6,
    };
    pet.dodging = true;
    break;
  }
  if (pet.cast && !pet.dodging) return;
  const d = distance(pet, destination);
  if (d < 0.18) return;
  const speed =
    pet.slowUntil > now
      ? 2
      : pet.dodging || distance(pet, owner) > 5
        ? 10
        : target
          ? 5.5
          : 6.5;
  let dx = ((destination.x - pet.x) / d) * Math.min(d, speed * 0.05),
    dz = ((destination.z - pet.z) / d) * Math.min(d, speed * 0.05);
  if (distance({ x: pet.x + dx, z: pet.z + dz }, owner) < 1) {
    const swap = dx;
    dx = -dz;
    dz = swap;
  }
  let next = moveWithCollision(pet.x, pet.z, dx, dz);
  if (distance(pet, next) < 0.01)
    next = moveWithCollision(pet.x, pet.z, -dz, dx);
  pet.moving = distance(pet, next) > 0.01;
  if (pet.moving) pet.yaw = Math.atan2(next.x - pet.x, next.z - pet.z);
  pet.x = next.x;
  pet.z = next.z;
}
