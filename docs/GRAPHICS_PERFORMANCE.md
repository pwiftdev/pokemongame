# Graphics and rendering review

The renderer keeps the existing art and model library. Ground textures now include subtle surface relief, grass moves in the vertex shader, and the sea has view-dependent sky color and moving shoreline foam. Reduced motion disables grass movement.

Terrain is split into tiles with shared edge normals, colors and UVs. Babylon can skip offscreen tiles without changing the terrain shape. Grass uses its existing static instance buffers, with progressively fewer instances at a distance. Static scenery transforms are frozen, visibility checks skip stationary views, and cottage parts now participate in scenery visibility and disposal.

## Local measurement

The fixed 1440 × 900 overview comparison uses the same new materials in both configurations. The comparison configuration merges the terrain back into one mesh, enables all grass instances and unfreezes scenery transforms. These changes existed only in the measurement browser.

| Metric                  | Comparison configuration |  Optimized |
| ----------------------- | -----------------------: | ---------: |
| FPS                     |                    57.73 |      59.98 |
| Scene rendering time    |                 16.89 ms |   15.08 ms |
| Submitted indices       |               13,889,685 | 12,617,046 |
| Terrain indices in view |                  423,966 |    138,210 |
| Draw calls              |                      344 |        367 |

Tiles add draw calls but reduce submitted geometry. This local sample shows approximately 9% fewer submitted indices and 11% less scene rendering time. It is a single view on the local Chromium renderer, not a guarantee for other hardware or scenes. Raw results are in `evidence/graphics-workload.json`; screenshots are in `evidence/graphics-final-*.png`.

## Audit and validation

- Reused model loading, materials, existing instance buffers, quality settings and reduced-motion settings; no new dependencies or assets.
- Removed unused terrain palette colors. Extracted terrain splitting, foliage culling and wind into focused helpers.
- Checked resource disposal, shader bounds, shared materials, camera obstruction metadata and restoration after distance or quality changes.
- Checked error handling and security boundaries: no network, database, endpoint, authentication or server-authority changes.
- Unit coverage verifies triangle and edge preservation, empty tiles, distance changes, teleports, quality restoration and disposal.
- Type checking, production build, 102 unit tests, camera-controls browser test and browser quality/reduced-motion checks pass. Browser checks reported no shader or runtime errors.
- Prettier passes for changed files. The production build still reports the existing large Babylon bundle warning.
