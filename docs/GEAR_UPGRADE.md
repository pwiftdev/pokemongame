# Equipment and collectibles

Open **Gear with I**, or use the Gear tab in any adventure menu. Mira's Field Supply sells equipment alongside existing supplies. Buying requires a connected wallet, matching the rest of the shop; guests can browse, try on, and equip gear they already own. Buying adds permanent ownership; equipping is a separate action. Try-on previews never change saved equipment.

## Progression

- Six slots: weapon, chest, shoulders, head, boots, and a cosmetic back collectible.
- Five tiers at hero levels 1, 4, 8, 12, and 16: Wayfarer, Wildwood, Azureguard, Emberforged, and Astral.
- Each class has its own weapon at every tier. Armor works across classes. The catalog contains 44 items, including four collectibles.
- Weapons add 4 / 8 / 14 / 20 / 28 power to hero abilities and automatic attacks in PvE. Companion attacks retain their own stats.
- A complete armor tier adds 48 / 96 / 144 / 192 / 240 maximum health and 5 / 10 / 15 / 20 / 25 percent damage reduction against wild enemies. The shared mitigation helper caps reduction at 40 percent for future additions.
- Weapon prices are 80 / 220 / 500 / 900 / 1500 PD. Chest armor costs 90 percent of its tier's weapon price; each other armor part costs 55 percent.
- Boss contributors receive an unowned piece from their highest usable tier, while pieces remain in that tier. Elites have a deterministic 25 percent drop chance. Encounter receipts protect rewards against replay. Full-tier owners receive the existing currency and experience rewards.
- Traveler's Banner and Grovekeeper's Sigil are purchased cosmetics. Vanguard's Standard requires 25 creature defeats; Warden's Halo requires three world-boss defeats. These achievements use existing cumulative progress, so returning players receive credit.

## Appearance and interface

Equipment uses the existing rigged character and weapon models, with tier colors, weapon runes, armor trim, crowns, and back adornments attached to their bones. Equipped items replicate to nearby players. Existing weapon grips are preserved. Character customization remains the base appearance when a slot is empty.

The equipment panel includes a rotating character preview, ownership and level requirements, rarity colors, stat comparisons, and collectible progress. Desktop catalogs scroll independently from the character column. Small screens use a single column. Preview materials finish loading before the character is revealed; text-only refreshes retain the loaded preview and panel scroll positions.

The character creator and equipment preview share their scene setup. Additional materials and geometry are owned by each avatar and disposed with it. No new downloaded assets or external services are required.

## Persistence and safeguards

Equipment is stored in the existing profile JSON. There is no schema migration or hosting-plan change. Older profiles retain their original stats and appearance until they acquire gear.

The server validates item identity, level, class, ownership, slot, shop distance, and encounter state. Prices and bonuses come from the shared catalog. Purchases, debits, and ownership changes use the existing row-locked transaction and request receipts. Items cannot be sold or traded in this pass.

Changing equipment never heals or revives a hero. Removing maximum-health gear clamps current health. Buying, claiming, and equipping are blocked during combat and duels. Friendly duels retain normalized health and damage; equipment remains visible without affecting duel balance.

## Verification

- Unit suite covers catalog progression, class and level locks, ownership, forged commands, purchase failures, duplicate claims, migration, stat changes, no-healing swaps, encounter drops, and mitigation.
- `npx tsx scripts/gear-test.ts` runs against the local server and database: purchases and replay, peer replication, reconnects, duel normalization, combat and location restrictions, real training-target damage, concurrent purchases, and transaction rollback. It refuses remote servers.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:2567 npx playwright test tests/browser/gear.spec.ts` checks the built client: try-on, buying, equipping, reconnecting, multiplayer appearances, achievements, responsive layouts, repeated preview disposal, and equipment on different races, body types, and classes.
- Character-creation browser regressions cover all races and bodies, saved customization and names, failed asset loads, responsive layouts, and starter-selection handoff.
- Audit checks include strict unused-code TypeScript checks, transaction boundaries, server validation, private ownership data versus public equipped items, model/material ownership, preview reuse, and existing code reuse.
