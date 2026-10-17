// Item & Equipment Catalog with Affix Generators

export const ITEM_SLOTS = {
    HELM: 'helm',
    ARMOR: 'armor',
    GAUNTLETS: 'gauntlets',
    BOOTS: 'boots',
    MAIN_HAND: 'main_hand',
    OFF_HAND: 'off_hand',
    RING_LEFT: 'ring_left',
    RING_RIGHT: 'ring_right',
    AMULET: 'amulet',
    CLOAK: 'cloak'
};

export const BASE_ITEMS = [
    // Weapons
    { name: 'Dagger', slot: ITEM_SLOTS.MAIN_HAND, dice: 4, icon: '🗡️' },
    { name: 'Shortsword', slot: ITEM_SLOTS.MAIN_HAND, dice: 6, icon: '⚔️' },
    { name: 'Broadsword', slot: ITEM_SLOTS.MAIN_HAND, dice: 8, icon: '🗡️' },
    { name: 'Warhammer', slot: ITEM_SLOTS.MAIN_HAND, dice: 10, icon: '🔨' },
    // Off-hand / Shields
    { name: 'Buckler', slot: ITEM_SLOTS.OFF_HAND, ac: 1, icon: '🛡️' },
    { name: 'Heater Shield', slot: ITEM_SLOTS.OFF_HAND, ac: 2, icon: '🛡️' },
    // Armor
    { name: 'Leather Jerkin', slot: ITEM_SLOTS.ARMOR, ac: 2, icon: '🦺' },
    { name: 'Chainmail Hauberk', slot: ITEM_SLOTS.ARMOR, ac: 4, icon: '🛡️' },
    { name: 'Plate Cuirass', slot: ITEM_SLOTS.ARMOR, ac: 6, icon: '🛡️' },
    // Helms
    { name: 'Iron Coif', slot: ITEM_SLOTS.HELM, ac: 1, icon: '🪖' },
    { name: 'Great Helm', slot: ITEM_SLOTS.HELM, ac: 2, icon: '🪖' },
    // Gauntlets
    { name: 'Leather Gloves', slot: ITEM_SLOTS.GAUNTLETS, dex: 1, icon: '🧤' },
    { name: 'Steel Gauntlets', slot: ITEM_SLOTS.GAUNTLETS, str: 1, ac: 1, icon: '🧤' },
    // Boots
    { name: 'Traveler Boots', slot: ITEM_SLOTS.BOOTS, dex: 1, icon: '🥾' },
    { name: 'Iron Sabatons', slot: ITEM_SLOTS.BOOTS, ac: 1, con: 1, icon: '🥾' },
    // Rings & Trinkets
    { name: 'Band of Fortitude', slot: ITEM_SLOTS.RING_LEFT, con: 2, icon: '💍' },
    { name: 'Ring of Quickness', slot: ITEM_SLOTS.RING_RIGHT, dex: 2, icon: '💍' },
    { name: 'Amulet of the Owl', slot: ITEM_SLOTS.AMULET, wis: 2, int: 1, icon: '📿' },
    { name: 'Shadow Cloak', slot: ITEM_SLOTS.CLOAK, dex: 1, ac: 1, icon: '🧥' }
];

export const AFFIXES = [
    { name: 'Sturdy', str: 1, con: 1, ac: 0 },
    { name: 'Nimble', dex: 2, str: 0, ac: 0 },
    { name: 'Keen', str: 0, dex: 1, diceBonus: 1 },
    { name: 'Reinforced', ac: 1, con: 1 },
    { name: 'Eldritch', int: 2, wis: 2 },
    { name: 'Titan’s', str: 3, con: 2, ac: 1 }
];

export function generateLootItem(prng, floorLevel = 1) {
    const base = prng.choice(BASE_ITEMS);
    const hasAffix = prng.chance(0.4 + floorLevel * 0.02);
    const affix = hasAffix ? prng.choice(AFFIXES) : null;

    const item = {
        name: affix ? `${affix.name} ${base.name}` : base.name,
        slot: base.slot,
        icon: base.icon,
        dice: (base.dice || 0) + (affix?.diceBonus || 0),
        ac: (base.ac || 0) + (affix?.ac || 0),
        str: (base.str || 0) + (affix?.str || 0),
        dex: (base.dex || 0) + (affix?.dex || 0),
        con: (base.con || 0) + (affix?.con || 0),
        int: (base.int || 0) + (affix?.int || 0),
        wis: (base.wis || 0) + (affix?.wis || 0)
    };

    const stats = [];
    if (item.dice) stats.push(`1d${item.dice} Dmg`);
    if (item.ac) stats.push(`+${item.ac} AC`);
    if (item.str) stats.push(`+${item.str} STR`);
    if (item.dex) stats.push(`+${item.dex} DEX`);
    if (item.con) stats.push(`+${item.con} CON`);
    if (item.int) stats.push(`+${item.int} INT`);
    if (item.wis) stats.push(`+${item.wis} WIS`);
    item.desc = stats.join(', ') || 'Standard equipment';

    return item;
}

