# MMO combat systems

This pass replaces cooldown-only fighting with a tab-target MMO combat model: class resources, a global cooldown, automatic weapon swings, a hit table, buffs and debuffs, threat, enemy spellcasting and interrupts, plus the unit frames, nameplates and feedback needed to read it.

## Rules (server-authoritative)

- **Class resources.** Knight Valor and Barbarian Rage start empty, build from dealing and taking damage (blocks add Valor) and decay out of combat. Rogue Energy regenerates 12/s and builders award up to five combo points for finishers. Mage Mana (100 + 10 per level) regenerates slowly while casting and quickly after four seconds without a spell. Costs are refunded if a cast is interrupted.
- **Global cooldown.** Abilities share a one-second GCD with 150 ms of latency tolerance. Defensive cooldowns, taunts and interrupts are off the GCD; instant off-GCD abilities resolve immediately and may be used while casting.
- **Kits.** Six abilities per class (`packages/shared/classes.ts`): slot 5 unlocks at level 2, slot 6 at level 3. New abilities: Challenge (taunt), Crusader Sweep and Whirlwind (area around you), Counterspell and Kick (interrupt and lock out), Ice Lance (shatter), Eviscerate (finisher) and Execute (below 25%).
- **Automatic swings.** Melee abilities, `T` or right-click start weapon swings on a class weapon timer (daggers 1.5 s … great axe 3 s). Swings pause while stunned, dashing, casting a stationary spell or out of reach, and stop when the target dies. Spells do not start melee swings.
- **Hit table.** One roll per attack (`rollOutcome`): miss, dodge, parry, block, critical strike, hit. Level gaps raise miss and dodge. Critical strikes deal ×2 (spells ×1.6), blocks ×0.5, damage varies ±10%. Barbarian critical strikes Enrage (+20% damage for 6 s). Rogue Evasion adds 50% dodge. Knights block 25% of attacks.
- **Auras.** `apps/server/src/auras.ts` keeps a general buff/debuff map. Guard, stun and slow are mirrored into the existing `guardUntil`, `stunUntil` and `slowUntil` fields so older rules (capture chance, movement, duel resets) keep working. Burn and poison tick once per second, credit their source and generate threat.
- **Threat.** Every creature has a threat table. Damage adds threat scaled by class (Knight ×2, Rogue ×0.8); healing adds half its amount to every creature engaged with the healer. The target switches only when someone exceeds 110% of the current target's threat; Challenge forces the target for 3 s and takes the lead.
- **Creature AI.** Creatures swing on their own timer (ranged elements fire bolts from 9 m) and use a special every 5–9 s: heavy cleaves, charges that stop at the target, aimed bolts, and interruptible spells with cast bars — bolts that respect line of sight, and self-heals when wounded. Stormheart adds an interruptible Stormcall in phase two. Interrupts cancel the cast and lock out specials for 4 s; stuns cancel any windup.
- **Leashing.** A creature whose threat table empties evades home immune to damage and resets; a creature that cannot reach home within five seconds snaps back rather than staying immune. Creatures that merely wander are not immune.
- **Regeneration and persistence.** Health regenerates 2.5% per second once combat has lingered out (6 s). Hero health changes in memory and is saved every 1.5 s, on death, on leaving and inside every other profile transaction, instead of one transaction per hit.
- **Capture safety.** Abilities never start swings on wild Pokémon, and swings and companion attacks hold back once a wild Pokémon is below 30%.

## Presentation (client)

- **Unit frames** (`ui/unit-frames.ts`): player frame with health, class-coloured resource bar, combo points, combat flag and buffs; companion frame with orders; target frame with difficulty-coloured level, elite/boss ring, health, enemy cast bar (gold when interruptible), debuffs (yours outlined), target-of-target and your threat.
- **Action bar** (`ui/action-bar.ts`): six class slots plus Dash and Catch with element-tinted icons (`ui/ability-icons.ts`), radial cooldown and GCD sweeps, blue tint without resource, red keybind out of range, level locks, and a pulsing glow when an interrupt, execute, big finisher or shatter is available. Rich tooltips show cost, range, cast time and cooldown.
- **Nameplates and floating combat text** (`render/overlay.ts`): DOM elements projected from 3D each frame, replacing the canvas health bars and damage planes. Nameplates show level, health, cast bars and an aggro marker and are clickable. Floating text distinguishes ability, swing, companion, periodic, incoming, healing, avoided, interrupt, shatter, experience and PD rewards; critical strikes pop larger.
- **Feel.** Local abilities play their animation on key press and roll back if the server rejects them; a 400 ms queue fires a pressed ability as soon as the GCD or cooldown allows. Critical strikes add a 70 ms hitstop and stronger camera shake. Incoming hits flash the screen edge; low health pulses a vignette; defeat greys the world until healed. Auto swings play alternating weapon clips; Whirlwind spins, Challenge shouts, Execute chops. Synthesized audio distinguishes swings, critical strikes, blocks and parries, dodges, interrupts, aggro and shatters.
- **Combat log**, inline red combat errors (instead of toasts), an experience bar and a level-up banner that names newly unlocked abilities.

## Verification

- `npm test`: 98 unit tests, including `tests/combat-rules.test.ts` for the hit table, resources, threat, difficulty colours, aura mirroring and periodic ticks, creature-body sliding and ability eligibility.
- `npm run test:combat-systems`: 11 checks with real clients against an isolated server and schema — Valor gating and generation, Challenge level lock, GCD rejection, swing timers and outcomes, out-of-combat regeneration, starting Mana and Energy, Challenge taunting a creature off a Mage, Frost Nova into Ice Lance shatter, combo points into Eviscerate, Venom Blade ticks, Execute gating and Counterspell interrupting a creature spell with a lockout. Results: `evidence/combat-systems-test.json`.
- `npm run test:combat`, `test:story`, `test:first-session`, `test:network` and the Playwright suite pass. `test:combat` was hardened to distinguish telegraphed specials from automatic swings and to account for avoidance rolls and Valor.
- `test:gameplay` passes its combat, capture and boss checks. Its final quest assertion expects a `coast-path` quest that the earlier story rewrite removed (and claims quests without accepting them), so that check fails independently of combat. The harness no longer walks through creatures to reach a target already in spell range.
- Production bundle on Apple M4 / Metal at 1440×900: town ~60 FPS, p95 17.5 ms; during melee combat 59 FPS, p95 19.4 ms, p99 22.2 ms.

## Remaining limits

- Balance is tuned by hand for the first regions; there is no gear, talent or stat system, so class damage scales only with level.
- There are no groups or party frames; threat and taunts matter whenever several players fight the same creature.
- Creature specials are built from the shared telegraph shapes; creatures do not yet have species-unique abilities.
- Ability icons are original vector glyphs, not painted art.
