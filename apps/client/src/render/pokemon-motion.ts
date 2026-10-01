import {
  Animation,
  AnimationGroup,
  Quaternion,
  Vector3,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import type { Locomotion } from "../../../../packages/shared/pokemon";

const CLIPS = [
  "Idle",
  "Idle_Variant",
  "Walk",
  "Run",
  "Bite_InPlace",
  "Attack_Alt",
  "Special",
  "HitReact",
  "Death",
  "Dance",
  "Sleep",
];
export function pokemonMotion(
  root: TransformNode,
  scene: Scene,
  locomotion: Locomotion = "biped",
) {
  const joints = root
    .getChildTransformNodes()
    .map((joint) => ({
      joint,
      name: joint.name
        .split(":")
        .at(-1)!
        .replace(/^\d+ /, "")
        .replace(/_\d+$/, ""),
    }))
    .filter(({ name }) =>
      /^(Head|Neck|LThigh|RThigh|LArm|RArm|Tail1|Tail2|TailA01|LEar[1]?|REar[1]?|Body|pivot)$/.test(
        name,
      ),
    );
  return CLIPS.map((clip) => {
    const group = new AnimationGroup(`${root.name}:${clip}`, scene);
    const moving = clip === "Walk" || clip === "Run",
      attacking = ["Bite_InPlace", "Attack_Alt", "Special"].includes(clip);
    for (const { joint, name } of joints) {
      const base =
        joint.rotationQuaternion?.clone() ??
        Quaternion.FromEulerVector(joint.rotation);
      joint.rotationQuaternion = base.clone();
      const leg = /Thigh|Arm/.test(name),
        arm = /Arm/.test(name),
        tail = /Tail/.test(name),
        ear = /Ear/.test(name),
        head = /Head|Neck/.test(name),
        body = /Body|pivot/.test(name);
      const side = /^R/.test(name) ? Math.PI : 0,
        phase = side + (arm && locomotion === "quadruped" ? Math.PI : 0);
      const animation = new Animation(
        `${clip}:${joint.name}`,
        "rotationQuaternion",
        30,
        Animation.ANIMATIONTYPE_QUATERNION,
        Animation.ANIMATIONLOOPMODE_CYCLE,
      );
      animation.setKeys(
        Array.from({ length: 31 }, (_, i) => {
          const t = i / 30,
            cycle = t * Math.PI * 2,
            breath = Math.sin(cycle);
          const strike =
            t < 0.25
              ? -Math.sin(((t / 0.25) * Math.PI) / 2) * 0.25
              : t < 0.55
                ? Math.sin(((t - 0.25) / 0.3) * Math.PI)
                : -Math.sin(((t - 0.55) / 0.45) * Math.PI) * 0.12;
          let angle = tail
            ? Math.sin(cycle - 0.6) * 0.13
            : ear
              ? Math.sin(cycle + 0.9) * 0.045
              : head
                ? breath * 0.035
                : 0;
          let axis = leg || head ? Vector3.Right() : Vector3.Up();
          if (moving) {
            if (leg)
              angle = Math.sin(cycle + phase) * (clip === "Run" ? 0.8 : 0.48);
            if (tail)
              angle =
                Math.sin(cycle - 0.8) * (locomotion === "serpent" ? 0.6 : 0.25);
            if (body) {
              angle =
                Math.sin(cycle) * (locomotion === "serpent" ? 0.12 : 0.045);
              axis = Vector3.Forward();
            }
          }
          if (locomotion === "flying" && arm) {
            angle = Math.sin(cycle + side) * 0.6;
            axis = Vector3.Forward();
          }
          if (attacking) {
            angle =
              strike *
              (head ? -0.55 : body ? -0.25 : arm ? 0.9 : tail ? -0.45 : 0.12);
            if (clip === "Attack_Alt") axis = Vector3.Up();
          }
          if (clip === "HitReact")
            angle = Math.sin(Math.PI * t) * (body ? -0.28 : head ? 0.42 : 0.15);
          if (clip === "Death") {
            angle =
              Math.min(1, t * 1.5) *
              (body ? 1.35 : head ? 0.4 : leg ? 0.65 : 0);
            if (body) axis = Vector3.Forward();
          }
          if (clip === "Dance")
            angle = Math.sin(cycle * 2 + phase) * (body ? 0.18 : 0.4);
          if (clip === "Sleep")
            angle = head ? 0.45 + breath * 0.025 : leg ? -0.8 : tail ? 0.4 : 0;
          if (clip === "Idle_Variant")
            angle = head
              ? Math.sin(cycle) * 0.4
              : tail
                ? Math.sin(cycle * 2) * 0.3
                : angle;
          return {
            frame: i,
            value: base.multiply(Quaternion.RotationAxis(axis, angle)),
          };
        }),
      );
      group.addTargetedAnimation(animation, joint);
      if (body) {
        const position = joint.position.clone();
        const bob = new Animation(
          `${clip}:weight shift`,
          "position",
          30,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CYCLE,
        );
        bob.setKeys(
          Array.from({ length: 31 }, (_, i) => {
            const t = i / 30,
              value = position.clone();
            const hover = locomotion === "flying" || locomotion === "floating";
            value.y +=
              clip === "Death"
                ? -0.2 * t
                : clip === "Sleep"
                  ? -0.13 + Math.sin(t * Math.PI * 2) * 0.012
                  : hover
                    ? 0.3 + Math.sin(t * Math.PI * 2) * 0.1
                    : moving
                      ? Math.abs(Math.sin(t * Math.PI * 2)) *
                        (clip === "Run" ? 0.1 : 0.04)
                      : Math.sin(t * Math.PI * 2) * 0.015;
            if (attacking) value.z += Math.sin(t * Math.PI) * 0.16;
            return { frame: i, value };
          }),
        );
        group.addTargetedAnimation(bob, joint);
      }
    }
    return group;
  });
}
