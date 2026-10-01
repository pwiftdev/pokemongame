# World of Pokémon UI system

The local `World of Pokemon UI Cheatsheet.html` is the visual source of truth. This pass replaces the mixed fantasy/gold, rounded, and pixel treatments with its navy pixel interface throughout the game. Changes stay local; no deployment or commit is part of this pass.

## Shared foundation

`apps/client/src/theme.css` owns the exact reference palette, type families, borders, bevels, buttons, focus outlines, form fields, and setup steps. `fonts.css` serves the reference's embedded Pixelify Sans, Chakra Petch and Silkscreen files locally. The duplicated Pixelify weights share one variable font file. Font licenses are included under `public/legal/`; there are no runtime Google Fonts or other third-party requests. The reference globe is shared by the title screen and HUD through one SVG.

Surfaces use square corners, two-pixel ink frames and hard inset/drop shadows. Red marks the main action; yellow marks currency, active items, and quest headers; cyan marks focused or selected choices and XP. Health bars use green above 50%, yellow at 20–50%, and red below 20%. Pokémon type and character swatch colors retain their gameplay meanings. Soft shading is confined to the 3D world and screen damage feedback; UI buttons have solid fills and bevels.

## Coverage

- Loading: only POKEMON and a square progress bar during normal loading. Recovery controls appear only for slow or failed loading; real readiness tracking is preserved. All six font faces and the globe are included in startup readiness.
- Landing and setup: larger display lettering, readable forms, consistent primary action, shared adventurer/Pokémon setup steps, cyan starter selection, and a usable narrow-screen landing page.
- Character creation and editing: a fixed-height, non-scrolling creator with a live 3D preview and Heritage, Features, Hair, Style, and Build categories. The continue/save button remains visible. Heritage glyphs, selected swatch checks, and slider values preserve clear feedback. The markup/field helpers live separately from preview lifecycle code. Appearance tabs support arrows, Home and End with roving focus and labelled panels.
- HUD: location, quest tracking, player/pet frames, action and companion bars, currency, navigation, minimap and target information. Existing responsive docks and UI scaling are retained. Cooldowns use a top-down dark sweep and yellow active border; locked slots use recessed surfaces.
- Menus: team, Pokémon details and move editor, Pokédex, inventory, shop, journal, map/travel, arena, ledger, settings, credits, and character studio share the same surfaces and typography. Repeated shop/team actions are secondary rather than multiple competing red buttons.
- Feedback: errors, connection notices, toasts, capture, defeat, level-up, cast/XP/health bars, combat log, wild and player/companion nameplates.
- Linked tools: character studio, sound studio, world tour, model atelier and benchmark use the same theme. Tool-page chrome is shared rather than copied into separate inline HTML styles.

## Audit

Reused existing icons, navigation, portrait catalogs, models, panel routing, input handling, readiness/retry logic, saved profiles, and preview disposal. No new package, server endpoint, database query, schema, or service was introduced. Creator choices still flow through the existing normalization and server validation; user names remain escaped or painted as canvas text.

Removed obsolete class-picker styling, unused map/ascension selectors, old font registration, decorative rounded elite frames and unused glow animation. Removed duplicate overridden declarations from the base/interface stylesheets. Template and swatch helpers reduce the rendering module size. Health state attributes update only on state changes. Font files and the globe are local and cacheable; the loader does not depend on the large game module for its styling.

Reviewed contrast, readable body sizing, focused/selected/disabled states, reduced motion, narrow-screen layouts, clipping, popup bounds and modal focus. Hidden fields and inactive tabs are excluded from the dialog focus loop. Tooltips now follow focus as well as the pointer and are clamped to the viewport. Tab retains its established targeting behavior during gameplay.

Player and companion nameplates are capped at 240 CSS pixels or 24% of the viewport, including distance scaling. Desktop action slots are larger for readable ability names; compact layouts retain their smaller slots.

## Validation

Use `npm run typecheck`, `npm test`, and the browser suites `loading`, `character`, `layout`, `ui`, `design-system`, and relevant combat/audio suites against the locally built server. The design-system suite exercises keyboard appearance categories, preserves edits between tabs, checks menu bounds, and captures screenshots across viewport sizes. Existing character tests cover save/cancel/reconnect and shared player/pet names. Existing loading tests cover slow engine/model downloads, failed-file recovery, and playable entry. Prettier is run directly, not through `npm run format`.

This pass passed the production build, unused-local/import type checks, 209 unit tests, and 19 browser checks. Follow-up character, keyboard/menu, and responsive HUD checks passed after the final refinements. Screenshots were reviewed for the loader, title, creator, starter selection, HUD, collection, settings, and arena.

## Onboarding refinement

Character confirmation explicitly reveals and focuses Pokémon selection and resets the previous screen's scroll position. Back to character preserves the draft and starter choice. Returning profiles seed their existing class and appearance; a character who already has a companion is labelled “Enter the world” instead of promising a second starter. The server remains the authority for granting the first companion.

Removed the obsolete loader artwork, stage rows, expandable asset list, related styles and per-frame DOM work. Reused the existing progress tracker, preview lifecycle, category keyboard navigation and server commands. No dependency, endpoint, database query or persistence change was needed. Browser checks cover stalled/failed loading and retry, overflow in every creator category, and character → Pokémon → back → confirmation with preserved choices.

Compact controls adapt to the creator container's dimensions, including its smaller in-game dialog. The dialog reuses its existing heading and allocates the remaining height to the editor, keeping Save visible. The audit also checked hidden-tab keyboard focus, draft preservation, returning-profile initialization, safe retry behavior, unused loader selectors, and escaped player names.
