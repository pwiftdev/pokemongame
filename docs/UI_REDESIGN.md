# World of Pokémon interface redesign

The interface follows the supplied navy, yellow and red references, with an MMO layout that keeps the middle of the screen open. The title screen uses a locally served pixel font and an original SVG globe. Body text uses system fonts.

The upper left holds location and the tracked quest. The upper right holds the island code, online count, wallet, settings and minimap. The lower left groups trainer health, companion health, orders, moves and team switching. Hero abilities, dash and capture stay together at the bottom. The menu dock moves below the minimap when there is less horizontal space.

Team, Pokédex, inventory, quests and map share one navigation helper in both the HUD and open menus. Active menus are marked, shortcuts remain visible, and dialogs retain the existing focus handling and movement lock. Larger interface scales use compact layouts. Phones still show the existing keyboard-and-mouse requirement; this is a desktop game.

## Implementation and performance

`ui/hud.ts` owns the HUD shell, and `ui/navigation.ts` owns shared menu metadata and the globe. `interface.css` owns the new theme and layout; replaced rules were removed from `style.css`. Existing action slots, cooldown displays, portraits, panel content and command handlers are reused.

There are no new runtime dependencies, network endpoints, database changes or state machines. The font is bundled with its SIL Open Font License and recorded in the asset manifest. Overlays no longer blur the live 3D scene. The location label now reuses `updateMarkup`, avoiding repeated DOM replacement when the location is unchanged. These changes reduce UI work; no separate FPS improvement is claimed for the redesign.

## Verification and audit

The browser layout test checks dock bounds and overlap at 1920×1080, 1440×900, 1280×720, 1024×768 and 800×600, including 125% scaling at 1280×720 and 800×600. It also opens, switches and closes real menus at every size. Screenshots are saved under the ignored `evidence/ui-layout-*.png` paths.

The audit covers unused imports and code, shared helpers, duplicate style rules, UI update costs, escaping and existing server authority. Generated navigation contains only fixed catalog values; player and location text remains escaped. The redesign preserves HUD stacking isolation, so companion controls cannot appear above a dialog. The asset integrity check now recognizes the font license while continuing to verify every packaged file's hash and size.

The full validation results and live release are recorded in `evidence/ui-release-verification.json` after deployment. Source changes remain uncommitted; deployment uses a snapshot of the workspace through Heroku's Build API.
