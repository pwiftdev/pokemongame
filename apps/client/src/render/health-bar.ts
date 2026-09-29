import {
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type Scene,
} from "@babylonjs/core";
export function createHealthBar(scene: Scene, id: string) {
  const root = new TransformNode(`health:${id}`, scene);
  const material = (name: string, color: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.emissiveColor = m.diffuseColor;
    m.disableLighting = true;
    return m;
  };
  const back = material("health track", "#182e34"),
    fill = material("health fill", "#f5c56a");
  const track = MeshBuilder.CreatePlane(
    "health track",
    { width: 1.8, height: 0.1 },
    scene,
  );
  track.parent = root;
  track.material = back;
  track.billboardMode = Mesh.BILLBOARDMODE_ALL;
  track.isPickable = false;
  const bar = MeshBuilder.CreatePlane(
    "health fill",
    { width: 1.72, height: 0.065 },
    scene,
  );
  bar.parent = track;
  bar.position.z = -0.015;
  bar.material = fill;
  bar.isPickable = false;
  let current = 1;
  return {
    root,
    update(hp: number, max: number, visible: boolean, dt: number) {
      root.setEnabled(visible);
      current += (hp / Math.max(1, max) - current) * (1 - Math.exp(-dt * 12));
      bar.scaling.x = Math.max(0.001, current);
      bar.position.x = -(1 - current) * 0.86;
    },
    dispose() {
      root.dispose();
      back.dispose();
      fill.dispose();
    },
  };
}
