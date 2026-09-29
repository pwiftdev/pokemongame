# Build plan

1. Establish pinned stack, shared contracts, PostgreSQL persistence and art direction.
2. Build real Colyseus server, authored Babylon island, interface in isolated workstreams.
3. Integrate full exploration → battle → tame → team → quest → purchase loop, PvP and boss.
4. Verify migrations, persistence, security, concurrency, two browsers and 16-client capacity.
5. Refine visuals and interactions, audit code, run Prettier, document evidence and remaining gaps.

## Progress

- Read complete brief; repository contains only the brief. Node 26 and local PostgreSQL available; no Docker.
- Selected Babylon 9, compatible Colyseus 0.16 server/client, TypeScript/Vite, PostgreSQL.
- Official Babylon/Colyseus documentation inspected; Quaternius Ultimate Monsters and Kenney Nature Kit CC0 pages checked.

- Built and integrated actual PostgreSQL/Colyseus authority, Babylon world, skeletal local assets, all gameplay catalogs and UI.
- Upgraded to current compatible Colyseus0.18 after detecting a patched dependency incompatibility; final npm audit0 vulnerabilities.
- Passed real two-client combat/economy/PvP,150ms latency, hard process restarts, reconnection fencing and disconnect-forfeit checks.
- Passed 38 unit/database/camera tests and five production browser tests. All12 species/boss/mainquest chain tested with explicit integration fixtures.
- Completed two600-second16-client activity runs; final mean tick0.255ms, p950.886ms, max22.177ms.
- Measured actual Apple M4 Metal1080p60FPS and documented separate software-renderer limitations.
- Final review found and fixed forest canopy camera occlusion. Packaged browser walkthrough and camera regression tests pass. Additional fresh-profile progression journey complements leveled content coverage; human pacing remains an explicitly unmeasured estimate.

- A fresh two-player run exposed a short required story route. Added authored 20-victory and 10-capture midgame quests; updated model estimates ~53 minutes under stated assumptions, and the expanded normal-account route passed 11/11 checks in 9.91 automated minutes (22 victories, 10 captures and all 13 main-chain quests per player).
- Verified full-room rejection and automatic overflow using 17 real network clients.

- Final packaged build passes 38 tests and five browser cases. Expanded fresh progression, camera-follow/occlusion, actual defeat/free healing, and persistence all verified. First-time human pacing is the remaining external validation; no public hosting or commits performed.
