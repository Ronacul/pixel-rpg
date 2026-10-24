// Identification and curse removal.
//
// Unidentified gear (item.unid) works exactly like the real thing - its hidden bonuses, power, pre-set gems and curse are
// all active - but the player only sees the plain base item. It is revealed by:
//   - wearing it: every IDENTIFY_EVERY turns the wearer rolls d20 + Perception mod (+ a bard's lore) against the item's DC,
//     and a long enough wear always works
//   - a Scroll of Identify, a wizard's Identify spell, a merchant, a fountain
//   - bards also study what is in their bag (and loose gems) as they walk
// Curses show themselves the moment the item is put on. They are lifted by Holy Water Vial (one item or gem), a Scroll of
// Remove Curse or a cleric's Remove Curse (everything worn), an altar, a merchant, or a lucky fountain.

import { buildItemDesc, refreshItemDesc } from '../data/Items.js';
import { removeCurse, CURSES } from '../data/Curses.js';
import { identifyGem, identifySocketed, purifySocketed, purifyGem } from '../data/Gems.js';

export const IDENTIFY_EVERY = 15;
export const AUTO_IDENTIFY_TURNS = 240;

export function hasUnknownParts(item) {
    if (!item) return false;
    if (item.isGem) return !!(item.cursed ? !item.curseKnown : !item.checked);
    return !!item.unid || (item.gems || []).some(g => g.known === false);
}

export function isCursedKnown(item) {
    if (!item) return false;
    if (item.isGem) return !!(item.cursed && item.curseKnown);
    return !!(item.curse && item.curse.known) || (item.gems || []).some(g => g.cursed && g.curseKnown);
}

export function hasAnyCurse(item) {
    if (!item) return false;
    if (item.isGem) return !!item.cursed;
    return !!item.curse || (item.gems || []).some(g => g.cursed);
}

// Fully reveals one item (or loose gem). Returns a list of human-readable findings, or null when nothing was hidden.
export function identifyItem(item) {
    if (!item) return null;
    if (item.isGem) {
        const r = identifyGem(item);
        if (r === 'cursed') return [`${item.name} is CURSED: it will cost an item something when set`];
        if (r === 'clean') return [`${item.name} is sound and untainted`];
        return null;
    }
    if (!hasUnknownParts(item)) return null;
    const found = [];
    if (item.unid) {
        item.unid = false;
        if (item.trueName) { item.name = item.trueName; delete item.trueName; }
        found.push(`it is ${item.name}`);
    }
    if (item.curse && !item.curse.known) item.curse.known = true;
    if (item.curse) found.push(`☠️ cursed with ${CURSES[item.curse.id].name} (${CURSES[item.curse.id].desc})`);
    const bad = identifySocketed(item);
    for (const g of bad) found.push(`its ${g.name.replace('Shadowed ', '')} is CURSED`);
    if ((item.gems || []).length) found.push(`${item.gems.length} gem${item.gems.length > 1 ? 's' : ''} set`);
    refreshItemDesc(item);
    return found;
}

// A curse announces itself the moment the item is worn. Returns a message or null.
export function revealOnEquip(item) {
    if (!item) return null;
    const hiddenGems = (item.gems || []).filter(g => g.cursed && !g.curseKnown);
    for (const g of hiddenGems) { g.curseKnown = true; g.name = `Shadowed ${g.name.replace('Shadowed ', '')}`; } // the curse is felt; what the gem IS stays hidden
    if (!item.curse || item.curse.known) {
        return hiddenGems.length ? `☠️ ${item.name} holds a CURSED gem (${hiddenGems.map(g => g.name.replace('Shadowed ', '')).join(', ')}): it will not come off until the gem is purified.` : null;
    }
    item.curse.known = true;
    const d = CURSES[item.curse.id];
    if (item.unid) item.name = item.name.replace('(?)', '(☠️)');
    refreshItemDesc(item);
    return `☠️ ${item.trueName || item.name} is CURSED: ${d.name}, ${d.desc}!${item.curse.sticky ? ' It clings to you and cannot be removed until the curse is lifted.' : ''}`;
}

// Holy water on one item or gem: lifts its curse and every cursed gem inside. Returns the number of curses lifted.
export function purifyItem(item) {
    if (!item) return 0;
    if (item.isGem) return purifyGem(item) ? 1 : 0;
    let n = 0;
    if (item.curse) {
        removeCurse(item);
        n++;
        if (item.unid) item.name = item.name.replace('(☠️)', '(?)');
    }
    n += purifySocketed(item);
    refreshItemDesc(item);
    return n;
}

function wornItems(player) {
    return Object.values(player.equipment).filter(Boolean);
}

// Scroll of Remove Curse / cleric / altar. scope 'worn' = equipped gear only, 'all' = worn plus bag.
export function cleanseCurses(player, scope = 'worn') {
    let n = 0;
    const list = scope === 'all' ? [...wornItems(player), ...player.backpack.filter(Boolean)] : wornItems(player);
    for (const it of list) if (!it.isConsumable) n += purifyItem(it);
    return n;
}

// First thing worth identifying: preferred item, then worn, then bag
export function nextUnknown(player, prefer = null) {
    if (prefer && hasUnknownParts(prefer)) return prefer;
    const worn = wornItems(player).find(hasUnknownParts);
    if (worn) return worn;
    return player.backpack.find(i => i && !i.isConsumable && hasUnknownParts(i)) || null;
}

// Called once per player turn. `post(msg)` shows a message; `roll()` returns 1-20.
// Returns true when anything changed (so the UI can refresh).
export function tickIdentify(player, roll, post) {
    let changed = false;
    const isBard = player.characterClass?.id === 'bard';
    const perBonus = (player.perMod || 0) + (isBard ? 5 : 0);

    for (const item of wornItems(player)) {
        if (!hasUnknownParts(item)) continue;
        item.idTurns = (item.idTurns || 0) + 1;
        const limit = isBard ? AUTO_IDENTIFY_TURNS / 2 : AUTO_IDENTIFY_TURNS;
        const due = item.idTurns % IDENTIFY_EVERY === 0;
        if (item.idTurns >= limit || (due && roll() + perBonus >= (item.idDC || 12))) {
            const name = item.name;
            const found = identifyItem(item);
            if (found) {
                post(`${isBard ? '🪕 Your lore tells you' : '👁️ Using it, you work out that'} ${name}: ${found.join('; ')}.`);
                changed = true;
            }
        }
    }

    // Bards study the whole bag, loose gems included
    if (isBard && player.turnCount % 20 === 0) {
        const pool = player.backpack.filter(i => i && (i.isGem || !i.isConsumable) && hasUnknownParts(i));
        if (pool.length) {
            const target = pool[0];
            if (roll() + perBonus >= (target.idDC || 12)) {
                const name = target.name;
                const found = identifyItem(target);
                if (found) { post(`🪕 Leafing through your pack, your lore reveals ${name}: ${found.join('; ')}.`); changed = true; }
            }
        }
    }
    return changed;
}

// Per-turn curse effects on worn gear. Returns true when HP changed.
export function tickCurses(player, post) {
    let changed = false;
    for (const item of wornItems(player)) {
        const c = item.curse && CURSES[item.curse.id];
        if (!c) continue;
        if (c.hunger) player.hungerTurns += 1; // rations burn twice as fast
        if (c.drain && player.turnCount % c.every === 0 && player.hp > 1) {
            player.hp -= 1;
            changed = true;
            if (item.curse.known) post(`🦇 ${item.name} saps a little of your life.`);
        }
    }
    return changed;
}

export { buildItemDesc };
