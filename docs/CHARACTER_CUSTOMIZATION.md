# Character customization

The onboarding character creator and the in-town character studio share one component and the same renderer. Open the studio using the Character button next to Settings. Save edits in Hearthwick outside combat. Team cards allow pet nicknames; clearing the field restores the species name. Players and deployed companions have world nameplates, including the local player. Companion labels identify their owner.

## Choices and assets

Four cosmetic race variants (Human, Elf, Dwarf, Orc), two body bases, eight skin colors per race, five hairstyles plus bald, ten hair colors, eight eye colors, three beard settings, four face presets, three brow styles, jaw/nose/ear/height sliders, two outfits, eight clothing dyes and optional shoulder armor. Classes retain their existing gameplay, weapons and abilities. Heritage and appearance never change combat statistics.

The free Quaternius Standard bases, hairstyles, fantasy outfits and Universal Animation Libraries replace fixed KayKit player bodies. KayKit weapons are reused with rig-specific grips. Village and story NPCs share the player bases with role-specific uniforms. Race variants derive from these two bases, not four separately authored racial model packs. See [full credits](../apps/client/public/legal/CHARACTER_CREDITS.txt). The standalone `/character-studio.html` previews the same models and controls without creating a profile.

## Persistence, security and reuse

- `packages/shared/appearance.ts` holds choices, palettes, defaults, stable comparison and display-name rules. Old profiles receive defaults during normalization.
- Strict server command schemas reject unknown fields, external model URLs, invalid choices, out-of-range values and non-finite sliders. Names are normalized, length-limited and reject markup and control characters. UI uses escaped markup or textContent.
- Appearance and pet names use the existing profile transaction and request-id replay protection. Pet updates verify ownership. Character edits require town and peace; duel loadouts remain locked. No new database tables, API endpoints or queries per snapshot.
- Snapshots carry appearance and companion nickname. Model instances change only when class or appearance changes; name text updates only when changed.
- Existing asset loader, animation mixer, combat motion and nameplate renderer are reused. No second combat-animation system or character recovery/lease state machine.

## Rendering audit and fixes

- Players and NPCs share one avatar library; legacy hero models are no longer loaded during game startup. Partial avatar-library startup failures dispose successful loads.
- Asset templates do not autoplay animations. This avoids background animation work and time-dependent cloned poses.
- Imported head geometry is customized per instance, leaving shared templates intact. Per-character materials preserve shared underlying image resources. Texture wrappers cloned by Babylon are explicitly disposed, including textures removed when tinting hair/hands.
- Repeated preview changes now keep meshes, materials, textures, skeletons, animations and active animation counts stable. The audit found and fixed texture-wrapper growth from 32 to 592 after 30 edits; the same check now remains at 32.
- Preview rendering is capped near 30 fps, pauses in hidden tabs and throttles slider-driven model rebuilds. Closing disposes the canvas engine, observer, models, materials and listeners. Late loads and failed previews are covered.
- Every animation channel that stays at the rest value across _all_ clips is removed during assembly. Per-avatar animated tracks fall from 195 to 64 while preserving changed channels and their transitions. Unused source bodies/skeletons are removed and vertices welded. The separate six-weapon payload falls from roughly 1.3 MB to 144 KB. Model textures are capped at 512px and encoded as WebP.
- Nameplate heights are cached on snapshots rather than normalizing appearance every frame. Distance-limited labels fade and scale for readability.
- Checked unused imports/code, duplication, ownership, validation, escaping, database work, resource cleanup, responsive layout and asset licensing. No new dependency or paid asset/service.

## Rebuilding assets

1. Download the free Standard ZIPs from Quaternius's official Universal Base Characters and Universal Animation Library itch.io pages. Use the free download option; no paid pack is required.
2. Place them at `evidence/character-sources/universal-base.zip` and `animations.zip`; verify against `scripts/data/character-sources.json`. Extract into `evidence/character-sources/base/` and `animations/` respectively, keeping the archive directory names.
3. Run `python3 scripts/acquire-characters.py` on macOS with Python 3, `sips`, Node and npm. The pinned CC0 mirror supplies outfit files and UAL2. glTF Transform 4.2.1 welds, deduplicates, prunes, resamples, resizes and compresses the assembled models. The manifest records output hashes.
4. Run `npx prettier --write ASSET_MANIFEST.json`, `npm test`, `npm run typecheck`, and `npm run build`.

## Validation

Unit tests cover legacy migration, all races/bodies, key ordering, strict appearance/name input, template loading and packaged rig/equipment integrity. `npx tsx scripts/character-systems-test.ts` exercises real server persistence, remote snapshots, cosmetic invariants, replayed requests, pet ownership, nickname reset, reconnect, town/combat and duel restrictions. Browser tests cover saved edits, cancelled edits, reconnect, two-player visibility, all races/bodies, repeated-edit resource counts, narrow layouts, failed previews and leaving during model downloads.
