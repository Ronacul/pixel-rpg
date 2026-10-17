# Pixel RPG ⚔️

A modular 2D retro RPG engine featuring 200×200 procedural dungeons, 25 dungeon floors across 5 regional schemas, perception fog of war, secret doors, and surprise advantage mechanics.

**🎮 Play Live:** [https://ronacul.github.io/pixel-rpg/](https://ronacul.github.io/pixel-rpg/)

---

## 🗺️ 200×200 Dungeon Mechanics & 25-Floor Progression

1. **200×200 Procedural Grid per Level:**
   * 40,000 tiles per floor generated on-demand using zero-garbage-collection `Uint8Array` buffers.
   * Viewport camera culling locks rendering to an $11 \times 11$ viewport centered on the hero, guaranteeing 60 FPS on any mobile device or desktop browser.
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
   * Sight radius scales dynamically with the Perception score: $\text{PER} = \lfloor(\text{DEX} + \text{INT} + \text{WIS}) / 3\rfloor$.
5. **Walls, Doors & Secret Doors:**
   * **Closed Doors (`🚪`):** Block movement and line-of-sight. Tap to breach open.
   * **Secret Doors:** Render identically to solid stone walls until detected by a passive Perception check or stepping adjacent. Once detected, they reveal as doorways!
6. **Surprise Advantage Mechanics:**
   * Breaching closed doors or striking unaware monsters from blindspots triggers a **Surprise Attack**:
     * **Advantage:** Roll $2\text{d}20$ and take the highest roll!
     * **Denied DEX:** The surprised monster loses their DEX bonus to AC for that strike ($AC = 10$).
7. **Single Common Interface & Tile Query:**
   * **Tap/Click on map:** Bounded A* pathfinds and steps hero around obstacles.
   * **Long-press / Right-click:** Queries any tile, door, monster, chest, or stairs for detailed lore and stats.
   * **Character Sheet Popup:** Tap the top HP chip to view all 6 attributes, Perception rating, and equipped items.

---

## 📚 Engine Architecture & Design Docs

- [Architectural Plan Bounds](file:///C:/Users/The%20One/.gemini/antigravity/brain/2a7db4e0-b3f8-4521-adf0-617d25137cc7/plan_bounds_specification.md): Memory budgets, camera culling, and 25-slot layout.
- [Master Plan (Phases 1-4)](file:///C:/Users/The%20One/.gemini/antigravity/scratch/pixel-rpg/MASTER_PLAN.md): Core attributes, modular registry, and monster behavior.
- [System Modification Maps](file:///C:/Users/The%20One/.gemini/antigravity/scratch/pixel-rpg/SYSTEM_MODIFICATIONS.md): d20 combat formulas, perception radar scan matrix, and seed PRNG specs.
