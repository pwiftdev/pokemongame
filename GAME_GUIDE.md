# The Wildlight Isles

Choose a class, then choose Bulbasaur, Charmander or Squirtle. Your character fights with weapons and spells; your Pokémon can help automatically or attack on command.

## Controls

| Action                               | Control                |
| ------------------------------------ | ---------------------- |
| Move / sprint                        | WASD / Shift           |
| Rotate camera                        | Mouse drag or Q / R    |
| Zoom                                 | Mouse wheel            |
| Class abilities                      | 1–6                    |
| Target / cycle targets               | Click, Tab / Shift+Tab |
| Auto attack                          | T or right-click       |
| Clear target                         | Escape                 |
| Send companion                       | G or Attack            |
| Recall companion                     | H or Follow            |
| Automatic companion help             | Assist                 |
| Catch a wild Pokémon                 | F                      |
| Interact                             | E                      |
| Collection / satchel / journal / map | C / B / J / M          |
| Settings / close panel               | Escape                 |

Select a target with Tab, click or its nameplate. Melee abilities, T or right-click start automatic weapon swings; your abilities are woven between swings. Most abilities share a one-second global cooldown; defensive cooldowns and interrupts are off it. Press an ability shortly before it is ready and it fires as soon as it can. See **Combat systems** below for resources, the hit table, threat and enemy spells.

## Classes

Each class has six abilities; the fifth unlocks at level 2 and the sixth at level 3.

- **Knight (Valor):** the defender. Sword Slash builds Valor; so do blows you take and block. Shield Strike interrupts and stuns, Second Wind heals, Bulwark reduces damage, Challenge (level 2) taunts, Crusader Sweep (level 3) hits everything around you. Blocks 25% of attacks and generates double threat.
- **Mage (Mana):** ranged caster. Firebolt and Meteor are cast while standing still; Frost Nova chills; Ice Lance (level 3) deals triple damage to chilled or stunned targets; Counterspell (level 2) interrupts. Mana regenerates quickly a few seconds after your last spell.
- **Rogue (Energy + combo points):** Quick Stab, Venom Blade (poison over time) and Ambush award combo points; Eviscerate (level 2) spends them for a big hit. Kick (level 3) interrupts. Evasion dodges half of all attacks.
- **Barbarian (Rage):** Rage comes from your axe swings and the damage you take, and fades outside combat. Axe Cleave also strikes enemies beside your target, Skullcrusher interrupts and stuns, Execute (level 2) finishes enemies below 25%, Whirlwind (level 3) spins through everything nearby. Critical strikes send you into an Enrage for 20% more damage.

Characters have their own health, separate from the companion collection. Health regenerates on its own a few seconds after combat ends. The Springhouse in Hearthwick restores everything for free. Potions heal; revival seeds or the Springhouse recover a fallen character. Defeat returns you to Hearthwick without taking your collection or currency; the world stays grey until you are healed.

## Companions and monsters

Bulbasaur, Charmander and Squirtle are companions. Assist joins your attacks. Attack sends the deployed companion at a selected enemy within 24m without requiring you to attack. Follow stops its attacks. Move too far from the target and your companion returns.

Quaternius monsters are enemies to defeat for experience and PD. They cannot be captured. Find all three species near the first ranger: Bulbasaur in Clover Hollow, Squirtle at Reedbank Pool, and Charmander at Sunlit Rocks. Green circles on the map show their habitats. Weaken them or use bait before throwing a capsule; prism capsules improve the chance. Pokémon evolve at level six through the Companion Lodge for 90 PD.

Your team holds three Pokémon; additional captures stay at the lodge. Collection changes and evolution require peace, with team arrangement and evolution performed near the lodge. Existing collections retain their progress when converted to Pokémon equivalents.

## The Fading Wards story

Open J after choosing your starter and collect your expedition allowance. Walk to the expedition board in Hearthwick and press E to accept **The silent orchard**. Follow the gold objective marker to Ranger Rowan by the Sunpetal windmill.

The ten-part opening chapter takes you through an orchard rescue, a missing field kit, your first wild Pokémon capture, a forest monster camp, the ward inscriptions, the Tideglass beacon and the shared Stormheart boss. Rowan and Warden Elara give the story context, supplies and companion experience. Accept assignments and return to the named character to finish them. Objectives count after acceptance; each inscription only counts once.

For Rowan’s capture lesson, press H to stop companion attacks, then either weaken a wild Pokémon below 75% health or use Sweetseed bait from B. Select the Pokémon and press F. The first prepared capture during this assignment is guaranteed; later captures use the usual odds. Hostile monsters cannot be caught.

