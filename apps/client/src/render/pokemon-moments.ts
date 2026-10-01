import {
  CAPTURE_TIMING,
  EVOLUTION_TIMING,
} from "../../../../packages/shared/pokedex";
import {
  MeshBuilder,
  Vector3,
  VertexBuffer,
  type TransformNode,
  type Scene,
} from "@babylonjs/core";
import type { GameEvent } from "../../../../packages/shared/types";
import type { createEffectPool } from "./effect-pool";
import type { createEffectMaterials } from "./effect-materials";
import type { createCombatPrimitives } from "./combat-primitives";

export function createPokemonMoments(
  scene: Scene,
  pool: ReturnType<typeof createEffectPool>,
  materials: ReturnType<typeof createEffectMaterials>,
  primitives: ReturnType<typeof createCombatPrimitives>,
) {
  function capture(from: Vector3, target: TransformNode, event: GameEvent) {
    const sequence = event.capture;
    if (!sequence) return;
    const destination = target.position.clone(),
      base = target.scaling.clone(),
      duration = sequence.duration / 1000;
    const ball = pool.acquire("capture capsule", () => {
      const mesh = MeshBuilder.CreateSphere(
        "capture capsule",
        { diameter: 0.52, segments: 16 },
        scene,
      );
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
      const colors: number[] = [];
      for (let i = 0; i < positions.length; i += 3) {
        const y = positions[i + 1];
        colors.push(
          ...(Math.abs(y) < 0.04
            ? [0.12, 0.18, 0.2]
            : y > 0
              ? [0.95, 0.2, 0.18]
              : [0.96, 0.95, 0.87]),
          1,
        );
      }
      mesh.setVerticesData(VertexBuffer.ColorKind, colors);
      return mesh;
    });
    ball.material = materials.get("#ffffff", undefined, true);
    ball.rotationQuaternion = null;
    let absorbed = false,
      revealed = false;
    pool.track(
      ball,
      duration,
      (progress) => {
        const t = progress * duration;
        if (t < 0.65) {
          ball.position.copyFrom(
            Vector3.Lerp(
              from.add(new Vector3(0, 1.2, 0)),
              destination.add(new Vector3(0, 0.5, 0)),
              t / 0.65,
            ),
          );
          ball.position.y += Math.sin((t / 0.65) * Math.PI) * 2;
        } else {
          ball.position.copyFrom(destination).y += 0.25;
          if (!absorbed) {
            absorbed = true;
            primitives.glow(
              destination.add(new Vector3(0, 1, 0)),
              "#b7edf2",
              2.2,
              0.4,
            );
          }
          if (!target.isDisposed()) {
            target.setEnabled(true);
            target.scaling
              .copyFrom(base)
              .scaleInPlace(Math.max(0.001, 1 - (t - 0.65) / 0.2));
          }
          const shake =
            (t * 1000 - CAPTURE_TIMING.flight) / CAPTURE_TIMING.shake;
          if (shake >= 0 && shake < sequence.shakes) {
            const phase = shake % 1;
            ball.rotation.z =
              Math.sin(phase * Math.PI * 4) * 0.45 * Math.sin(phase * Math.PI);
            ball.position.x += Math.sin(phase * Math.PI * 4) * 0.09;
          }
          if (
            t * 1000 >=
              CAPTURE_TIMING.flight + sequence.shakes * CAPTURE_TIMING.shake &&
            !revealed
          ) {
            revealed = true;
            ball.visibility = 0;
            primitives.ring(
              destination,
              sequence.success ? "#f4d98b" : "#e59a93",
              3,
              0.6,
            );
            primitives.burst(
              destination.add(new Vector3(0, 0.6, 0)),
              sequence.success ? "#f5da93" : "#dbeaf0",
              sequence.success ? 18 : 8,
            );
            primitives.text(
              destination,
              sequence.success ? "Caught!" : "Broke free",
              "#fff0cd",
            );
          }
          if (revealed && !sequence.success && !target.isDisposed())
            target.scaling.copyFrom(base);
        }
      },
      () => {
        if (!target.isDisposed()) {
          target.scaling.copyFrom(base);
          target.setEnabled(!sequence.success);
        }
      },
    );
  }
  function evolve(
    position: Vector3,
    progress: (t: number) => void,
    dispose: () => void,
  ) {
    const halo = pool.acquire("evolution halo", () =>
      MeshBuilder.CreateTorus(
        "evolution halo",
        { diameter: 2.5, thickness: 0.08, tessellation: 32 },
        scene,
      ),
    );
    halo.material = materials.get("#d7f4d2");
    halo.position.copyFrom(position);
    halo.rotationQuaternion = null;
    let revealed = false;
    pool.track(
      halo,
      EVOLUTION_TIMING.duration / 1000,
      (t) => {
        progress(t);
        halo.position.y = position.y + 0.2 + Math.sin(t * Math.PI) * 1.6;
        halo.scaling.setAll(0.5 + Math.sin(t * Math.PI));
        halo.rotation.y = t * 9;
        if (
          t * EVOLUTION_TIMING.duration > EVOLUTION_TIMING.reveal &&
          !revealed
        ) {
          revealed = true;
          primitives.glow(
            position.add(new Vector3(0, 1, 0)),
            "#fff5c9",
            4,
            0.6,
          );
          primitives.burst(position.add(new Vector3(0, 1, 0)), "#e6f7b2", 18);
        }
      },
      dispose,
    );
  }
  return { capture, evolve };
}
