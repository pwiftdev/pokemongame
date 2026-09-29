import {
  MaterialPluginBase,
  type Material,
  type UniformBuffer,
} from "@babylonjs/core";

export class FoliageWind extends MaterialPluginBase {
  constructor(
    material: Material,
    private readonly wind: { time: number; strength: number },
  ) {
    super(material, "FoliageWind", 200, {}, true, true);
  }

  getUniforms() {
    return {
      ubo: [{ name: "foliageWind", size: 2, type: "vec2" }],
      vertex: "#ifndef UNIFORMBUFFERS\nuniform vec2 foliageWind;\n#endif",
    };
  }

  bindForSubMesh(buffer: UniformBuffer) {
    buffer.updateFloat2("foliageWind", this.wind.time, this.wind.strength);
  }

  getCustomCode(shaderType: string) {
    if (shaderType !== "vertex") return null;
    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
float bend = clamp(positionUpdated.y, 0., 2.) * foliageWind.y;
float gust = sin(worldPos.x * .31 + worldPos.z * .21 + foliageWind.x * 1.6);
worldPos.xz += vec2(gust, gust * .45) * bend;
vPositionW = worldPos.xyz;`,
    };
  }
}
