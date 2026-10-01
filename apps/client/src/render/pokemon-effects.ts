import {
  Mesh,
  MeshBuilder,
  Quaternion,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { POKEMON_MOVES } from "../../../../packages/shared/pokemon-moves";
import { TYPE_COLORS } from "../../../../packages/shared/pokemon-types";
import type { GameEvent } from "../../../../packages/shared/types";
import type { createEffectPool } from "./effect-pool";
import type { createEffectMaterials } from "./effect-materials";
import type { createCombatPrimitives } from "./combat-primitives";

export function createPokemonEffects(
  scene: Scene,
  pool: ReturnType<typeof createEffectPool>,
  materials: ReturnType<typeof createEffectMaterials>,
  primitives: ReturnType<typeof createCombatPrimitives>,
) {
  const { glow, ring, burst } = primitives;
  function cast(event: GameEvent, from: Vector3, to: Vector3, size = 1) {
    const move = POKEMON_MOVES[event.ability ?? ""];
    if (!move) return false;
    const color = TYPE_COLORS[move.type],
      start = from.add(new Vector3(0, size * 0.65, 0)),
      end = to.add(new Vector3(0, 0.7, 0));
    const distance = Vector3.Distance(start, end),
      duration = Math.max(0.15, distance / move.travelSpeed);
    const hash = [...move.vfx].reduce((n, char) => n + char.charCodeAt(0), 0);
    if (event.type === "pet-cast") {
      glow(start, color, size * 1.4, move.anticipation / 1000);
      ring(from, color, size * 1.3, move.anticipation / 1000);
      return true;
    }
    if (event.type === "impact") {
      burst(end, color, 5 + (hash % 5));
      ring(to, color, size * (move.shape === "ground" ? 4 : 1.3));
      return true;
    }
    if (move.shape === "self") {
      ring(from, color, size * 2.4, 1);
      glow(start, color, size * 2, 0.6);
      return true;
    }
    const beam = (
      name: string,
      a: Vector3,
      b: Vector3,
      thickness: number,
      lifetime: number,
      delay = 0,
    ) => {
      const mesh = pool.acquire("pokemon beam", () =>
        MeshBuilder.CreateCylinder(
          "pokemon beam",
          { height: 1, diameter: 1, tessellation: 6 },
          scene,
        ),
      );
      mesh.name = name;
      mesh.material = materials.get(color);
      const direction = b.subtract(a),
        length = direction.length();
      mesh.position.copyFrom(a.add(b).scale(0.5));
      mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(
        Vector3.Up(),
        direction.normalize(),
        new Quaternion(),
      );
      pool.track(
        mesh,
        lifetime,
        (t) => {
          mesh.scaling.set(
            thickness * Math.sin(Math.PI * t),
            length,
            thickness * Math.sin(Math.PI * t),
          );
          mesh.visibility = 1 - t * 0.6;
        },
        undefined,
        delay,
      );
    };
    if (move.type === "electric") {
      let last = start;
      for (let i = 1; i <= 7; i++) {
        const next = Vector3.Lerp(start, end, i / 7);
        if (i < 7) {
          next.x += Math.sin(i * 13 + hash) * 0.6;
          next.y += Math.cos(i * 7) * 0.4;
        }
        beam(move.name + " arc", last, next, 0.12 * size, 0.3);
        last = next;
      }
    } else if (move.id === "pk-vine-whip" || move.shape === "melee") {
      beam(
        move.name + " lash",
        start,
        end,
        (move.type === "grass" ? 0.18 : 0.35) * size,
        0.25,
      );
      ring(to, color, 1.4 * size, 0.3);
    } else if (move.shape === "beam") {
      beam(move.name + " stream", start, end, 0.24 * size, 0.5);
      beam(move.name + " core", start, end, 0.08 * size, 0.55, 0.04);
    } else if (move.shape === "ground") {
      ring(to, color, 7, 0.7);
      for (let i = 0; i < 5; i++) {
        const point = to.add(
          new Vector3(Math.cos(i * 1.26) * 2, 0, Math.sin(i * 1.26) * 2),
        );
        beam(
          move.name + " eruption",
          point,
          point.add(new Vector3(0, 2 + (i % 2), 0)),
          0.5,
          0.55,
          i * 0.04,
        );
      }
    } else {
      const count = move.shape === "cone" ? 7 : move.type === "fire" ? 4 : 1;
      for (let i = 0; i < count; i++) {
        const vortex = move.type === "flying";
        const mesh = pool.acquire(
          vortex ? "pokemon vortex" : "pokemon mote",
          () =>
            vortex
              ? MeshBuilder.CreateTorus(
                  "pokemon vortex",
                  { diameter: 1, thickness: 0.07, tessellation: 14 },
                  scene,
                )
              : MeshBuilder.CreateSphere(
                  "pokemon mote",
                  { diameter: 0.35, segments: 4 },
                  scene,
                ),
        );
        mesh.rotationQuaternion = null;
        mesh.name = move.name + (vortex ? " vortex" : " projectile");
        mesh.material = materials.get(color);
        mesh.billboardMode = Mesh.BILLBOARDMODE_NONE;
        pool.track(
          mesh,
          duration,
          (t) => {
            mesh.position.copyFrom(Vector3.Lerp(start, end, t));
            if (move.type === "rock" || move.id === "pk-seed-bomb")
              mesh.position.y +=
                Math.sin(t * Math.PI) * Math.min(3, distance * 0.3);
            if (count > 1) {
              mesh.position.x += Math.sin(i * 2.4 + hash) * t * 1.1;
              mesh.position.z += Math.cos(i * 2.4 + hash) * t * 1.1;
            }
            mesh.scaling.setAll(
              size * (vortex ? 0.4 + t * 2.5 : 0.6 + (hash % 4) * 0.12),
            );
            mesh.rotation.y = t * 10;
            mesh.rotation.z = t * 7;
          },
          undefined,
          i * 0.035,
        );
      }
    }
    return true;
  }
  return { cast };
}
