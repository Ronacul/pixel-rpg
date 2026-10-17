// Modular Class & Progression System with Proficiencies, Feats, and Milestone Scaling

export const CLASSES = {
    WARRIOR: {
        id: 'warrior',
        name: 'Warrior',
        title: 'Martial Champion',
        icon: '⚔️',
        desc: 'Master of melee weapons, heavy armor, and frontline endurance.',
        hitDie: 10,
        primaryStat: 'str',
        proficiencies: {
            armor: ['Light', 'Medium', 'Heavy', 'Shields'],
            weapons: ['Simple', 'Martial'],
            skills: ['Athletics', 'Intimidation']
        },
        abilities: [
            {
                id: 'second_wind',
                name: 'Second Wind',
                level: 1,
                icon: '💨',
                delivery: 'SELF',
                type: 'heal',
                healPercent: 0.35,
                cooldown: 20,
                desc: 'Dig deep into martial reserve. Restore 35% of max HP immediately.'
            },
            {
                id: 'power_strike',
                name: 'Power Strike',
                level: 2,
                icon: '💥',
                delivery: 'ADJACENT',
                type: 'buff_attack',
                cooldown: 12,
                dice: 6,
                diceCount: 2,
                statusEffect: { type: 'BLEEDING', duration: 4, power: 1 },
                desc: 'Crushing melee blow dealing weapon +2d6 damage and causing heavy bleeding.'
            },
            {
                id: 'javelin_throw',
                name: 'Javelin Throw',
                level: 3,
                icon: '🗡️',
                delivery: 'RANGED',
                range: 6,
                type: 'ranged_damage',
                dice: 8,
                diceCount: 1,
                cooldown: 14,
                statusEffect: { type: 'BLEEDING', duration: 3, power: 1 },
                desc: 'Hurl a heavy barbed javelin at a distance foe for 1d8+STR damage and bleed.'
            },
            {
                id: 'shield_bash',
                name: 'Shield Bash',
                level: 4,
                icon: '🛡️',
                delivery: 'ADJACENT',
                type: 'stun_adjacent',
                dice: 6,
                diceCount: 1,
                cooldown: 16,
                statusEffect: { type: 'STUNNED', duration: 2 },
                desc: 'Slam shield into adjacent foe for 1d6 damage and stun for 2 turns.'
            },
            {
                id: 'whirlwind',
                name: 'Whirlwind',
                level: 5,
                icon: '🌪️',
                delivery: 'AOE',
                range: 0,
                radius: 1,
                type: 'aoe_adjacent',
                dice: 8,
                diceCount: 1,
                cooldown: 24,
                desc: 'Spin in a 360-degree martial arc, striking every surrounding foe for 1d8+STR damage.'
            }
        ]
    },
    MAGE: {
        id: 'mage',
        name: 'Mage',
        title: 'Arcane Scholar',
        icon: '🔮',
        desc: 'Wielder of devastating elemental sorcery and dimensional magic.',
        hitDie: 6,
        primaryStat: 'int',
        proficiencies: {
            armor: ['Light'],
            weapons: ['Daggers', 'Staves', 'Wands'],
            skills: ['Arcana', 'Investigation']
        },
        abilities: [
            {
                id: 'magic_missile',
                name: 'Magic Missile',
                level: 1,
                icon: '✨',
                delivery: 'RANGED',
                range: 7,
                type: 'ranged_damage',
                dice: 4,
                diceCount: 2,
                bonusFlat: 2,
                damageType: 'ARCANE',
                cooldown: 8,
                desc: 'Unerring arcane bolt strikes visible foe for 2d4+2 damage.'
            },
            {
                id: 'frost_ray',
                name: 'Frost Ray',
                level: 2,
                icon: '❄️',
                delivery: 'RANGED',
                range: 6,
                type: 'ranged_damage',
                dice: 8,
                diceCount: 1,
                damageType: 'COLD',
                cooldown: 12,
                statusEffect: { type: 'CLUMSY', duration: 4 },
                desc: 'Beam of freezing energy: deals 1d8 cold damage and slows foe (-4 DEX, -2 AC).'
            },
            {
                id: 'fireball',
                name: 'Fireball',
                level: 3,
                icon: '🔥',
                delivery: 'AOE',
                range: 7,
                radius: 1,
                type: 'aoe_range',
                dice: 6,
                diceCount: 3,
                damageType: 'FIRE',
                cooldown: 22,
                statusEffect: { type: 'BURNING', duration: 3 },
                zoneEffect: { type: 'FIRE', duration: 4 },
                desc: 'Hurl an explosive sphere creating a 3x3 blast for 3d6 fire damage and a lingering fire field.'
            },
            {
                id: 'poison_cloud',
                name: 'Toxic Cloud',
                level: 5,
                icon: '☁️',
                delivery: 'ZONE',
                range: 6,
                radius: 1,
                type: 'aoe_range',
                dice: 4,
                diceCount: 1,
                damageType: 'POISON',
                cooldown: 25,
                statusEffect: { type: 'POISONED', duration: 4 },
                zoneEffect: { type: 'POISON_GAS', duration: 5 },
                desc: 'Conjure a lingering 3x3 cloud of toxic gas that chokes and poisons all within.'
            }
        ]
    },
    CLERIC: {
        id: 'cleric',
        name: 'Cleric',
        title: 'Divine Herald',
        icon: '☀️',
        desc: 'Conduit of sacred light, divine healing, and radiant power.',
        hitDie: 8,
        primaryStat: 'wis',
        proficiencies: {
            armor: ['Light', 'Medium', 'Shields'],
            weapons: ['Simple', 'Maces', 'Warhammers'],
            skills: ['Religion', 'Medicine', 'Insight']
        },
        abilities: [
            {
                id: 'healing_word',
                name: 'Healing Word',
                level: 1,
                icon: '💖',
                delivery: 'SELF',
                type: 'heal',
                isPositive: true,
                dice: 8,
                diceCount: 2,
                cooldown: 14,
                desc: 'Sacred prayer restores 2d8 + WIS modifier HP instantly.'
            },
            {
                id: 'smite',
                name: 'Radiant Smite',
                level: 2,
                icon: '🕯️',
                delivery: 'ADJACENT',
                type: 'melee_holy',
                dice: 6,
                diceCount: 2,
                damageType: 'HOLY',
                cooldown: 12,
                statusEffect: { type: 'BLESSED', duration: 8 },
                desc: 'Infuse weapon with holy light: +2d6 radiant damage and grants Blessed aura.'
            },
            {
                id: 'holy_nova',
                name: 'Holy Nova',
                level: 3,
                icon: '✨',
                delivery: 'AOE',
                range: 0,
                radius: 2,
                isPositive: true,
                type: 'positive_aoe',
                healDice: 8,
                healDiceCount: 2,
                dice: 6,
                diceCount: 2,
                damageType: 'HOLY',
                cooldown: 24,
                desc: 'Positive burst (5x5 radius): heals hero for 2d8 HP while searing surrounding foes for 2d6 holy damage.'
            },
            {
                id: 'consecrate',
                name: 'Consecrate',
                level: 5,
                icon: '⛪',
                delivery: 'ZONE',
                range: 4,
                radius: 1,
                type: 'zone',
                isPositive: true,
                cooldown: 26,
                zoneEffect: { type: 'CONSECRATION', duration: 6 },
                desc: 'Sanctify 3x3 ground: heals player each turn while burning unholy foes.'
            }
        ]
    },
    BARD: {
        id: 'bard',
        name: 'Bard',
        title: 'Wandering Skald',
        icon: '🪕',
        desc: 'Charismatic performer weaving songs of inspiration, charm, and confusion.',
        hitDie: 8,
        primaryStat: 'cha',
        proficiencies: {
            armor: ['Light', 'Medium'],
            weapons: ['Simple', 'Rapiers', 'Shortswords'],
            skills: ['Performance', 'Persuasion', 'Deception']
        },
        abilities: [
            {
                id: 'inspiring_song',
                name: 'Inspiring Song',
                level: 1,
                icon: '🎶',
                delivery: 'SELF',
                type: 'buff_all',
                isPositive: true,
                cooldown: 18,
                statusEffect: { type: 'BLESSED', duration: 15 },
                desc: 'Stirring ballad: grants Blessed aura (+2 AC, +2 Attack, +Holy damage) for 15 turns.'
            },
            {
                id: 'healing_ballad',
                name: 'Healing Ballad',
                level: 2,
                icon: '💖',
                delivery: 'SELF',
                type: 'heal_over_time',
                isPositive: true,
                cooldown: 18,
                statusEffect: { type: 'REGEN', duration: 6 },
                desc: 'Soothing refrain: grants Regeneration status (+3 HP restored each turn for 6 turns).'
            },
            {
                id: 'discordant_chord',
                name: 'Discordant Chord',
                level: 3,
                icon: '⚡',
                delivery: 'AOE',
                range: 5,
                radius: 1,
                type: 'aoe_range',
                dice: 6,
                diceCount: 2,
                damageType: 'SONIC',
                cooldown: 20,
                statusEffect: { type: 'CLUMSY', duration: 4 },
                desc: 'Acoustic shockwave in 3x3 area: deals 2d6 sonic damage and disorients foes with Clumsy.'
            },
            {
                id: 'enthralling_lullaby',
                name: 'Lullaby of Slumber',
                level: 5,
                icon: '💤',
                delivery: 'AOE',
                range: 5,
                radius: 1,
                type: 'aoe_range',
                cooldown: 30,
                statusEffect: { type: 'STUNNED', duration: 3 },
                desc: 'Hypnotic melody: puts all foes in a 3x3 area into deep slumber (Stunned for 3 turns).'
            }
        ]
    }
};

// Experience Point Thresholds (Levels 1 to 20)
export const XP_TABLE = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4 (Attribute Milestone 1)
    900,    // Level 5 (Special Feat Tier)
    1400,   // Level 6
    2000,   // Level 7
    2800,   // Level 8 (Attribute Milestone 2)
    3800,   // Level 9
    5000,   // Level 10 (Mastery Milestone)
    6500,   // Level 11
    8200,   // Level 12 (Attribute Milestone 3)
    10200,  // Level 13
    12500,  // Level 14
    15000,  // Level 15
    18000,  // Level 16 (Attribute Milestone 4)
    21500,  // Level 17
    25500,  // Level 18
    30000,  // Level 19 (Attribute Milestone 5)
    35000   // Level 20
];

// Check if a level is an attribute boost milestone
export function isAttributeMilestone(level) {
    return [4, 8, 12, 16, 19].includes(level);
}

