import { MaterialPluginBase, type Material } from "@babylonjs/core";
export class StoneWeathering extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, "StoneWeathering", 210, {}, true, true);
  }
  getCustomCode(shaderType: string) {
    if (shaderType !== "fragment") return null;
    return {
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
float stoneGrain=sin(vPositionW.x*5.3+sin(vPositionW.z*6.7))*sin(vPositionW.y*8.1+vPositionW.z*3.7);
float stoneSeam=smoothstep(.88,.98,abs(sin(vPositionW.y*3.1+sin(vPositionW.x*.7)*.4)));
surfaceAlbedo *= .83+stoneGrain*.09-stoneSeam*.16;
float snow=smoothstep(180.,220.,vPositionW.z)*smoothstep(.22,.68,normalW.y);
surfaceAlbedo=mix(surfaceAlbedo,vec3(.73,.83,.86),snow*.88);`,
    };
  }
}
