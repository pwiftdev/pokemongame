# Audio system

The game uses locally served CC0 recordings and music. Audio starts after player interaction, and defaults to pausing when the tab is hidden. Settings preserve separate master, music, nature, combat/footsteps, creature and interface volumes. Background audio is optional. Existing saved settings receive defaults for the new channels.

## What players hear

- Seven streamed scores cover all eight regions plus combat. Town uses an inn theme; meadow uses Harvest Season; forest uses Wandering Woodlands; ruins and marsh use Fairy Lights; desert and highlands use Exploration; tundra uses Bells of Winter. Combat has its own score. Region boundaries have a short delay to prevent rapid switching, and tracks crossfade.
- Birds, wind, night wildlife, marsh ambience and rain respond to region, weather and time. Shared world coordinates place coast, lake, waterfall and fire sounds next to their visible sources.
- Walking, sprinting and landing choose randomized stone, grass, sand, snow or water recordings. Nearby multiplayer footsteps are quieter.
- Hero and companion casts, elemental impacts, melee hits, critical hits, blocks, dodges, shattering, healing, dashes and boss warnings have distinct cues. Distance and camera direction control volume and stereo placement.
- Creature calls, hurt and faint sounds; capture shakes/results; evolution; victory/defeat; inventory, journal, targeting, equipment, travel, rewards and interface actions have cues. Creature voices use adapted fantasy recordings, not official Pokémon cries.
- Capture and evolution share timing constants with their visual effects. Important results briefly lower background sound.

Try the regional mixes and individual cues at `/sound-studio.html`, linked from in-game credits.

## Sources and rebuilding

All 78 shipped recordings are listed with source URLs, creators, licenses, durations, sizes and SHA-256 hashes in `ASSET_MANIFEST.json`. Public credits are at `/legal/AUDIO_CREDITS.txt`. Original download hashes and selected archive members are pinned in `scripts/data/audio-sources.json`.

Music: RandomMind and troubadour. Nature: Thimras, LokiF, RandomMind, AntumDeluge and Kresiek The Furry. Effects: Kenney, rubberduck, artisticdude, bart, Fantozzi/qubodup and Peludo/RNAn. See the credits file for exact source pages.

Run `python3 scripts/acquire-audio.py` with ffmpeg, ffprobe and bsdtar installed. The script verifies source hashes, normalizes levels, trims effect leading silence, crossfades ambient loop seams, limits peaks, and encodes MP3. Original sources are cached under ignored `evidence/audio-sources/`. No runtime calls to asset providers, paid assets, new server services or subscriptions are required.

## Runtime limits

`audio.ts` directs gameplay cues; `audio/` separates source selection, buffered samples, streamed music, mixing and environmental placement. Shared geography and combat data are reused rather than duplicated.

- At most two streamed music decks; long tracks are not decoded into the sample cache.
- Four concurrent sample requests, at most 24 pending, bounded retries and failure backoff.
- 24 MiB LRU decoded sample cache. Playing sources may retain buffers beyond that cache budget until they end.
- At most 24 one-shot voices, eight desired ambient layers and ten ambient voices including retiring layers.
- Distant sounds are rejected before downloading. Late effects are dropped rather than played out of sync. Variant selection avoids immediate repeats.
- Mute/tab changes stop short effects, cancel delayed presentation sounds and suspend Web Audio. Music preserves its current playback position. Disconnect cancels presentation cues and returns to the town/menu mix.
- Async generation checks prevent replaced music or disposed sample loads from becoming active. Downloads have timeouts. Audio failures remain nonblocking for gameplay.

## Audit and validation

The code audit covers unused imports/settings/assets, reuse, async errors, duplicate cues, bounded downloads/voices, asset licenses, local URLs, and cleanup after mute, disconnect and disposal. No database queries or multiplayer authority changes were added.

Automated tests cover volume migration, spatial attenuation, terrain/weather selection, catalog completeness, cache limits and request deduplication, retry/backoff, disposal during decoding, stale sample deadlines, voice limits, obsolete ambience, rapid music transitions, preservation of playback position, load timeout, node creation failure, and delayed capture cancellation. Browser checks exercise the real audio engine, gameplay footsteps, settings, region/combat transitions, mute/resume and failed downloads. Signal checks verify every packaged file decodes and is non-silent with headroom.

Technical validation does not substitute for listening on the player's speakers or headphones. The studio allows direct comparison and the separate volume controls allow personal balancing.
