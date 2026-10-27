// Difficulty model. Everything that makes deeper floors harder, less predictable and worth a steady amount of XP lives here.
//
// Pacing target: a player who explores normally gains about PLAYER_LEVEL_PER_FLOOR levels per floor
// (level 1 at floor 1, ~level 19 at floor 25). Monsters are scaled so a typical fight at that pace costs a
// predictable slice of HP, then randomness (level spread, elites, out-of-depth "dread" foes, wandering spawns)
// keeps any single encounter uncertain.

import { XP_TABLE, PROGRESSION } from './Progression.js';

export const DIFFICULTY = {
    playerLevelPerFloor: 0.75,

    // Monster stat scaling per monster level (see scaleMonsterStats)
    hpBaseShare: 0.7,        // share of the biome's listed HP that is kept
    hpFlat: 5,               // flat HP at any level
    hpPerLevel: 3.3,         // HP gained per monster level
    attackPerLevel: 0.85,    // attack bonus per level
    damagePerLevel: 0.45,    // flat damage bonus per level
    acEveryLevels: 4,        // +1 AC every N levels

    // Level spread of a freshly spawned monster relative to the floor number
    levelSpread: [[-1, 0.15], [0, 0.40], [1, 0.27], [2, 0.12], [4, 0.06]],  // [offset, probability]; +3 or more = "Dread"

    // Elites
    eliteChanceBase: 0.11,
    eliteChancePerFloor: 0.007,
    eliteChanceCap: 0.28,
    championChance: 0.05,    // of elites: gets two affixes

    // XP economy
    clearFraction: 0.70,     // clearing this share of a floor's monsters earns the whole floor budget
    wandererXpFactor: 0.6,   // wandering spawns are worth less than the floor's placed monsters
    levelDeltaStep: 0.15,    // XP change per level the monster is above (+) or below (-) the hero
    levelDeltaMin: 0.1,
    levelDeltaMax: 1.8,
    familiarityStep: 0.03,   // XP lost per earlier kill of the same monster type this run
    familiarityMin: 0.4,
    bossBudgetShare: 0.4,

    // Wandering monsters
    wanderIntervalBase: 28,  // turns between spawn checks at floor 1 (shrinks with depth)
    wanderIntervalMin: 14,
    wanderChanceBase: 0.4,
    wanderChancePerFloor: 0.01,
    wanderChanceCap: 0.7,
    wanderCapBase: 2,        // max live wanderers = base + floor / 5
    ambushChanceBase: 0.12,  // chance that camping is interrupted
    ambushChancePerFloor: 0.01
};

export function expectedPlayerLevel(floor) {
    return Math.min(PROGRESSION.maxLevel, 1 + DIFFICULTY.playerLevelPerFloor * (floor - 1));
}

// Inverse: which floor matches a given hero level
export function floorForLevel(level) {
    return 1 + (level - 1) / DIFFICULTY.playerLevelPerFloor;
}

// Total XP at a (possibly fractional) level
export function xpAtLevel(level) {
    const lo = Math.max(1, Math.floor(level));
    const hi = Math.min(PROGRESSION.maxLevel, lo + 1);
    const a = XP_TABLE[lo - 1], b = XP_TABLE[hi - 1];
    return a + (b - a) * Math.min(1, Math.max(0, level - lo));
}

// XP a player on pace should earn from floor `floor` (the placed monsters' share; chests / traps are extra)
export function floorXpBudget(floor) {
    return Math.max(60, Math.round(xpAtLevel(expectedPlayerLevel(floor + 1)) - xpAtLevel(expectedPlayerLevel(floor))));
}

export function rollMonsterLevel(prng, floor) {
    const r = prng.next();
    let acc = 0;
    for (const [offset, p] of DIFFICULTY.levelSpread) {
        acc += p;
        if (r < acc) return Math.max(1, floor + (floor <= 2 ? Math.min(offset, 1) : offset)); // no dread foes on the first two floors
    }
    return floor;
}

// HP / AC / attack / damage for a monster of `level` built from biome definition `def`
export function scaleMonsterStats(def, level) {
    const D = DIFFICULTY;
    return {
        hp: Math.round(def.hp * D.hpBaseShare + D.hpFlat + D.hpPerLevel * level),
        ac: def.ac + Math.floor((level - 1) / D.acEveryLevels),
        attackBonus: Math.floor(level * D.attackPerLevel),
        bonusDmg: Math.round(level * D.damagePerLevel)
    };
}

