import { createCampSmoke } from "./camp-smoke";
import {
  Color3,
  Mesh,
  ShaderMaterial,
  Vector3,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import { biomeAt, terrainHeight } from "../../../../packages/shared/rules";
import type { Biome } from "../../../../packages/shared/types";
const climates: Record<
  Biome,
  { fog: string; density: number; mote: string; fall: number }
> = {
  town: { fog: "#bcced0", density: 0.0026, mote: "#f7e6b0", fall: 0 },
  meadow: { fog: "#bed4c5", density: 0.003, mote: "#f4e9ae", fall: 0 },
  forest: { fog: "#739b93", density: 0.007, mote: "#daeeaa", fall: 0.3 },
  ruins: { fog: "#9fc8d0", density: 0.004, mote: "#8ce1d8", fall: 0 },
  desert: { fog: "#e1c294", density: 0.0038, mote: "#e2c390", fall: 0.2 },
  marsh: { fog: "#738d98", density: 0.009, mote: "#bcf197", fall: 0 },
  tundra: { fog: "#c3dbe6", density: 0.0055, mote: "#effaff", fall: 1 },
  highlands: { fog: "#d4c4a6", density: 0.0035, mote: "#e7a44e", fall: 0.6 },
};
const fogColors = Object.fromEntries(
  Object.entries(climates).map(([name, c]) => [
    name,
    Color3.FromHexString(c.fog),
  ]),
) as Record<Biome, Color3>;
const moteColors = Object.fromEntries(
  Object.entries(climates).map(([name, c]) => [
    name,
    Color3.FromHexString(c.mote),
  ]),
) as Record<Biome, Color3>;
export function createBiomeLife(scene: Scene) {
  const mesh = new Mesh("seasonal motes", scene),
    vd = new VertexData(),
    p: number[] = [],
    uv: number[] = [],
    ix: number[] = [];
  for (let i = 0; i < 96; i++) {
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      p.push(x, y, i);
      uv.push((x + 1) / 2, (y + 1) / 2);
    }
    const n = i * 4;
    ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  vd.positions = p;
  vd.uvs = uv;
  vd.indices = ix;
  vd.applyToMesh(mesh);
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.isPickable = false;
  const mat = new ShaderMaterial(
    "seasonal drift",
    scene,
    {
      vertexSource: `precision highp float;
attribute vec3 position;attribute vec2 uv;uniform mat4 viewProjection;uniform vec3 focus;uniform vec3 right;uniform vec3 up;uniform float time;uniform float fall;uniform float limit;varying vec2 vUV;varying float alpha;
float hash(float n){return fract(sin(n*127.1)*43758.5453);}
void main(){float id=position.z;float s=hash(id+1.);vec3 center=focus+vec3((hash(id+9.)-.5)*52.,0.,(hash(id+29.)-.5)*52.);
center.x+=sin(time*.21+s*12.)*1.4;center.z+=cos(time*.16+s*21.)*1.2;
center.y+=mod(s*8.-time*(.1+fall*.85),8.)+.5;
float size=mix(.027,.08,fall)*(1.+s*.5);vec3 pos=center+(right*position.x+up*position.y)*size;
gl_Position=viewProjection*vec4(pos,1.);vUV=uv;alpha=step(id,limit)*(.35+s*.55);}`,
      fragmentSource: `precision highp float;varying vec2 vUV;varying float alpha;uniform vec3 tint;uniform float fall;
void main(){vec2 q=vUV-.5;float shape=1.-smoothstep(.12,.5,length(q));gl_FragColor=vec4(tint,shape*alpha);}`,
    },
    {
      attributes: ["position", "uv"],
      uniforms: [
        "viewProjection",
        "focus",
        "right",
        "up",
        "time",
        "fall",
        "limit",
        "tint",
      ],
      needAlphaBlending: true,
    },
  );
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;
  mesh.material = mat;
  const birds = createBirds(scene);
  const smoke = createCampSmoke(scene);
  let low = false,
    currentFog = fogColors.town.clone(),
    density = 0.0026;
  const focus3 = new Vector3(),
    right = new Vector3(),
    up = new Vector3();
  return {
    update(t: number, focus: { x: number; z: number }, reduced: boolean) {
      const biome = biomeAt(focus.x, focus.z),
        climate = climates[biome];
      Color3.LerpToRef(currentFog, fogColors[biome], 0.018, currentFog);
      density += (climate.density - density) * 0.018;
      scene.fogColor.copyFrom(currentFog);
      scene.fogDensity = density;
      focus3.set(focus.x, terrainHeight(focus.x, focus.z), focus.z);
      const camera = scene.activeCamera;
      if (camera) {
        const world = camera.getWorldMatrix();
        Vector3.TransformNormalToRef(Vector3.Right(), world, right);
        Vector3.TransformNormalToRef(Vector3.Up(), world, up);
      }
      mat.setVector3("focus", focus3);
      mat.setVector3("right", right);
      mat.setVector3("up", up);
      mat.setFloat("time", reduced ? 0 : t);
      mat.setColor3("tint", moteColors[biome]);
      mat.setFloat("fall", climate.fall);
      mat.setFloat("limit", low ? 28 : 95);
      smoke.update(reduced);
      mesh.setEnabled(!reduced);
      birds.update(reduced ? 0 : t, focus3, biome !== "marsh");
    },
    setQuality(value: boolean) {
      low = value;
      smoke.setQuality(value);
    },
    dispose() {
      mesh.dispose();
      mat.dispose();
      birds.dispose();
      smoke.dispose();
    },
  };
}
function createBirds(scene: Scene) {
  const mesh = new Mesh("circling birds", scene),
    data = new VertexData(),
    p: number[] = [],
    ix: number[] = [];
  for (let i = 0; i < 9; i++) {
    const n = p.length / 3;
    p.push(
      -0.6,
      0,
      i,
      0,
      0.06,
      i,
      -0.13,
      0.1,
      i,
      0,
      0.06,
      i,
      0.6,
      0,
      i,
      0.13,
      0.1,
      i,
    );
    ix.push(n, n + 1, n + 2, n + 3, n + 4, n + 5);
  }
  data.positions = p;
  data.indices = ix;
  data.applyToMesh(mesh);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  const mat = new ShaderMaterial(
    "bird silhouettes",
    scene,
    {
      vertexSource: `precision highp float;attribute vec3 position;uniform mat4 viewProjection;uniform float time;uniform vec3 focus;
void main(){float id=position.z,a=time*.06+id*.7;vec3 center=focus+vec3(cos(a)*(25.+id),24.+sin(id)*4.,sin(a)*(22.+id));
float wing=sin(time*3.4+id)*abs(position.x)*.3;vec3 p=vec3(position.x*cos(a),position.y+wing,position.x*sin(a));gl_Position=viewProjection*vec4(center+p,1.);}`,
      fragmentSource: `precision highp float;void main(){gl_FragColor=vec4(.22,.29,.32,1.);}`,
    },
    { attributes: ["position"], uniforms: ["viewProjection", "time", "focus"] },
  );
  mat.backFaceCulling = false;
  mesh.material = mat;
  return {
    update(t: number, focus: Vector3, visible: boolean) {
      mesh.setEnabled(visible);
      mat.setFloat("time", t);
      mat.setVector3("focus", focus);
    },
    dispose() {
      mesh.dispose();
      mat.dispose();
    },
  };
}
