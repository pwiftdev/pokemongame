import { WATERFALL } from "../../../../packages/shared/environment-features";
import {
  surfaceVertex,
  surfaceFog,
  surfaceUniforms,
  updateSurface,
} from "./surface-shader";
import {
  Mesh,
  MeshBuilder,
  ShaderMaterial,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { terrainHeight } from "../../../../packages/shared/rules";
export function createWaterfall(scene: Scene) {
  const top = terrainHeight(WATERFALL.cliff.x, WATERFALL.cliff.z) + 8;
  const path = Array.from({ length: 18 }, (_, i) => {
    const t = i / 17;
    return new Vector3(
      WATERFALL.top.x + (WATERFALL.bottom.x - WATERFALL.top.x) * t,
      top * (1 - t) + 0.9 * t + Math.sin(t * Math.PI) * 1.6,
      WATERFALL.top.z + (WATERFALL.bottom.z - WATERFALL.top.z) * t,
    );
  });
  const ribbon = MeshBuilder.CreateRibbon(
    "canopy cascade",
    {
      pathArray: [
        path.map((p) => p.add(new Vector3(-1.2, 0, -0.25))),
        path.map((p) => p.add(new Vector3(1.2, 0, 0.25))),
      ],
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene,
  );
  const material = new ShaderMaterial(
    "falling water",
    scene,
    {
      vertexSource: surfaceVertex,
      fragmentSource: `precision highp float;varying vec2 vUV;varying vec3 vPosition;uniform float time;${surfaceFog}
void main(){float threads=sin(vUV.x*35.+sin(vUV.y*24.-time*5.)*1.2)*.5+.5;float streak=sin(vUV.y*55.-time*8.)*.5+.5;float edge=smoothstep(0.,.13,vUV.x)*(1.-smoothstep(.87,1.,vUV.x));vec3 color=mix(vec3(.08,.28,.33),vec3(.56,.79,.78),threads*.55+streak*.2);gl_FragColor=vec4(applySurfaceFog(color),edge*.85);}`,
    },
    {
      attributes: ["position", "uv"],
      uniforms: surfaceUniforms,
      needAlphaBlending: true,
    },
  );
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  ribbon.material = material;
  ribbon.isPickable = false;
  return {
    update(t: number) {
      updateSurface(material, scene, t);
    },
    dispose() {
      ribbon.dispose();
      material.dispose();
    },
  };
}
