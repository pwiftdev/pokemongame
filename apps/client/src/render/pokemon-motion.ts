import {
  Animation,
  AnimationGroup,
  Quaternion,
  Vector3,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";

export function pokemonMotion(root: TransformNode, scene: Scene) {
  const joints = root
    .getChildTransformNodes()
    .filter((n) =>
      /:(Head|Neck|LThigh|RThigh|LArm|RArm|Tail1|TailA01)$/.test(n.name),
    );
  return ["Idle", "Walk", "Bite_InPlace", "HitReact", "Death", "Dance"].map(
    (clip) => {
      const group = new AnimationGroup(`${root.name}:${clip}`, scene);
      for (const joint of joints) {
        const base =
          joint.rotationQuaternion?.clone() ??
          Quaternion.FromEulerVector(joint.rotation);
        joint.rotationQuaternion = base.clone();
        const leg = /Thigh/.test(joint.name),
          tail = /Tail/.test(joint.name),
          head = /Head|Neck/.test(joint.name);
        const amplitude =
          clip === "Walk"
            ? leg
              ? 0.48
              : tail
                ? 0.18
                : 0.06
            : clip === "Bite_InPlace"
              ? head
                ? 0.32
                : 0.08
              : clip === "Death"
                ? head
                  ? 0.7
                  : 0.15
                : clip === "Dance"
                  ? 0.25
                  : tail
                    ? 0.14
                    : head
                      ? 0.045
                      : 0.015;
        const phase = joint.name.includes(":R") ? Math.PI : 0;
        const animation = new Animation(
          `${clip}:${joint.name}`,
          "rotationQuaternion",
          30,
          Animation.ANIMATIONTYPE_QUATERNION,
          Animation.ANIMATIONLOOPMODE_CYCLE,
        );
        animation.setKeys(
          Array.from({ length: 25 }, (_, i) => ({
            frame: i,
            value: base.multiply(
              Quaternion.RotationAxis(
                leg ? Vector3.Forward() : Vector3.Up(),
                Math.sin((i / 24) * Math.PI * 2 + phase) * amplitude,
              ),
            ),
          })),
        );
        group.addTargetedAnimation(animation, joint);
      }
      return group;
    },
  );
}
