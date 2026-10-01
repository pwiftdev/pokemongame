import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@babylonjs/core", async (original) => ({
  ...(await original<typeof import("@babylonjs/core")>()),
  LoadAssetContainerAsync: vi.fn(),
}));
import {
  LoadAssetContainerAsync,
  type AssetContainer,
  type Scene,
} from "@babylonjs/core";
import { loadModelLibrary } from "../apps/client/src/render/models";

const scene = () =>
  ({ onDisposeObservable: { addOnce: vi.fn() } }) as unknown as Scene;
const template = () => ({ dispose: vi.fn() }) as unknown as AssetContainer;
afterEach(() => vi.resetAllMocks());
describe("shared model loading", () => {
  it("shares one pending download between actors of the same species", async () => {
    let finish!: (asset: AssetContainer) => void;
    vi.mocked(LoadAssetContainerAsync).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const library = await loadModelLibrary(scene(), {});
    const a = library.load("Bulbasaur", "/bulbasaur.glb");
    const b = library.load("Bulbasaur", "/bulbasaur.glb");
    expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);
    expect(LoadAssetContainerAsync).toHaveBeenCalledWith(
      "/bulbasaur.glb",
      expect.anything(),
      { pluginOptions: { gltf: { animationStartMode: 0 } } },
    );
    finish(template());
    await Promise.all([a, b]);
    expect(library.has("Bulbasaur")).toBe(true);
    library.dispose();
  });
  it("disposes a late download after the library has been discarded", async () => {
    let finish!: (asset: AssetContainer) => void;
    vi.mocked(LoadAssetContainerAsync).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const library = await loadModelLibrary(scene(), {});
    const pending = library.load("Bulbasaur", "/bulbasaur.glb");
    library.dispose();
    const asset = template();
    finish(asset);
    await pending;
    expect(asset.dispose).toHaveBeenCalledOnce();
    expect(library.has("Bulbasaur")).toBe(false);
  });
  it("cleans up successful templates if a required startup model fails", async () => {
    const asset = template();
    vi.mocked(LoadAssetContainerAsync)
      .mockResolvedValueOnce(asset)
      .mockRejectedValueOnce(new Error("missing hero"));
    await expect(
      loadModelLibrary(scene(), { village: "/village.glb", hero: "/hero.glb" }),
    ).rejects.toThrow("missing hero");
    expect(asset.dispose).toHaveBeenCalledOnce();
  });
});
