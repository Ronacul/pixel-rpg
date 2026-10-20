// Socketable gems. Items roll 0-3 sockets; a gem set into a socket permanently adds a bonus that depends on the
// gem colour, its tier (1 Chipped, 2 Flawed, 3 Perfect) and the kind of item it is set into.

import { powerCategoryForSlot } from './Powers.js';

export const GEM_TYPES = {
    ruby:     { id: 'ruby',     name: 'Ruby',     icon: '🔴', color: '#ff4455' },
    sapphire: { id: 'sapphire', name: 'Sapphire', icon: '🔵', color: '#4488ff' },
    emerald:  { id: 'emerald',  name: 'Emerald',  icon: '🟢', color: '#44dd66' },
    topaz:    { id: 'topaz',    name: 'Topaz',    icon: '🟡', color: '#ffcc33' },
    amethyst: { id: 'amethyst', name: 'Amethyst', icon: '🟣', color: '#b070ff' },
    diamond:  { id: 'diamond',  name: 'Diamond',  icon: '⚪', color: '#e8f0ff' }
};

export const GEM_TIER_NAMES = ['Chipped', 'Flawed', 'Perfect'];
export const MAX_GEM_TIER = 3;

// Bonus per gem type and item category. `s` = flat stat fields on the item (str dex con int wis cha ac),
// `m` = hero passive mods (maxHp attack dmg per regen), `p` = power instance. Every value is multiplied by tier
// unless it is a function of tier.
const GEM_TABLE = {
    ruby: {
        weapon:  { p: (t) => ({ id: 'ignite', chance: 0.12 + 0.08 * t }) },
        armor:   { m: (t) => ({ maxHp: 3 * t }), p: (t) => (t >= 2 ? { id: 'fireward' } : null) },
        jewelry: { s: (t) => ({ str: t }) }
    },
    sapphire: {
        weapon:  { p: (t) => ({ id: 'frostbite', chance: 0.15 + 0.1 * t }) },
        armor:   { s: (t) => ({ ac: t >= 3 ? 2 : 1 }) },
        jewelry: { s: (t) => ({ int: t }) }
    },
    emerald: {
        weapon:  { p: (t) => ({ id: 'venom', chance: 0.15 + 0.1 * t }) },
        armor:   { m: (t) => ({ regen: t >= 3 ? 1 : 0, maxHp: 2 * t }), p: (t) => (t >= 2 ? { id: 'poisonward' } : null) },
        jewelry: { s: (t) => ({ dex: t }) }
    },
    topaz: {
        weapon:  { m: (t) => ({ attack: t }) },
        armor:   { m: (t) => ({ per: t }) },
        jewelry: { s: (t) => ({ wis: t }), p: (t) => (t >= 2 ? { id: 'trapsense', value: 2 + t } : null) }
    },
    amethyst: {
        weapon:  { m: (t) => ({ dmg: t }) },
        armor:   { m: (t) => ({ maxHp: 4 * t }) },
        jewelry: { s: (t) => ({ cha: t }) }
    },
    diamond: {
        weapon:  { p: (t) => ({ id: 'vampiric', value: 0.04 + 0.04 * t }) },
        armor:   { s: (t) => ({ ac: t }), m: (t) => ({ maxHp: 2 * t }) },
        jewelry: { s: (t) => ({ con: t }), m: (t) => ({ maxHp: 2 * t }) }
    }
};

export function createGem(type, tier = 1) {
    const t = GEM_TYPES[type];
    const name = `${GEM_TIER_NAMES[tier - 1]} ${t.name}`;
    return {
        name,
        icon: t.icon,
        isGem: true,
        gemType: type,
        tier,
        desc: `${name}: set into an item socket (Gear → item → Socket Gem). Weapons, armor and jewelry each get a different bonus.`
    };
}

