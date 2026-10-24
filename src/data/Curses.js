// Curses on gear. A curse is attached when the item is generated and stays HIDDEN until the item is identified or worn.
// Cursed items are tempting on purpose: they always carry an extra power.
//   stats / mods  - flat penalties applied to the item itself (so every existing system just works)
//   (every curse locks the item: it cannot be taken off, and a cursed gem inside cannot be shattered, until it is lifted)
//   hunger        - the wearer burns rations twice as fast
//   drain         - saps 1 HP every `every` turns (never kills)
//   weapon        - only rolled on weapons; nonWeapon - never on weapons
//
// Ways to lift a curse: Holy Water (one item or gem), Scroll of Remove Curse (everything worn), a cleric's Remove Curse,
// an altar, a merchant's service, or a fountain with luck. Gems can carry their own curse (see data/Gems.js).

export const CURSES = {
    weakness:   { id: 'weakness',   name: 'Weakness',   icon: '🥀', stats: { str: -2 }, desc: '−2 STR', weight: 3 },
    clumsiness: { id: 'clumsiness', name: 'Clumsiness', icon: '🪢', stats: { dex: -2 }, desc: '−2 DEX', weight: 3 },
    dullness:   { id: 'dullness',   name: 'Dullness',   icon: '🩸', mods: { attack: -2, dmg: -1 }, desc: '−2 Attack, −1 Damage', weight: 3, weapon: true },
    brittle:    { id: 'brittle',    name: 'Brittleness', icon: '🧊', stats: { ac: -2 }, desc: '−2 AC', weight: 3, nonWeapon: true },
    frailty:    { id: 'frailty',    name: 'Frailty',    icon: '💔', mods: { maxHp: -8 }, desc: '−8 Max HP', weight: 3 },
    binding:    { id: 'binding',    name: 'Binding',    icon: '⛓️', stats: { cha: -1 }, sticky: true, desc: '−1 CHA and it cannot be removed', weight: 2 },
    famine:     { id: 'famine',     name: 'Famine',     icon: '🍂', hunger: true, desc: 'rations run out twice as fast', weight: 2 },
    leech:      { id: 'leech',      name: 'Leeching',   icon: '🦇', drain: true, every: 12, desc: 'saps 1 HP every 12 turns', weight: 2 }
};

export function rollCurse(prng, isWeapon) {
    const pool = Object.values(CURSES).filter(c => (isWeapon ? !c.nonWeapon : !c.weapon));
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let r = prng.next() * total;
    for (const c of pool) { r -= c.weight; if (r <= 0) return c.id; }
    return pool[0].id;
}

// Attaches a curse to an item, applying its penalties. `known` = already revealed.
export function attachCurse(item, id, known = false) {
    const def = CURSES[id];
    if (!def || item.curse) return false;
    const applied = { stats: {}, mods: {} };
    for (const [k, v] of Object.entries(def.stats || {})) { item[k] = (item[k] || 0) + v; applied.stats[k] = v; }
    if (def.mods) {
        if (!item.mods) item.mods = {};
        for (const [k, v] of Object.entries(def.mods)) { item.mods[k] = (item.mods[k] || 0) + v; applied.mods[k] = v; }
    }
    item.curse = { id, known, sticky: true, applied }; // every curse locks the item until it is lifted
    return true;
}

// Lifts an item's own curse (gems are handled in Gems.js). Returns the removed curse id or null.
export function removeCurse(item) {
    const c = item?.curse;
    if (!c) return null;
    for (const [k, v] of Object.entries(c.applied?.stats || {})) item[k] = (item[k] || 0) - v;
    for (const [k, v] of Object.entries(c.applied?.mods || {})) if (item.mods) { item.mods[k] = (item.mods[k] || 0) - v; if (!item.mods[k]) delete item.mods[k]; }
    const id = c.id;
    delete item.curse;
    return id;
}

export function isStuck(item) {
    return !!(item && item.curse && item.curse.sticky);
}

export function curseLine(item) {
    const c = item?.curse;
    if (!c || !c.known) return '';
    const d = CURSES[c.id];
    return `${d.icon} ${d.name}: ${d.desc}`;
}

// Why an item cannot come off, or null. Its own curse or any cursed gem set in it locks it.
export function lockReason(item) {
    if (!item) return null;
    if (item.curse) return `${item.name} is cursed and will not come off. Lift the curse first (holy water, remove curse, an altar or a merchant).`;
    if ((item.gems || []).some(g => g.cursed)) return `${item.name} holds a cursed gem and will not come off. Purify the gem first (holy water, remove curse, an altar or a merchant).`;
    return null;
}
