// Character creation: ability score generation, class requirements and race restrictions.
//
// Scores can come from three sources: the class template (balanced, every class available), rolled dice
// (4d6 drop lowest x6, kept in descending order and assigned to a class' stats by priority), or the standard array.
// A class is available only if the race allows it AND the final scores (assignment + race modifiers) meet its minimums.

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const SCORE_MODES = {
    template: { label: '⚖️ Class template (balanced)' },
    roll:     { label: '🎲 Roll the dice (4d6, drop lowest)' },
    standard: { label: '📊 Standard array (15 14 13 12 10 8)' }
};

// priority: which stats the best rolls go to; min: minimum FINAL score (after race) needed to take the class
export const CLASS_CREATION = {
    warrior: { priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'], min: { str: 13 } },
    wizard:  { priority: ['int', 'dex', 'con', 'wis', 'cha', 'str'], min: { int: 13 } },
    thief:   { priority: ['dex', 'int', 'con', 'cha', 'wis', 'str'], min: { dex: 13 } },
    cleric:  { priority: ['wis', 'con', 'str', 'cha', 'dex', 'int'], min: { wis: 13 } },
    ranger:  { priority: ['dex', 'wis', 'con', 'str', 'int', 'cha'], min: { dex: 13, wis: 11 } },
    bard:    { priority: ['cha', 'dex', 'con', 'int', 'wis', 'str'], min: { cha: 13, dex: 11 } },
    monk:    { priority: ['dex', 'wis', 'con', 'str', 'int', 'cha'], min: { dex: 13, wis: 12 } },
    druid:   { priority: ['wis', 'con', 'int', 'dex', 'cha', 'str'], min: { wis: 13, con: 11 } }
};

const DEFAULT_CREATION = { priority: ['str', 'dex', 'con', 'int', 'wis', 'cha'], min: {} };

export function creationFor(classId) {
    return CLASS_CREATION[classId] || DEFAULT_CREATION;
}

// 4d6 drop lowest, six times, highest first
export function rollAbilityScores(rand = Math.random) {
    const one = () => {
        const d = [0, 0, 0, 0].map(() => 1 + Math.floor(rand() * 6)).sort((a, b) => a - b);
        return d[1] + d[2] + d[3];
    };
    return Array.from({ length: 6 }, one).sort((a, b) => b - a);
}

// Best rolls to the class' priority stats
export function assignScores(rolls, classId) {
    const sorted = [...rolls].sort((a, b) => b - a);
    const out = {};
    creationFor(classId).priority.forEach((k, i) => { out[k] = sorted[i]; });
    return out;
}

// scores = class template or assigned rolls, then race modifiers (never below 3)
export function finalScores(classDef, race, rolls) {
    const base = rolls ? assignScores(rolls, classDef.id) : { ...classDef.attributes };
    const out = {};
    for (const k of ABILITY_KEYS) out[k] = Math.max(3, (base[k] || 10) + (race?.attrs?.[k] || 0));
    return out;
}

// { ok, reasons[] } for a class given the race and rolls (rolls null = class template, which always qualifies)
export function classEligibility(classDef, race, rolls) {
    const reasons = [];
    if (race?.bannedClasses?.includes(classDef.id)) reasons.push(`${race.name}s cannot be ${classDef.name}s`);
    if (rolls) {
        const scores = finalScores(classDef, race, rolls);
        for (const [k, need] of Object.entries(creationFor(classDef.id).min)) {
            if (scores[k] < need) reasons.push(`needs ${k.toUpperCase()} ${need}+ (you would have ${scores[k]})`);
        }
    }
    return { ok: reasons.length === 0, reasons };
}
