// Gear management helpers: score items, compare against what is equipped, flag upgrades and junk.

import { getCompatibleSlots, visibleView } from '../data/Items.js';
import { usability } from '../data/Proficiency.js';
import { describePower } from '../data/Powers.js';

const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function avgDamage(item) {
    if (!item.dice) return 0;
    return ((item.dice + 1) / 2) * (item.diceCount || 1) + (item.bonusFlat || 0);
}

// A single rough "how good is this" number. Only meant for ranking items for the SAME slot.
export function itemScore(item) {
    item = visibleView(item); // unidentified magic cannot be judged yet
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
    newItem = visibleView(newItem);
    current = visibleView(current);
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
    if (!usability(player.characterClass, item).ok) return 'unusable';
    if (item.unid) return 'unknown';
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
    const u = usability(player.characterClass, item);
    if (item && item.slot && !item.isConsumable && !u.ok) return `<div style="margin-top:3px;"><b style="color:#ff8a8a;">🚫 Cannot use:</b> ${u.reason}. Value 0: sell it or drop it first.</div>`;
    if (item?.unid) return `<div style="margin-top:3px;"><b style="color:#b9a8ff;">❓ Unidentified</b> Wearing it identifies it over time, but any magic on it is a gamble (it may be cursed). Identify it first to compare.</div>`;
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
    const tag = { unknown: '❓ Unknown', upgrade: '⬆️ Upgrade', downgrade: '⬇️ Worse than what you wear', sidegrade: '↔️ About equal', new: '🆕 Fills an empty slot' }[verdict] || '';
    const rt = itemRating(player, item);
    const rtHtml = rt && rt.grade !== '?' ? ` <span style="color:#9aa0bd;">Keep value <b>${rt.grade}</b>: ${rt.note}.</span>` : '';
    return `<div style="margin-top:3px;"><b style="color:#ffcc00;">${tag}</b> ${head} ${parts.join(' ') || 'no change'}${rtHtml}</div>`;
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
    const v = adviceFor(player, item);
    if (v === 'unusable') return !item.unid && !item.setId && !(item.powers && item.powers.length) && !(item.gems && item.gems.length);
    if (v !== 'downgrade') return false;
    if (item.unid || item.setId || (item.powers && item.powers.length) || (item.gems && item.gems.length)) return false;
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

// ---- Value rating: how much an item is worth KEEPING for this hero, to decide what to drop ----
// Compared with the best item the hero owns for the same slot (usable ones only). 0 = cannot be used at all.
// Returns { grade: 'A'..'D' | 'X' | '?', score, pct, note }
export function itemRating(player, item) {
    if (!item || !item.slot || item.isConsumable || item.isGem || item.isKey) return null;
    const u = usability(player.characterClass, item);
    if (!u.ok) return { grade: 'X', score: 0, pct: 0, note: u.reason };
    if (item.unid) return { grade: '?', score: 0, pct: null, note: 'unidentified: value unknown' };
    const slots = getCompatibleSlots(item);
    const others = [];
    const consider = (it) => {
        if (!it || it === item || !it.slot || it.unid) return;
        if (!slots.some(s => getCompatibleSlots(it).includes(s))) return;
        if (!usability(player.characterClass, it).ok) return;
        others.push(itemScore(it));
    };
    Object.values(player.equipment).forEach(consider);
    player.backpack.forEach(consider);
    const score = itemScore(item);
    // With two slots to fill (rings) the bar is the weaker of your two best; with one slot it is your best
    others.sort((a, b) => b - a);
    const bar = others.length >= slots.length ? others[slots.length - 1] : 0;
    const ref = Math.max(bar, score, 1);
    const pct = Math.round((100 * score) / ref);
    const grade = pct >= 100 ? 'A' : pct >= 80 ? 'B' : pct >= 55 ? 'C' : 'D';
    const note = pct >= 100 ? 'best you have for this slot' : `${pct}% of your best for this slot`;
    return { grade, score: Math.round(score * 10) / 10, pct, note };
}

// Index of the least valuable gear item in the bag range [a, b): unusable first, then lowest percentage
export function lowestValueIndex(player, a, b) {
    let worst = -1, worstKey = Infinity;
    for (let i = a; i < b; i++) {
        const it = player.backpack[i];
        const r = itemRating(player, it);
        if (!r || r.grade === '?') continue;
        const key = r.grade === 'X' ? -1 : r.pct;
        if (key < worstKey) { worstKey = key; worst = i; }
    }
    return worst;
}
