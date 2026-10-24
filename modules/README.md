# Writing a module

A **module** is one chapter of the story: a theme, a number of floors, regions with their own look and monsters, and bosses.
It is a single JSON file. Drop it in this folder and list it in `index.json`, or load it in the game from
**Menu → New Run → Add a module file**.

Heroes carry over between modules (Menu → New Run → *Hero*). A hero's level sets the **difficulty depth** the module starts at
(about 0.75 levels per floor), so any module stays a fair fight whenever you enter it.

## Smallest working module

```json
{
  "id": "tiny_test",
  "name": "Tiny Test",
  "floors": 3,
  "stages": [
    { "name": "Bat Cave", "floors": [1, 3], "palette": "cave", "monsters": ["cave_bat", "goblin_scout"] }
  ],
  "bosses": { "3": "bugbear" }
}
```

That is a full playable module. Everything else is optional polish.

## Fields

| Field | Meaning |
| --- | --- |
| `id` | 2-40 chars, lowercase letters, digits, `_` |
| `name`, `icon`, `theme`, `author`, `desc` | Shown on the module card |
| `floors` | 3-40 |
| `layout` | How floors are built (see below); applies to every stage |
| `stages[]` | Regions. Together they must cover floors `1..floors` exactly once |
| `bosses` | `{ "floor": boss }`. The **final floor must have a boss**; beating it clears the module |

### Stage

```json
{ "name": "Flooded Ruins", "floors": [4, 6], "palette": "lagoon", "desc": "Flavour text.",
  "monsters": ["drowned_dead", "river_serpent"], "layout": { "lakes": 5 } }
```

* `palette`: `stone cave forest forge void marsh lagoon reef deep glade grotto autumn` (colours + which pixel-art tile set to use).
* `monsters`: ids from the library (below), or inline `{ "name", "icon", "hp", "ac", "dice", "desc", "sprite" }`.
  `hp`/`ac`/`dice` are the *base* stats; they are scaled by difficulty depth automatically.
* `layout`: optional override of the module layout for just this stage.

### Layout (all optional, `1` = classic dungeon)

| Key | Effect |
| --- | --- |
| `roomSize` `[min, max]` | Room width/height (clamped on small maps) |
| `rooms`, `doors`, `traps`, `pillars`, `barrels`, `foliage` | Multipliers on how many there are |
| `rough` 0-1 | Ragged cave walls |
| `lakes`, `rivers` | Number of big lakes / rivers. Deep water is impassable but see-through; rivers have fords (shallows). Every room stays reachable |

### Bosses

Either a library id (`bugbear troll chimaera giant dragon`) or an inline definition:

```json
{ "name": "Crab Monarch", "icon": "🦀", "sprite": { "id": "spider" }, "scale": 1.5,
  "hp": 90, "ac": 16, "dice": 8, "diceCount": 2, "bonusDmg": 2, "hpMult": 4.5, "xpBonus": 150,
  "desc": "Flavour.", "minion": "giant_crab", "breath": { "zone": "POISON_GAS", "length": 5 },
  "phases": [
    { "below": 100, "script": ["melee", "slam", "melee"] },
    { "below": 50,  "script": ["charge", "summon", "slam"], "onEnter": { "msg": "calls his court!", "summon": true } }
  ] }
```

Moves: `melee charge slam breath boulder summon roar fly land`. The boss repeats its phase's `script`; the last phase whose `below`
(% of max HP) it has fallen under is active. `onEnter` can show a message, summon minions or raise damage (`dmgMult`).

### Monster library ids

`sewer_rat dungeon_bat goblin_scout cave_crawler slime_mass troglodyte thorn_stalker entling_guard moss_skeleton forge_golem magma_hound deep_dwarf_wight void_wraith eldritch_eye abyssal_overlord`
`giant_crab bog_lizard drowned_dead mire_slime river_serpent kelp_horror tide_hag water_wraith kraken_spawn`
`dire_wolf cave_bat web_weaver wood_goblin owlbear fungal_ooze stone_golem briar_wisp valley_troll`

(`sprite` values you can use inline: bat brute chimaera demon dragon eye goblin golem hound lizard rat skeleton slime spider treant wight wolf wraith.)

Bad files are rejected with a list of what to fix. Examples: `sunken_reaches.json`, `whispering_vale.json`.
