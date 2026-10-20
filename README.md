# Pixel RPG ⚔️

A modular 2D retro RPG engine featuring procedural dungeons (50 (**Tiny, default**) / 100 / 150 / 200 tiles square), 25 dungeon floors across 5 regional schemas, perception fog of war, secret doors, surprise advantage mechanics, 8 classes and 6 races.

**🎮 Play Live:** [https://ronacul.github.io/pixel-rpg/](https://ronacul.github.io/pixel-rpg/)

---

## 🗺️ Dungeon Mechanics & 25-Floor Progression

1. **Configurable Procedural Grid per Level:**
   * Map size is chosen in the **⚙️ Menu** screen (applies to the next run): **50x50 (Tiny, default)**, 100x100, 150x150 or 200x200.
   * Floors are generated on demand into zero-garbage-collection `Uint8Array` buffers (2,500 tiles at the default size, 22,500 at 150x150). Room count scales with map area.
   * Viewport camera culling renders only the visible window (11x11 / 17x17 / 25x25 tiles), so rendering cost is independent of map size.
2. **5 Regional Fantasy Schemas across 25 Floors:**
   * **Floors 1 – 5: Castle Dungeons & Crypts** (Classic masonry, oak doors, iron grates, Rats, Bats, Goblin Scouts).
   * **Floors 6 – 10: Sunken Caverns & Grottoes** (Limestone tunnels, puddles, Cave Crawlers, Slimes, Troglodytes).
   * **Floors 11 – 15: Overgrown Forest Catacombs** (Ancient tree roots, mossy stone, Thorn Stalkers, Entling Guards).
   * **Floors 16 – 20: Dwarven Deep Forges** (Monumental granite pillars, magma ducts, Forge Golems, Magma Hounds).
   * **Floors 21 – 25: Abyssal Sanctum of the Void** (Obsidian architecture, eldritch energy, Void Wraiths, Abyssal Overlords).
3. **Bi-Directional Stairwells:**
   * **Stairs Down (`🪜`):** Delve deeper into the next floor ($N+1$).
   * **Stairs Up (`⛺`):** Return to previously cleared and cached floors ($N-1$).
4. **Perception Fog of War:**
   * Three visibility states: Unexplored Pitch Black, Explored Memory (dim gray), and Currently Visible (actively lit).
   * Sight radius scales dynamically with the Perception score: $\text{PER} = \lfloor(\text{DEX} + \text{INT} + \text{WIS}) / 3\rfloor$ (plus skill, feat, race and set bonuses).
5. **Walls, Doors & Secret Doors:**
   * **Closed Doors (`🚪`):** Block movement and line-of-sight. Tap to breach open.
   * **Secret Doors:** Render identically to solid stone walls until detected by a passive Perception check or stepping adjacent. Once detected, they reveal as doorways!
6. **Surprise Advantage Mechanics:**
   * Breaching closed doors or striking unaware monsters from blindspots triggers a **Surprise Attack**:
     * **Advantage:** Roll $2\text{d}20$ and take the highest roll!
     * **Denied DEX:** The surprised monster loses their DEX bonus to AC for that strike ($AC = 10$).
7. **Locked Doors, Keys & Searching:**
   * Each floor has 1-2 **locked doors (`🔒`)** guarding optional vaults with bonus chests. A door is only ever locked when the stairs stay reachable without it.
   * The matching **key (`🗝️`)** lies elsewhere on the floor; the first is usually in plain sight, others are **hidden until you Search**.
   * **Search (🔎 button or `E`)** spends a turn to reveal secret doors, traps and hidden keys within a radius that grows with Perception.
8. **Single Common Interface & Tile Query:**
   * **Tap/Click on map:** Bounded A* pathfinds and steps hero around obstacles.
   * **Pinch** (phone) or **mouse wheel** zooms between 7 and 33 tiles across; **drag the map** to pan, and any move recentres on the hero. The Zoom button / `Z` cycles levels.
   * **Long-press / Right-click:** Queries any tile, door, monster, chest, or stairs for detailed lore and stats.
   * **Character Sheet Popup:** Tap the top HP chip (or **Gear**) to view attributes, Perception, feats and equipped items. **Tap any equipment slot** to pop up every owned item that fits it (rings fit either ring slot).

---

## 🎭 Classes, Races & Progression

* **Classes:** Warrior, Wizard, Thief, Cleric, Ranger, Bard, Monk, Druid (Paladin, Ninja, Gladiator and Necromancer sub-classes are planned; the registry already has room for them).
* **Races:** Human, Elf, Dwarf, Halfling, Gnome, Half-Elf, each with attribute modifiers and a trait.
* Pick class, race and map size in **⚙️ Menu**, then start a new run.
* **Level-up rules** (all configurable in [`src/data/Progression.js`](src/data/Progression.js)):
  * HP every level (class hit die + CON modifier, plus race bonus)
  * 1 skill rank every level
  * 1 attribute point every 4 levels (4, 8, 12, 16, 20)
  * 1 feat every 3 levels starting at level 2 (2, 5, 8, 11, ...)
  * 1 heroic mastery every 5 levels (5, 10, 15, 20)
* The XP curve is tuned in the same file (`PROGRESSION.xp`, `XP_REWARDS`).

---

## 🧪 Test Mode & Debug Tools (for speed-testing)

| How | What |
| :--- | :--- |
| `?seed=TEST-0001` (any seed starting with `TEST`) | Generates a fixed **kitchen-sink floor**: spawn room, a spine corridor with 14 feature rooms (closed/open/secret doors, chests incl. secret, altar, traps, pit, rubble, foliage, pillars, barrels, mushrooms, corpses, every monster of all 5 biomes, stairs down) and an east **vault** holding one chest per catalogued item (every equipment slot, both ring slots, flasks, set pieces). |
| `?debug=1` or ⚙️ Menu → *Enable debug / test tools* | Shows the debug panel in the Menu: jump to any floor, +levels / XP, full heal, god mode, rations, one item per slot, reveal map, teleport to stairs, remove visible foes. |
| `?map=50\|100\|150\|200` `?class=monk` `?race=elf` `?floor=12` `?level=10` | Start directly in a configuration. |
| Browser console: `pixelDebug.state()` | JSON snapshot (map size, tile counts, stairs, stats, equipment, bag). Also `startRun(seed, {mapSize, classId, raceId})`, `reachableStairsDown()`, `pathBench()`, `jumpToFloor(n)`, `setLevel(n)`. |

Run locally with `./serve.ps1` (Windows PowerShell, http://localhost:8080) or any static file server pointed at the repo root.

---

## 📚 Engine Architecture & Design Docs

- [Architectural Bounds & Performance Plan](docs/ARCHITECTURE_BOUNDS.md): Memory budgets, camera culling, and 25-slot layout.
- [Master Plan (Phases 1-5)](MASTER_PLAN.md): Core attributes, modular registry, monster behavior, tooling, and what is done vs open.
- [System Modification Maps](SYSTEM_MODIFICATIONS.md): d20 combat formulas, perception radar, progression, and seed PRNG specs.

---

## 🕹️ Controls (phone-first)

* **Two big buttons:** **Attack** (equipped weapon: blade, bow, wand, fists...) and **Power** (your selected class feat or spell; ⟳ cycles it, or set it with *Make Main* in Menu → Spells & Feats). Both **auto-target** the foe you last tapped or attacked, otherwise the closest visible one, and close in when the target is out of range.
* **Search / Gear / Rest / Menu** sit under them. The Menu has tabs: **Actions** (spells, manual aim, wait, zoom, d-pad, character), **New Run** (map size, class, race) and **Debug** (when enabled).
* **Foes** show a health bar over their tile, and the selected foe has a red ring plus an HP panel under the map.
* **Traps:** Search (`E`) or Perception reveals them. A revealed trap is never walked into: tap or bump it to **disarm** (d20 + DEX mod + level/2, +4 Thief, vs DC 10 + floor/2; failing by 5+ sets it off). Auto-walk routes around known traps and lingering fire / gas. Traps cannot kill outright.
* Keys: `Q`/Tab attack · Enter power · `E` search · `R` rest · `F` spells · `T` manual aim · `Z` zoom · `C` gear · Space wait.
