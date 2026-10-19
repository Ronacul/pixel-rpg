# 🛠️ SYSTEM MODIFICATION MAPS

## 🎲 THE d20 COMBAT ENGINES
- Player Attack Roll = d20 + stat modifier (melee: best of STR/DEX, ranged: DEX) + Base Attack Bonus (`floor(level / 2) + 1`) + buffs/statuses + feat/mastery attack bonus
- Target Armor Class = monster AC (+ cover bonus vs ranged, + status modifiers); surprised targets have AC 10
- Player Armor Class = 10 + equipment AC + DEX Mod + buffs/statuses + Acrobatics ranks + set bonus + feat/race/mastery AC
- Physical Damage Pipeline = weapon die roll + stat modifier + weapon flat bonus + skill/feat/mastery damage + status bonuses
- Class `unarmedDie` (Monk d6, default d3) is used when the main hand is empty

## 📈 PROGRESSION (data: `src/data/Progression.js`)
- XP thresholds follow `PROGRESSION.xp` (base 200, growth 1.32, rounded to 10; see `XP_TABLE`): level 2 at 200 XP (was 100), level 5 at 1,270 (was 900), level 10 at 6,980 (was 5,000), level 20 at 121,490 (was 35,000)
- Kill XP = `8 * floor + 1.5 * monster max HP` (`monsterXp`); chest = `12 * floor`; secret door 15; trap 10; forage / harvest 5
- Every level: HP gain = `floor(hitDie / 2) + 1 + CON mod + race hpPerLevel` (minimum 2) and a full heal
- Grants per level (`PROGRESSION.grants`): skill rank every level; attribute point at 4, 8, 12, 16, 20; feat at 2, 5, 8, 11, ...; heroic mastery at 5, 10, 15, 20
- Max HP = class `baseHp` + CON mod x 8 + level-up HP + Athletics x 2 + set bonus + feat/mastery HP

## 🎭 DATA REGISTRIES
| Registry | File | Notes |
| :--- | :--- | :--- |
| Classes | `src/data/Classes.js`, `ClassesExtended.js` | hitDie, baseHp, attributes, startingGear, unarmedDie, abilities; `SUBCLASS_PLANS` reserves Paladin / Ninja / Gladiator / Necromancer |
| Races | `src/data/Races.js` | attribute modifiers, passive `mods`, `hpPerLevel`, traits |
| Feats | `src/data/Feats.js` | passive `mods`, optional `classes` / `races` restrictions |
| Masteries / XP | `src/data/Progression.js` | heroic masteries, level-up grants, XP tuning |
| Items | `src/data/Items.js` | base items, affixes, sets, ring-slot compatibility (`getCompatibleSlots`) |

## 🔬 PERCEPTION RADAR VISUAL SCALING MATRIX

| Effective PER Score | Sight Radius | Passive checks |
| :--- | :--- | :--- |
| < 12 | 3 Tiles | Secret door: d20 + PER mod vs DC 12 (automatic when adjacent) |
| 12 - 15 | 4 Tiles | Hidden trap: d20 + PER mod vs DC 13 (automatic when adjacent) |
| 16 - 19 | 5 Tiles | |
| 20+ | 6 Tiles | |

---

## 🗺️ MAP SIZE & PATHFINDING
- Square maps of 50 / 100 / 150 (default) / 200 tiles per side, chosen per run (`MAP_SIZES`, `setMapSize` in `src/map/Dungeon.js`).
- Room attempts scale with map area (65-85 attempts at 100x100); terrain and visibility are flat `Uint8Array`s indexed `y * MAP_WIDTH + x`.
- Tap-to-move uses bounded A* (binary heap, typed arrays, 4-directional, search margin 20 tiles, max radius 50). Closed doors, barrels and live monsters are only valid as the final step.

---

## 🌱 DETERMINISTIC SEED & MODIFIER ENGINE

- **Seed Format:** 8-character Base-32 alphanumeric string formatted as `XXXX-XXXX` (e.g. `K9X2-M4P7`).
- **Charset:** 32 unambiguous characters (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, omitting `O`, `0`, `I`, `1` to avoid transcription errors).
- **Entropy & State Space:** $32^8 = 1,099,511,627,776$ (~1.1 Trillion) distinct playthrough configurations.
- **PRNG Algorithm:** 32-bit FNV-1a String Hash $\to$ Mulberry32 Pseudo-Random Number Generator.
- **Governed Subsystems:**
  1. **Map Generation:** Rooms, corridors, doors, traps and tactical terrain (the same seed on a different map size gives a different layout).
  2. **Entity Generation:** Monster type per room, level-scaled HP/AC, spawn coordinates.
  3. **Loot & Equipment Drops:** Seeded weapon/armor selection and prefix affix rolls.
  4. **Combat Rolls:** Deterministic d20 attack rolls, weapon damage dice, and monster retaliation checks.
  5. **Shareability:** Deep linking via `?seed=XXXX-XXXX` (add `&map=`, `&class=`, `&race=` to reproduce a run exactly).
- **Test seeds:** any seed starting with `TEST` (e.g. `TEST-0001`) loads the fixed kitchen-sink test floor instead of a procedural one.
