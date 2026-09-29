# Combat mechanics review

Scope: hero combat, enemy attacks, character presentation, and a dash for every class. World layout and story content are unchanged.

## Behavior

- Heroes have server-owned windup, release, and impact stages. Melee hits resolve during the swing; Firebolt travels after release. Meteor and Frost Nova damage enemies around the release location. Passive Pokémon are excluded from collateral damage.
- Movement interrupts Firebolt and Meteor before release. Stuns, guard, and dash interrupt unfinished attacks. Released spells continue travelling. Interrupted casts use a short retry delay. Death and sanctuary entry clear pending attacks.
- Space dashes in the facing/movement direction for every class, with a 4.2-second cooldown and a 190ms dodge window. Alt jumps. The server sweeps dash movement in small steps against existing world and creature collision, and preserves arena boundaries.
- Enemy kits include fast claws, wider heavy cleaves, committed rushes, aimed ranged bolts, and boss cones, lines, and ground impacts. Aimed directions are fixed at windup. Monsters close distance faster and alternate attack cadence.
- Shared snapshots drive the cast bar, charging runes, character actions, cooldowns, and attack footprints. Damage numbers and hit reactions follow confirmed server impacts.

## Audit checks

- Reused existing animation mixer, class weapons/clips, effect materials/pool, collision helpers, command validation, serialized room operations, and durable request receipts.
- Kept timing definitions free of runtime data dependencies after tests exposed an import cycle. Shared geometry is used for hit checks and matching ground footprints.
- Attack targets, line of sight, sanctuary rules, duel opponents, health, and cooldowns remain server validated. Dash directions reject nonfinite or out-of-range inputs and are normalized server-side.
- Pending actions are transient room state. No new persistence, recovery, or lease machinery. No new database endpoints or queries; accepted commands reuse existing receipt transactions.
- Charging meshes and attack markers release their resources on cancellation, player departure, and scene disposal. Existing effect limits remain enforced.
- TypeScript unused-symbol checks, unit/database tests, network playthroughs, browser checks, and Prettier are required for this pass. Results are in `evidence/combat-rework-*`.

## Limits

The dash uses the existing authored jump-start pose rather than a dedicated roll animation. Combat sound still uses the existing synthesized effects. Further animation and sound asset work would improve polish; this pass concentrates on authoritative mechanics and readable timing.

## Verification results

- 81 unit and database checks pass, including cast interruption, projectile travel boundaries, directional attack geometry, dash collision, command input validation, and existing persistence/economy regressions.
- `npm run test:combat` passes 10 live-network checks. These include all four classes' dashes, cooldown rejection, dodging while still inside a claw's footprint, guard damage (2 versus 6), Shield Strike interrupting an enemy windup, movement/dash cancellation, and Firebolt damage arriving after release and travel.
- Five browser scenarios pass: cast bar/cancellation/dash, knight combat, movement and jumping, held melee swings, and Frost Nova/Meteor visuals. The two new scenarios were rerun after dash prediction; knight combat was rerun after the final effect and animation adjustments.
- Screenshots were reviewed. Guard opacity was reduced so the hero remains readable; enemy footprints gained thin boundaries and lighter fills. Enemy facing now stays aligned with its committed attack direction, and attack/charge animation duration follows its windup.
- TypeScript passes with unused-local and unused-parameter checks. Prettier passes for every changed source, test, and document.
