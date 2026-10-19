# 📐 Pixel RPG Engine: Architectural Bounds & Performance Plan

This document establishes the technical bounds, memory budgets, and algorithm constraints for scaling **Pixel RPG** across **configurable square maps (50 / 100 / 150 default / 200 tiles per side)**, **25 dungeon floors**, **25 equipment slots**, **dynamic perception fog of war**, and **blindspot surprise mechanics**.

> **Implementation notes (current build):** map size is a per-run setting (`src/map/Dungeon.js` `MAP_SIZES`, default 150x150 = 22,500 tiles = 22.5 KB per floor per buffer). The numbers below were written for the original 200x200 plan and scale linearly with the chosen size. Pathfinding is a bounded A* (`src/systems/Pathfinding.js`, binary heap + typed arrays, search box margin 20, max radius 50) whose cost depends on walk distance, not map area.

---

## 1. 🗺️ Map Scale & Dungeon Depth Bounds

```
                        [ Level 1: Surface Dungeon ]
                                     │
                                (Stairs Down)
                                     ▼
                          [ Level 2: Deep Tombs ]
                                     │
                                    ...
                                     │
                                     ▼
                        [ Level 25: Abyssal Vault ]
```

| Parameter | Specification Bound | Performance Consideration |
| :--- | :--- | :--- |
| **Dimensions Per Level** | $200 \times 200$ tiles | $40,000$ tiles per floor |
| **Total Dungeon Depth** | 25 procedurally connected levels | $1,000,000$ potential world tiles |
| **Generation Strategy** | **Lazy Procedural Generation** | Floors generate on-demand via deterministic seed: `hash(Seed + "_L" + Level)` |
| **Active Memory Footprint** | Flat typed arrays (`Uint8Array`) | **$40\text{ KB}$ per floor** (instead of $5\text{ MB}$ JS object trees) |
| **Difficulty Scaling** | Level Multiplier: $1 + (\text{Floor} - 1) \times 0.25$ | Monster HP, AC, damage dice, and trap DCs scale monotonically per floor |

### Memory Data Structure (Zero Garbage Collection)
```javascript
// Each level uses flat contiguous byte buffers:
const TILE_COUNT = 200 * 200; // 40,000
const terrainMap   = new Uint8Array(TILE_COUNT); // 0=Floor, 1=Wall, 2=Door, 3=SecretDoor, 4=StairsDown, 5=StairsUp
const visibilityMap= new Uint8Array(TILE_COUNT); // 0=Unexplored (Pitch Black), 1=Explored (Fog), 2=Currently Visible
```

---

## 2. ⚡ Mobile & Desktop Performance Budget

To guarantee a locked **60 FPS** on mobile browsers without battery drain or input lag:

```
[ Full 200x200 Map (40,000 tiles) ]
        ┌────────────────────────┐
        │                        │
        │      ┌──────────┐      │  <-- Viewport Camera Culling Window
        │      │ 13x13    │      │      (Only ~169 tiles rendered per frame)
        │      │ Player 🛡│      │
        │      └──────────┘      │
        │                        │
        └────────────────────────┘
```

1. **Viewport Camera Culling**:
   - Canvas renders only a **$13 \times 13$ or $15 \times 15$ window** centered on the player ($\sim 169 - 225$ tiles per frame).
   - Render overhead remains constant $O(1)$, independent of map size.
2. **Bounded A\* Pathfinding**:
   - Limit tap-to-move path searches to a **maximum radius of 40 tiles** ($< 2\text{ms}$ execution time).
   - Long-distance cross-dungeon taps resolve to the boundary of the visible/explored sector.
3. **Collision & Trigger Checks**:
   - $O(1)$ index lookup: `index = y * 200 + x`.

---

## 3. 🎒 25-Slot Categorized Character Sheet

