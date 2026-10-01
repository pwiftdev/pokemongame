import { POKEMON } from "../../../packages/shared/pokemon.js";
import {
  temperamentAction,
  type PokemonActivity,
} from "../../../packages/shared/pokemon-habitats.js";
import { distance, moveWithCollision } from "../../../packages/shared/rules.js";
import { isSafeArea } from "../../../packages/shared/regions.js";

export interface AmbientPokemon {
  id: string;
  species: string;
  x: number;
  z: number;
  hp: number;
  home: { x: number; z: number };
  state: string;
  activity?: PokemonActivity;
  ambientAt?: number;
  warnedAt?: number;
  destination?: { x: number; z: number };
  ambientSpeed?: number;
}
export function tickPokemonAmbient(
  wild: AmbientPokemon,
  visitors: Iterable<{ id: string; x: number; z: number; moving: boolean }>,
  peers: Iterable<AmbientPokemon>,
  now: number,
) {
  const species = POKEMON[wild.species];
  if (!species) return undefined;
  if (now >= (wild.ambientAt ?? 0)) {
    wild.ambientAt = now + 500;
    let nearest:
        | { id: string; x: number; z: number; moving: boolean }
        | undefined,
      near = 12;
    for (const visitor of visitors) {
      const d = distance(wild, visitor);
      if (d < near) {
        nearest = visitor;
        near = d;
      }
    }
    if (near >= 5) wild.warnedAt = undefined;
    else wild.warnedAt ??= now;
    const decision = temperamentAction(
      species.temperament,
      near,
      nearest?.moving ?? false,
      now - (wild.warnedAt ?? now),
      isSafeArea(wild.x, wild.z),
    );
    wild.activity = decision.activity;
    wild.ambientSpeed = decision.speed;
    if (decision.aggression && nearest) return nearest.id;
    const phase = Math.floor(now / 4000) + species.number;
    const angle = phase * 2.399;
    wild.destination = {
      x: wild.home.x + Math.cos(angle) * 3,
      z: wild.home.z + Math.sin(angle) * 3,
    };
    if (nearest && decision.activity === "inspect") wild.destination = nearest;
    if (nearest && decision.activity === "flee") {
      const d = Math.max(0.1, near);
      wild.destination = {
        x: wild.x + ((wild.x - nearest.x) / d) * 4,
        z: wild.z + ((wild.z - nearest.z) / d) * 4,
      };
      if (species.locomotion === "burrowing") wild.activity = "burrow";
    }
    if (decision.activity === "play") {
      const peer = [...peers].find(
        (peer) =>
          peer.id !== wild.id && peer.hp > 0 && distance(peer, wild.home) < 6,
      );
      if (peer)
        wild.destination = {
          x: peer.x + Math.cos(angle),
          z: peer.z + Math.sin(angle),
        };
    }
    if (decision.activity === "rest") {
      wild.activity =
        phase % 3 === 0
          ? species.locomotion === "swimming"
            ? "drink"
            : "feed"
          : "rest";
      wild.ambientSpeed = phase % 3 === 0 ? 0 : 0.6;
    }
    if (distance(wild.destination, wild.home) > 9) wild.destination = wild.home;
  }
  const destination = wild.destination ?? wild.home,
    d = distance(wild, destination),
    speed = wild.ambientSpeed ?? 0;
  wild.state = speed > 0 && d > 0.3 ? "roam" : "idle";
  if (wild.state === "roam") {
    const step = Math.min(d, speed * 0.05);
    const next = moveWithCollision(
      wild.x,
      wild.z,
      ((destination.x - wild.x) / d) * step,
      ((destination.z - wild.z) / d) * step,
    );
    wild.x = next.x;
    wild.z = next.z;
  }
  return undefined;
}
