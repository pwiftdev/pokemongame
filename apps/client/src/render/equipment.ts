import {
  Quaternion,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type AnimationGroup,
  type Scene,
} from "@babylonjs/core";
import { heroClass, type ClassId } from "../../../../packages/shared/classes";

export function equipmentGrip(name: string) {
  const shield = name === "Badge_Shield";
  const left = name === "Knife_Offhand" || name === "2H_Staff" || shield;
  const scale = name.startsWith("Knife")
    ? 0.4
    : name === "2H_Staff"
      ? 0.7
      : name === "2H_Axe"
        ? 0.62
        : 0.55;
  const rotation = shield
    ? [0, -Math.PI / 2, 0]
    : [name === "Knife_Offhand" ? -Math.PI / 2 : Math.PI / 2, 0, 0];
  const handle = shield
    ? new Vector3(0, 0, -0.12)
    : new Vector3(
        0,
        name.startsWith("Knife") ? -0.08 : name === "2H_Staff" ? 0 : -0.15,
        0,
      );
  const palm = new Vector3(left ? 0.018 : -0.018, 0.1, 0.012);
  const orientation = Quaternion.FromEulerAngles(
    ...(rotation as [number, number, number]),
  );
  const offset = handle.scale(scale).applyRotationQuaternion(orientation);
  return {
    hand: left ? "hand_l" : "hand_r",
    position: palm.subtract(offset).asArray(),
    rotation,
    scale,
    handle: handle.asArray(),
    palm: palm.asArray(),
  };
}
export function attachEquipment(
  id: string,
  classId: ClassId,
  nodes: TransformNode[],
  meshes: AbstractMesh[],
  armed = true,
) {
  const definition = heroClass(classId);
  for (const mesh of meshes) {
    const name = mesh.name.split(":").at(-1)!;
    const enabled =
      armed && (name === definition.weapon || name === definition.offhand);
    mesh.setEnabled(enabled);
    if (!enabled) continue;
    const grip = equipmentGrip(name);
    const hand = nodes.find((node) => node.name === `${id}:${grip.hand}`);
    if (!hand) throw new Error(`Missing ${grip.hand} on character ${id}`);
    mesh.parent = hand;
    mesh.position.set(grip.position[0], grip.position[1], grip.position[2]);
    mesh.rotationQuaternion = Quaternion.FromEulerAngles(
      ...(grip.rotation as [number, number, number]),
    );
    mesh.scaling.setAll(grip.scale);
    mesh.isPickable = true;
    mesh.metadata = { target: id, equipment: name, grip: grip.hand };
  }
}

export function armedIdle(classId: ClassId) {
  return classId === "mage"
    ? "Idle_Staff"
    : classId === "knight"
      ? "Idle_Shield"
      : "Idle_Armed";
}

export function holdEquipment(
  scene: Scene,
  animations: AnimationGroup[],
  meshes: AbstractMesh[],
) {
  const hands = new Set(
    meshes
      .filter((mesh) => mesh.isEnabled())
      .map((mesh) => mesh.metadata?.grip),
  );
  const poses: { node: TransformNode; rotation: Quaternion }[] = [];
  for (const [hand, clip] of [
    ["hand_l", "Idle_Staff"],
    ["hand_r", "Idle_Armed"],
  ]) {
    if (!hands.has(hand)) continue;
    const side = hand.endsWith("l") ? "l" : "r";
    const group = animations.find((group) => group.name.endsWith(`:${clip}`));
    for (const track of group?.targetedAnimations ?? []) {
      if (
        track.animation.targetProperty !== "rotationQuaternion" ||
        !new RegExp(`:(index|middle|ring|pinky|thumb)_0[123]_${side}$`).test(
          track.target.name,
        )
      )
        continue;
      const rotation = track.animation.getKeys()[0]?.value as
        | Quaternion
        | undefined;
      if (rotation)
        poses.push({
          node: track.target as TransformNode,
          rotation: rotation.clone(),
        });
    }
  }
  if (!poses.length) return () => {};
  const observer = scene.onAfterAnimationsObservable.add(() => {
    for (const pose of poses)
      pose.node.rotationQuaternion?.copyFrom(pose.rotation);
  });
  return () => scene.onAfterAnimationsObservable.remove(observer);
}