Four optional regional expeditions unlock at the board after your first story catch. Visit their waystones and press E to record the survey, then report back. Stormheart is a shared boss; prepare at the lodge and Springhouse and bring an ally.

Monsters now live in small named camps, with short pursuit distances. Normal camps respawn after at least two minutes, elites after two and a half, and Stormheart after three. Respawning waits while an online player is within 18m of the home. Wild Pokémon are peaceful unless provoked and return after at least one minute once players leave the habitat.

## Regions and travel

| Region              | Suggested levels | Character                                    |
| ------------------- | ---------------- | -------------------------------------------- |
| Hearthwick          | Safe haven       | Capital, supplies, healing, lodge and arena  |
| Sunpetal Meadows    | 1–4              | Green fields, deer and a windmill            |
| Lanternwood         | 4–7              | Dense woodland and ancient roots             |
| Tideglass Reach     | 7–12             | Ruined arches and Stormheart                 |
| Kingsward Vale      | 5–9              | Autumn pastures, horses and southern markets |
| Amberfall Expanse   | 8–12             | Sandstone and a ruined shrine                |
| Moonfen             | 10–14            | Blue woodland and giant mushrooms            |
| Frostveil Highlands | 14–20            | Snowy pines, cliffs and northern ruins       |

Follow the stone roads. Approach a waystone to attune it. Press E at a waystone or M to open the map, then select an attuned destination. Travel requires being near a waystone and out of combat. Waystone camps are protected sanctuaries: enemies cannot follow you inside, and you must leave the camp to attack. The minimap follows your position; the world map shows every region and your unlocked travel points.

Animals are ambient wildlife. They graze and roam but are not selectable enemies.

## Shared adventures

Create an island or enter a friend's room code on the title screen. Up to 16 players share a room. Both players must consent to an arena duel; duel levels are normalized. Boss rewards credit participating players once per encounter.

Accept assignments from the board or named NPCs, complete their objectives and return for rewards. PD is only in-game currency. Purchases, captures, evolution, quests and balances persist in PostgreSQL. Keep the browser's guest token to retain access to your character; public account recovery is not implemented.

Combat controls now support holding **1** for repeated primary attacks and briefly buffering an ability near the end of its cooldown. Movement stops on release, Alt uses takeoff and landing animations, and attacks keep the legs moving while you run.

## Combat controls

Space dashes for every class; Alt jumps. Dash briefly avoids attacks and recharges in 4.2 seconds. Use it sideways against aimed bolts or through a dangerous moment in a melee windup.

## Combat systems

- **Hit table.** Every swing and ability rolls once: miss, dodge, parry, block, critical strike or hit. Enemies above your level are harder to hit. Critical strikes deal double damage (spells 1.6×). Floating numbers show your damage in yellow (weapon swings in white, companion in green), damage to you in red, healing in bright green.
- **Enemy nameplates.** Name, level and health float above nearby creatures. Level colours follow difficulty: grey trivial, green easy, yellow even, orange hard, red deadly. Hostile monsters have red bars; wild Pokémon, which only fight back, have yellow bars. A red "!" marks creatures attacking you. Click a nameplate to target it; right-click to attack it.
- **Enemy attacks.** Creatures swing on a weapon timer and use a special every few seconds. Specials with an amber ground marker (cleaves, charges, aimed bolts) can be avoided by leaving the marked area or dashing. Spells show a cast bar on the nameplate and target frame: a gold bar can be interrupted (Shield Strike, Skullcrusher, Kick, Counterspell or any stun), which also locks the creature out of specials for four seconds. Casters heal themselves and hurl bolts you can break line of sight to; Stormheart channels Stormcall in its second phase.
- **Threat.** Creatures attack whoever has generated the most threat. Knights generate double threat and can Challenge to take the lead instantly; a creature only switches to someone else once they exceed 110% of its current target's threat. The target frame shows your threat and whom the creature is targeting.
- **Leashing.** Creatures pursue only a short distance from home. Beyond it they evade, immune to damage, run home and reset.
- **Catching.** Abilities never start automatic swings against wild Pokémon, and both your swings and your companion stop once a wild Pokémon is below 30% health, so you can throw a capsule.
- **Buffs and debuffs** appear above your frame and on the target frame with remaining time; hover them for details. Hover any action-bar slot for its cost, range, cast time and cooldown. The combat log above your frame lists everything that happened to and from you.

Firebolt and Meteor need a stationary cast. Moving cancels them before release. Frost Nova and melee attacks allow movement. Guard or dash can interrupt an unfinished cast, while released projectiles keep travelling. Frost Nova, Meteor, and Axe Cleave hit nearby enemies. Enemy cones show melee reach, strips show bolts and charges, and circles mark ground impacts.
