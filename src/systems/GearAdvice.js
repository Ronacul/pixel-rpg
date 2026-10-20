// Gear management helpers: score items, compare against what is equipped, flag upgrades and junk.

import { getCompatibleSlots } from '../data/Items.js';
import { describePower } from '../data/Powers.js';

const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function avgDamage(item) {
    if (!item.dice) return 0;
    return ((item.dice + 1) / 2) * (item.diceCount || 1) + (item.bonusFlat || 0);
}

// A single rough "how good is this" number. Only meant for ranking items for the SAME slot.
export function itemScore(item) {
    if (!item) return 0;
    let s = (item.ac || 0) * 3;
    for (const k of STAT_KEYS) s += (item[k] || 0) * 2;
    s += avgDamage(item) * 0.9;
    if (item.delivery === 'RANGED' || item.delivery === 'AOE') s += (item.range || 0) * 0.3;
    s += (item.powers ? item.powers.length : 0) * 6;
    if (item.mods) s += Object.values(item.mods).reduce((a, b) => a + b, 0) * 2;
    s += (item.gems ? item.gems.length : 0) * 2;
    if (item.setId) s += 4;
    if (item.statusOnHit) s += 2;
    return s;
}

// The equipped item (or empty slot) a bag item would replace: an empty compatible slot first, else the weakest
export function comparisonTarget(player, item) {
    const slots = getCompatibleSlots(item);
    if (slots.length === 0) return null;
    const empty = slots.find(sl => !player.equipment[sl]);
    if (empty) return { slot: empty, current: null };
    let weakest = slots[0];
    for (const sl of slots) if (itemScore(player.equipment[sl]) < itemScore(player.equipment[weakest])) weakest = sl;
    return { slot: weakest, current: player.equipment[weakest] };
}

// Stat-by-stat differences new vs current, as { label, delta } entries
export function diffItems(newItem, current) {
    const rows = [];
    const add = (label, a, b) => {
        const d = Math.round((a - b) * 10) / 10;
        if (d !== 0) rows.push({ label, delta: d });
    };
    add('AC', newItem.ac || 0, current?.ac || 0);
    for (const k of STAT_KEYS) add(k.toUpperCase(), newItem[k] || 0, current?.[k] || 0);
    if (newItem.dice || current?.dice) add('avg dmg', avgDamage(newItem), current ? avgDamage(current) : 0);
    if ((newItem.delivery === 'RANGED' || current?.delivery === 'RANGED') && (newItem.range || current?.range)) add('range', newItem.range || 0, current?.range || 0);
    const mods = (it) => (it?.mods ? it.mods : {});
    for (const [k, label] of [['maxHp', 'Max HP'], ['attack', 'attack'], ['dmg', 'dmg'], ['per', 'PER']]) add(label, mods(newItem)[k] || 0, mods(current)[k] || 0);
    const newPowers = (newItem.powers || []).map(p => p.id);
    const oldPowers = (current?.powers || []).map(p => p.id);
    const gained = (newItem.powers || []).filter(p => !oldPowers.includes(p.id)).map(describePower);
    const lost = (current?.powers || []).filter(p => !newPowers.includes(p.id)).map(describePower);
    return { rows, gained, lost };
}

// 'upgrade' | 'downgrade' | 'sidegrade' | 'new' | null (not gear)
export function adviceFor(player, item) {
    if (!item || !item.slot || item.isConsumable || item.isGem || item.isKey) return null;
    const target = comparisonTarget(player, item);
    if (!target) return null;
    if (!target.current) return 'new';
    const a = itemScore(item), b = itemScore(target.current);
    if (a > b + 0.5) return 'upgrade';
    if (a < b - 0.5) return 'downgrade';
    return 'sidegrade';
}

// HTML snippet comparing a bag item with whatever it would replace
export function compareHtml(player, item) {
    const target = comparisonTarget(player, item);
    if (!target) return '';
    const { rows, gained, lost } = diffItems(item, target.current);
    const verdict = adviceFor(player, item);
    const head = target.current
        ? `vs equipped <b>${target.current.name}</b>:`
        : `Empty slot: wearing this adds:`;
    const parts = rows.map(r => `<span style="color:${r.delta > 0 ? '#55ff77' : '#ff6677'}">${r.delta > 0 ? '▲ +' : '▼ '}${r.delta} ${r.label}</span>`);
    gained.forEach(g => parts.push(`<span style="color:#55ff77">▲ ${g}</span>`));
    lost.forEach(l => parts.push(`<span style="color:#ff6677">▼ loses ${l}</span>`));
    const tag = { upgrade: '⬆️ Upgrade', downgrade: '⬇️ Worse than what you wear', sidegrade: '↔️ About equal', new: '🆕 Fills an empty slot' }[verdict] || '';
    return `<div style="margin-top:3px;"><b style="color:#ffcc00;">${tag}</b> ${head} ${parts.join(' ') || 'no change'}</div>`;
}

// Bag items better than what is equipped, best first, one per target slot
export function findUpgrades(player) {
    const picks = [];
    const used = new Set();
    const cands = [];
    player.backpack.forEach((item, idx) => {
        const verdict = adviceFor(player, item);
        if (verdict === 'upgrade' || verdict === 'new') cands.push({ idx, item, gain: itemScore(item) - itemScore(comparisonTarget(player, item).current) });
    });
    cands.sort((a, b) => b.gain - a.gain);
    for (const c of cands) {
        const t = comparisonTarget(player, c.item);
        if (!t || used.has(t.slot)) continue;
        used.add(t.slot);
        picks.push({ idx: c.idx, slot: t.slot });
    }
    return picks;
}

// Bag gear that is strictly worse than everything you wear in its slots, with nothing special about it
export function isJunk(player, item) {
    if (adviceFor(player, item) !== 'downgrade') return false;
    if (item.setId || (item.powers && item.powers.length) || (item.gems && item.gems.length)) return false;
    return true;
}

// Sort key for the bag: equippable gear by slot then score, then gems, then consumables
export function bagSortKey(item) {
    if (!item) return [9, 0, ''];
    if (item.isKey) return [0, 0, item.name];
    if (item.slot && !item.isConsumable) return [1, -itemScore(item), item.slot + item.name];
    if (item.isGem) return [2, -(item.tier || 1), item.name];
    return [3, 0, item.name];
}
