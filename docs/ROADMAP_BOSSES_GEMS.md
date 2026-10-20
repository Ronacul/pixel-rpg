# Roadmap: bosses, equipment powers, gem sockets, and engagement ideas

Design notes for the next big features. Nothing here is implemented yet. Each piece reuses an existing system (data registries, `EffectSystem` statuses/zones, `Biomes.js`, `Items.js`).

## 1. Boss fights (every 5th floor: 5, 10, 15, 20, 25)

**Structure.** The stairs-down room on a boss floor holds a sealed **boss arena** (a big 11x11 room). The stairs stay inactive until the boss dies, so each boss is a real gate rather than an optional fight. Boss floors are mostly small (fewer regular monsters) so the fight is the event.

**Data model** (`src/data/Bosses.js`, same registry style as classes):

```js
{ id, name, icon, size: 2,               // 2x2 footprint (drawn double size)
  floors: [5], hp, ac, dice,
  phases: [ { atHpPct: 100, pattern: [...] }, { atHpPct: 50, pattern: [...], enrage: {...} } ],
  loot: { guaranteed: ['set piece'], gems: 1 } }
```

A **pattern** is a repeating turn script: a list of moves like `melee`, `charge(3)`, `summon(minion, 2)`, `breath(cone, 5)`, `slam(aoe, r2)`, `roar(fear)`, `regen(+5)`. The boss **telegraphs** the next dangerous move one turn ahead by tinting the affected tiles red and posting a message ("The troll raises its club..."), which makes fights readable and gives the player a way to dodge with movement, a cleverly timed Power, or cover (pillars already block ranged damage).

| Floor | Boss | Gimmick |
| :--- | :--- | :--- |
| 5 | **Bugbear Chieftain** | Charges in a straight line (telegraphed lane, dodge sideways); summons 2 goblin scouts at 50% HP |
| 10 | **Cave Troll** | Regenerates 5 HP/turn unless hit by fire or acid; slam hits all adjacent tiles; fire zones disable regen |
| 15 | **Chimaera** | Three attacks in rotation: bite (single), fire breath (cone, leaves FIRE zone), tail sweep (adjacent). Tests hazard-aware movement |
| 20 | **Stone Giant** | Throws boulders (ranged AoE leaving RUBBLE), stomps (stun on adjacent); slow but huge HP; pillars give cover |
| 25 | **Ancient Dragon** | Phase 1: flies (untargetable by melee on alternate turns), breath cone; phase 2 at 50%: enraged, summons whelps, wing-buffet knockback |

Rewards: a guaranteed set piece or unique item, a gem (see 3), and the first clear unlocks a "boss slain" mark in the run summary. Mini-bosses ("champions") can appear on non-boss floors as a named, tougher monster with one signature move.

**Implementation order.** (1) multi-tile monsters + telegraph rendering, (2) pattern/phase engine in the monster turn loop, (3) arena generation + gated stairs, (4) first boss (bugbear) end to end, (5) remaining bosses as data.

## 2. Equipment powers (affixes with special conditions)

Today gear gives flat stats and sets give threshold bonuses. Add **powers**: a small trigger -> effect data entry on an item, so loot stays interesting beyond bigger numbers.

```js
powers: [ { trigger: 'onHit', chance: 0.2, effect: { status: 'BURNING', duration: 3 } },
          { trigger: 'onKill', effect: { heal: 4 } },
          { trigger: 'onDamaged', chance: 0.15, effect: { zone: 'WEB_ZONE' } },
          { trigger: 'passive', effect: { trapSense: true } } ]   // e.g. auto-reveal traps within 2 tiles
```

Triggers: `onHit`, `onCrit`, `onKill`, `onDamaged`, `onTurnStart`, `onStairs`, `passive`. Effects reuse existing statuses and zones (burning, bleeding, stoneskin, fire zone...) plus a few new ones: thorns (reflect), lifesteal, thief's-eye (passive trap/key sense radius), featherfall (immune to pit/spike), fire/poison ward (halve zone damage, directly addressing deadly traps and fire). Unique drops can carry a named power ("Emberfang: 20% to ignite").

## 3. Socketed gems (upgrade layer)

- Items roll 0-3 **sockets** (more at higher floors / on boss loot).
- **Gems** are small items with a tier (chipped, flawed, perfect) and a colour that sets the bonus by slot type: weapon sockets give damage/status (ruby: +fire dmg, sapphire: cold slow, emerald: poison), armor sockets give AC/resistance, jewelry gives attributes.
- Socket a gem from the item drawer (a new "Gems" row beside Equip / Drop); sockets are permanent unless a rare "Gem Extractor" is used, which creates a gold sink and a decision.
- **Gem fusing**: three of the same tier merge into the next tier, giving duplicate gems a use.
- Same-colour gems on one item (or on a full set) can trigger a small **socket bonus**, tying into the new set highlighting.

## 4. Other ideas that fit the game

- **Shrines with a choice**: an altar offers a boon with a price (e.g. +2 AC for this floor but cursed with fewer rations; sacrifice 10 HP for a free feat reroll). Data-driven, very cheap to add, high replay value.
- **Merchant / camp events**: a wandering trader on some floors who buys loot and sells potions and keys. Gives the bag-full problem a purpose.
- **Floor modifiers**: each floor rolls 0-1 modifier shown at entry ("Flooded: fire is weaker", "Haunted: more undead, better loot", "Pitch dark: -1 sight, +25% XP"). Cheap variety from existing systems.
- **Run summary + meta unlocks**: on death, show turns, kills, deepest floor, best find, and award "legacy points" that unlock starting perks, extra start classes, or sub-classes (Paladin, Ninja...) which are already reserved in the registry.
- **Daily seed**: one shared seed per day with a local best-floor record; works with the existing `?seed=` links and costs almost nothing.
- **Companions / taming** (MASTER_PLAN Phase 4): charm a monster with a CHA check; it fights beside you. Natural payoff for Bard and Druid.
- **Light and stealth**: carried torches change sight radius; sneaking (move without sprinting) lowers monster alert, strengthening the Thief and Ranger.
- **Quest-lite goals per floor**: "free the prisoner", "light 3 braziers", "find the cursed relic" for bonus XP, using the existing key / locked-door and search mechanics.
