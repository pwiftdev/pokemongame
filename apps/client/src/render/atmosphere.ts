import { WORLD_RADIUS } from "../../../../packages/shared/regions";
import {
  Mesh,
  MeshBuilder,
  ShaderMaterial,
  Vector3,
  type Scene,
} from "@babylonjs/core";

const vertex = `precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vPosition;
void main(){vPosition=(world*vec4(position,1.)).xyz;gl_Position=worldViewProjection*vec4(position,1.);}`;
const noise = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.01)*.13+noise(p*8.1)*.04;}`;
export function createAtmosphere(scene: Scene) {
  const sky = MeshBuilder.CreateSphere(
    "painted sky",
    { diameter: 1600, segments: 24, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  sky.isPickable = false;
  sky.infiniteDistance = true;
  const material = new ShaderMaterial(
    "sky gradients",
    scene,
    {
      vertexSource: vertex,
      fragmentSource: `precision highp float;
varying vec3 vPosition;uniform float time;${noise}
void main(){vec3 d=normalize(vPosition);float h=max(0.,d.y);
vec3 color=mix(vec3(.38,.66,.82),vec3(.12,.36,.68),pow(h,.45));
vec2 uv=d.xz/max(.12,d.y)*.42+vec2(time*.002,0.);
float clouds=smoothstep(.48,.71,fbm(uv))*smoothstep(0.,.15,d.y);
color=mix(color,vec3(1.,.98,.88),clouds*.86);
float sun=pow(max(0.,dot(d,normalize(vec3(-.55,.85,-.35)))),380.);
color+=vec3(1.,.77,.42)*sun*.7;
gl_FragColor=vec4(color,1.);}`,
    },
    {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "world", "time"],
    },
  );
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  sky.material = material;
  return {
    update(t: number) {
      material.setFloat("time", t);
    },
    dispose() {
      sky.dispose();
      material.dispose();
    },
  };
}
export function createWater(scene: Scene) {
  const mesh = MeshBuilder.CreateGround(
    "open sea",
    { width: 1000, height: 1000 },
    scene,
  );
  mesh.position.y = -1.45;
  mesh.isPickable = false;
  const material = new ShaderMaterial(
    "sunlit sea",
    scene,
    {
      vertexSource: vertex,
      fragmentSource: `precision highp float;
varying vec3 vPosition;uniform float time;uniform vec3 eye;${noise}
void main(){vec2 p=vPosition.xz;float ripple=sin(p.x*.7+time*.7+sin(p.y*.24))*sin(p.y*.8-time*.5)*.5+.5;
float coast=length(p);
float shoreline=1.-smoothstep(${WORLD_RADIUS + 1}.,${WORLD_RADIUS + 16}.,coast);
vec3 color=mix(vec3(.025,.24,.35),vec3(.14,.58,.62),shoreline*.7+.2);
color+=ripple*.028;
vec2 swell=vec2(p.x*.19+p.y*.12-time*.65,p.x*-.13+p.y*.23+time*.48);
vec3 normal=normalize(vec3(cos(swell.x)*.065-cos(swell.y)*.035,1.,cos(swell.x)*.04+cos(swell.y)*.06));
vec3 view=normalize(eye-vPosition);
float fresnel=.04+.65*pow(1.-max(0.,dot(normal,view)),5.);
vec3 reflection=reflect(-view,normal);
vec3 sky=mix(vec3(.65,.79,.79),vec3(.19,.43,.69),sqrt(max(0.,reflection.y)));
color=mix(color,sky,fresnel);
float glitter=pow(max(0.,dot(reflect(normalize(vec3(-.55,-1.,.35)),normal),view)),100.);
color+=vec3(1.,.9,.6)*glitter*.65;
if(coast>${WORLD_RADIUS - 1}. && coast<${WORLD_RADIUS + 10}.){
float grain=noise(p*.42+time*.06);
float breakers=sin((coast-grain*1.4)*1.6-time*1.1)*.5+.5;
float foam=smoothstep(.68,.95,breakers)*smoothstep(.2,.7,grain);
foam*=smoothstep(${WORLD_RADIUS - 1}.,${WORLD_RADIUS + 2}.,coast)*(1.-smoothstep(${WORLD_RADIUS + 3}.,${WORLD_RADIUS + 10}.,coast));
color=mix(color,vec3(.82,.95,.91),foam*.8);}
float fog=1.-exp(-length(eye-vPosition)*.002);
color=mix(color,vec3(.55,.75,.8),fog*.7);gl_FragColor=vec4(color,1.);}`,
    },
    {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "world", "time", "eye"],
    },
  );
  mesh.material = material;
  return {
    mesh,
    update(t: number) {
      material.setFloat("time", t);
      material.setVector3(
        "eye",
        scene.activeCamera?.globalPosition ?? Vector3.Zero(),
      );
    },
  };
}
