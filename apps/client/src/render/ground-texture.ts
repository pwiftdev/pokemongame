import { DynamicTexture, Texture, type Scene } from "@babylonjs/core";

export function createGroundTextures(scene: Scene) {
  const size = 512;
  const texture = new DynamicTexture(
    "meadow surface",
    { width: size, height: size },
    scene,
    true,
  );
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const image = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  let state = 1907;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const grid = Array.from({ length: 32 * 32 }, random);
  const noise = (x: number, y: number, scale: number) => {
    const px = x / scale,
      py = y / scale,
      ix = Math.floor(px),
      iy = Math.floor(py),
      u = px - ix,
      v = py - iy;
    const period = Math.min(32, size / scale);
    const at = (x: number, y: number) =>
      grid[
        (((y % period) + period) % period) * 32 +
          (((x % period) + period) % period)
      ];
    const a = at(ix, iy) * (1 - u) + at(ix + 1, iy) * u,
      b = at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u;
    return a * (1 - v) + b * v;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const value =
        0.72 +
        noise(x, y, 32) * 0.16 +
        noise(x, y, 16) * 0.07 +
        noise(x, y, 4) * 0.055 +
        random() * 0.025;
      const index = (y * size + x) * 4;
      heights[y * size + x] = value;
      image.data[index] = 255 * value;
      image.data[index + 1] = 255 * value;
      image.data[index + 2] = 255 * value;
      image.data[index + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  texture.update();
  const normal = new DynamicTexture(
    "meadow relief",
    { width: size, height: size },
    scene,
    true,
  );
  normal.gammaSpace = false;
  const normalContext = normal.getContext() as CanvasRenderingContext2D;
  const normalImage = normalContext.createImageData(size, size);
  const heightAt = (x: number, y: number) =>
    heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (heightAt(x - 1, y) - heightAt(x + 1, y)) * 3;
      const dy = (heightAt(x, y - 1) - heightAt(x, y + 1)) * 3;
      const length = Math.hypot(dx, dy, 1);
      const index = (y * size + x) * 4;
      normalImage.data[index] = ((dx / length) * 0.5 + 0.5) * 255;
      normalImage.data[index + 1] = ((dy / length) * 0.5 + 0.5) * 255;
      normalImage.data[index + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      normalImage.data[index + 3] = 255;
    }
  normalContext.putImageData(normalImage, 0, 0);
  normal.update();
  for (const surface of [texture, normal]) {
    surface.wrapU = surface.wrapV = Texture.WRAP_ADDRESSMODE;
    surface.uScale = surface.vScale = 108;
    surface.anisotropicFilteringLevel = 8;
  }
  return { diffuse: texture, normal };
}
