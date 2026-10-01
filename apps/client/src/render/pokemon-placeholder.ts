import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
  type Scene,
} from "@babylonjs/core";
import { POKEMON } from "../../../../packages/shared/pokemon";
import { TYPE_COLORS } from "../../../../packages/shared/pokemon-types";

export function createPokemonPlaceholders(scene: Scene) {
  const templates = new Map<
    string,
    ReturnType<typeof MeshBuilder.CreateSphere>
  >();
  function template(color: string) {
    let mesh = templates.get(color);
    if (mesh) return mesh;
    mesh = MeshBuilder.CreateSphere(
      `rig template ${color}`,
      { diameter: 1, segments: 5 },
      scene,
    );
    const material = new StandardMaterial(`rig ${color}`, scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor.setAll(0.12);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.setEnabled(false);
    templates.set(color, mesh);
    return mesh;
  }
  function create(species: string, id: string, height: number) {
    const p = POKEMON[species],
      root = new TransformNode(id, scene),
      pivot = new TransformNode(`${id}:Body`, scene);
    pivot.parent = root;
    const color = TYPE_COLORS[p.types[0]],
      accent = TYPE_COLORS[p.types[1] ?? p.types[0]],
      quad = p.locomotion === "quadruped",
      flying = p.locomotion === "flying",
      serpent = p.locomotion === "serpent",
      floating = p.locomotion === "floating";
    function part(
      name: string,
      position: number[],
      scale: number[],
      tint = color,
      parent = pivot,
    ) {
      const joint = new TransformNode(`${id}:${name}`, scene);
      joint.parent = parent;
      joint.position.set(position[0], position[1], position[2]);
      const mesh = template(tint).createInstance(`${id}:${name}:mesh`);
      mesh.parent = joint;
      mesh.scaling.set(scale[0], scale[1], scale[2]);
      mesh.isPickable = true;
      mesh.metadata = { target: id };
      return joint;
    }
    part(
      "Torso",
      [0, quad ? 0.48 : 0.6, 0],
      quad
        ? [0.7, 0.65, 1.05]
        : serpent
          ? [0.46, 0.45, 1.05]
          : [0.7, 0.85, 0.6],
    );
    const head = part("Head", [0, quad ? 0.76 : 1.05, 0.34], [0.63, 0.58, 0.6]);
    part("LEye", [-0.18, 0.06, 0.26], [0.13, 0.17, 0.06], "#253c46", head);
    part("REye", [0.18, 0.06, 0.26], [0.13, 0.17, 0.06], "#253c46", head);
    if (!floating && !serpent)
      for (const side of [-1, 1]) {
        part(
          side < 0 ? "LThigh" : "RThigh",
          [side * 0.22, 0.2, -0.18],
          [0.2, 0.43, 0.28],
        );
        part(
          side < 0 ? "LArm" : "RArm",
          [side * (quad ? 0.26 : 0.46), quad ? 0.23 : 0.7, quad ? 0.34 : 0],
          flying
            ? [1.2, 0.12, 0.56]
            : quad
              ? [0.19, 0.43, 0.25]
              : [0.2, 0.46, 0.2],
          accent,
        );
      }
    const tail = part(
      "Tail1",
      [0, 0.48, -0.53],
      serpent ? [0.3, 0.3, 1.3] : [0.17, 0.2, 0.65],
      accent,
    );
    if (serpent) part("Tail2", [0, 0, -0.5], [0.18, 0.22, 0.65], accent, tail);
    if (/saur|oddish|gloom|vileplume/.test(species)) {
      part("Bulb", [0, 1, -0.18], [0.68, 0.7, 0.65], "#598d58");
      if (species !== "bulbasaur" && species !== "oddish")
        part("Flower", [0, 1.4, -0.18], [1.2, 0.26, 1], "#e98695");
    } else if (/char|flareon/.test(species))
      part("Flame", [0, 0.18, -0.3], [0.27, 0.52, 0.28], "#ffbc54", tail);
    else if (/squirt|wartortle|blastoise/.test(species)) {
      part("Shell", [0, 0.65, -0.26], [0.9, 0.9, 0.35], "#a58664");
      if (species === "blastoise")
        for (const side of [-1, 1])
          part(
            "Cannon",
            [side * 0.46, 0.9, -0.1],
            [0.22, 0.22, 0.7],
            "#8cabb7",
          );
    } else if (
      /eevee|chu|swinub|swine|clef|abra|kadabra|alakazam/.test(species)
    )
      for (const side of [-1, 1])
        part(
          side < 0 ? "LEar" : "REar",
          [side * 0.22, 0.32, 0],
          [0.2, /chu|eevee/.test(species) ? 0.65 : 0.25, 0.18],
          accent,
          head,
        );
    else if (/pidge/.test(species))
      part("Beak", [0, -0.05, 0.37], [0.23, 0.18, 0.36], "#dfb663", head);
    else if (/magn/.test(species))
      for (const side of [-1, 1])
        part(
          "Magnet",
          [side * 0.55, 0.67, 0],
          [0.22, 0.48, 0.2],
          side < 0 ? "#b46369" : "#7396bb",
        );
    else if (/caterpie|butterfree/.test(species))
      for (const side of [-1, 1])
        part(
          side < 0 ? "LEar" : "REar",
          [side * 0.22, 0.3, 0],
          [0.1, 0.45, 0.1],
          "#cf7d73",
          head,
        );
    else if (/gastly|haunter|gengar/.test(species)) {
      part("LEar", [-0.25, 0.27, 0], [0.2, 0.45, 0.2], accent, head);
      part("REar", [0.25, 0.27, 0], [0.2, 0.45, 0.2], accent, head);
    }
    root.scaling.setAll(height / 1.5);
    return {
      root,
      meshes: root.getChildMeshes(),
      animations: [],
      dispose() {
        root.dispose();
      },
    };
  }
  return {
    create,
    dispose() {
      for (const mesh of templates.values()) {
        mesh.material?.dispose();
        mesh.dispose();
      }
      templates.clear();
    },
  };
}