export function randomGem(prng, floorLevel = 1) {
    const types = Object.keys(GEM_TYPES);
    // Diamonds are rare
    const type = prng.chance(0.08) ? 'diamond' : prng.choice(types.filter(x => x !== 'diamond'));
    let tier = 1;
    if (floorLevel >= 8 && prng.chance(0.3)) tier = 2;
    if (floorLevel >= 16 && prng.chance(0.2)) tier = 3;
    return createGem(type, tier);
}

export function gemCategory(item) {
    return powerCategoryForSlot(item.slot);
}

// What a gem would add to this item (without applying it)
export function previewGem(gem, item) {
    const entry = GEM_TABLE[gem.gemType]?.[gemCategory(item)];
    if (!entry) return { stats: {}, mods: {}, power: null };
    return {
        stats: entry.s ? entry.s(gem.tier) : {},
        mods: entry.m ? entry.m(gem.tier) : {},
        power: entry.p ? entry.p(gem.tier) : null
    };
}

const STAT_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA', ac: 'AC' };
const MOD_LABELS = { maxHp: 'Max HP', attack: 'Attack', dmg: 'Damage', per: 'Perception', regen: 'Regen' };

export function describePreview(preview, powerLabel) {
    const bits = [];
    for (const [k, v] of Object.entries(preview.stats)) if (v) bits.push(`+${v} ${STAT_LABELS[k]}`);
    for (const [k, v] of Object.entries(preview.mods)) if (v) bits.push(`+${v} ${MOD_LABELS[k]}`);
    if (preview.power && powerLabel) bits.push(powerLabel(preview.power));
    return bits.join(', ') || 'no effect';
}

export function freeSockets(item) {
    return (item.sockets || 0) - (item.gems ? item.gems.length : 0);
}

// Permanently sets `gem` into `item`: mutates the item's stats / mods / powers and records the gem
export function socketGem(item, gem, powerLabel) {
    if (!item || !gem || !gem.isGem) return { success: false, reason: 'Not a gem' };
    if (freeSockets(item) <= 0) return { success: false, reason: 'No free sockets on that item' };
    const preview = previewGem(gem, item);

    for (const [k, v] of Object.entries(preview.stats)) item[k] = (item[k] || 0) + v;
    if (!item.mods) item.mods = {};
    for (const [k, v] of Object.entries(preview.mods)) if (v) item.mods[k] = (item.mods[k] || 0) + v;
    if (preview.power) {
        if (!item.powers) item.powers = [];
        const same = item.powers.find(p => p.id === preview.power.id);
        if (same) {
            if (preview.power.chance !== undefined) same.chance = Math.min(0.8, (same.chance || 0) + preview.power.chance * 0.5);
            if (preview.power.value !== undefined) same.value = (same.value || 0) + preview.power.value * 0.5;
        } else {
            item.powers.push({ ...preview.power });
        }
    }
    if (!item.gems) item.gems = [];
    const summary = describePreview(preview, powerLabel);
    item.gems.push({ type: gem.gemType, tier: gem.tier, icon: gem.icon, name: gem.name, summary });
    return { success: true, summary };
}

// 3 matching gems of the same tier fuse into one gem of the next tier. Returns the new gem or null.
export function canFuse(bag, gem) {
    if (!gem || !gem.isGem || gem.tier >= MAX_GEM_TIER) return false;
    return bag.filter(i => i && i.isGem && i.gemType === gem.gemType && i.tier === gem.tier).length >= 3;
}

export function fuseGems(bag, gem) {
    if (!canFuse(bag, gem)) return null;
    let removed = 0;
    for (let i = 0; i < bag.length && removed < 3; i++) {
        const it = bag[i];
        if (it && it.isGem && it.gemType === gem.gemType && it.tier === gem.tier) {
            bag[i] = null;
            removed++;
        }
    }
    return createGem(gem.gemType, gem.tier + 1);
}

// Socket count for freshly generated gear
export function rollSockets(prng, floorLevel = 1) {
    const r = prng.next();
    const bonus = Math.min(0.2, floorLevel * 0.008);
    if (r < 0.04 + bonus * 0.5) return 3;
    if (r < 0.15 + bonus) return 2;
    if (r < 0.40 + bonus) return 1;
    return 0;
}
