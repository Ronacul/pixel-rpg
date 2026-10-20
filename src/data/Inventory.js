// Inventory compartments. The backpack is ONE flat array (so every index-based feature keeps working) split into
// fixed ranges, one per compartment. Items route to their compartment automatically; each fills independently.
// Add a compartment here (and an icon) to give a new kind of item its own bag.

export const COMPARTMENTS = [
    { id: 'gear',    label: 'Gear',       icon: '⚔️', size: 30, fallback: true,  hint: 'weapons, armor, jewelry' },
    { id: 'gems',    label: 'Gems',       icon: '💎', size: 20, hint: 'socketable gems' },
    { id: 'food',    label: 'Provisions', icon: '🍖', size: 15, hint: 'rations, meat, mushrooms, herbs' },
    { id: 'alchemy', label: 'Alchemy',    icon: '🧪', size: 10, hint: 'potions, flasks, scrolls, venoms' }
];

export const TOTAL_SLOTS = COMPARTMENTS.reduce((sum, c) => sum + c.size, 0);

// First index of each compartment
const STARTS = {};
{
    let i = 0;
    for (const c of COMPARTMENTS) { STARTS[c.id] = i; i += c.size; }
}

export function compartmentRange(id) {
    const c = COMPARTMENTS.find(x => x.id === id);
    return [STARTS[id], STARTS[id] + c.size];
}

export function compartmentOfIndex(idx) {
    for (const c of COMPARTMENTS) {
        const [a, b] = compartmentRange(c.id);
        if (idx >= a && idx < b) return c.id;
    }
    return 'gear';
}

function isFood(item) {
    return !!item.isConsumable && ((item.rations || 0) > 0 || !!item.isMushroom || /meat|herb|ration/i.test(item.name || ''));
}

// Which compartment an item belongs in
export function compartmentOf(item) {
    if (!item) return 'gear';
    if (item.isGem) return 'gems';
    if (isFood(item)) return 'food';
    if (item.isConsumable) return 'alchemy';
    return 'gear';
}
