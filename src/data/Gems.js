// Socketable gems. Items roll 0-3 sockets; a gem set into a socket permanently adds a bonus that depends on the
// gem colour, its tier (1 Chipped, 2 Flawed, 3 Perfect) and the kind of item it is set into.

import { powerCategoryForSlot, describePower } from './Powers.js';

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

// opts: { cursed } - a cursed gem still gives its bonus, but costs the item something once it is set (see gemCursePenalty).
// The curse is hidden until the gem is identified (scroll, Identify spell, a bard's lore, a merchant) and then shows as a
// shadowed icon; holy water or shattering removes it.
export function createGem(type, tier = 1, opts = {}) {
    const t = GEM_TYPES[type];
    const name = `${GEM_TIER_NAMES[tier - 1]} ${t.name}`;
    const gem = {
        name,
        baseName: name,
        icon: t.icon,
        isGem: true,
        gemType: type,
        tier,
        cursed: !!opts.cursed,
        curseKnown: false,
        desc: ''
    };
    refreshGemDesc(gem);
    return gem;
}

export function refreshGemDesc(gem) {
    const tail = gem.cursed && gem.curseKnown ? ` ☠️ CURSED: socketing costs the item ${describeGemCurse(gem)}. Holy water purifies it; shattering it from a socket also breaks the curse.` : '';
    gem.desc = `${gem.name} (set it into a socket via Gear → item → Socket Gem). Gives: ${describeGemEffects(gem.gemType, gem.tier)}${tail}`;
}

// The price a cursed gem exacts, as item mods (negative)
export function gemCursePenalty(gem, category = 'armor') {
    const mods = { maxHp: -3 * gem.tier };
    if (category === 'weapon') mods.attack = -gem.tier;
    return mods;
}

export function describeGemCurse(gem, category = 'armor') {
    return Object.entries(gemCursePenalty(gem, category)).map(([k, v]) => `${v} ${MOD_LABELS[k] || k}`).join(', ');
}

// Reveals a loose gem's nature. Returns 'cursed' | 'clean' | null (already known)
export function identifyGem(gem) {
    if (!gem || !gem.isGem) return null;
    if (gem.cursed && !gem.curseKnown) {
        gem.curseKnown = true;
        gem.name = `Shadowed ${gem.baseName || gem.name}`;
        refreshGemDesc(gem);
        return 'cursed';
    }
    if (!gem.cursed && !gem.checked) { gem.checked = true; return 'clean'; }
    return null;
}

// Holy water: loose cursed gem becomes clean
export function purifyGem(gem) {
    if (!gem || !gem.cursed) return false;
    gem.cursed = false;
    gem.curseKnown = false;
    gem.checked = true;
    gem.name = gem.baseName || gem.name.replace(/^Shadowed /, '');
    refreshGemDesc(gem);
    return true;
}

