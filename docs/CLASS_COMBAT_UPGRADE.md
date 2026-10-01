# Class combat and skillbook

Heroes start with one equipped class skill. Skills unlock automatically at their real adventure level, following the existing highest-companion-level progression. Duel stat normalization does not grant extra skills.

| Class     | Early mobility                           | Later skills                                                         |
| --------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Knight    | Shield Charge at level 2                 | Shield Strike, Bulwark, Challenge, Sweep, Rally, Heroic Throw        |
| Mage      | Blink at level 2                         | Frost Nova, Barrier, Ice Lance, Counterspell, Meteor, Arcane Barrage |
| Rogue     | Vanish at level 2; Shadowstep at level 4 | Venom Blade, Eviscerate, Kick, Evasion, Ambush, Fan of Knives        |
| Barbarian | Charge at level 2                        | Skullcrusher, Ironhide, Execute, Whirlwind, Blood Rush, Shockwave    |

The skillbook opens with K. Players can equip six distinct unlocked skills, swap their slots, clear slots, restore automatic equipment, select one or two rows, hide names, and change ability key bindings in Settings. Loadout and layout save in the existing profile JSON. Key bindings remain browser preferences. Custom bars stay under the player's control when new skills unlock; the level-up banner directs them to the skillbook.

## Combat behavior

- Blink travels up to 9 metres along the facing direction. Charge and Shadowstep stop near a valid enemy. All three check terrain, obstacles and arranged-arena boundaries on the server.
- Charges move over time, cancel on stun or defeat, and only strike if the target remains within melee reach. Successful mobility attacks continue automatic melee swings. Class mobility does not grant the universal dodge's invulnerability.
- Vanish lasts 8 seconds, clears outgoing casts and auto attacks, pauses the companion, removes the Rogue's creature threat, and omits hero and companion from other players' snapshots, including initial joins. Other players' threat remains intact. Attacking, ordering companion attacks, or taking damage reveals the Rogue. Existing poison/burn ticks can reveal them in duels.
- Cooldowns are keyed by ability, so slot swaps cannot refresh them. Changes to equipped skills are rejected during encounters and duels.
- Effects use the existing bounded effect pool and shared materials: mobility wakes, smoke, class-colored weapon trails, orbiting evasion, healing motes, spectral swords, converging arcane motes, and radial knives/shockwaves. Existing fire, frost, meteor, shield and impact presentation remains integrated. New skills use the existing sound catalog.

## Audit

Reviewed command validation, profile migration, target ownership, unlock enforcement, replay receipts, stale-session checks after profile writes, collision, duel cleanup, stealth visibility, damage/companion interactions, and resource/cooldown behavior. No new endpoints, database tables, recurring jobs, paid assets, or infrastructure services are introduced.

Reused profile transactions, combat hit tables, training targets, aura handling, movement collision, action-slot rendering, icons, materials, effect lifetimes, audio cues, and browser/network fixtures. Removed an unused class import. Snapshot filtering is shared by the initial visibility rules and periodic delivery; saved loadouts use the same validator on commands and profiles.

The browser review caught an inherited absolute-positioned icon style covering skillbook buttons. The skillbook now explicitly sizes and positions its icons. Multiplayer testing caught sanctuary combat clearing during training charges; mobility targets participate in sanctuary checks and charge completion starts melee normally.

Validation covers progression and malformed loadouts, migration, swaps, terrain and arena limits, threat retention, charge interruption/defeat/moving targets, multiple real clients, stealth expiry and initial joins, duel targeting, cooldowns, persistence, actual browser controls, and rendered skill effects. Existing combat regression fixtures equip named skills at the appropriate levels and use training targets for longer combos.

Deploy the working tree using Heroku's Sources/Builds API. No Git commit is required. Existing Basic web dyno and database plan stay unchanged.

## Verification results

- 249 unit tests across 40 files passed.
- 10 class-progression/mobility multiplayer checks and 12 existing combat-system checks passed against isolated PostgreSQL schemas and real Colyseus clients.
- 10 browser scenarios passed, including all four classes' advanced effects, keyboard combat, skillbook persistence, key rebinding, and compact layout. The two affected UI flows passed again after final styling changes.
- Production build, strict unused-import/local/parameter checks, direct Prettier checks, and Git whitespace checks passed.
- Local spell review recorded about 57 FPS and 21.5 ms p95 frame time while other verification processes were running, with no browser errors. This is a local observation, not a performance guarantee for other hardware.
