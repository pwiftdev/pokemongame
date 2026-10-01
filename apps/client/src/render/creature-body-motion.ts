import {
  Animation,
  type AnimationGroup,
  Vector3,
  type TransformNode,
} from "@babylonjs/core";
import type { Locomotion } from "../../../../packages/shared/pokemon";

export function addBodyMotion(
  group: AnimationGroup,
  root: TransformNode,
  clip: string,
  locomotion: Locomotion,
  height: number,
) {
  const hover = locomotion === "flying" || locomotion === "floating";
  const moving = clip === "Walk" || clip === "Run";
  const attacking = ["Bite_InPlace", "Attack_Alt", "Special"].includes(clip);
  const base = root.position.clone();
  for (const property of ["position", "rotation", "scaling"] as const) {
    const animation = new Animation(
      `${clip}:body:${property}`,
      property,
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    animation.setKeys(
      Array.from({ length: 31 }, (_, i) => {
        const t = i / 30,
          cycle = t * Math.PI * 2,
          breathe = Math.sin(cycle);
        const value =
          property === "position"
            ? base.clone()
            : property === "scaling"
              ? Vector3.One()
              : Vector3.Zero();
        if (property === "position") {
          value.y += hover
            ? height * (0.16 + breathe * 0.04)
            : moving
              ? Math.abs(breathe) * height * (clip === "Run" ? 0.045 : 0.015)
              : 0;
          if (attacking) value.z += Math.sin(Math.PI * t) * height * 0.13;
          if (clip === "Death")
            value.y = base.y - Math.min(1, t * 1.5) * height * 0.08;
        } else if (property === "rotation") {
          value.z = moving
            ? breathe * (locomotion === "serpent" ? 0.025 : 0.035)
            : hover
              ? breathe * 0.025
              : 0;
          if (clip === "Look" || clip === "Idle_Variant")
            value.y = Math.sin(cycle) * 0.12;
          if (clip === "Feed") value.x = (1 - Math.cos(cycle)) * 0.055;
          if (attacking) value.x = -Math.sin(Math.PI * t) * 0.12;
          if (clip === "HitReact") value.x = Math.sin(Math.PI * t) * 0.15;
          if (clip === "Death") value.z = Math.min(1, t * 1.5) * 1.25;
          if (clip === "Dance") value.z = breathe * 0.1;
        } else {
          const breathing = (clip === "Sleep" ? 0.012 : 0.005) * breathe;
          value.y = 1 + breathing;
          value.x = 1 - breathing * 0.4;
          if (clip === "Sleep") value.y *= 0.95;
        }
        return { frame: i, value };
      }),
    );
    group.addTargetedAnimation(animation, root);
  }
}
