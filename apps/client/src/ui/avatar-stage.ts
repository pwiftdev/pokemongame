import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Vector3,
} from "@babylonjs/core";
export function createAvatarStage(canvas: HTMLCanvasElement) {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
  });
  engine.setHardwareScalingLevel(Math.max(1, devicePixelRatio / 1.5));
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new ArcRotateCamera(
    "portrait camera",
    Math.PI / 2,
    1.38,
    4.2,
    new Vector3(0, 0.98, 0),
    scene,
  );
  camera.minZ = 0.04;
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 1;
  camera.upperRadiusLimit = 6;
  camera.lowerBetaLimit = 0.6;
  camera.upperBetaLimit = 1.65;
  camera.wheelPrecision = 60;
  camera.panningSensibility = 0;
  const sky = new HemisphericLight(
    "studio key",
    new Vector3(-0.6, 1, 1),
    scene,
  );
  sky.intensity = 1;
  sky.groundColor = Color3.FromHexString("#2b3c99");
  const rim = new HemisphericLight(
    "studio fill",
    new Vector3(0.6, 0.3, -1),
    scene,
  );
  rim.intensity = 0.3;
  const plinth = MeshBuilder.CreateCylinder(
    "portrait plinth",
    { diameter: 1.6, height: 0.1, tessellation: 8 },
    scene,
  );
  plinth.position.y = -0.06;
  const stone = new PBRMaterial("studio stone", scene);
  stone.albedoColor = Color3.FromHexString("#121c52");
  stone.roughness = 0.9;
  stone.metallic = 0.2;
  plinth.material = stone;
  const resize = new ResizeObserver(() => engine.resize());
  resize.observe(canvas);
  let lastFrame = 0;
  engine.runRenderLoop(() => {
    if (!document.hidden && performance.now() - lastFrame > 30) {
      lastFrame = performance.now();
      scene.render();
    }
  });
  return {
    scene,
    camera,
    dispose() {
      resize.disconnect();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
