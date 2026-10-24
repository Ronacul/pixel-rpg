// Gold, item values and merchant stock.

import { generateLootItem, createItemFromBase, BASE_ITEMS, visibleView } from './Items.js';
import { randomGem, createGem, identifyGem } from './Gems.js';

// Base value of an item in gold
export function itemValue(item) {
    if (!item) return 0;
    if (item.isKey) return 0;
    if (item.unid) return itemValue(visibleView(item)) + 25; // unknown magic: merchants guess an average premium
    if (item.effect === 'identify') return 40;
    if (item.effect === 'uncurse') return 70;
    if (item.effect === 'holy_water') return 45;
    if (item.isGem) return Math.round((20 * item.tier * item.tier + (item.gemType === 'diamond' ? 30 : 0)) * (item.cursed && item.curseKnown ? 0.3 : 1));
    if (item.isConsumable) {
        return 6 + (item.healPotency || 0) * 0.8 + (item.rations || 0) * 6 + (item.statusOnHit ? 8 : 0);
    }
    let v = 12;
    v += (item.ac || 0) * 9;
    v += ((item.str || 0) + (item.dex || 0) + (item.con || 0) + (item.int || 0) + (item.wis || 0) + (item.cha || 0)) * 11;
    v += (item.dice || 0) * 2.5 * (item.diceCount || 1);
    v += (item.bonusFlat || 0) * 5;
    v += (item.powers ? item.powers.length : 0) * 35;
    v += (item.sockets || 0) * 12 + (item.gems ? item.gems.length : 0) * 18;
    if (item.setId) v += 40;
    if (item.mods) v += Object.values(item.mods).reduce((a, b) => a + b, 0) * 6;
    return Math.round(v);
}

export function buyPrice(item) {
    return Math.max(4, Math.round(itemValue(item) * 1.6));
}

export function sellPrice(item) {
    return Math.max(1, Math.round(itemValue(item) * 0.4));
}

export function goldForKill(prng, monster, floorLevel) {
    if (monster.isBoss) return 60 * floorLevel + prng.nextInt(0, 40 * floorLevel);
    const base = 1 + Math.floor((monster.maxHp || 6) / 5);
    return base + prng.nextInt(0, 2 + floorLevel);
}

export function goldForChest(prng, floorLevel) {
    return prng.nextInt(4, 10) * (1 + Math.floor(floorLevel / 2));
}

// A travelling merchant's wares for a floor (generated once, from the floor seed)
export function buildMerchantStock(prng, floorLevel) {
    const stock = [];
    const potions = BASE_ITEMS.filter(b => b.name === 'Minor Healing Potion' || b.name === 'Healing Potion');
    stock.push(createItemFromBase(potions[0]));
    stock.push(createItemFromBase(floorLevel >= 6 ? potions[1] : potions[0]));
    stock.push({ name: 'Hearty Ration', icon: '🍖', isConsumable: true, rations: 1, healPotency: 4, desc: 'Restores 1 Ration and 4 HP.' });
    { const g = randomGem(prng, floorLevel + 2); identifyGem(g); stock.push(g); } // merchants know what they sell
    const byName = (n) => BASE_ITEMS.find(b => b.name === n);
    stock.push(createItemFromBase(byName('Scroll of Identify')));
    if (prng.chance(0.6)) stock.push(createItemFromBase(byName('Holy Water Vial')));
    if (prng.chance(0.35)) stock.push(createItemFromBase(byName('Scroll of Remove Curse')));
    if (prng.chance(0.5)) stock.push(createGem(prng.choice(['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst']), 1));
    for (let i = 0; i < 3; i++) {
        let item = generateLootItem(prng, floorLevel + 2);
        let guard = 0;
        while ((item.isGem || item.isConsumable) && guard++ < 8) item = generateLootItem(prng, floorLevel + 2);
        stock.push(item);
    }
    return stock;
}

// Merchant services: price grows with the item's worth. `depth` is the floor's difficulty depth.
export function identifyPrice(item, depth = 1) {
    return 25 + depth * 4 + Math.round(itemValue(item) * 0.25);
}

export function uncursePrice(item, depth = 1) {
    return 60 + depth * 6 + Math.round(itemValue(item) * 0.4);
}
