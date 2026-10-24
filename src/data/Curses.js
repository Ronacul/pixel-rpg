// Curses on gear. A curse is attached when the item is generated and stays HIDDEN until the item is identified or worn.
// Cursed items are tempting on purpose: they always carry an extra power.
//   stats / mods  - flat penalties applied to the item itself (so every existing system just works)
//   sticky        - cannot be taken off until the curse is lifted
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
    item.curse = { id, known, sticky: !!def.sticky, applied };
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
