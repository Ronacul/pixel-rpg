// Item & Equipment Catalog with Affix Generators and Diverse Delivery Types
// Supports Melee, Ranged Projectiles, AoE Flasks, and Status-Inflicting Armaments

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
    // Standard Melee Weapons (Adjacent, 1 Tile)
    { name: 'Dagger', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 4, icon: '🗡️' },
    { name: 'Shortsword', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 6, icon: '⚔️' },
    { name: 'Broadsword', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 8, icon: '🗡️' },
    { name: 'Warhammer', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 10, icon: '🔨' },

    // Reach Melee Weapons (2 Spots / Reach over hazards)
    { name: 'Hunting Spear', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 2, isReach: true, dice: 6, icon: '🗡️' },
    { name: 'Dungeon Halberd', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 2, isReach: true, dice: 10, icon: '🪓' },
    { name: 'War Pike', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 2, isReach: true, dice: 8, icon: '🔱' },

    // Status-Inflicting Melee Weapons
    { name: 'Poisoned Stiletto', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 4, statusOnHit: 'POISONED', statusDuration: 4, icon: '🗡️' },
    { name: 'Jagged Flail', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 8, statusOnHit: 'BLEEDING', statusDuration: 4, icon: '⛓️' },

    // Short Range Weapons (4-5 Spots)
    { name: 'Throwing Daggers', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 4, dice: 4, statusOnHit: 'BLEEDING', statusDuration: 3, icon: '🗡️' },
    { name: 'Hunting Sling', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 5, dice: 4, bonusFlat: 1, icon: '🪨' },

    // Medium Range Weapons (6-7 Spots)
    { name: 'Shortbow', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 6, dice: 6, icon: '🏹' },
    { name: 'Hand Crossbow', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 6, dice: 6, bonusFlat: 1, icon: '🏹' },
    { name: 'Composite Bow', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 7, dice: 8, icon: '🏹' },

    // Long Range Weapons (8-10 Spots)
    { name: 'Heavy Crossbow', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 8, dice: 10, icon: '🏹' },
    { name: 'Elven Longbow', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 9, dice: 8, icon: '🏹' },
    { name: 'Sniper Arbalest', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 10, dice: 12, icon: '🏹' },

    // Tactical Thrown Flasks / Bombs (Can be equipped or thrown from backpack)
    { 
        name: "Alchemist's Fire", 
        slot: ITEM_SLOTS.OFF_HAND, 
        delivery: 'AOE', 
        range: 5, 
        radius: 1, 
        dice: 6, 
        diceCount: 2, 
        zoneType: 'FIRE', 
        zoneDuration: 4, 
        statusOnHit: 'BURNING', 
        statusDuration: 3, 
        isConsumable: true,
        icon: '🔥' 
    },
    { 
        name: 'Poison Gas Flask', 
        slot: ITEM_SLOTS.OFF_HAND, 
        delivery: 'AOE', 
        range: 5, 
        radius: 1, 
        dice: 4, 
        diceCount: 1, 
        zoneType: 'POISON_GAS', 
        zoneDuration: 5, 
        statusOnHit: 'POISONED', 
        statusDuration: 4, 
        isConsumable: true,
        icon: '🧪' 
    },
    { 
        name: 'Holy Water Flask', 
        slot: ITEM_SLOTS.OFF_HAND, 
        delivery: 'AOE', 
        range: 5, 
        radius: 1, 
        isPositive: true, 
        zoneType: 'CONSECRATION', 
        zoneDuration: 6, 
        healPotency: 12, 
        isConsumable: true,
        icon: '✨' 
    },

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
    { name: 'Titan’s', str: 3, con: 2, ac: 1 },
    { name: 'Venomous', statusOnHit: 'POISONED', statusDuration: 4 },
    { name: 'Serrated', statusOnHit: 'BLEEDING', statusDuration: 4 }
];

export function generateLootItem(prng, floorLevel = 1) {
    const base = prng.choice(BASE_ITEMS);
    const hasAffix = prng.chance(0.4 + floorLevel * 0.02);
    const affix = hasAffix ? prng.choice(AFFIXES) : null;

    const item = {
        name: affix ? `${affix.name} ${base.name}` : base.name,
        slot: base.slot,
        icon: base.icon,
        delivery: base.delivery || 'ADJACENT',
        range: base.range || 0,
        isReach: !!base.isReach,
        bonusFlat: base.bonusFlat || 0,
        radius: base.radius || 0,
        isPositive: !!base.isPositive,
        isConsumable: !!base.isConsumable,
        zoneType: base.zoneType || null,
        zoneDuration: base.zoneDuration || 0,
        statusOnHit: affix?.statusOnHit || base.statusOnHit || null,
        statusDuration: affix?.statusDuration || base.statusDuration || 0,
        dice: (base.dice || 0) + (affix?.diceBonus || 0),
        diceCount: base.diceCount || 1,
        healPotency: base.healPotency || 0,
        ac: (base.ac || 0) + (affix?.ac || 0),
        str: (base.str || 0) + (affix?.str || 0),
        dex: (base.dex || 0) + (affix?.dex || 0),
        con: (base.con || 0) + (affix?.con || 0),
        int: (base.int || 0) + (affix?.int || 0),
        wis: (base.wis || 0) + (affix?.wis || 0)
    };

    const stats = [];
    if (item.isReach) stats.push(`Reach (2t)`);
    else if (item.delivery === 'RANGED') stats.push(`Ranged (${item.range}t)`);
    if (item.delivery === 'AOE') stats.push(`AoE (${item.radius}r, ${item.range}t)`);
    if (item.dice) stats.push(`${item.diceCount > 1 ? item.diceCount : ''}1d${item.dice}${item.bonusFlat ? `+${item.bonusFlat}` : ''} Dmg`);
    if (item.statusOnHit) stats.push(`Inflicts ${item.statusOnHit}`);
    if (item.zoneType) stats.push(`Leaves ${item.zoneType} field`);
    if (item.healPotency) stats.push(`Heals +${item.healPotency} HP`);
    if (item.ac) stats.push(`+${item.ac} AC`);
    if (item.str) stats.push(`+${item.str} STR`);
    if (item.dex) stats.push(`+${item.dex} DEX`);
    if (item.con) stats.push(`+${item.con} CON`);
    if (item.int) stats.push(`+${item.int} INT`);
    if (item.wis) stats.push(`+${item.wis} WIS`);
    item.desc = stats.join(', ') || 'Standard equipment';

    return item;
}