// ---------- Elite affixes ----------
// Each affix edits the monster once at creation (`apply`) and may add runtime behaviour handled in main.js / Combat.js
export const MONSTER_AFFIXES = {
    rabid:    { id: 'rabid',    prefix: 'Rabid',    icon: '🩸', desc: 'hits harder and causes bleeding',     apply: (m) => { m.bonusDmg += 2 + Math.round(m.level * 0.1); m.onHitStatus = { status: 'BLEEDING', duration: 3, chance: 0.5 }; } },
    venomous: { id: 'venomous', prefix: 'Venomous', icon: '🧪', desc: 'poisons on a hit',                    apply: (m) => { m.onHitStatus = { status: 'POISONED', duration: 4, chance: 0.6 }; } },
    armored:  { id: 'armored',  prefix: 'Armored',  icon: '🛡️', desc: '+3 AC and +20% HP',                  apply: (m) => { m.ac += 3; m.hp = Math.round(m.hp * 1.2); m.maxHp = m.hp; } },
    berserk:  { id: 'berserk',  prefix: 'Berserk',  icon: '💢', desc: 'hits much harder but is easier to hit', apply: (m) => { m.bonusDmg += 3 + Math.round(m.level * 0.15); m.ac = Math.max(5, m.ac - 2); } },
    swift:    { id: 'swift',    prefix: 'Swift',    icon: '💨', desc: 'closes distance twice as fast',        apply: (m) => { m.swift = true; } },
    regenerating: { id: 'regenerating', prefix: 'Regenerating', icon: '💚', desc: 'heals 2 HP every turn',    apply: (m) => { m.regen = 2 + Math.floor(m.level / 8); } },
    vampiric: { id: 'vampiric', prefix: 'Vampiric', icon: '🦇', desc: 'heals itself when it hits',            apply: (m) => { m.lifesteal = 0.6; } },
    brutal:   { id: 'brutal',   prefix: 'Brutal',   icon: '⚔️', desc: 'extra damage die and +1 attack',      apply: (m) => { m.diceCount = (m.diceCount || 1) + 1; m.attackBonus += 1; } }
};

export function rollAffixes(prng, floor) {
    const chance = Math.min(DIFFICULTY.eliteChanceCap, DIFFICULTY.eliteChanceBase + DIFFICULTY.eliteChancePerFloor * floor);
    if (floor < 2 || !prng.chance(chance)) return [];
    const ids = Object.keys(MONSTER_AFFIXES);
    const first = prng.choice(ids);
    const picks = [first];
    if (prng.chance(DIFFICULTY.championChance)) {
        const second = prng.choice(ids.filter(i => i !== first));
        picks.push(second);
    }
    return picks;
}

// Applies stats scaling, level label and affixes to a fresh monster object (mutates and returns it)
export function applyDifficulty(monster, def, level, affixIds = []) {
    const s = scaleMonsterStats(def, level);
    monster.level = level;
    monster.hp = s.hp; monster.maxHp = s.hp;
    monster.ac = s.ac;
    monster.attackBonus = s.attackBonus;
    monster.bonusDmg = s.bonusDmg;
    monster.diceCount = 1;
    if (level <= 2) monster.dice = Math.min(monster.dice, level <= 1 ? 4 : 6); // the first floors hit gently
    monster.affixes = [];
    for (const id of affixIds) {
        const a = MONSTER_AFFIXES[id];
        if (!a) continue;
        a.apply(monster);
        monster.affixes.push(id);
    }
    monster.maxHp = monster.hp;
    if (monster.affixes.length) {
        monster.isElite = true;
        const tags = monster.affixes.map(id => MONSTER_AFFIXES[id].prefix);
        monster.name = `${tags.join(' ')} ${monster.name}`;
    }
    return monster;
}

// Out-of-depth foes get a "Dread" tag
export function labelDread(monster, floor) {
    if (monster.level >= floor + 3) {
        monster.isDread = true;
        monster.name = `Dread ${monster.name}`;
    }
    return monster;
}

// XP weight of a monster when the floor budget is divided among them
export function xpWeight(monster) {
    return monster.maxHp * (monster.isElite ? 2 : 1) * (monster.isDread ? 2.5 : 1);
}

// Splits the floor budget across `monsters` (ordinary monsters only). clearFraction of them yields the full budget.
export function assignFloorXp(monsters, floor) {
    const ordinary = monsters.filter(m => !m.isBoss);
    const total = ordinary.reduce((s, m) => s + xpWeight(m), 0);
    if (total <= 0) return 0;
    const budget = floorXpBudget(floor);
    for (const m of ordinary) m.xp = Math.max(2, Math.round(budget * (xpWeight(m) / total) / DIFFICULTY.clearFraction));
    return Math.round(budget / Math.max(1, ordinary.length) / DIFFICULTY.clearFraction);
}

// XP actually awarded for a kill: base value, scaled by how much of a challenge it was and how familiar the type is
export function killXpFor(monster, heroLevel, killsOfType, isWanderer = false) {
    const D = DIFFICULTY;
    const base = monster.xp ?? 0;
    const delta = (monster.level ?? heroLevel) - heroLevel;
    const rel = Math.min(D.levelDeltaMax, Math.max(D.levelDeltaMin, 1 + D.levelDeltaStep * delta));
    const fam = Math.max(D.familiarityMin, 1 - D.familiarityStep * killsOfType);
    const wander = isWanderer ? D.wandererXpFactor : 1;
    return { xp: Math.max(1, Math.round(base * rel * fam * wander)), rel, fam, wander };
}

// `count` distinct elite affixes for guaranteed elites (special-room guardians)
export function forceAffixes(prng, count = 1) {
    const ids = Object.keys(MONSTER_AFFIXES);
    const picks = [];
    while (picks.length < Math.min(count, ids.length)) {
        const id = prng.choice(ids);
        if (!picks.includes(id)) picks.push(id);
    }
    return picks;
}
