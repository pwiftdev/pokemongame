import {
  Color3,
  Mesh,
  MeshBuilder,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { LAKES } from "../../../../packages/shared/geography";
import {
  surfaceVertex,
  surfaceFog,
  surfaceUniforms,
  updateSurface,
} from "./surface-shader";
export function createInlandWater(scene: Scene) {
  const materials: ShaderMaterial[] = [];
  const meshes: Mesh[] = [];
  for (const lake of LAKES) {
    const mesh = MeshBuilder.CreateDisc(
      lake.id,
      { radius: 1, tessellation: 64, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.scaling.set(lake.rx * 1.23, lake.rz * 1.23, 1);
    mesh.position.set(lake.x, lake.level + 0.025, lake.z);
    mesh.isPickable = false;
    const mat = new ShaderMaterial(
      `${lake.id} water`,
      scene,
      {
        vertexSource: surfaceVertex,
        fragmentSource: `precision highp float;
varying vec3 vPosition;varying vec2 vUV;uniform float time;uniform float ice;uniform vec3 tint;uniform vec3 basin;uniform vec2 radii;${surfaceFog}
void main(){vec2 p=vPosition.xz;vec2 q=(p-basin.xz)/radii;float a=atan(q.y,q.x);float d=length(q)/(1.+.065*sin(a*3.+basin.x)+.035*sin(a*7.+basin.z));
if(d>1.035)discard;
float wave=sin(p.x*1.3+time*.6+sin(p.y*.8))*sin(p.y*1.4-time*.5);
vec3 normal=normalize(vec3(cos(p.x*.8+time*.65)*.06,1.,sin(p.y*.7-time*.5)*.06));
vec3 view=normalize(eye-vPosition);float fresnel=.06+.3*pow(1.-max(0.,dot(view,normal)),4.);
vec3 depth=mix(tint*.52,tint*1.4,smoothstep(.2,1.,d));
vec3 color=mix(depth,vec3(.17,.34,.39),fresnel)+wave*.007;
float foam=smoothstep(.89,1.04,d)*(.5+.5*sin(p.x*1.7+p.y*.8+wave-time*.3));
color=mix(color,vec3(.34,.56,.43),foam*.25);
float caustic=pow(max(0.,sin(p.x*2.+sin(p.y*1.7+time*.4))+sin(p.y*2.1-time*.5))*.5,12.);
color+=caustic*.06*smoothstep(.35,1.,d);
float gleam=pow(max(0.,dot(reflect(normalize(vec3(-.55,-1.,.35)),normal),view)),90.);
color+=vec3(1.,.94,.73)*gleam*.5;
if(ice>.5){
vec2 cell=floor(p*.38),f=fract(p*.38);float first=10.,second=10.;
for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){vec2 g=vec2(float(i),float(j));vec2 v=cell+g;vec2 point=.5+.35*sin(vec2(dot(v,vec2(127.1,311.7)),dot(v,vec2(269.5,183.3))));float dist=length(g+point-f);if(dist<first){second=first;first=dist;}else second=min(second,dist);}
float vein=1.-smoothstep(.006,.025,second-first);
vec3 frozen=mix(vec3(.15,.34,.43),vec3(.58,.76,.83),.36+vein*.4)+wave*.013;
color=frozen;}gl_FragColor=vec4(applySurfaceFog(color),1.);}`,
      },
      {
        attributes: ["position", "uv"],
        uniforms: [...surfaceUniforms, "ice", "tint", "basin", "radii"],
      },
    );
    mat.setFloat("ice", lake.frozen ? 1 : 0);
    mat.setColor3(
      "tint",
      Color3.FromHexString(
        lake.biome === "marsh"
          ? "#355e57"
          : lake.biome === "desert"
            ? "#278c89"
            : "#307e85",
      ).toLinearSpace(),
    );
    mat.setVector3("basin", new Vector3(lake.x, lake.level, lake.z));
    mat.setVector2("radii", new Vector2(lake.rx, lake.rz));
    mesh.material = mat;
    mesh.freezeWorldMatrix();
    materials.push(mat);
    meshes.push(mesh);
  }
  return {
    update(t: number) {
      for (const mat of materials) updateSurface(mat, scene, t);
    },
    dispose() {
      meshes.forEach((mesh) => mesh.dispose());
      materials.forEach((mat) => mat.dispose());
    },
  };
}
