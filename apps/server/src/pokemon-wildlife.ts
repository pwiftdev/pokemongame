import { POKEMON } from "../../../packages/shared/pokemon.js";
import {
  temperamentAction,
  type PokemonActivity,
} from "../../../packages/shared/pokemon-habitats.js";
import {
  distance,
  lineOfSight,
  moveWithCollision,
  walkable,
} from "../../../packages/shared/rules.js";
import { isSafeArea } from "../../../packages/shared/regions.js";
import { creatureSeed } from "../../../packages/shared/creature-motion.js";

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
  activityUntil?: number;
  ambientStep?: number;
  warnedAt?: number;
  destination?: { x: number; z: number };
  ambientSpeed?: number;
  yaw?: number;
}
type Visitor = { id: string; x: number; z: number; moving: boolean };

function chooseRoutine(wild: AmbientPokemon, now: number, hostile: boolean) {
  const seed = creatureSeed(wild.id + ":" + (wild.ambientStep ?? 0));
  wild.ambientStep = (wild.ambientStep ?? 0) + 1;
  const species = POKEMON[wild.species];
  const walking = seed > 0.4;
  wild.activity = walking
    ? "wander"
    : hostile
      ? "look"
      : seed < 0.15
        ? "feed"
        : "rest";
  wild.ambientSpeed = walking ? (hostile ? 1 : 0.8) + seed * 0.6 : 0;
  wild.activityUntil = now + (walking ? 4500 : 3000) + seed * 5000;
  wild.destination = undefined;
  if (!walking) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = seed * Math.PI * 2 + attempt * 2.399;
    const radius = 2 + seed * 4;
    const point = {
      x: wild.home.x + Math.cos(angle) * radius,
      z: wild.home.z + Math.sin(angle) * radius,
    };
    if (
      walkable(point.x, point.z) &&
      lineOfSight(wild, point) &&
      (!hostile || !isSafeArea(point.x, point.z))
    ) {
      wild.destination = point;
      return;
    }
  }
  wild.activity = species?.locomotion === "swimming" ? "drink" : "look";
  wild.ambientSpeed = 0;
}

function moveAmbient(wild: AmbientPokemon, hostile = false) {
  const destination = wild.destination;
  const speed = wild.ambientSpeed ?? 0;
  const d = destination ? distance(wild, destination) : 0;
  wild.state = "idle";
  if (!destination || speed <= 0 || d < 0.35) return;
  const heading = Math.atan2(destination.x - wild.x, destination.z - wild.z);
  const step = Math.min(d, speed * 0.05 * Math.min(1, d / 1.2));
  for (const turn of [0, 0.65, -0.65, 1.1, -1.1]) {
    const next = moveWithCollision(
      wild.x,
      wild.z,
      Math.sin(heading + turn) * step,
      Math.cos(heading + turn) * step,
    );
    if (
      distance(wild, next) < step * 0.35 ||
      (hostile && isSafeArea(next.x, next.z))
    )
      continue;
    wild.yaw = Math.atan2(next.x - wild.x, next.z - wild.z);
    wild.x = next.x;
    wild.z = next.z;
    wild.state = "roam";
    return;
  }
  wild.activityUntil = 0;
}

export function tickPokemonAmbient(
  wild: AmbientPokemon,
  visitors: Iterable<Visitor>,
  peers: readonly AmbientPokemon[],
  now: number,
  hostile = false,
) {
  const species = POKEMON[wild.species];
  if (now >= (wild.ambientAt ?? 0)) {
    wild.ambientAt = now + 400 + creatureSeed(wild.id) * 200;
    let nearest: Visitor | undefined,
      near = 12;
    if (species && !hostile)
      for (const visitor of visitors) {
        const d = distance(wild, visitor);
        if (d < near && lineOfSight(wild, visitor)) {
          nearest = visitor;
          near = d;
        }
      }
    if (near >= 5) wild.warnedAt = undefined;
    else wild.warnedAt ??= now;
    const decision =
      species && !hostile
        ? temperamentAction(
            species.temperament,
            near,
            nearest?.moving ?? false,
            now - (wild.warnedAt ?? now),
            isSafeArea(wild.x, wild.z),
          )
        : undefined;
    if (decision?.aggression && nearest) return nearest.id;
    const reacting =
      nearest &&
      decision &&
      ["inspect", "flee", "warn"].includes(decision.activity);
    if (reacting && nearest && decision) {
      wild.activity = decision.activity;
      wild.ambientSpeed = decision.speed;
      wild.activityUntil = now + 1500;
      wild.yaw = Math.atan2(nearest.x - wild.x, nearest.z - wild.z);
      if (decision.activity === "flee") {
        const d = Math.max(0.1, near);
        wild.destination = {
          x: wild.x + ((wild.x - nearest.x) / d) * 4,
          z: wild.z + ((wild.z - nearest.z) / d) * 4,
        };
        if (species?.locomotion === "burrowing") wild.activity = "burrow";
      } else wild.destination = { x: nearest.x, z: nearest.z };
    } else if (decision?.activity === "sleep") {
      wild.activity = "sleep";
      wild.ambientSpeed = 0;
      wild.destination = undefined;
      wild.activityUntil = now + 1000;
    } else if (now >= (wild.activityUntil ?? 0)) {
      chooseRoutine(wild, now, hostile);
      if (decision?.activity === "play" && wild.destination) {
        let friend: AmbientPokemon | undefined,
          nearestPeer = 6;
        for (const peer of peers) {
          const d = distance(peer, wild);
          if (
            peer.id !== wild.id &&
            peer.species === wild.species &&
            peer.hp > 0 &&
            d < nearestPeer &&
            distance(peer, wild.home) < 6
          ) {
            friend = peer;
            nearestPeer = d;
          }
        }
        if (friend) {
          const angle =
            creatureSeed(wild.id + String(wild.ambientStep)) * Math.PI * 2;
          const point = {
            x: friend.x + Math.sin(angle) * 2,
            z: friend.z + Math.cos(angle) * 2,
          };
          if (walkable(point.x, point.z) && lineOfSight(wild, point)) {
            wild.destination = point;
            wild.activity = "play";
            wild.ambientSpeed = 1.7;
          }
        }
      }
    }
    if (wild.destination && distance(wild.destination, wild.home) > 9)
      wild.destination = { ...wild.home };
    if (wild.destination && (wild.ambientSpeed ?? 0) > 0) {
      for (const peer of peers) {
        if (peer.id === wild.id || peer.hp <= 0) continue;
        const d = distance(wild, peer);
        if (d > 0.05 && d < 1.1) {
          const point = {
            x: wild.x + (wild.x - peer.x) / d,
            z: wild.z + (wild.z - peer.z) / d,
          };
          if (walkable(point.x, point.z) && distance(point, wild.home) < 9)
            wild.destination = point;
          break;
        }
      }
    }
  }
  moveAmbient(wild, hostile);
  return undefined;
}
