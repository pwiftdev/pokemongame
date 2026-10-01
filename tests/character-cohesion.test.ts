import {
  Animation,
  AnimationGroup,
  Mesh,
  NullEngine,
  Quaternion,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { expect, it } from "vitest";
import {
  attachEquipment,
  equipmentGrip,
  holdEquipment,
} from "../apps/client/src/render/equipment";
import {
  npcAppearance,
  type NpcRole,
} from "../apps/client/src/render/npc-appearance";
import { normalizeAppearance } from "../packages/shared/appearance";
import {
  buildingParts,
  VILLAGE_BUILDINGS,
} from "../apps/client/src/render/village-buildings";
import manifest from "../ASSET_MANIFEST.json";

it("places each weapon handle inside the palm across scaled, moving hands", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  try {
    const hands = ["hand_l", "hand_r"].map(
      (name) => new TransformNode(`hero:${name}`, scene),
    );
    const names = [
      "1H_Sword",
      "Badge_Shield",
      "2H_Staff",
      "Knife",
      "Knife_Offhand",
      "2H_Axe",
    ];
    const meshes = names.map((name) => new Mesh(`hero:${name}`, scene));
    for (const classId of ["knight", "mage", "rogue", "barbarian"] as const) {
      attachEquipment("hero", classId, hands, meshes);
      for (const mesh of meshes.filter((mesh) => mesh.isEnabled())) {
        const grip = equipmentGrip(mesh.metadata.equipment);
        const hand = mesh.parent as TransformNode;
        for (const scale of [0.8, 1, 1.3]) {
          hand.scaling.setAll(scale);
          hand.rotation.set(0.7 * scale, -0.5, 0.9);
          hand.position.set(2, 1, -3);
          hand.computeWorldMatrix(true);
          mesh.computeWorldMatrix(true);
          const handle = Vector3.TransformCoordinates(
            Vector3.FromArray(grip.handle),
            mesh.getWorldMatrix(),
          );
          const palm = Vector3.TransformCoordinates(
            Vector3.FromArray(grip.palm),
            hand.getWorldMatrix(),
          );
          expect(Vector3.Distance(handle, palm)).toBeLessThan(0.00001);
        }
      }
    }
    attachEquipment("hero", "knight", hands, meshes, false);
    expect(meshes.every((mesh) => !mesh.isEnabled())).toBe(true);
    expect(() => attachEquipment("hero", "knight", [], meshes)).toThrow(
      "Missing hand_r",
    );
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

it("keeps finger grips after animations and releases observers on disposal", async () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  try {
    const finger = new TransformNode("hero:index_01_r", scene);
    finger.rotationQuaternion = Quaternion.Identity();
    const rotation = Quaternion.FromEulerAngles(0.6, 0.1, 0.3);
    const track = new Animation(
      "grip",
      "rotationQuaternion",
      30,
      Animation.ANIMATIONTYPE_QUATERNION,
    );
    track.setKeys([
      { frame: 0, value: rotation },
      { frame: 30, value: rotation },
    ]);
    const group = new AnimationGroup("hero:Idle_Armed", scene);
    group.addTargetedAnimation(track, finger);
    const mesh = new Mesh("weapon", scene);
    mesh.metadata = { grip: "hand_r" };
    const count = scene.onAfterAnimationsObservable.observers.length;
    const release = holdEquipment(scene, [group], [mesh]);
    scene.onAfterAnimationsObservable.notifyObservers(scene);
    expect(finger.rotationQuaternion.equals(rotation)).toBe(true);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scene.onAfterAnimationsObservable.observers.length).toBe(count);
    mesh.setEnabled(false);
    holdEquipment(scene, [group], [mesh])();
    expect(scene.onAfterAnimationsObservable.observers.length).toBe(count);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

it("gives each NPC role a valid independent uniform and civilians no weapons", () => {
  const roles: NpcRole[] = [
    "ranger",
    "scholar",
    "healer",
    "merchant",
    "captain",
    "keeper",
    "marshal",
  ];
  const uniforms = roles.map((role) => npcAppearance(role));
  expect(new Set(uniforms.map((p) => JSON.stringify(p.appearance))).size).toBe(
    7,
  );
  for (const [i, preset] of uniforms.entries()) {
    expect(normalizeAppearance(preset.appearance)).toEqual(preset.appearance);
    expect(npcAppearance(roles[i]).appearance).not.toBe(preset.appearance);
  }
  for (const role of ["scholar", "healer", "merchant", "keeper"] as const)
    expect(npcAppearance(role).armed).toBe(false);
});

it("assembles five distinct buildings from packaged local modules within existing wall footprints", () => {
  expect(
    new Set(
      VILLAGE_BUILDINGS.map(
        (b) => `${b.width}:${b.depth}:${b.floors}:${b.roof}:${b.angle}`,
      ),
    ).size,
  ).toBe(5);
  for (let i = 0; i < 5; i++) {
    const { definition, parts } = buildingParts(i);
    expect(
      parts.filter(
        (p) => p.model.startsWith("Wall_") && p.model.includes("Door"),
      ),
    ).toHaveLength(1);
    for (const part of parts) {
      expect(
        manifest.some((asset) =>
          asset.path.endsWith(`/village/${part.model}.glb`),
        ),
        part.model,
      ).toBe(true);
      expect([part.x, part.y, part.z, part.angle].every(Number.isFinite)).toBe(
        true,
      );
    }
    // Cottage scale is obstacle.radius / 4.5. Leave room for wall thickness.
    expect(
      Math.hypot(definition.width / 2 + 0.35, definition.depth / 2 + 0.35),
    ).toBeLessThan(4.5);
  }
});
