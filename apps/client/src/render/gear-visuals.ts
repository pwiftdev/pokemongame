import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  Vector3,
  type AbstractMesh,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import {
  GEAR,
  type GearSlot,
  type GearState,
} from "../../../../packages/shared/gear";
export function applyGearVisuals(
  scene: Scene,
  id: string,
  root: TransformNode,
  nodes: TransformNode[],
  meshes: AbstractMesh[],
  equipment: GearState["equipped"] = {},
) {
  const materials: PBRMaterial[] = [];
  const item = (slot: GearSlot) => GEAR[equipment[slot] ?? ""];
  function metal(color: string, glow = false) {
    const m = new PBRMaterial(`${id}:gear:${color}:${materials.length}`, scene);
    m.albedoColor = Color3.FromHexString(color).toLinearSpace();
    m.metallic = glow ? 0.2 : 0.3;
    m.roughness = 0.65;
    if (glow) m.emissiveColor = m.albedoColor.scale(0.25);
    materials.push(m);
    return m;
  }
  function mounted(
    mesh: Mesh,
    boneName: string,
    at: Vector3,
    material: PBRMaterial,
  ) {
    const bone = nodes.find((n) => n.name === `${id}:${boneName}`);
    if (!bone) {
      mesh.dispose();
      return;
    }
    root.computeWorldMatrix(true);
    bone.computeWorldMatrix(true);
    const relative = root
      .getWorldMatrix()
      .multiply(bone.getWorldMatrix().clone().invert());
    mesh.parent = bone;
    mesh.position.copyFrom(Vector3.TransformCoordinates(at, relative));
    mesh.rotationQuaternion = Quaternion.FromRotationMatrix(relative);
    mesh.material = material;
    mesh.metadata = { target: id, gear: true };
    meshes.push(mesh);
  }
  for (const slot of ["chest", "shoulders", "boots"] as const) {
    const gear = item(slot);
    if (!gear) continue;
    const material = metal(gear.color);
    for (const mesh of meshes) {
      const matches =
        slot === "chest"
          ? /_(Body|Arms|Legs)(_|$)/.test(mesh.name)
          : slot === "shoulders"
            ? /Pauldron/.test(mesh.name)
            : /Feet/.test(mesh.name);
      if (!matches || !/Ranger:|Peasant:/.test(mesh.name)) continue;
      mesh.setEnabled(mesh.name.includes("Ranger:"));
      if (mesh.name.includes("Ranger:")) mesh.material = material;
    }
  }
  const head = item("head");
  if (head) {
    const crown = MeshBuilder.CreateTorus(
      `${id}:gear:crown`,
      { diameter: 0.3, thickness: 0.035 + head.tier * 0.004, tessellation: 12 },
      scene,
    );
    const trim = metal(head.trim);
    mounted(crown, "Head", new Vector3(0, 1.77, 0.015), trim);
    for (const side of [-1, 0, 1]) {
      const gem = MeshBuilder.CreatePolyhedron(
        `${id}:gear:crown-gem`,
        { type: 1, size: 0.018 + head.tier * 0.002 },
        scene,
      );
      gem.scaling.y = 1.7;
      mounted(
        gem,
        "Head",
        new Vector3(side * 0.095, 1.79, 0.14 - Math.abs(side) * 0.035),
        trim,
      );
    }
  }
  const chest = item("chest");
  if (chest) {
    const badge = MeshBuilder.CreatePolyhedron(
      `${id}:gear:breastplate`,
      { type: 1, size: 0.045 + chest.tier * 0.004 },
      scene,
    );
    badge.scaling.set(1, 1.25, 0.25);
    mounted(badge, "spine_03", new Vector3(0, 1.3, 0.16), metal(chest.trim));
  }
  const shoulders = item("shoulders");
  if (shoulders && shoulders.tier >= 2) {
    const trim = metal(shoulders.trim);
    for (const side of [-1, 1]) {
      const cap = MeshBuilder.CreatePolyhedron(
        `${id}:gear:pauldron-trim`,
        { type: 1, size: 0.06 + shoulders.tier * 0.005 },
        scene,
      );
      cap.scaling.set(1.2, 0.5, 1);
      mounted(
        cap,
        `clavicle_${side < 0 ? "r" : "l"}`,
        new Vector3(side * 0.29, 1.46, 0),
        trim,
      );
    }
  }
  const weapon = item("weapon");
  if (weapon) {
    const body = metal(weapon.color),
      trim = metal(weapon.trim, weapon.tier >= 3);
    for (const mesh of [...meshes]) {
      if (!mesh.isEnabled() || !mesh.metadata?.equipment) continue;
      mesh.material = body;
      for (let i = 0; i < Math.min(3, weapon.tier); i++) {
        const gem = MeshBuilder.CreatePolyhedron(
          `${id}:gear:weapon-rune`,
          { type: 1, size: 0.065 },
          scene,
        );
        gem.parent = mesh;
        gem.position.set(0, 0.15 + i * 0.12, 0.055);
        gem.scaling.set(0.65, 1, 0.45);
        gem.material = trim;
        gem.metadata = { target: id, gear: true };
        meshes.push(gem);
      }
    }
  }
  const back = item("back");
  if (back) {
    const trim = metal(back.trim, true);
    if (back.id.startsWith("banner")) {
      const flag = MeshBuilder.CreateBox(
        `${id}:gear:banner`,
        { width: 0.42, height: 0.65, depth: 0.025 },
        scene,
      );
      mounted(flag, "spine_03", new Vector3(0, 1.14, -0.22), metal(back.color));
      const bar = MeshBuilder.CreateCylinder(
        `${id}:gear:banner-pole`,
        { height: 0.92, diameter: 0.024, tessellation: 6 },
        scene,
      );
      mounted(bar, "spine_03", new Vector3(0, 1.25, -0.25), trim);
      const emblem = MeshBuilder.CreatePolyhedron(
        `${id}:gear:banner-emblem`,
        { type: 1, size: 0.09 },
        scene,
      );
      emblem.scaling.z = 0.25;
      mounted(emblem, "spine_03", new Vector3(0, 1.23, -0.255), trim);
    } else {
      const halo = MeshBuilder.CreateTorus(
        `${id}:gear:halo`,
        { diameter: 0.64, thickness: 0.035, tessellation: 24 },
        scene,
      );
      mounted(halo, "spine_03", new Vector3(0, 1.48, -0.27), trim);
      halo.rotationQuaternion?.multiplyInPlace(
        Quaternion.FromEulerAngles(Math.PI / 2, 0, 0),
      );
    }
  }
  return () => {
    for (const material of materials) material.dispose();
  };
}
