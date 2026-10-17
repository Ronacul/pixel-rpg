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
                type: 'heal',
                cooldown: 25,
                desc: 'Dig deep into martial reserve. Restore 35% of max HP immediately.'
            },
            {
                id: 'power_strike',
                name: 'Power Strike',
                level: 2,
                icon: '💥',
                type: 'buff_attack',
                cooldown: 12,
                desc: 'Channel crushing force: next melee strike deals +2d6 bonus damage.'
            },
            {
                id: 'shield_bash',
                name: 'Shield Bash',
                level: 3,
                icon: '🛡️',
                type: 'stun_adjacent',
                cooldown: 18,
                desc: 'Slam shield into adjacent monster for 1d6 damage and a 2-turn stun.'
            },
            {
                id: 'whirlwind',
                name: 'Whirlwind',
                level: 5,
                icon: '🌪️',
                type: 'aoe_adjacent',
                cooldown: 30,
                desc: 'Spin with martial fury, striking every surrounding foe simultaneously.'
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
                type: 'ranged_damage',
                cooldown: 10,
                desc: 'Unerring arcane bolt strikes nearest visible foe for 2d4+2 damage.'
            },
            {
                id: 'blink',
                name: 'Blink',
                level: 2,
                icon: '🌀',
                type: 'teleport',
                cooldown: 20,
                desc: 'Shift through the ether, teleporting to a random safe visible tile.'
            },
            {
                id: 'fireball',
                name: 'Fireball',
                level: 4,
                icon: '🔥',
                type: 'aoe_range',
                cooldown: 25,
                desc: 'Incinerate an area with a 3x3 blast for 3d6 fire damage.'
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
                type: 'heal',
                cooldown: 16,
                desc: 'Sacred prayer restores 2d8 + WIS modifier HP instantly.'
            },
            {
                id: 'sacred_flame',
                name: 'Sacred Flame',
                level: 2,
                icon: '🕯️',
                type: 'ranged_damage',
                cooldown: 12,
                desc: 'Call down radiant flame upon a visible foe, bypassing monster armor.'
            },
            {
                id: 'turn_undead',
                name: 'Turn Undead',
                level: 3,
                icon: '✝️',
                type: 'frighten_all',
                cooldown: 35,
                desc: 'Display holy symbol: all visible monsters are frightened and flee for 8 turns.'
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
                type: 'buff_all',
                cooldown: 20,
                desc: 'Stirring ballad: grants +2 AC and +2 to all Attack rolls for 15 turns.'
            },
            {
                id: 'charm_song',
                name: 'Charm Foe',
                level: 2,
                icon: '💫',
                type: 'pacify_nearest',
                cooldown: 22,
                desc: 'Enthrall nearest monster with enchanting melody, pacifying it for 10 turns.'
            },
            {
                id: 'discordant_screech',
                name: 'Shatter Chord',
                level: 4,
                icon: '⚡',
                type: 'aoe_confuse',
                cooldown: 28,
                desc: 'Unleash resonant acoustic burst, dealing 2d6 sonic damage and confusing foes.'
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
