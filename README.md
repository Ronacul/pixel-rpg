# Pixel RPG ⚔️

A minimal 2D retro RPG engine with a unified common interface for both phone and computer. Hosted live via GitHub Pages.

**🎮 Play Link:** [https://ronacul.github.io/pixel-rpg/](https://ronacul.github.io/pixel-rpg/)

---

## 🕹️ Single Common Interface (Phone & Computer)

There are no separate modes or split layouts—both phone and computer use the exact same streamlined interface:

1. **Map Focus:** The screen is centered entirely on the 10×10 dungeon map.
2. **Tap / Click to Move:** Tap or click any open tile on the map; the hero automatically pathfinds around stone pillars and walks there.
3. **Interact / Attack:** Tap or walk into the **Rat (R)** to attack using the d20 combat system, or tap the **Chest (C)** to loot and equip gear.
4. **Character Sheet Popup:** Tap or click the **`❤️ HP | 👤 Sheet`** chip in the top bar to pop up your character stats and equipment. Tap outside to close.
5. **Single-Line Message Bar:** The bottom of the screen displays a single clean status line showing the latest combat roll or loot update.
6. **Deterministic Seed (Top Left):** Displays the active seed (`🌱 XXXX-XXXX`) with a `🎲` button to roll a new run. Every seed deterministically generates map obstacles, monster variants, rolls, and loot drops.

---

## 📚 Engine Architecture & Design Docs

- [Master Plan (Phases 1-4)](file:///C:/Users/The%20One/.gemini/antigravity/scratch/pixel-rpg/MASTER_PLAN.md): Core attributes, derived mechanics, modular registry, and monster behavior.
- [System Modification Maps](file:///C:/Users/The%20One/.gemini/antigravity/scratch/pixel-rpg/SYSTEM_MODIFICATIONS.md): d20 combat formulas, perception radar scan matrix, and seed PRNG specs.
