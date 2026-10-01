import { Color3, ShaderMaterial, Vector3, type Scene } from "@babylonjs/core";
export const surfaceVertex = `precision highp float;
attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;uniform mat4 world;
varying vec3 vPosition;varying vec2 vUV;
void main(){vUV=uv;vPosition=(world*vec4(position,1.)).xyz;gl_Position=worldViewProjection*vec4(position,1.);}`;
export const surfaceFog = `uniform vec3 eye;uniform vec3 fogColor;uniform float fogDensity;
vec3 applySurfaceFog(vec3 color){float distance=length(eye-vPosition);return mix(color,fogColor,1.-exp(-distance*distance*fogDensity*fogDensity));}`;
export const surfaceUniforms = [
  "worldViewProjection",
  "world",
  "time",
  "eye",
  "fogColor",
  "fogDensity",
];
const fog = new Color3(),
  origin = Vector3.Zero();
export function updateSurface(
  material: ShaderMaterial,
  scene: Scene,
  time: number,
) {
  material.setFloat("time", time);
  material.setVector3("eye", scene.activeCamera?.globalPosition ?? origin);
  scene.fogColor.toLinearSpaceToRef(fog);
  material.setColor3("fogColor", fog);
  material.setFloat("fogDensity", scene.fogDensity);
}
