# Renderer review and evidence

The authored-model replacement is documented in [MODEL_UPGRADE_AUDIT.md](MODEL_UPGRADE_AUDIT.md) and [ASSET_INSPECTION.md](ASSET_INSPECTION.md). The observations and measurements below describe the earlier renderer and are retained as historical evidence.

The renderer uses the shared authoritative terrain height, town building obstacle proxies, world bounds, species IDs and encounter coordinates. Renderer effects do not decide damage, capture outcomes, currency or ownership. External model paths are fixed local constants; no runtime remote asset URLs or user-provided URLs are loaded.

The world includes authored cottages with windows and gardens, winding continuous trails, a meadow windmill, a shallow rill and flush footbridge, a campfire restsite, a luminous grove and ancient tree, a coastal sanctuary, sea stacks and clouds. Shared snapshot time supplies a gentle twenty-minute day/night tint cycle. The camera follows predicted movement reconciled to server snapshots, and actual merged-mesh camera raycasts cover buildings, tree canopies and ruin columns. Ground movement uses shared authoritative collision rules. Decorative tree/rock placement generally is not an additional authoritative physical obstacle; these are scenic props. Buffers around encounter spawns prevent large scenery covering creatures.

Reusable helpers cover creature templates, trainer articulation, world labels, threat markers, environment primitives, shadow registration/cleanup, and movement rules. Static environment geometry is merged by material; loaded creature geometry/materials are reused with separate skeletons. Inspected and corrected unused imports, duplicate disposal, incorrect clockwise triangle winding, incompatible mesh merge attributes, title camera clamping, reversed right movement, backward key mapping, key-code interaction mapping, modal input capture, camera resets on profile updates, stale shadow references and poor shadow projection.

`evidence/renderer-check.json` records a real headless Chromium renderer run:

- No page errors.
- Remapped physical-key E/F and ability 1 reach the correct callbacks.
- D produces positive X movement at the default camera angle.
- A `[role=dialog]` overlay suppresses movement and action commands.
- Renderer disposal removes its metrics and tears down engine, scene, listeners, templates and effects.
- Read-only metrics include frame samples, actual scene counts, draw calls, position and camera orientation.

At 1440×900 using **ANGLE SwiftShader software rendering**, the final isolated coastal inspection measured approximately **9.35 FPS high** and **20.69 FPS low**. Last fifty frame median/p95: high 108.6/132.9 ms; low 47.7/66.5 ms. Scene: 113 meshes, 309,842 total vertices, 99 high/93 low draw calls. Other scene compositions varied between approximately 9–12 high and 21–32 low, including contention from parallel browser checks. These numbers describe the software renderer, not consumer GPU performance. A separate actual Apple M4 Metal benchmark at 1920×1080 measured approximately 60 FPS in both quality modes, with p95 frame time around 18 ms; see `evidence/render-benchmark.json`. That benchmark uses one rendered player and 22 wild creatures, not 16 rendered players. Low mode reduces resolution, shadow map size, bloom and decorative flowers while keeping gameplay warnings.

Boss telegraphs use the server's area, resolution time and snapshot clock. The visible area has an outline, eight radial marks, a contracting countdown and the text `! MOVE OUT`, including low mode. `boss-telegraph-render.png` is an isolated renderer check with an injected snapshot, not evidence of authoritative boss gameplay; network encounter tests are separate. Replicated preset emotes display above the corresponding trainer. Asset animation inspection is described in `ASSET_INSPECTION.md`.

Remaining presentation limits: clip changes are immediate rather than full animation crossfades; Tree has no dedicated Death clip and uses its No reaction before vanishing; placeholder-free but deliberately simple articulated trainer geometry; material-based merging provides coarse rather than spatial vegetation culling. Remote movement is interpolated; The current render tests are short runs and do not establish an hours-long memory plateau.

## Forest camera regression

The final visual walkthrough exposed a blocked camera inside a large tree canopy at `(28, 30)`. Coarse circle proxies and the old five-metre minimum radius could place the camera inside real geometry. The revised helper casts three actual geometry rays from the player focal point toward the requested camera endpoint, including side clearance, and can move within 0.85 metres when required. It preserves wheel-selected zoom and smoothly restores that zoom after the obstruction clears. Old proxy bookkeeping was removed.

`evidence/forest-camera-fixed.png` shows the exact reported location at default orbit. `forest-orbit-0.png` through `forest-orbit-3.png` show four cardinal orientations without scene relocation. `evidence/camera-collision.json` reports zero page errors, obstructed radius 6.64 m with recovery to the chosen 15 m, and geometry-raycast batches at median 3.5 ms / p95 at most 4 ms. Checks are throttled to one batch every 70 ms; movement/rendering still runs each frame. Four focused `tests/camera-collision.test.ts` tests cover real geometry clipping with normal picking disabled, user zoom and recovery, sub-five-metre clearance, and raycast throttling.

## Springhouse close-camera and follow regression

The post-defeat walk to the Springhouse exposed two additional camera presentation failures. Babylon's `camera.target = ...` setter rebuilt orbit angles/radius to preserve the previous camera position on each follow frame; camera follow now mutates the existing target vector so walking and respawning preserve the chosen orbit. The new regression follows three positions including a distant boss-to-town return and verifies target identity, radius and both orbit angles remain stable.

Service and name labels now hide when behind the viewer or within 3.5 m of forward camera depth, and their projected width is capped at 24% of the viewport. Labels update before each camera render and restore automatically. Local trainer/companion **mesh visibility** fades when the camera enters the character area; shared materials remain unchanged. Combat-critical boss warning geometry and its instruction remain visible.

At the exact Springhouse position `(-10,-30)`, default orbit correctly narrows to 1.62 m to avoid the cottage. Both local body and companion have mesh visibility zero at that distance; the player can see and interact with the world. Turning the camera restores both to visibility one and returns toward the chosen 15 m zoom. Four-angle screenshots `springhouse-camera-fixed.png` and `springhouse-orbit-0.png` through `springhouse-orbit-3.png` and metrics in `evidence/springhouse-camera.json` document zero page errors and approximately 60 FPS with ANGLE Metal at 1440×900. Five `tests/camera-presentation.test.ts` regressions cover target-follow preservation, near/behind label hiding, projected label sizing/restoration, actor fade/restoration, and camera-forward depth.
