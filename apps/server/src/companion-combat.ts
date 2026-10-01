import { hiddenHero } from "./class-combat.js";
import { isTraining } from "../../../packages/shared/training.js";
import { randomUUID } from "node:crypto";
import { shapeContains } from "../../../packages/shared/combat.js";
import { POKEMON } from "../../../packages/shared/pokemon.js";
import {
  POKEMON_MOVES,
  type PokemonMove,
} from "../../../packages/shared/pokemon-moves.js";
import { SPECIES } from "../../../packages/shared/data.js";
import { LEGACY_TYPES } from "../../../packages/shared/pokemon-types.js";
import {
  pokemonDamage,
  pokemonStats,
  weakenedPokemon,
} from "../../../packages/shared/pokemon-rules.js";
import { distance } from "../../../packages/shared/rules.js";
import { heroHp } from "../../../packages/shared/hero.js";
import { isSafeArea } from "../../../packages/shared/regions.js";
import { rollOutcome, landed } from "../../../packages/shared/combat-rules.js";
import type { GameEvent } from "../../../packages/shared/types.js";
import { auraViews, applyAura, hasAura } from "./auras.js";
import {
  deployCompanion,
  companionMoveSlot,
  moveCompanion,
} from "./companion.js";
import type { Player, Wild } from "./room.js";

interface Context {
  wilds: Map<string, Wild>;
  event: (event: GameEvent) => void;
  attack: (
    p: Player,
    target: string,
    slot: number,
    request: string,
  ) => Promise<void>;
  impact: (p: Player, target: string, move: PokemonMove) => Promise<void>;
}
export function createCompanionCombat(context: Context) {
  async function tick(p: Player, now: number) {
    const creature = p.profile.creatures.find((c) => c.id === p.profile.active);
    if (!creature) {
      p.pet = undefined;
      return;
    }
    if (!p.pet || p.pet.id !== creature.id || distance(p.pet, p) > 45)
      p.pet = deployCompanion(p, creature.id);
    const pet = p.pet;
    auraViews(pet, now);
    if (creature.hp <= 0 || heroHp(p.profile) <= 0 || p.duelId) {
      pet.cast = undefined;
      pet.command = undefined;
      p.petTarget = undefined;
      return;
    }
    if (hiddenHero(p, now)) {
      p.petTarget = undefined;
      pet.cast = undefined;
      pet.command = undefined;
      moveCompanion(pet, p, creature, undefined, context.wilds.values(), now);
      return;
    }
    let target = context.wilds.get(p.petTarget ?? "");
    if (
      target &&
      (target.hp <= 0 ||
        (!pet.command && weakenedPokemon(target)) ||
        distance(p, target) > 24 ||
        (isSafeArea(p.x, p.z) && !isTraining(target)))
    ) {
      p.petTarget = undefined;
      pet.command = undefined;
      target = undefined;
    }
    const view = target
      ? { ...target, auras: auraViews(target, now) }
      : undefined;
    moveCompanion(pet, p, creature, view, context.wilds.values(), now);
    const cast = pet.cast;
    if (cast) {
      const move = POKEMON_MOVES[cast.ability];
      if (pet.dodging && !cast.released) {
        pet.cast = undefined;
        pet.nextAction = now + 350;
        return;
      }
      if (!cast.released && now >= cast.releasesAt) {
        cast.released = true;
        context.event({
          type: "attack",
          actor: "companion",
          source: p.profile.id,
          target: cast.target,
          ability: move.id,
          message: move.name,
        });
      }
      if (now < cast.resolvesAt) return;
      pet.cast = undefined;
      pet.nextAction = now + move.recovery;
      if (move.shape === "self") {
        if (move.effect === "heal") {
          creature.hp = Math.min(
            creature.maxHp,
            creature.hp + Math.round(creature.maxHp * 0.3),
          );
          p.hpDirty = true;
        } else
          applyAura(
            pet,
            move.effect === "evasion" ? "evasion" : "guard",
            now,
            4000,
            { ability: move.id },
          );
        context.event({
          type: "pet-heal",
          source: p.profile.id,
          actor: "companion",
          ability: move.id,
          message: move.name,
        });
      } else {
        await context.impact(p, cast.target, move);
        if (move.aoe || move.shape === "cone")
          for (const extra of context.wilds.values()) {
            const intersects =
              move.shape === "cone"
                ? shapeContains(
                    {
                      x: cast.x,
                      z: cast.z,
                      ability: move.id,
                      resolvesAt: cast.resolvesAt,
                      radius: move.range,
                      shape: "cone",
                      arc: Math.PI / 3,
                      yaw: Math.atan2(cast.aimX - cast.x, cast.aimZ - cast.z),
                    },
                    extra,
                  )
                : distance(extra, { x: cast.aimX, z: cast.aimZ }) <= move.aoe!;
            if (
              extra.id === cast.target ||
              extra.hp <= 0 ||
              (SPECIES[extra.species].companion &&
                !extra.threat.has(p.profile.id)) ||
              !intersects
            )
              continue;
            await context.impact(p, extra.id, move);
          }
      }
      return;
    }
    if (
      pet.command &&
      POKEMON_MOVES[creature.moves[pet.command.slot]]?.shape === "self"
    )
      await context.attack(
        p,
        pet.command.target,
        pet.command.slot,
        randomUUID(),
      );
    else if (view && now >= pet.nextAction && pet.stunUntil <= now) {
      const slot = companionMoveSlot(pet, creature, view, now);
      if (slot >= 0) await context.attack(p, view.id, slot, randomUUID());
    }
  }
  function hit(w: Wild, p: Player, scale: number, now: number) {
    const c = p.profile.creatures.find((c) => c.id === p.profile.active),
      pet = p.pet;
    if (!c || c.hp <= 0 || !pet) return;
    const outcome = rollOutcome({
      miss: 0.04,
      dodge: hasAura(pet, "evasion", now) ? 0.5 : pet.dodging ? 0.25 : 0.04,
      parry: 0,
      block: 0,
      crit: 0.04,
    });
    const stats = pokemonStats(c.species, c.level, c.ivs, c.nature);
    const rawDamage = landed(outcome)
      ? pokemonDamage({
          level: w.level,
          power: 35 * scale,
          attack: 18 + w.level * 4,
          defense: stats.defense,
          type: LEGACY_TYPES[SPECIES[w.species].element],
          attackerTypes: POKEMON[w.species]?.types ?? [
            LEGACY_TYPES[SPECIES[w.species].element],
          ],
          defenderTypes: POKEMON[c.species].types,
          critical: outcome === "crit",
          random: Math.random(),
        })
      : 0;
    const damage = Math.round(rawDamage * (pet.guardUntil > now ? 0.35 : 1));
    c.hp = Math.max(0, c.hp - damage);
    p.hpDirty = true;
    context.event({
      type: c.hp === 0 ? "pet-faint" : "pet-hit",
      actor: "companion",
      source: w.id,
      target: p.profile.id,
      amount: damage,
      outcome,
      message:
        c.hp === 0
          ? `${SPECIES[c.species].name} fainted. Use a Revival seed or swap teammates.`
          : `${SPECIES[c.species].name} · ${damage || outcome}`,
    });
    if (c.hp === 0) {
      pet.cast = undefined;
      pet.command = undefined;
      p.petTarget = undefined;
    }
  }
  return { tick, hit };
}
