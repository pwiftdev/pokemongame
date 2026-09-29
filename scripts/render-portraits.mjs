import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
const portraitPage =
  "<!doctype html><html><body style=\"margin:0;background:transparent\"><canvas id=\"portrait\" width=\"256\" height=\"256\" style=\"width:256px;height:256px\"></canvas><script type=\"module\">\nimport { Engine,Scene,Color4,Color3,HemisphericLight,DirectionalLight,Vector3,ArcRotateCamera } from '@babylonjs/core';\nimport { loadCreatures,CREATURE_MODELS,EVOLVED_MODELS } from './src/render/creatures';\nconst engine=new Engine(document.querySelector('canvas'),true,{preserveDrawingBuffer:true});const scene=new Scene(engine);scene.clearColor=new Color4(0,0,0,0);\nconst camera=new ArcRotateCamera('portrait',-Math.PI/2+.25,1.3,5.2,new Vector3(0,1,0),scene);\nconst light=new HemisphericLight('fill',new Vector3(0,1,0),scene);light.intensity=1.3;\nconst sun=new DirectionalLight('key',new Vector3(-1,-1,1),scene);sun.intensity=1.5;\nconst library=await loadCreatures(scene);let actor;\nwindow.showPortrait=async(name)=>{actor?.dispose();actor=library.create(name,'portrait',1.9);actor.root.rotation.y=Math.PI;actor.animate('idle');await scene.whenReadyAsync();scene.render();};\nengine.runRenderLoop(()=>scene.render());window.portraitNames=[...CREATURE_MODELS,...EVOLVED_MODELS];\n</script></body></html>\n";
await writeFile("apps/client/portraits.html", portraitPage, { flag: "wx" });
let browser;
try {
  browser = await chromium.launch({
    channel: "chromium",
    args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
  });
  const page = await browser.newPage({
    viewport: { width: 256, height: 256 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:5173/portraits.html");
  await page.waitForFunction(() => window.portraitNames);
  await mkdir("apps/client/public/assets/portraits", { recursive: true });
  const manifest = JSON.parse(
    await readFile("ASSET_MANIFEST.json", "utf8"),
  ).filter(
    (e) =>
      e.kind !== "portrait" ||
      e.creator !== "Quaternius; rendered by this project",
  );
  for (const name of await page.evaluate(() => window.portraitNames)) {
    await page.evaluate((name) => window.showPortrait(name), name);
    await page.waitForTimeout(200);
    const path = `apps/client/public/assets/portraits/${name}.png`;
    await page.screenshot({ path, omitBackground: true });
    const bytes = await readFile(path);
    manifest.push({
      name: `portrait:${name}`,
      path,
      creator: "Quaternius; rendered by this project",
      source: "https://quaternius.com/packs/ultimatemonsters.html",
      license: "CC0-1.0",
      kind: "portrait",
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      modifications:
        "Transparent in-engine portrait rendered from the packaged GLB",
    });
  }
  await writeFile(
    "ASSET_MANIFEST.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
} finally {
  await browser?.close();
  await unlink("apps/client/portraits.html");
}
