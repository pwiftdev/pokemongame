# Mob behavior and presentation

The combat log belongs to the party dock and stays 16 UI pixels above its actual height. It follows responsive widths and UI scaling. Short viewports retain the existing log-hiding rule.

Wild Pokémon and hostile patrols now use persistent, individually timed routines instead of repeatedly choosing synchronized directions. They pause, look around, feed, approach cautiously, or play near members of their own species. Curious Pokémon face visitors and stop before crowding them; skittish ones flee; territorial ones warn before aggression. Destinations are checked for collision and sight, movement slows near arrival, and blocked walkers try nearby headings. Local spacing reduces overlapping creatures. Hostile patrols stay outside sanctuary and within their home area. Combat enemies pursue when an obstacle blocks their attack, even inside normal attack range.

Animation changes reuse the existing model library and mixer. Authored walk, idle, hit, and defeat clips take priority. Procedural fallback clips now include feeding, looking, and alert poses, with separate tail segment phases and wing movement. Static models receive subtle whole-body motion on a node measured in world units, avoiding asset-scale-dependent movement. Individuals start loops at different phases and use slightly different idle timing. Walk/run cadence follows actual rendered travel, stationary creatures stop walking, and turns toward opponents blend. Repeated hit/attack events can restart their reactions; returning nearby actors resume culled animation.

## Audit

- Shared the existing collision, sight, temperament, snapshot, and animation systems. Removed the old hostile wander fields and reused a single peer list per room tick.
- Added small helpers for clip selection, body motion, individual variation, and presentation decisions. Native clips are not duplicated by generated clips; actor disposal owns generated animation groups and their motion node.
- Decisions are throttled to approximately twice per second and destinations persist for several seconds. Existing distant animation culling remains active. No new models, network downloads, dependencies, database tables, endpoints, or paid services.
- Server movement remains authoritative. Existing damage, threat, reward, leash, and capture validation remain in place. Active duels are excluded from ambient player reactions; pending invitations do not give that protection.
- No persistent recovery or lease workflow was introduced.
- This uses local steering, not a navigation mesh. Static models have body motion rather than a newly authored skeletal rig. Existing large client bundle warning remains.

## Validation

Behavior tests cover individual routines, home limits, collision, sanctuary, curious stopping distance, fleeing, warning time, animation priority, speed-dependent gait, stun presentation, and static-model motion at different asset scales. Browser layout checks include seven viewport/scale combinations. The melee helper follows the selected moving creature instead of walking a fixed diagonal. Representative models were visually checked in idle, walk, feed, look, and sleep poses.

Development-origin browser checks exposed an existing local cross-origin matchmaking issue; release verification uses the same-origin production build, matching Heroku.

Release checks passed: 238 unit tests, six browser flows, twelve live combat-system checks, strict TypeScript, Prettier, and the production build. The local 30-Pokémon rendering benchmark reported a 16.8 ms 95th-percentile frame time on both quality presets, with no browser errors; this is a local hardware measurement, not a guarantee for other devices.
