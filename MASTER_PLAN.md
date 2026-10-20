# 🗺️ RPG ENGINE DEVELOPMENT MASTER PLAN

Pixel RPG is a JavaScript (ES modules) browser game served as a static site. Code lives in `src/` (`core`, `data`, `entities`, `map`, `systems`, `main.js`).
Legend: `[x]` done, `[~]` partially done (note says what is left), `[ ]` not started.

## 🧱 PHASE 1: CORE ARCHITECTURE & BASE ATTRIBUTES
- [x] Establish Six Core RPG Attributes in Player Character Model
  - Stats Tracked: STR, DEX, INT, WIS, CON, CHA (`src/entities/Character.js`)
- [x] Configure Base vs. Effective Dynamic Getters
- [x] Hook Constitution (CON) directly into Player Max HP Calculations
- [x] Refactor Equipment System to feed Stat Modifiers into Player Getters
  - Equipment, set bonuses, feats and race all feed the `str/dex/con/int/wis/cha/ac/per/maxHp` getters
  - Rings fit either ring slot; slot picker lists every owned item that fits a clicked slot

## 🧠 PHASE 2: DERIVED MECHANICS & CALCULATED STEPS
- [x] Define the Perception (PER) Derived Metric: (DEX + INT + WIS) / 3 (+ skill, set, feat and race bonuses)
- [x] Write the 2D Grid Passive Radial Radar Sweep Loop (`src/systems/Perception.js`)
- [ ] Integrate Agility/Dexterity modifiers into Attack Frame Delays
  - DEX currently feeds attack rolls and AC (d20 system); there are no attack animation frame delays yet

## 🎭 PHASE 3: MODULAR ARCHITECTURE (DATA-DRIVEN REGISTRY)
- [~] Implement Abstract Data Parsers for Race, Class, and Monster objects
  - [x] Races: `src/data/Races.js` (`RACES` + `RaceManager`)
  - [x] Classes: `src/data/Classes.js` + `ClassesExtended.js` (`CLASSES` + `ClassManager`)
  - [x] Feats and Heroic Masteries: `src/data/Feats.js`, `src/data/Progression.js`
  - [x] Items / sets / affixes: `src/data/Items.js`
  - [ ] Monsters still live inline in the biome tables (`src/data/Biomes.js`); move to a `Monsters.js` registry
- [x] Create Central Registry Systems to deprecate hardcoded Enums
  - Class attributes/gear were hard-coded in `Character.js`; they are now class data
- [~] Setup Dynamic Character Sheet interface to pull configuration arrays
  - Sheet reads classes, races, skills, feats and masteries from the registries; skills list is still a fixed `SKILLS` table
- [x] Level-up rules are data-driven (`PROGRESSION` in `src/data/Progression.js`): HP every level, 1 skill/level, attribute every 4, feat every 3 from level 2, mastery every 5
- [x] Class roster: Warrior, Wizard, Thief, Cleric, Ranger, Bard, Monk, Druid
- [x] Race roster: Human, Elf, Dwarf, Halfling, Gnome, Half-Elf
- [ ] Sub-classes (registry shape is ready: `isSubclass`, `parentClasses`, `SUBCLASS_PLANS`; none implemented)
  - [ ] Paladin, [ ] Ninja, [ ] Gladiator, [ ] Necromancer

## 🐾 PHASE 4: MONSTER BEHAVIOR & THE TAMING PIPELINE
- [~] Refactor monsters to accept dynamic Status Conditions (Charmed, Sleep)
  - Monsters carry a `statuses` list handled by `EffectSystem` (Stunned, Terrified, Bleeding, Poisoned, Burning, Clumsy...); Charmed and Sleep do not exist yet
- [ ] Code Charisma-based check vs Target Level / Health Pools
- [ ] Implement Pet AI companion tracking modules

## 🛠️ PHASE 5: TOOLING, SETTINGS & PLAYTEST SUPPORT
- [x] Configurable map size (50 (**Tiny, default**) / 100 / 150 / 200) in the Settings screen (⚙️ Menu), A* pathfinding sized to walk distance
- [x] Debug / test mode: `?seed=TEST-0001` kitchen-sink level, `?debug=1`, in-app debug panel, `window.pixelDebug` console API (see README)
- [x] Slower XP curve and unified XP rewards (`XP_REWARDS`, `monsterXp`)
- [ ] Persist / resume a run (nothing is saved except settings)
- [ ] Automated browser regression script for the `pixelDebug` checks
- [x] Locked doors + keys + active Search (`E`); traps are rarer and never lethal; healing potions in loot; faster natural regen
- [x] Two-button combat UI (Attack / Power with auto-target), monster health bars + target panel, trap disarming and hazard-aware pathing, Tiny (50x50) default map
- [x] Touch controls: pinch zoom, drag pan; inventory shows large icons with colour-coded set highlighting
