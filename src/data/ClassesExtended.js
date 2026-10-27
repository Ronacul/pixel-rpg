// Additional base classes: Thief, Monk, Druid. Same schema as Classes.js (merged into CLASSES there).
// Ability `type`/`delivery` values only use handlers the engine already implements
// (see executeSelfAction / fireTargetedAction / CombatSystem in main.js and systems/).

export const EXTENDED_CLASSES = {
    THIEF: {
        id: 'thief',
        name: 'Thief',
        title: 'Shadow Cutpurse',
        icon: '🗡️',
        desc: 'Agile opportunist who strikes from the shadows, poisons blades, and slips away.',
        hitDie: 8,
        primaryStat: 'dex',
        baseHp: 18,
        attributes: { str: 10, dex: 16, con: 12, int: 12, wis: 8, cha: 10 },
        startingGear: { main_hand: 'Dagger', armor: 'Leather Jerkin', helm: "Thieves' Hood" },
        parentClasses: [],
        isSubclass: false,
        proficiencies: {
            armor: ['Light'],
            weapons: ['Simple', 'Daggers', 'Rapiers', 'Shortbows', 'Hand Crossbows'],
            skills: ['Stealth', 'Sleight of Hand', 'Perception']
        },
        abilities: [
            {
                id: 'slip_shadow', name: 'Slip into Shadow', level: 1, icon: '🌑',
                delivery: 'SELF', type: 'shadow', utility: true, isPositive: true, cooldown: 25,
                desc: 'Hunters at range lose track of you and you stay Hidden for 8 turns (attacking ends it). No feat slot needed.'
            },
            {
                id: 'backstab', name: 'Backstab', level: 1, icon: '🗡️',
                delivery: 'ADJACENT', type: 'melee_strike', dice: 6, diceCount: 2, bonusFlat: 2, cooldown: 8,
                desc: 'Vicious opening strike from the blind side for 2d6+2 damage.'
            },
            {
                id: 'smoke_bomb', name: 'Smoke Bomb', level: 1, icon: '💨',
                delivery: 'AOE', range: 4, radius: 1, type: 'aoe_range', dice: 2, diceCount: 1, cooldown: 14,
                statusEffect: { type: 'CLUMSY', duration: 4 },
                desc: 'Burst of choking smoke in a 3x3 area: foes grow Clumsy (-DEX, -AC) for 4 turns.'
            },
            {
                id: 'poison_blade', name: 'Poisoned Blade', level: 2, icon: '🧪',
                delivery: 'ADJACENT', type: 'melee_strike', dice: 4, diceCount: 1, cooldown: 10,
                statusEffect: { type: 'POISONED', duration: 5 },
                desc: 'Slash with a venom-coated blade: 1d4 damage and 5 turns of Poison.'
            },
            {
                id: 'cunning_action', name: 'Cunning Action', level: 2, icon: '🌑',
                delivery: 'SELF', type: 'buff_all', cooldown: 16,
                statusEffect: { type: 'ENERGY', duration: 12 },
                desc: 'Move like a shadow: Energy Rush (+3 DEX, +2 Attack) for 12 turns.'
            },
            {
                id: 'throwing_knives', name: 'Throwing Knives', level: 3, icon: '🔪',
                delivery: 'RANGED', range: 6, type: 'ranged_damage', dice: 4, diceCount: 2, cooldown: 10,
                statusEffect: { type: 'BLEEDING', duration: 3, power: 1 },
                desc: 'Hurl a pair of balanced knives for 2d4+DEX damage and bleeding.'
            },
            {
                id: 'assassinate', name: 'Assassinate', level: 5, icon: '☠️',
                delivery: 'ADJACENT', type: 'melee_strike', dice: 8, diceCount: 3, bonusFlat: 4, cooldown: 24,
                desc: 'Lethal precision strike for 3d8+4 damage.'
            }
        ]
    },

    MONK: {
        id: 'monk',
        name: 'Monk',
        title: 'Disciplined Fist',
        icon: '🥋',
        desc: 'Unarmed ascetic who channels ki into flurries of blows, stunning strikes, and inner calm.',
        hitDie: 8,
        primaryStat: 'wis',
        baseHp: 20,
        attributes: { str: 12, dex: 14, con: 12, int: 8, wis: 14, cha: 8 },
        unarmedDie: 6,
        startingGear: { armor: 'Padded Robes', gauntlets: 'Monk Wraps' },
        parentClasses: [],
        isSubclass: false,
        proficiencies: {
            armor: ['Light'],
            weapons: ['Unarmed', 'Quarterstaves', 'Simple'],
            skills: ['Acrobatics', 'Insight', 'Athletics']
        },
        abilities: [
            {
                id: 'flurry_of_blows', name: 'Flurry of Blows', level: 1, icon: '👊',
                delivery: 'ADJACENT', type: 'melee_strike', dice: 4, diceCount: 3, cooldown: 8,
                desc: 'A blur of rapid strikes totalling 3d4 damage.'
            },
            {
                id: 'inner_calm', name: 'Inner Calm', level: 1, icon: '🧘',
                delivery: 'SELF', type: 'heal', healPercent: 0.25, cooldown: 18,
                desc: 'Focus your ki to mend wounds: restore 25% of max HP.'
            },
            {
                id: 'stunning_strike', name: 'Stunning Strike', level: 2, icon: '💫',
                delivery: 'ADJACENT', type: 'stun_adjacent', dice: 6, diceCount: 1, cooldown: 14,
                statusEffect: { type: 'STUNNED', duration: 2 },
                desc: 'Strike a pressure point for 1d6 damage and stun the foe for 2 turns.'
            },
            {
                id: 'step_of_wind', name: 'Step of the Wind', level: 2, icon: '🌬️',
                delivery: 'SELF', type: 'buff_all', cooldown: 16,
                statusEffect: { type: 'ENERGY', duration: 12 },
                desc: 'Ki-fuelled agility: Energy Rush (+3 DEX, +2 Attack) for 12 turns.'
            },
            {
                id: 'shockwave_palm', name: 'Shockwave Palm', level: 3, icon: '🌀',
                delivery: 'AOE', range: 0, radius: 1, type: 'aoe_adjacent', dice: 6, diceCount: 2, cooldown: 16,
                desc: 'Release a ki shockwave striking all adjacent foes for 2d6 damage.'
            },
            {
                id: 'quivering_palm', name: 'Quivering Palm', level: 5, icon: '☯️',
                delivery: 'ADJACENT', type: 'stun_adjacent', dice: 10, diceCount: 3, cooldown: 25,
                statusEffect: { type: 'STUNNED', duration: 3 },
                desc: 'A devastating vibrating strike: 3d10 damage and a 3-turn stun.'
            }
        ]
    },

    DRUID: {
        id: 'druid',
        name: 'Druid',
        title: 'Grove Warden',
        icon: '🌿',
        desc: 'Keeper of the wild who commands thorns, storms, and regrowth.',
        hitDie: 8,
        primaryStat: 'wis',
        baseHp: 18,
        attributes: { str: 10, dex: 12, con: 12, int: 10, wis: 16, cha: 8 },
        startingGear: { main_hand: 'Druidic Sickle', armor: 'Hide Armor', amulet: 'Druid Totem' },
        parentClasses: [],
        isSubclass: false,
        proficiencies: {
            armor: ['Light', 'Medium'],
            weapons: ['Sickles', 'Quarterstaves', 'Slings', 'Spears'],
            skills: ['Nature', 'Survival', 'Medicine']
        },
        abilities: [
            {
                id: 'thorn_lash', name: 'Thorn Lash', level: 1, icon: '🌵',
                delivery: 'RANGED', range: 5, type: 'ranged_damage', dice: 6, diceCount: 1, cooldown: 6,
                statusEffect: { type: 'BLEEDING', duration: 3, power: 1 },
                desc: 'Lash a distant foe with thorned vines: 1d6 damage and bleeding.'
            },
            {
                id: 'barkskin', name: 'Barkskin', level: 1, icon: '🌳',
                delivery: 'SELF', type: 'buff_def', cooldown: 16,
                statusEffect: { type: 'STONESKIN', duration: 12 },
                desc: 'Skin hardens like oak bark: +3 AC (Stoneskin) for 12 turns.'
            },
            {
                id: 'entangle', name: 'Entangle', level: 2, icon: '🕸️',
                delivery: 'ZONE', range: 5, radius: 1, type: 'zone', cooldown: 14,
                zoneEffect: { type: 'WEB_ZONE', duration: 5 },
                desc: 'Grasping roots sprout in a 3x3 area, holding foes fast.'
            },
            {
                id: 'regrowth', name: 'Regrowth', level: 2, icon: '🍃',
                delivery: 'SELF', type: 'heal_over_time', isPositive: true, cooldown: 16,
                statusEffect: { type: 'REGEN', duration: 6 },
                desc: 'Verdant renewal: Regeneration (+3 HP per turn) for 6 turns.'
            },
            {
                id: 'call_lightning', name: 'Call Lightning', level: 3, icon: '⛈️',
                delivery: 'AOE', range: 6, radius: 1, type: 'aoe_range', dice: 6, diceCount: 2,
                damageType: 'SONIC', cooldown: 18,
                desc: 'Summon a thunderbolt on a 3x3 area for 2d6 damage.'
            },
            {
                id: 'acid_spring', name: 'Spore Bloom', level: 5, icon: '🍄',
                delivery: 'ZONE', range: 6, radius: 1, type: 'aoe_range', dice: 4, diceCount: 1,
                damageType: 'POISON', cooldown: 22,
                statusEffect: { type: 'POISONED', duration: 4 },
                zoneEffect: { type: 'POISON_GAS', duration: 5 },
                desc: 'A bloom of toxic spores poisons all within a 3x3 cloud.'
            }
        ]
    }
};
