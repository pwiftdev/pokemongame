import { chromium } from "@playwright/test";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
const file = "apps/client/rpg-portraits.html";
await writeFile(
  file,
  `<html><body style="margin:0"><canvas style="width:256px;height:256px" width="256" height="256"></canvas><script type="module">
import {Engine,Scene,Color4,Vector3,ArcRotateCamera,HemisphericLight,DirectionalLight} from '@babylonjs/core';
import {modelBounds} from './src/render/models';import {loadCreatures,POKEMON_MODELS} from './src/render/creatures';import {loadTrainers} from './src/render/trainer';import {CLASSES} from '../../packages/shared/classes';
const engine=new Engine(document.querySelector('canvas'),true,{preserveDrawingBuffer:true});const scene=new Scene(engine);scene.clearColor=new Color4(0,0,0,0);const camera=new ArcRotateCamera('camera',-Math.PI/2+.3,1.35,4.6,new Vector3(0,1,0),scene);const fill=new HemisphericLight('fill',new Vector3(0,1,0),scene);fill.intensity=1.4;const sun=new DirectionalLight('sun',new Vector3(-1,-1,1),scene);sun.intensity=1.6;const creatures=await loadCreatures(scene);const heroes=await loadTrainers(scene);let actor;window.showPortrait=async(name)=>{actor?.dispose();const c=Object.entries(CLASSES).find(([id,c])=>c.model===name);actor=c?heroes.create('portrait',true,c[0]):creatures.create(name,'portrait',1.8);actor.root.rotation.y=Math.PI;if(actor.ready && !await actor.ready)throw new Error('Model failed: '+name);await scene.whenReadyAsync();actor.root.computeWorldMatrix(true);const bounds=modelBounds(actor.root);camera.target=bounds.min.add(bounds.max).scale(.5);const size=bounds.max.subtract(bounds.min);camera.radius=Math.max(size.x,size.y,size.z)*1.9;scene.render();};engine.runRenderLoop(()=>scene.render());window.portraitNames=[...POKEMON_MODELS,...Object.values(CLASSES).map(c=>c.model)];</script></body></html>`,
  { flag: "wx" },
);
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
  page.on("pageerror", (e) => console.error(e));
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.goto("http://127.0.0.1:5173/rpg-portraits.html");
  await page.waitForFunction(
    () => window.portraitNames,
    {},
    { timeout: 90000 },
  );
  let manifest = JSON.parse(await readFile("ASSET_MANIFEST.json", "utf8"));
  for (const name of await page.evaluate(() => window.portraitNames)) {
    await page.evaluate((n) => window.showPortrait(n), name);
    await page.waitForTimeout(250);
    const path = `apps/client/public/assets/portraits/${name}.png`;
    await page.screenshot({ path, omitBackground: true });
    const source = manifest.find((e) => e.name === name && e.kind === "model"),
      bytes = await readFile(path);
    manifest = manifest.filter((e) => e.path !== path);
    manifest.push({
      name: `portrait:${name}`,
      path,
      creator: source.creator,
      source: source.source,
      license: source.license,
      kind: "portrait",
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      modifications: "In-engine portrait of packaged model",
    });
  }
  await writeFile(
    "ASSET_MANIFEST.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
} finally {
  await browser?.close();
  await unlink(file);
}