export function randomGem(prng, floorLevel = 1) {
    const types = Object.keys(GEM_TYPES);
    // Diamonds are rare
    const type = prng.chance(0.08) ? 'diamond' : prng.choice(types.filter(x => x !== 'diamond'));
    let tier = 1;
    if (floorLevel >= 8 && prng.chance(0.3)) tier = 2;
    if (floorLevel >= 16 && prng.chance(0.2)) tier = 3;
    return createGem(type, tier, { cursed: prng.chance(0.07) });
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

// Permanently sets `gem` into `item`: mutates the item's stats / mods / powers and records the gem.
// opts.hidden: the gem is part of an unidentified item, so it is listed as unknown until identified.
export function socketGem(item, gem, powerLabel, opts = {}) {
    if (!item || !gem || !gem.isGem) return { success: false, reason: 'Not a gem' };
    if (freeSockets(item) <= 0) return { success: false, reason: 'No free sockets on that item' };
    const preview = previewGem(gem, item);
    const applied = { stats: {}, mods: {}, power: null, curse: null };

    for (const [k, v] of Object.entries(preview.stats)) { if (v) { item[k] = (item[k] || 0) + v; applied.stats[k] = v; } }
    if (!item.mods) item.mods = {};
    for (const [k, v] of Object.entries(preview.mods)) if (v) { item.mods[k] = (item.mods[k] || 0) + v; applied.mods[k] = v; }
    if (preview.power) {
        if (!item.powers) item.powers = [];
        const same = item.powers.find(p => p.id === preview.power.id);
        if (same) {
            applied.power = { id: preview.power.id, merged: true };
            if (preview.power.chance !== undefined) { const d = preview.power.chance * 0.5; applied.power.dChance = d; same.chance = Math.min(0.8, (same.chance || 0) + d); }
            if (preview.power.value !== undefined) { const d = preview.power.value * 0.5; applied.power.dValue = d; same.value = (same.value || 0) + d; }
        } else {
            item.powers.push({ ...preview.power });
            applied.power = { id: preview.power.id, merged: false };
        }
    }
    if (gem.cursed) {
        const penalty = gemCursePenalty(gem, gemCategory(item));
        for (const [k, v] of Object.entries(penalty)) item.mods[k] = (item.mods[k] || 0) + v;
        applied.curse = penalty;
    }
    if (!item.gems) item.gems = [];
    const summary = describePreview(preview, powerLabel);
    item.gems.push({
        type: gem.gemType, tier: gem.tier, icon: gem.icon, name: gem.name, summary,
        cursed: !!gem.cursed, curseKnown: !!gem.curseKnown, known: !opts.hidden, applied
    });
    return { success: true, summary, cursed: !!gem.cursed };
}

// Undoes a socketed gem's bonuses (and curse) exactly as they were applied
function reverseApplied(item, g) {
    const ap = g.applied || legacyApplied(item, g);
    for (const [k, v] of Object.entries(ap.stats || {})) item[k] = (item[k] || 0) - v;
    for (const [k, v] of Object.entries(ap.mods || {})) if (item.mods) { item.mods[k] = (item.mods[k] || 0) - v; if (!item.mods[k]) delete item.mods[k]; }
    for (const [k, v] of Object.entries(ap.curse || {})) if (item.mods) { item.mods[k] = (item.mods[k] || 0) - v; if (!item.mods[k]) delete item.mods[k]; }
    if (ap.power && item.powers) {
        const p = item.powers.find(x => x.id === ap.power.id);
        if (p) {
            if (ap.power.merged) {
                if (ap.power.dChance) p.chance = Math.max(0, (p.chance || 0) - ap.power.dChance);
                if (ap.power.dValue) p.value = Math.max(0, (p.value || 0) - ap.power.dValue);
            } else {
                item.powers = item.powers.filter(x => x !== p);
            }
        }
    }
}

// Gems socketed before reversal data was recorded: recompute from the gem table
function legacyApplied(item, g) {
    const pv = previewGem({ gemType: g.type, tier: g.tier }, item);
    return { stats: pv.stats, mods: pv.mods, power: pv.power ? { id: pv.power.id, merged: false } : null, curse: null };
}

// Shatter a gem out of its socket: the stone is lost one tier lower (a tier-1 stone is destroyed) and any curse is broken.
// Returns { gem } with the downgraded stone (or null).
export function shatterGem(item, idx) {
    const g = item?.gems?.[idx];
    if (!g) return null;
    reverseApplied(item, g);
    item.gems.splice(idx, 1);
    const tier = g.tier - 1;
    return { gem: tier >= 1 ? createGem(g.type, tier) : null, was: g };
}

// Holy water on a worn/bagged item: cleanses every cursed gem in it (its penalty is lifted, the gem stays)
export function purifySocketed(item) {
    let n = 0;
    for (const g of item.gems || []) {
        if (!g.cursed) continue;
        for (const [k, v] of Object.entries(g.applied?.curse || {})) if (item.mods) { item.mods[k] = (item.mods[k] || 0) - v; if (!item.mods[k]) delete item.mods[k]; }
        if (g.applied) g.applied.curse = null;
        g.cursed = false; g.curseKnown = false; g.checked = true;
        g.name = g.name.replace(/^Shadowed /, '');
        n++;
    }
    return n;
}

// Reveals the hidden/cursed state of every gem in an item. Returns the list of gems that turned out cursed.
export function identifySocketed(item) {
    const cursed = [];
    for (const g of item.gems || []) {
        g.known = true;
        if (g.cursed && !g.curseKnown) {
            g.curseKnown = true;
            g.name = `Shadowed ${g.name.replace(/^Shadowed /, '')}`;
            cursed.push(g);
        }
    }
    return cursed;
}

// ---- Fusion. Gems stack, so recipes count units across stacks. Cursed gems cannot be fused. ----
const clean = (i) => i && i.isGem && !i.cursed;
const units = (bag, pred) => bag.reduce((n, i) => (i && pred(i) ? n + (i.count || 1) : n), 0);

function takeOne(bag, pred) {
    for (let i = 0; i < bag.length; i++) {
        const it = bag[i];
        if (it && pred(it)) {
            if ((it.count || 1) > 1) it.count--; else bag[i] = null;
            return true;
        }
    }
    return false;
}

// 3 matching gems (same colour, same tier) fuse into one gem of the next tier
export function canFuse(bag, gem) {
    if (!clean(gem) || gem.tier >= MAX_GEM_TIER) return false;
    return units(bag, i => clean(i) && i.gemType === gem.gemType && i.tier === gem.tier) >= 3;
}

export function fuseGems(bag, gem) {
    if (!canFuse(bag, gem)) return null;
    for (let n = 0; n < 3; n++) takeOne(bag, i => clean(i) && i.gemType === gem.gemType && i.tier === gem.tier);
    return createGem(gem.gemType, gem.tier + 1);
}

// Rainbow: three different colours of the same tier fuse into one gem of the next tier, in one of those colours
export function rainbowTypes(bag, gem) {
    if (!clean(gem) || gem.tier >= MAX_GEM_TIER) return [];
    const types = [];
    for (const i of bag) if (i && clean(i) && i.tier === gem.tier && !types.includes(i.gemType)) types.push(i.gemType);
    return types;
}

export function canRainbow(bag, gem) {
    return rainbowTypes(bag, gem).length >= 3;
}

export function rainbowFuse(bag, gem, pick = (arr) => arr[Math.floor(Math.random() * arr.length)]) {
    if (!canRainbow(bag, gem)) return null;
    const all = rainbowTypes(bag, gem);
    const chosen = [gem.gemType, ...all.filter(t => t !== gem.gemType)].slice(0, 3);
    for (const t of chosen) takeOne(bag, i => clean(i) && i.gemType === t && i.tier === gem.tier);
    return createGem(pick(chosen), gem.tier + 1);
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

// What a gem of this type and tier gives in each kind of item, as one readable line
export function describeGemEffects(gemType, tier) {
    const cats = [['weapon', '⚔️ Weapon'], ['armor', '🛡️ Armor'], ['jewelry', '💍 Jewelry']];
    return cats.map(([cat, label]) => {
        const e = GEM_TABLE[gemType]?.[cat];
        if (!e) return `${label}: nothing`;
        const preview = { stats: e.s ? e.s(tier) : {}, mods: e.m ? e.m(tier) : {}, power: e.p ? e.p(tier) : null };
        return `${label}: ${describePreview(preview, describePower)}`;
    }).join(' · ');
}
