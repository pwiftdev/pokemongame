# A Pokémon adventure in a shared RPG world

The central promise: choose a partner, discover wild Pokémon, build a team, and overcome challenges together. Trainer classes provide different ways to help that team. Equipment supports the journey; finding and raising Pokémon gives the journey its purpose.

## What the game already has

Keep and surface the existing Pokémon systems: species-specific models, wild behavior, types, learned moves, natures, evolution, a three-Pokémon team, quick swapping, companion commands, habitat encounters, and Pokédex rewards. The issue is their prominence and introduction, not simply the number of features.

The current opening introduces class customization before a starter, then sends the player through travel, a monster camp, and a retrieval quest before the capture lesson. Guest accounts cannot catch Pokémon. The first combat dialogue also previously described the weapon as doing the fighting and the Pokémon as assistance.

## Opening changes implemented

- Show Bulbasaur, Charmander, and Squirtle on the title screen using existing starter data and portraits. Explain training, evolution, and battling together before sign-in.
- Present character creation as creating a trainer. Make the next step, meeting a first Pokémon, explicit.
- Explain that any trainer class can choose any Pokémon. Introduce attack, recall, and Pokémon move controls at selection and in the first combat lesson.
- Name the Pokémon action bar explicitly. Keep guest restrictions visible without leading the introduction with token conversion.

These changes do not change progression, balance, wallet access, or the simple loading screen.

## Proposed next passes, in order

1. **Let players experience the Pokémon loop immediately.** For new accounts, let players choose their starter before their trainer class, then preview the pair together. Aim for starter → command a move → observe a wild Pokémon → use bait and catch → choose a teammate within the first short session. Move a gentle capture lesson ahead of the monster camp. Consider allowing one guided guest capture before wallet connection; this needs a deliberate change to the server's guest restrictions. Preserve existing quest completion and saves when changing the sequence.
2. **Make joint combat decisions matter.** Surface type effectiveness and the active Pokémon's moves next to targeting. Use existing switching and move systems first. Then add a small, tested set of trainer–Pokémon combinations: a knight protects a charging partner, a rogue sets up a safe capture, a mage prepares an elemental opening, a barbarian draws danger away. Every class should work with every species; avoid mandatory pairings. Measure whether commanding a Pokémon changes the encounter, rather than only adding visual effects.
3. **Make Pokémon growth the main reward.** Highlight newly learned moves, evolution readiness, discoveries, and useful additions to the team. Gear remains useful, but opening quest rewards should teach or advance the partner's journey. Reuse existing evolution requirements, move progression, and Pokédex milestones before adding currencies or another progression system.
4. **Give partners a role outside combat.** Build a small set of optional field interactions around Pokémon: investigate tracks, reveal a hidden item, illuminate a cave, or clear an alternate path. Use these for discovery and personality. Keep the main route accessible regardless of starter or class, and make interactions meaningful instead of repeatedly pressing a button for a reward.
5. **Make multiplayer about teams of trainers and Pokémon.** Start with cooperative habitat rescue or boss objectives where players and their partners perform clear complementary jobs. Reuse shared combat and reward handling. Add encounter variety before creating another queue, daily grind, or standalone reward system.

## How to judge the result

A new player should be able to name their partner, command a move, explain how to find another Pokémon, and know what their team is working toward. Observe when players first use a Pokémon move, complete a catch, swap a teammate, and pursue evolution. Set balance targets after playtesting; do not assume that a fixed damage percentage alone makes the game feel more like Pokémon.
