# Duels, practice and repeatable expeditions

The gameplay loop now connects preparation, practice, exploration, collection,
combat, rewards and friendly competition. This pass improves those existing
systems rather than adding a separate progression currency.

## Play

- Open the explorer list using the online-player button. Challenge another healthy,
  peaceful trainer within 20m and clear line of sight, anywhere on the island.
  They must accept. Direct duels keep both trainers at their current positions and
  allow normal world movement. Health and class abilities normalize to level 10;
  companions rest. Adventure health is preserved. Surrender, defeat, timeout and
  disconnect use the existing match-result path.
- Sunstone Arena remains the home of arranged matches. Its queue places players on
  opposite starting marks. The fighting circle, center crest, colored marks,
  spectator benches, flags and open entrances make the space readable.
- Three wooden training targets stand east of the arena at (35, -25), (40, -25)
  and (45, -25). Select one and use class abilities, T for automatic attacks, or
  companion commands. The middle target starts at 20% health for execute practice.
  Targets never retaliate, cannot be captured and award no XP, currency or loot.
- The target panel shows personal damage, DPS, hit count, strongest hit and attack
  variety. A new target or ten seconds without hits starts a new session. Stop &
  reset stops your practice actions and removes your ongoing target effects.
  Targets recover after ten seconds without damage. These are session statistics,
  not saved rankings or a claim of comparable DPS across levels/classes.
- Fifteen repeatable expeditions appear in the quest journal: seven monster
  patrols unlocked after the story capture, and eight collection expeditions
  unlocked by their regional field study. Accept and turn in at the Hearthwick
  board. Patrols use two to four targets based on camp population; collection
  trips require three distinct species. Every run starts with fresh objectives.
  Rewards grant PD and active-companion XP using the existing economy.

## Design decisions

The most useful improvements for a small game are clear short-session goals,
reasons to revisit different regions, visible build progress, safe experimentation
and easy play with friends. Practice gives immediate feedback; patrols provide
combat objectives; collection expeditions encourage varied catches; existing
move/evolution goals turn rewards into team development; voluntary duels let
players try their classes against friends. Contracts have no login streak or
forced daily waiting period.

Large guild systems, ranked seasons, raids and a player market would need more
content and players to support them. They are future work, not features delivered
by this pass. Long-term balance and how enjoyable the loop remains need real
playtesting; automated tests cannot establish that a game is perfect.

## Implementation and audit

Reuses the existing duel system, combat calculations, casts, auto-attacks,
companion AI, aura handling, quest events, transactions, command schemas,
nameplates and UI styles. Training targets use a dedicated lightweight 3D wooden
model built with scene geometry; arena furniture reuses local licensed assets.
No new download, dependency, paid service, database table or API endpoint.

Direct-duel range and line of sight are checked when inviting and accepting.
Invites recheck player identity after persistence acknowledgement. Stale/dead/busy
queue members are removed without consuming an eligible waiting opponent. Pending
invitations do not make players immune to wild attacks; hostile contact cancels
the invitation. Active duels retain consent and opponent-only combat rules.

Sanctuary exceptions apply only to training targets. Area damage still cannot hit
ordinary sanctuary creatures. Dummies bypass combat AI, defeat, capture and reward
paths. Their health and statistics are server-owned. Session statistics are bounded
and damage is attributed separately to each player. Resetting one player's practice
does not clear another player's effects.

Repeatable rewards use the existing serialized profile transaction and request-ID
replay protection. Ledger references include the completed-run number. Acceptance,
progress and unique-species stamps clear only after a successful reward operation;
completed-run counts remain. Objective stamping stops at the goal, bounding profile
growth per run. One-time quests keep their existing claim behavior. No new recovery
or lease state machine was introduced.

Reviewed unused imports/code, helper reuse, transient resource disposal, bounded
state, authority, error handling, escaping and query behavior. Existing TypeScript
and Prettier checks remain required. Browser and network tests exercise actual
multiplayer, training, expedition claims and repeated acceptance; unit tests cover
validation and failure boundaries. Evidence logs and screenshots are in `evidence/`.

Validation: 231 unit/integration tests passed; six distinct browser flows passed
(the practice route was corrected after an initial attempt crossed the pond).
The live two-player script verified world movement and combat, preserved adventure
health, surrender, arranged arena matches, hero/companion practice, no practice
rewards, target recovery and capture rejection. Strict unused-symbol TypeScript,
Prettier and production build checks passed. The build retains its existing
large-bundle warning. The marshal stands outside the ring, and vegetation placement
excludes both the fighting circle and target approaches.
