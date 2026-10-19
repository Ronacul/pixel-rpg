// Data-driven level-up rules. Everything about "what do I get at level N" lives here so it can
// be tuned (or later overridden per class / difficulty) without touching engine code.

export const PROGRESSION = {
    maxLevel: 20,

    // XP needed to advance from level N to N+1:  round(base * growth^(N-1)) * (1 + (N-1) * linear) -> smoothed
    // Slower than the original table (100, 250, 500, 900...). Level 2 now takes 200 XP (was 100), level 10 needs ~7k (was 5k) and level 20 ~120k (was 35k).
    xp: { base: 200, growth: 1.32, linearPerLevel: 0.0 },

    // Every level grants HP: average of the class hit die (+1) plus CON modifier, never below minHp.
    hp: { everyLevel: true, minHp: 2 },

    // Grants. `every`/`start` define the levels at which each grant is awarded: start, start+every, ...
    grants: {
        skill:     { every: 1, start: 1, label: 'Skill Rank',      desc: 'Train one skill (+1 rank).' },
        attribute: { every: 4, start: 4, label: 'Attribute Point', desc: 'Raise one attribute by +1.' },
        feat:      { every: 3, start: 2, label: 'Feat',            desc: 'Learn a new feat (levels 2, 5, 8, 11...).' },
        mastery:   { every: 5, start: 5, label: 'Heroic Mastery',  desc: 'Choose a heroic mastery (levels 5, 10, 15, 20).' }
    },

    // Display / ordering of grants inside a level-up
    grantOrder: ['feat', 'attribute', 'mastery', 'skill']
};

export function grantAtLevel(grantId, level, cfg = PROGRESSION) {
    const g = cfg.grants[grantId];
    if (!g || level < g.start || level < 2) return false; // level 1 is character creation
    return (level - g.start) % g.every === 0;
}

// List of grant ids awarded when reaching `level` (in display order)
export function getGrantsForLevel(level, cfg = PROGRESSION) {
    return cfg.grantOrder.filter(id => grantAtLevel(id, level, cfg));
}

// Cumulative XP thresholds. XP_TABLE[n] = total XP required to REACH level n+1 (so XP_TABLE[0] = 0 for level 1).
export function buildXpTable(cfg = PROGRESSION) {
    const table = [0];
    let total = 0;
    for (let lvl = 1; lvl < cfg.maxLevel; lvl++) {
        const step = cfg.xp.base * Math.pow(cfg.xp.growth, lvl - 1) * (1 + (lvl - 1) * (cfg.xp.linearPerLevel || 0));
        total += Math.round(step / 10) * 10;
        table.push(total);
    }
    return table;
}

export const XP_TABLE = buildXpTable();

// XP-gain tuning knobs (all flat multipliers so playtest feedback can be applied in one place)
export const XP_REWARDS = {
    monsterBase: 8,        // per floor level
    monsterHpFactor: 1.5,  // x max HP
    chestPerFloor: 12,
    secretDoor: 15,
    trap: 10,
    forage: 5,
    harvest: 5
};

// Single source of truth for kill XP (melee, ranged, AoE, DoT and hazard kills all use this)
export function monsterXp(monster, floorLevel) {
    return Math.round(XP_REWARDS.monsterBase * floorLevel + XP_REWARDS.monsterHpFactor * (monster.maxHp || 5));
}

// Heroic Masteries (choose one at each mastery level). `mods` feed Character passive modifiers.
export const MASTERIES = {
    reserve: {
        id: 'reserve', icon: '⚡', name: 'Heroic Reserve',
        desc: '+6 Max HP and every ability cooldown resets.',
        mods: { maxHp: 6 }, resetCooldowns: true
    },
    precision: {
        id: 'precision', icon: '🎯', name: 'Combat Precision',
        desc: '+1 to attack rolls and +1 weapon damage.',
        mods: { attack: 1, dmg: 1 }
    },
    bulwark: {
        id: 'bulwark', icon: '🛡️', name: 'Bulwark',
        desc: '+1 AC and +2 Max HP.',
        mods: { ac: 1, maxHp: 2 }
    },
    farsight: {
        id: 'farsight', icon: '👁️', name: 'Farsight',
        desc: '+2 Perception (sight radius, secret & trap detection).',
        mods: { per: 2 }
    }
};
