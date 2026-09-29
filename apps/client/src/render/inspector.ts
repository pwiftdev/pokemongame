import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import {
  loadCreatures,
  CREATURE_MODELS,
  EVOLVED_MODELS,
  type Motion,
} from "./creatures";

export async function inspectAssets(
  canvas: HTMLCanvasElement,
  status: HTMLElement,
) {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.13, 0.2, 0.19, 1);
  const camera = new ArcRotateCamera(
    "inspection camera",
    -Math.PI / 2,
    1.02,
    28,
    new Vector3(0, 0, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 50;
  const light = new HemisphericLight(
    "inspection softbox",
    new Vector3(0, 1, 0),
    scene,
  );
  light.intensity = 1.5;
  const floor = MeshBuilder.CreateGround(
    "studio floor",
    { width: 60, height: 60 },
    scene,
  );
  const material = new StandardMaterial("matte studio", scene);
  material.diffuseColor = Color3.FromHexString("#66847b");
  material.specularColor = Color3.Black();
  floor.material = material;
  const library = await loadCreatures(scene);
  const names = [...CREATURE_MODELS, ...EVOLVED_MODELS];
  const actors = names.map((name, i) => {
    const actor = library.create(name, name, 2);
    actor.root.rotation.y = Math.PI;
    actor.root.position.set(
      ((i % 5) - 2) * 4.5,
      0,
      (Math.floor(i / 5) - 1) * 4.8,
    );
    return actor;
  });
  status.textContent =
    "15 locally packaged GLB models loaded. Drag to orbit; scroll to inspect. Every model has its own rig and texture.";
  const controls = document.getElementById("animation-controls")!;
  for (const motion of [
    "idle",
    "move",
    "attack",
    "hit",
    "defeat",
    "celebrate",
  ] as Motion[]) {
    const button = document.createElement("button");
    button.textContent = motion;
    button.onclick = () => actors.forEach((actor) => actor.animate(motion));
    controls.append(button);
  }
  const labels = document.getElementById("model-labels")!;
  names.forEach((name, i) => {
    const button = document.createElement("button");
    button.textContent = `${i + 1}. ${name}`;
    button.onclick = () => {
      camera.target
        .copyFrom(actors[i].root.position)
        .addInPlace(new Vector3(0, 1, 0));
      camera.radius = 6;
    };
    labels.append(button);
  });
  Object.defineProperty(window, "__assetInspection", {
    configurable: true,
    get: () => ({
      models: names,
      clips: scene.animationGroups
        .filter((a) => a.isStarted)
        .map((a) => a.name),
      bones: scene.skeletons.flatMap((skeleton) =>
        skeleton.bones.flatMap((bone) =>
          Array.from(bone.getFinalMatrix().asArray()),
        ),
      ),
    }),
  });
  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());
  window.addEventListener(
    "pagehide",
    () => {
      actors.forEach((a) => a.dispose());
      library.dispose();
      scene.dispose();
      engine.dispose();
    },
    { once: true },
  );
}
