import { POWER_DEFS, describePower, rollPower } from './Powers.js';
import { randomGem, rollSockets, socketGem } from './Gems.js';
import { rollCurse, attachCurse, CURSES, curseLine } from './Curses.js';

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
    { name: 'Signet of Might', slot: ITEM_SLOTS.RING_LEFT, str: 2, icon: '💍' },
    { name: 'Ring of Insight', slot: ITEM_SLOTS.RING_RIGHT, wis: 1, int: 1, icon: '💍' },
    { name: 'Amulet of the Owl', slot: ITEM_SLOTS.AMULET, wis: 2, int: 1, icon: '📿' },
    { name: 'Shadow Cloak', slot: ITEM_SLOTS.CLOAK, dex: 1, ac: 1, icon: '🧥' },

    // Class starting-kit gear (also found as loot)
    { name: 'Oak Quarterstaff', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 6, icon: '🪄' },
    { name: 'Apprentice Wand', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'RANGED', range: 5, dice: 4, bonusFlat: 1, icon: '🪄' },
    { name: 'Rapier', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 8, icon: '🤺' },
    { name: 'Flanged Mace', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 8, icon: '🔨' },
    { name: 'Druidic Sickle', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 6, icon: '🌙' },
    { name: 'Padded Robes', slot: ITEM_SLOTS.ARMOR, ac: 1, icon: '🥋' },
    { name: 'Hide Armor', slot: ITEM_SLOTS.ARMOR, ac: 3, icon: '🦺' },
    { name: 'Monk Wraps', slot: ITEM_SLOTS.GAUNTLETS, dex: 1, ac: 1, icon: '🧤' },
    { name: 'Holy Symbol', slot: ITEM_SLOTS.AMULET, wis: 1, icon: '📿' },
    { name: 'Wooden Lute', slot: ITEM_SLOTS.OFF_HAND, cha: 1, icon: '🪕' },
    { name: 'Druid Totem', slot: ITEM_SLOTS.AMULET, wis: 1, con: 1, icon: '🌿' },
    { name: "Thieves' Hood", slot: ITEM_SLOTS.HELM, dex: 1, icon: '🪖' },

    // ==========================================
    // UNIQUES WITH POWERS (see data/Powers.js)
    // ==========================================
    { name: 'Emberfang', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 8, icon: '🗡️', sockets: 2, powers: [{ id: 'ignite', chance: 0.3 }] },
    { name: 'Frostbrand Rapier', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 8, icon: '🤺', sockets: 1, powers: [{ id: 'frostbite', chance: 0.35 }] },
    { name: 'Bloodthirst Axe', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', range: 1, dice: 10, icon: '🪓', sockets: 1, powers: [{ id: 'vampiric', value: 0.2 }] },
    { name: 'Thornmail Hauberk', slot: ITEM_SLOTS.ARMOR, ac: 4, icon: '🛡️', sockets: 2, powers: [{ id: 'thorns', value: 4 }] },
    { name: 'Stoneward Shield', slot: ITEM_SLOTS.OFF_HAND, ac: 2, icon: '🛡️', sockets: 1, powers: [{ id: 'stoneguard', chance: 0.25 }] },
    { name: "Seer's Amulet", slot: ITEM_SLOTS.AMULET, wis: 1, icon: '🔮', sockets: 1, powers: [{ id: 'trapsense', value: 4 }, { id: 'keysight', value: 6 }] },
    { name: 'Wardstone Ring', slot: ITEM_SLOTS.RING_LEFT, icon: '💍', sockets: 1, powers: [{ id: 'fireward' }, { id: 'poisonward' }] },
    { name: "Burglar's Charm", slot: ITEM_SLOTS.RING_RIGHT, dex: 1, icon: '💍', sockets: 1, powers: [{ id: 'keysight', value: 4 }, { id: 'trapsense', value: 2 }] },
    { name: 'Emberproof Cloak', slot: ITEM_SLOTS.CLOAK, ac: 1, icon: '🧥', sockets: 1, powers: [{ id: 'fireward' }] },

    // ==========================================
    // MODULAR SET PIECES (LORE-INFUSED ARTIFACTS)
    // ==========================================

    // 1. Regalia of the King of Kings Set (Charisma, Majesty, Fear Aura)
    { name: 'Helm of the King of Kings', slot: ITEM_SLOTS.HELM, ac: 3, cha: 2, icon: '👑', setId: 'KING_OF_KINGS', desc: 'Ancient sovereign golden crest.' },
    { name: 'Sovereign Royal Mantle', slot: ITEM_SLOTS.CLOAK, ac: 2, cha: 2, icon: '🧥', setId: 'KING_OF_KINGS', desc: 'Radiates commanding noble aura.' },
    { name: 'Scepter of Dominion', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', dice: 8, cha: 1, bonusFlat: 2, icon: '🔱', setId: 'KING_OF_KINGS', desc: 'Royal golden crushing scepter.' },
    { name: 'Imperial Monarch Signet', slot: ITEM_SLOTS.RING_LEFT, cha: 2, ac: 1, icon: '💍', setId: 'KING_OF_KINGS', desc: 'Imperial dynasty seal ring.' },

    // 2. Elven Craftsmanship Set (Sylvan Dexterity, Range, Woodstrider)
    { name: 'Crown of the Woodland', slot: ITEM_SLOTS.HELM, ac: 2, dex: 1, icon: '👑', setId: 'ELVEN_MAKE', desc: 'Living silverwood circlet.' },
    { name: 'Sylvan Cloak', slot: ITEM_SLOTS.CLOAK, ac: 2, dex: 2, icon: '🧥', setId: 'ELVEN_MAKE', desc: 'Woven from elder woodland threads.' },
    { name: 'Elven Tracker Boots', slot: ITEM_SLOTS.BOOTS, ac: 1, dex: 2, icon: '🥾', setId: 'ELVEN_MAKE', desc: 'Silent leaves cushion footsteps.' },

    // 3. Dwarven Deep-Forge Set (Constitution, AC, Stoneblood Resilience)
    { name: 'Iron Dwarven Greathelm', slot: ITEM_SLOTS.HELM, ac: 3, con: 1, icon: '🪖', setId: 'DWARVEN_FORGE', desc: 'Mountain anvil plate helm.' },
    { name: 'Mithril Plate Cuirass', slot: ITEM_SLOTS.ARMOR, ac: 7, con: 2, icon: '🛡️', setId: 'DWARVEN_FORGE', desc: 'Tempered in deep subterranean magma.' },
    { name: 'Dwarven Battleaxe', slot: ITEM_SLOTS.MAIN_HAND, delivery: 'ADJACENT', dice: 10, bonusFlat: 2, icon: '🪓', setId: 'DWARVEN_FORGE', desc: 'Heavy double-bearded runic axe.' },

    // 4. Shadowstalker Shroud Set (Dexterity, Perception Radar, Surprise Strike)
    { name: 'Shadow Hood', slot: ITEM_SLOTS.HELM, ac: 1, dex: 2, icon: '🪖', setId: 'SHADOWSTALKER', desc: 'Conceals visage in living gloom.' },
    { name: 'Nightfall Band', slot: ITEM_SLOTS.RING_RIGHT, dex: 2, icon: '💍', setId: 'SHADOWSTALKER', desc: 'Cold abyssal silver ring.' },
    { name: 'Silent Stride Boots', slot: ITEM_SLOTS.BOOTS, ac: 1, dex: 2, icon: '🥾', setId: 'SHADOWSTALKER', desc: 'Absorbs vibration and footfalls.' },

    // ==========================================
    // FORAGEABLE MUSHROOMS & BEAST HARVEST DROPS
    // ==========================================
    { name: 'Glowcap Mushroom', isConsumable: true, isMushroom: true, mushroomType: 'GLOWCAP', rations: 1, healPotency: 4, icon: '🍄', desc: 'Bioluminescent fungi. Restores 1 Ration + Energy Rush (+3 DEX, +2 Atk) for 20t.' },
    { name: 'Deathstool Fungus', isConsumable: true, isMushroom: true, mushroomType: 'DEATHSTOOL', rations: 0, statusOnHit: 'POISONED', statusDuration: 5, icon: '🍄', desc: 'Toxic cap. Inhaling inflicts Poison, or harvest for poison coating.' },
    { name: 'Mind-Spore Mushroom', isConsumable: true, isMushroom: true, mushroomType: 'PSYCHEDELIC', rations: 1, healPotency: 6, icon: '🍄', desc: 'Psychedelic shroom. Induces Hallucinations (warped spectrum) while granting +3 INT for 25t.' },
    { name: 'Vitality Puffball', isConsumable: true, isMushroom: true, mushroomType: 'PUFFBALL', rations: 2, healPotency: 18, icon: '🍄', desc: 'Medicinal puffball. Heals +18 HP and +2 Hearty Rations.' },
    { name: 'Ironhide Morel', isConsumable: true, isMushroom: true, mushroomType: 'IRONHIDE', rations: 1, healPotency: 5, icon: '🍄', desc: 'Mineral fungus. Restores 1 Ration and grants Stoneskin (+3 AC) for 25t.' },
    { name: 'Fresh Beast Meat', isConsumable: true, rations: 1, healPotency: 8, icon: '🥩', desc: 'Harvested creature meat. Restores 1 Camp Ration and 8 HP.' },
    { name: 'Spider Venom Sac', isConsumable: true, statusOnHit: 'POISONED', statusDuration: 5, icon: '🧪', desc: 'Harvested venom gland. Coat weapon or throw: inflicts Poison.' },
    { name: 'Minor Healing Potion', isConsumable: true, healPotency: 15, icon: '🍷', desc: 'Restores 15 HP.' },
    { name: 'Minor Healing Potion', isConsumable: true, healPotency: 15, icon: '🍷', desc: 'Restores 15 HP.' },
    { name: 'Healing Potion', isConsumable: true, healPotency: 30, icon: '🧴', desc: 'Restores 30 HP.' },
    { name: 'Healing Potion', isConsumable: true, healPotency: 30, icon: '🧴', desc: 'Restores 30 HP.' },
    { name: 'Wild Briar Herbs', isConsumable: true, rations: 1, healPotency: 10, cleansesBleed: true, icon: '🌿', desc: 'Foraged medicinal herbs. Restores 10 HP, cleanses Bleeding, +1 Ration.' },

    // Magic utility: identifying hidden magic and lifting curses (see systems/Identify.js)
    { name: 'Scroll of Identify', isConsumable: true, effect: 'identify', icon: '📜', desc: 'Reveals the hidden magic and curses of one item (the one selected, else the first unknown).' },
    { name: 'Scroll of Identify', isConsumable: true, effect: 'identify', icon: '📜', desc: 'Reveals the hidden magic and curses of one item (the one selected, else the first unknown).' },
    { name: 'Scroll of Remove Curse', isConsumable: true, effect: 'uncurse', icon: '📃', desc: 'Lifts every curse on the gear you are wearing, gems included.' },
    { name: 'Holy Water Vial', isConsumable: true, effect: 'holy_water', icon: '💧', desc: 'Pour on one cursed item or gem (select it, then tap Holy Water) to purify it.' }
];

export const MUSHROOM_TYPES = {
    GLOWCAP: {
        id: 'GLOWCAP',
        name: 'Glowcap Mushroom',
        icon: '🍄',
        color: '#ffcc00',
        desc: 'Bioluminescent fungi. Restores 1 Ration and grants Energy Rush (+3 DEX, +2 Atk) for 20 turns.',
        rations: 1,
        heal: 4,
        status: 'ENERGY',
        duration: 20
    },
    DEATHSTOOL: {
        id: 'DEATHSTOOL',
        name: 'Deathstool Fungus',
        icon: '🍄',
        color: '#77dd33',
        desc: 'Noxious toxic mushroom. Inhaling/eating inflicts Poison, but harvesting yields Poison Flask.',
        rations: 0,
        heal: 0,
        status: 'POISONED',
        duration: 5,
        harvestYield: 'Poison Gas Flask'
    },
    PSYCHEDELIC: {
        id: 'PSYCHEDELIC',
        name: 'Mind-Spore Mushroom',
        icon: '🍄',
        color: '#ff44ff',
        desc: 'Psychedelic dungeon mushroom. Causes Hallucinations (warped spectrum & phantom radar) while boosting +3 INT.',
        rations: 1,
        heal: 6,
        status: 'HALLUCINATING',
        duration: 25
    },
    PUFFBALL: {
        id: 'PUFFBALL',
        name: 'Vitality Puffball',
        icon: '🍄',
        color: '#64d8cb',
        desc: 'Nutritious medicinal puffball. Restores 18 HP and +2 Hearty Rations immediately.',
        rations: 2,
        heal: 18
    },
    IRONHIDE: {
        id: 'IRONHIDE',
        name: 'Ironhide Morel',
        icon: '🍄',
        color: '#aaaaaa',
        desc: 'Mineral-rich subterranean morel. Grants Stoneskin (+3 AC) for 25 turns and restores 1 Ration.',
        rations: 1,
        heal: 5,
        status: 'STONESKIN',
        duration: 25
    }
};

export const EQUIPMENT_SETS = {
    KING_OF_KINGS: {
        id: 'KING_OF_KINGS',
        name: 'Regalia of the King of Kings',
        lore: 'Imperial regalia of an ancient sovereign dynasty whose overwhelming majesty breaks enemy morale.',
        icon: '👑',
        color: '#ffcc00',
        thresholds: {
            2: {
                name: 'Sovereign Majesty',
                desc: '+3 CHA, +2 AC. Noble aura commands fear and awe.',
                stats: { cha: 3, ac: 2 }
            },
            3: {
                name: 'Terrifying Presence (Fear Aura)',
                desc: 'Foes within 3 tiles must pass a DC 13 Will save vs Charisma or flee in TERROR!',
                stats: { cha: 5, ac: 3, fearAura: true, fearRadius: 3, fearDC: 13 }
            }
        }
    },
    ELVEN_MAKE: {
        id: 'ELVEN_MAKE',
        name: 'Elven Craftsmanship',
        lore: 'Hand-woven and tempered under ancient canopy leaves, infused with the swiftness of sylvan winds.',
        icon: '🌿',
        color: '#55dd77',
        thresholds: {
            2: {
                name: 'Sylvan Agility',
                desc: '+2 DEX, +1 Range to all weapons and spells.',
                stats: { dex: 2, rangeBonus: 1 }
            },
            3: {
                name: 'Woodstrider Grace',
                desc: '+2 Dodge AC, immune to bramble/foliage movement slowing.',
                stats: { dex: 4, ac: 2, rangeBonus: 1, woodstrider: true }
            }
        }
    },
    DWARVEN_FORGE: {
        id: 'DWARVEN_FORGE',
        name: 'Dwarven Deep-Forge',
        lore: 'Forged in subterranean magma and stamped with the unbreakable mountain anvil seal.',
        icon: '⚒️',
        color: '#ff8844',
        thresholds: {
            2: {
                name: 'Anvil Tempering',
                desc: '+2 CON, +2 AC. Armor reinforced against bludgeoning.',
                stats: { con: 2, ac: 2 }
            },
            3: {
                name: 'Stoneblood Resilience',
                desc: 'Immunity to Stun and Bleeding! +3 Melee Strike Damage.',
                stats: { con: 4, ac: 3, bonusDmg: 3, stoneblood: true }
            }
        }
    },
    SHADOWSTALKER: {
        id: 'SHADOWSTALKER',
        name: 'Shadowstalker Shroud',
        lore: 'Woven from spectral gloom for master infiltrators who strike from the unlit dark.',
        icon: '🌑',
        color: '#b08aff',
        thresholds: {
            2: {
                name: 'Veil of Shadows',
                desc: '+2 DEX, +2 Perception Radar detection.',
                stats: { dex: 2, perRadar: 2 }
            },
            3: {
                name: 'Phantom Assassination',
                desc: '+4 Critical Surprise Strike Damage, +1 Dodge AC.',
                stats: { dex: 3, perRadar: 2, surpriseBonus: 6, ac: 1 }
            }
        }
    }
};

export function calculateEquippedSetBonuses(player) {
    if (!player) return { activeSets: [], totals: {}, setCounts: {} };
    const equipped = player.getEquippedItems ? player.getEquippedItems() : Object.values(player.equipment || {}).filter(Boolean);

    // A set bonus counts DISTINCT worn pieces: wearing two copies of the same piece does not add a second one
    const setNames = {};
    for (const item of equipped) {
        if (item && item.setId && EQUIPMENT_SETS[item.setId]) {
            (setNames[item.setId] = setNames[item.setId] || new Set()).add(item.name);
        }
    }
    const setCounts = {};
    for (const id in setNames) setCounts[id] = setNames[id].size;

    const activeSets = [];
    const totals = {
        str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
        ac: 0, maxHp: 0, rangeBonus: 0, bonusDmg: 0,
        fearAura: false, fearRadius: 0, fearDC: 0,
        stoneblood: false, woodstrider: false, surpriseBonus: 0, perRadar: 0
    };

    for (const setId in setCounts) {
        const count = setCounts[setId];
        const setDef = EQUIPMENT_SETS[setId];
        if (!setDef) continue;

        let highestThreshold = null;
        let highestTier = 0;
        for (const tierStr in setDef.thresholds) {
            const tier = parseInt(tierStr, 10);
            if (count >= tier && tier > highestTier) {
                highestTier = tier;
                highestThreshold = setDef.thresholds[tierStr];
            }
        }

        if (highestThreshold) {
            activeSets.push({
                setId,
                name: setDef.name,
                icon: setDef.icon,
                count,
                tier: highestTier,
                title: highestThreshold.name,
                desc: highestThreshold.desc,
                stats: highestThreshold.stats
            });

            for (const key in highestThreshold.stats) {
                if (typeof totals[key] === 'number') {
                    totals[key] += highestThreshold.stats[key];
                } else if (typeof totals[key] === 'boolean') {
                    totals[key] = totals[key] || !!highestThreshold.stats[key];
                } else {
                    totals[key] = highestThreshold.stats[key];
                }
            }
        } else {
            activeSets.push({
                setId,
                name: setDef.name,
                icon: setDef.icon,
                count,
                tier: 0,
                title: 'Partial Set (1/2)',
                desc: `Equip 2 pieces to activate ${setDef.thresholds[2]?.name || 'bonus'}.`,
                stats: {}
            });
        }
    }

    return { activeSets, totals, setCounts };
}

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

// Slot compatibility: a ring may be worn on EITHER hand; every other item fits only its own slot.
// Equipment is keyed by ITEM_SLOTS values, so ring items carry slot 'ring_left'/'ring_right' as a
// default preference only and this function is the single source of truth for what fits where.
export const SLOT_GROUPS = {
    [ITEM_SLOTS.RING_LEFT]: [ITEM_SLOTS.RING_LEFT, ITEM_SLOTS.RING_RIGHT],
    [ITEM_SLOTS.RING_RIGHT]: [ITEM_SLOTS.RING_LEFT, ITEM_SLOTS.RING_RIGHT]
};

export function getCompatibleSlots(item) {
    if (!item || !item.slot) return [];
    return SLOT_GROUPS[item.slot] ? [...SLOT_GROUPS[item.slot]] : [item.slot];
}

export const SLOT_LABELS = {
    [ITEM_SLOTS.HELM]: 'Helm',
    [ITEM_SLOTS.AMULET]: 'Amulet',
    [ITEM_SLOTS.ARMOR]: 'Armor',
    [ITEM_SLOTS.CLOAK]: 'Cloak',
    [ITEM_SLOTS.MAIN_HAND]: 'Main Hand',
    [ITEM_SLOTS.OFF_HAND]: 'Off Hand',
    [ITEM_SLOTS.GAUNTLETS]: 'Gauntlets',
    [ITEM_SLOTS.BOOTS]: 'Boots',
    [ITEM_SLOTS.RING_LEFT]: 'Left Ring',
    [ITEM_SLOTS.RING_RIGHT]: 'Right Ring'
};

// Build a concrete item from a base definition (no affix roll). Used by starting-gear tables and test tooling.
export function createItemFromBase(base) {
    const fakePrng = { choice: () => base, chance: () => false, next: () => 0.99, nextInt: (a) => a };
    return generateLootItem(fakePrng, 1);
}

export function findBaseItem(name) {
    return BASE_ITEMS.find(b => b.name === name) || null;
}

// Human-readable stat line for an item. Rebuilt after gems are socketed.
export function buildItemDesc(item) {
    const stats = [];
    const sg = (v) => (v > 0 ? `+${v}` : `${v}`);
    if (item.effect) stats.push(item.effectDesc || '');
    if (item.setId && EQUIPMENT_SETS[item.setId]) stats.push(`[${EQUIPMENT_SETS[item.setId].name}]`);
    if (item.isReach) stats.push(`Reach (2t)`);
    else if (item.delivery === 'RANGED') stats.push(`Ranged (${item.range}t)`);
    if (item.delivery === 'AOE') stats.push(`AoE (${item.radius}r, ${item.range}t)`);
    if (item.dice) stats.push(`${item.diceCount > 1 ? item.diceCount : ''}1d${item.dice}${item.bonusFlat ? `+${item.bonusFlat}` : ''} Dmg`);
    if (item.statusOnHit) stats.push(`Inflicts ${item.statusOnHit}`);
    if (item.zoneType) stats.push(`Leaves ${item.zoneType} field`);
    if (item.healPotency) stats.push(`Heals +${item.healPotency} HP`);
    if (item.rations) stats.push(`+${item.rations} Ration(s)`);
    if (item.cleansesBleed) stats.push('Cures Bleed');
    if (item.ac) stats.push(`${sg(item.ac)} AC`);
    if (item.str) stats.push(`${sg(item.str)} STR`);
    if (item.dex) stats.push(`${sg(item.dex)} DEX`);
    if (item.con) stats.push(`${sg(item.con)} CON`);
    if (item.int) stats.push(`${sg(item.int)} INT`);
    if (item.wis) stats.push(`${sg(item.wis)} WIS`);
    if (item.cha) stats.push(`${sg(item.cha)} CHA`);
    const mods = item.mods || {};
    if (mods.maxHp) stats.push(`${sg(mods.maxHp)} Max HP`);
    if (mods.attack) stats.push(`${sg(mods.attack)} Attack`);
    if (mods.dmg) stats.push(`${sg(mods.dmg)} Damage`);
    if (mods.per) stats.push(`${sg(mods.per)} Perception`);
    if (mods.regen) stats.push('Faster regen');
    for (const p of item.powers || []) stats.push(describePower(p));
    if (item.sockets) {
        const used = item.gems ? item.gems.length : 0;
        stats.push(`Sockets ${(item.gems || []).map(g => (g.known === false ? '❓' : g.icon)).join('')}${'◇'.repeat(Math.max(0, item.sockets - used))}`);
    }
    const curse = curseLine(item);
    if (curse) stats.push(`☠️ ${curse}`);
    return stats.join(', ') || 'Standard equipment';
}

// What an unidentified item shows: only its plain base properties. `pristine` is captured at generation.
export function buildUnknownDesc(item) {
    const p = item.pristine || {};
    const view = {
        ...item, ...p, powers: p.powers || [], mods: {}, gems: [], curse: null,
        setId: item.setId, effect: null
    };
    const known = curseLine(item); // a curse that has already announced itself stays visible
    return `${buildItemDesc(view)} • ❓ unidentified${known ? ` • ☠️ ${known}` : ''}`;
}

// Gear stats with the hidden magic stripped: what the player can reasonably judge (used for advice and sale value)
export function visibleView(item) {
    if (!item || !item.unid) return item;
    const p = item.pristine || {};
    return { ...item, ...p, powers: p.powers || [], mods: {}, gems: [], curse: null, unid: false };
}

export function generateLootItem(prng, floorLevel = 1) {
    // A chunk of loot is a socketable gem instead of gear
    if (prng.chance(0.07 + floorLevel * 0.002)) return randomGem(prng, floorLevel);

    const base = prng.choice(BASE_ITEMS);
    const hasAffix = prng.chance(0.4 + floorLevel * 0.02) && !base.setId && !base.isConsumable;
    const affix = hasAffix ? prng.choice(AFFIXES) : null;
    const equippable = !!base.slot && !base.isConsumable;

    const item = {
        name: affix ? `${affix.name} ${base.name}` : base.name,
        baseName: base.name,
        slot: base.slot,
        icon: base.icon,
        setId: base.setId || null,
        delivery: base.delivery || 'ADJACENT',
        range: base.range || 0,
        isReach: !!base.isReach,
        bonusFlat: base.bonusFlat || 0,
        radius: base.radius || 0,
        isPositive: !!base.isPositive,
        isConsumable: !!base.isConsumable,
        isMushroom: !!base.isMushroom,
        mushroomType: base.mushroomType || null,
        effect: base.effect || null,
        effectDesc: base.effect ? base.desc : null,
        rations: base.rations || 0,
        cleansesBleed: !!base.cleansesBleed,
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
        wis: (base.wis || 0) + (affix?.wis || 0),
        cha: (base.cha || 0) + (affix?.cha || 0),
        powers: (base.powers || []).map(p => ({ ...p })),
        mods: {},
        sockets: 0,
        gems: []
    };

    if (equippable) {
        // Random power (named uniques already carry their own) and sockets
        if (!base.powers && !base.setId && prng.chance(0.10 + Math.min(0.2, floorLevel * 0.01))) {
            const p = rollPower(prng, base.slot, floorLevel);
            item.powers.push(p);
            item.name = `${item.name} of ${POWER_DEFS[p.id].suffix}`;
        }
        item.sockets = base.sockets ?? rollSockets(prng, floorLevel);

        // Hidden magic: an affix, a rolled power, a pre-set gem or a curse can be hidden until the item is identified
        const rolled = !base.powers && !base.setId;
        if (rolled && item.sockets > 0 && prng.chance(0.10 + Math.min(0.15, floorLevel * 0.008))) {
            const gem = randomGem(prng, floorLevel);
            socketGem(item, gem, describePower, { hidden: true });
        }
        if (rolled && prng.chance(0.05 + Math.min(0.12, floorLevel * 0.006))) {
            attachCurse(item, rollCurse(prng, item.slot === ITEM_SLOTS.MAIN_HAND), false);
            // The lure: a cursed item always has a real power
            if (!item.powers.length) {
                const p = rollPower(prng, base.slot, floorLevel + 3);
                item.powers.push(p);
                item.name = `${item.name} of ${POWER_DEFS[p.id].suffix}`;
            }
        }
        const magical = rolled && (!!affix || item.powers.length > 0 || item.gems.length > 0 || !!item.curse);
        if (magical && (item.curse || prng.chance(0.7))) {
            item.pristine = {
                ac: base.ac || 0, str: base.str || 0, dex: base.dex || 0, con: base.con || 0, int: base.int || 0, wis: base.wis || 0, cha: base.cha || 0,
                dice: base.dice || 0, statusOnHit: base.statusOnHit || null, statusDuration: base.statusDuration || 0,
                sockets: item.sockets, powers: (base.powers || []).map(p => ({ ...p }))
            };
            item.unid = true;
            item.trueName = item.name;
            item.name = `${base.name} (?)`;
            item.idDC = 11 + Math.floor(floorLevel / 4) + (item.curse ? 2 : 0);
            item.idTurns = 0;
            item.desc = buildUnknownDesc(item);
            return item;
        }
        for (const g of item.gems) g.known = true;
    }

    item.desc = buildItemDesc(item);
    return item;
}

// Recompute an item's description after it was modified (e.g. a gem was socketed)
export function refreshItemDesc(item) {
    item.desc = item.unid ? buildUnknownDesc(item) : buildItemDesc(item);
    return item;
}

// Number of catalogued pieces in a set (used for "2/3 pieces" displays)
export function getSetPieceTotal(setId) {
    return BASE_ITEMS.filter(b => b.setId === setId).length;
}
