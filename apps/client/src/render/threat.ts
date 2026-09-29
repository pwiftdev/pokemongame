import {
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { terrainHeight } from "../../../../packages/shared/rules";
import type { AttackShape } from "../../../../packages/shared/combat";

export function createThreatMarker(scene: Scene) {
  const root = new TransformNode("enemy attack warning", scene);
  const material = new StandardMaterial("enemy attack amber", scene);
  material.emissiveColor = Color3.FromHexString("#ff9659");
  material.diffuseColor = material.emissiveColor;
  material.disableLighting = true;
  material.alpha = 0.28;
  material.backFaceCulling = false;
  let boundary: Mesh | undefined;
  let shape: Mesh | undefined,
    lastResolution = 0;
  const bolt = MeshBuilder.CreateSphere(
    "enemy aimed bolt",
    { diameter: 0.65, segments: 8 },
    scene,
  );
  const boltMaterial = material.clone("enemy bolt core");
  boltMaterial.alpha = 1;
  bolt.material = boltMaterial;
  bolt.isPickable = false;
  function build(cast: AttackShape) {
    shape?.dispose();
    boundary?.dispose();
    const arc = cast.shape === "cone" ? (cast.arc ?? Math.PI / 2) : Math.PI * 2;
    const points =
      cast.shape === "line"
        ? [
            new Vector3(-(cast.width ?? 1.8) / 2, 0, 0),
            new Vector3(-(cast.width ?? 1.8) / 2, 0, cast.radius),
            new Vector3((cast.width ?? 1.8) / 2, 0, cast.radius),
            new Vector3((cast.width ?? 1.8) / 2, 0, 0),
          ]
        : Array.from({ length: 49 }, (_, i) => {
            const a = -arc / 2 + (arc * i) / 48;
            return new Vector3(
              Math.sin(a) * cast.radius,
              0,
              Math.cos(a) * cast.radius,
            );
          });
    if (cast.shape === "line") points.push(points[0].clone());
    const edge =
      cast.shape === "cone"
        ? [Vector3.Zero(), ...points, Vector3.Zero()]
        : points;
    const outline = MeshBuilder.CreateLines(
      "attack boundary",
      { points: edge },
      scene,
    );
    outline.color = Color3.FromHexString("#ffb66b");
    outline.alpha = 0.9;
    outline.isPickable = false;
    outline.parent = root;
    boundary = outline;
    shape = MeshBuilder.CreateRibbon(
      "attack footprint",
      {
        pathArray: [points.map(() => Vector3.Zero()), points],
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene,
    );
    shape.material = material;
    shape.parent = root;
    shape.isPickable = false;
  }
  root.setEnabled(false);
  bolt.setEnabled(false);
  return {
    update(cast: AttackShape | undefined, now: number) {
      root.setEnabled(!!cast);
      bolt.setEnabled(!!cast && cast.shape === "line" && !cast.charge);
      if (!cast) return;
      if (cast.resolvesAt !== lastResolution) {
        lastResolution = cast.resolvesAt;
        build(cast);
      }
      const t = Math.max(
        0,
        Math.min(
          1,
          (now - (cast.startedAt ?? cast.resolvesAt - 900)) /
            (cast.resolvesAt - (cast.startedAt ?? cast.resolvesAt - 900)),
        ),
      );
      root.position.set(cast.x, terrainHeight(cast.x, cast.z) + 0.13, cast.z);
      root.rotation.y = cast.yaw ?? 0;
      material.alpha = 0.06 + t * 0.14;
      const travel =
        cast.releasesAt === undefined
          ? t
          : Math.max(
              0,
              Math.min(
                1,
                (now - cast.releasesAt) / (cast.resolvesAt - cast.releasesAt),
              ),
            );
      bolt.position.set(
        cast.x + Math.sin(cast.yaw ?? 0) * cast.radius * travel,
        root.position.y + 0.8,
        cast.z + Math.cos(cast.yaw ?? 0) * cast.radius * travel,
      );
      bolt.scaling.setAll(0.7 + Math.sin(t * 30) * 0.12);
    },
    dispose() {
      root.dispose();
      bolt.dispose();
      material.dispose();
      boltMaterial.dispose();
    },
  };
}