The equipment and inventory layout is divided into **10 active equipment slots** and **15 backpack carrying slots** ($10 + 15 = 25$ total slots).

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          EQUIPPED SLOTS (10)                                 ║
╠══════════════════╦══════════════════╦══════════════════╦═════════════════════╣
║ [1] Head (Helm)  ║ [2] Armor/Chest  ║ [3] Gauntlets    ║ [4] Boots (Feet)    ║
╠══════════════════╬══════════════════╬══════════════════╬═════════════════════╣
║ [5] Main Hand    ║ [6] Off Hand     ║ [7] Left Ring    ║ [8] Right Ring      ║
╠══════════════════╬══════════════════╬══════════════════╩═════════════════════╣
║ [9] Neck/Amulet  ║ [10] Cloak/Belt  ║                                        ║
╚══════════════════╩══════════════════╩════════════════════════════════════════╝
╔══════════════════════════════════════════════════════════════════════════════╗
║                          BACKPACK INVENTORY (15)                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ [11] [12] [13] [14] [15] [16] [17] [18] [19] [20] [21] [22] [23] [24] [25]   ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

* **Slot Validation Rules:** Items can only be equipped into their designated archetype (e.g. shields/weapons in Hand slots, rings in Ring slots).
* **Dynamic Modifiers:** Every equipped slot dynamically hooks into player getters:
  $$\text{Effective STR} = \text{Base STR} + \sum \text{Slot STR Bonuses}$$
  $$\text{Effective AC} = 10 + \sum \text{Armor Bonuses} + \min(\text{DEX Mod}, \text{Max Dex Allowance})$$

---

## 4. 👁️ Perception Radar, Fog of War & Secret Doors

```
[ Pitch Black ] -> [ Explored Memory (Dim Gray) ] -> [ Active Vision Field (Lit) ]
```

### Visual Scaling by Perception (PER)
Using the formula $\text{PER} = \lfloor(\text{DEX} + \text{INT} + \text{WIS}) / 3\rfloor$:

| Effective PER Score | Base Visual Radius | Survey Area Revealed | Secret Door Detection DC |
| :---: | :---: | :---: | :---: |
| **0 – 11** | 2 Tiles | $5 \times 5$ Box ($25$ tiles) | DC 18 Passive Check |
| **12 – 15** | 3 Tiles | $7 \times 7$ Box ($49$ tiles) | DC 15 Passive Check |
| **16 – 19** | 4 Tiles | $9 \times 9$ Box ($81$ tiles) | DC 12 Passive Check |
| **20+** | 5 Tiles | $11 \times 11$ Box ($121$ tiles) | DC 10 Passive Check (Insta-Spot) |

### Map Tile Manifest
* `0`: **Floor** (Open traversal)
* `1`: **Solid Wall** (Blocks sight & movement)
* `2`: **Closed Door** (Blocks sight & movement until opened)
* `3`: **Open Door** (Permits sight & movement)
* `4`: **Secret Door** (Renders identically to a Solid Wall until detected via Perception check, after which it reveals as an interactable doorway)
* `5`: **Stairs Down** (Transitions to $\text{Floor} + 1$)
* `6`: **Stairs Up** (Transitions to $\text{Floor} - 1$)

---

## 5. 🎯 Surprise & Blindspot Ambush Mechanics

A target is **Surprised** if attacked from outside its line of sight or immediately upon breaching a closed door/corner.

```
       [ Wall ] [ Closed Door ] [ Wall ]
                      │ (Door Opens)
                      ▼
               [ Surprised Rat! ]
           • Denied DEX bonus to AC
           • Player attacks with Advantage (Roll 2d20, keep highest)
```

### Combat Resolution Rules:
1. **Surprise Conditions:**
   * **Door Breach:** Attacking a monster on the tile directly behind a closed door on the turn it is opened.
   * **Flank / Blindspot:** Attacking from a tile that was outside the monster's field of view on the prior turn.
2. **Surprise Advantage Effects:**
   * **Advantage:** Attacker rolls $2\text{d}20$ and takes the higher result.
   * **Flat-Footed Armor Class:** The defender loses all Dexterity bonuses to Armor Class for that attack:
     $$\text{Surprised AC} = 10 + \text{Equipment Base Defense} \quad (\text{DEX Mod denied})$$
3. **Monster Ambush:**
   * If the player blindly walks into a dark room or past an uninspected corner, lurking monsters can trigger a surprise round against the player under the same rules.
