import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import type { GameEvent } from "../../../../packages/shared/types";
import type { createEffectMaterials } from "./effect-materials";
import type { createEffectPool } from "./effect-pool";

export function createCombatPrimitives(
  scene: Scene,
  materials: ReturnType<typeof createEffectMaterials>,
  track: ReturnType<typeof createEffectPool>["track"],
  onImpact: (event: GameEvent) => void,
) {
  const material = materials.get;
  function ring(position: Vector3, color: string, size = 2.2, duration = 0.55) {
    const mesh = MeshBuilder.CreatePlane("spell shockwave", { size }, scene);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copyFrom(position);
    mesh.position.y += 0.12;
    mesh.material = material(color, "ring");
    track(mesh, duration, (t) => {
      mesh.scaling.setAll(0.35 + t * 1.7);
      mesh.visibility = (1 - t) * 0.8;
    });
  }
  function glow(position: Vector3, color: string, size = 2, duration = 0.25) {
    const mesh = MeshBuilder.CreatePlane("impact light", { size }, scene);
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.position.copyFrom(position);
    mesh.material = material(color, "glow");
    track(mesh, duration, (t) => {
      mesh.scaling.setAll(0.7 + t);
      mesh.visibility = (1 - t) ** 2;
    });
  }

  function burst(position: Vector3, color: string, count = 12) {
    for (let i = 0; i < count; i++) {
      const mesh = MeshBuilder.CreatePlane(
        "spell spark",
        { size: 0.32 },
        scene,
      );
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.material = material(color, "glow");
      const angle = (i / count) * Math.PI * 2,
        velocity = new Vector3(
          Math.cos(angle) * (1.4 + (i % 3)),
          1.4 + (i % 4) * 0.5,
          Math.sin(angle) * (1.4 + (i % 3)),
        );
      track(mesh, 0.6 + (i % 3) * 0.1, (t) => {
        mesh.position.copyFrom(position).addInPlace(velocity.scale(t));
        mesh.position.y -= t * t * 2;
        mesh.scaling.setAll(1 - t);
      });
    }
  }
  function text(position: Vector3, value: string, color: string) {
    const texture = new DynamicTexture(
      "combat number",
      { width: 256, height: 128 },
      scene,
      false,
    );
    texture.hasAlpha = true;
    const context = texture.getContext() as CanvasRenderingContext2D;
    context.font = "bold 64px system-ui";
    context.textAlign = "center";
    context.lineWidth = 8;
    context.strokeStyle = "#152523";
    context.strokeText(value, 128, 85, 240);
    context.fillStyle = color;
    context.fillText(value, 128, 85, 240);
    texture.update();
    const m = new StandardMaterial("combat number", scene);
    m.diffuseTexture = texture;
    m.useAlphaFromDiffuseTexture = true;
    m.emissiveColor = Color3.White();
    m.disableLighting = true;
    m.backFaceCulling = false;
    const mesh = MeshBuilder.CreatePlane(
      "combat number",
      { width: 1.2, height: 0.6 },
      scene,
    );
    mesh.material = m;
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.renderingGroupId = 1;
    const start = position.add(new Vector3(0, 1.9, 0));
    track(
      mesh,
      1.15,
      (t) => {
        mesh.position.copyFrom(start);
        mesh.position.y += t * 1.4;
        mesh.visibility = Math.min(1, (1 - t) * 3);
        mesh.scaling.setAll(
          0.8 + Math.sin(Math.min(1, t * 4) * Math.PI) * 0.22,
        );
      },
      () => {
        m.dispose();
        texture.dispose();
      },
    );
  }
  function impact(position: Vector3, event: GameEvent, color: string) {
    onImpact(event);
    const outcome = event.outcome ?? "hit";
    if (outcome !== "hit" && outcome !== "crit" && outcome !== "block") {
      burst(position.add(new Vector3(0, 0.8, 0)), "#dfe7ea", 4);
      return;
    }
    const crit = outcome === "crit",
      light = event.auto && !crit;
    glow(
      position.add(new Vector3(0, 0.9, 0)),
      color,
      crit ? 4 : light ? 1.9 : 2.8,
    );
    ring(position, color, crit ? 3 : light ? 1.3 : 1.8, crit ? 0.45 : 0.35);
    burst(
      position.add(new Vector3(0, 0.6, 0)),
      color,
      crit ? 20 : light ? 6 : 12,
    );
  }
  function status(position: Vector3, effect: string, color: string) {
    for (let i = 0; i < 6; i++) {
      const mesh = MeshBuilder.CreatePlane(
        "status wisp",
        { size: effect === "stun" ? 0.25 : 0.35 },
        scene,
      );
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.material = material(color, "glow");
      track(mesh, effect === "slow" ? 1.4 : 0.9, (t) => {
        const angle = (i / 6) * Math.PI * 2 + t * 3;
        mesh.position.set(
          position.x + Math.cos(angle) * 0.65,
          position.y + (effect === "stun" ? 1.8 : 0.2 + t * 1.6),
          position.z + Math.sin(angle) * 0.65,
        );
        mesh.visibility = (1 - t) * 0.8;
      });
    }
  }

  return { ring, glow, burst, text, impact, status };
}
