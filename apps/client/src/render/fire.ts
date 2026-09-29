import { Mesh, MeshBuilder, ShaderMaterial, type Scene } from "@babylonjs/core";
import { terrainHeight } from "../../../../packages/shared/rules";

export function createFlameMaterial(scene: Scene) {
  const material = new ShaderMaterial(
    "living flame",
    scene,
    {
      vertexSource: `precision highp float;
attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;varying vec2 vUV;
void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.);}`,
      fragmentSource: `precision highp float;
varying vec2 vUV;uniform float time;uniform float opacity;
void main(){float y=vUV.y;float x=abs(vUV.x-.5+sin(y*14.-time*7.)*.06*y);
float edge=max(.001,(1.-y)*.32);float alpha=(1.-smoothstep(edge*.5,edge,x))*smoothstep(0.,.12,y);
vec3 color=mix(vec3(1.,.23,.02),vec3(1.,.95,.52),(1.-smoothstep(0.,.2,x))*(1.-y));
gl_FragColor=vec4(color*1.5,alpha*.9*opacity);}`,
    },
    {
      attributes: ["position", "uv"],
      uniforms: ["worldViewProjection", "time", "opacity"],
      needAlphaBlending: true,
    },
  );
  material.setFloat("opacity", 1);
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  return material;
}

export function createTorchFire(scene: Scene, positions: number[][]) {
  const material = createFlameMaterial(scene);
  const flames = positions.map(([x, z], index) => {
    const mesh = MeshBuilder.CreatePlane(
      `torch flame ${index}`,
      { width: 0.65, height: 0.95 },
      scene,
    );
    mesh.position.set(x, terrainHeight(x, z) + 2.68, z);
    mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  });
  return {
    setActive(flags: boolean[]) {
      flames.forEach((flame, index) => flame.setEnabled(flags[index] ?? false));
    },
    update(time: number) {
      material.setFloat("time", time);
    },
    dispose() {
      flames.forEach((mesh) => mesh.dispose());
      material.dispose();
    },
  };
}
