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
                cooldown: 18,
                desc: 'Dig deep into martial reserve. Restore 35% of max HP immediately.'
            },
            {
                id: 'battle_cry',
                name: 'Battle Cry (Fear)',
                level: 1,
                icon: '🗣️',
                delivery: 'AOE',
                range: 0,
                radius: 2,
                type: 'aoe_fear',
                cooldown: 16,
                statusEffect: { type: 'TERRIFIED', duration: 3 },
                desc: 'Thunderous roar! Intimidates all foes in a 5x5 radius to flee in TERROR for 3 turns.'
            },
            {
                id: 'power_strike',
                name: 'Power Strike',
                level: 2,
                icon: '💥',
                delivery: 'ADJACENT',
                type: 'buff_attack',
                cooldown: 10,
                dice: 6,
                diceCount: 2,
                statusEffect: { type: 'BLEEDING', duration: 4, power: 1 },
                desc: 'Crushing melee blow dealing weapon +2d6 damage and heavy bleeding.'
            },
            {
                id: 'shield_wall',
                name: 'Shield Wall',
                level: 2,
                icon: '🛡️',
                delivery: 'SELF',
                type: 'buff_def',
                cooldown: 16,
                statusEffect: { type: 'STONESKIN', duration: 10 },
                desc: 'Adopt an impenetrable defensive guard: +3 AC and Stoneskin for 10 turns.'
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
                cooldown: 12,
                statusEffect: { type: 'BLEEDING', duration: 3, power: 1 },
                desc: 'Hurl a heavy barbed javelin at a distance foe for 1d8+STR damage and bleed.'
            },
            {
                id: 'cleave',
                name: 'Cleaving Sweep',
                level: 3,
                icon: '🪓',
                delivery: 'AOE',
                range: 0,
                radius: 1,
                type: 'aoe_adjacent',
                dice: 6,
                diceCount: 1,
                cooldown: 14,
                desc: 'Sweeping martial arc striking all surrounding enemies for 1d6+STR damage.'
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
                cooldown: 14,
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
                diceCount: 2,
                cooldown: 20,
                desc: 'Spin in a 360-degree martial storm, striking all adjacent foes for 2d8+STR damage.'
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
                id: 'mana_shield',
                name: 'Mana Shield',
                level: 1,
                icon: '💠',
                delivery: 'SELF',
                type: 'buff_def',
                cooldown: 16,
                statusEffect: { type: 'STONESKIN', duration: 12 },
                desc: 'Envelope yourself in translucent arcane barrier (+3 AC for 12 turns).'
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
                cooldown: 10,
                statusEffect: { type: 'CLUMSY', duration: 4 },
                desc: 'Beam of freezing frost: deals 1d8 cold damage and slows foe (-4 DEX, -2 AC).'
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
                cooldown: 18,
                statusEffect: { type: 'BURNING', duration: 3 },
                zoneEffect: { type: 'FIRE', duration: 4 },
                desc: 'Explosive sphere creates 3x3 blast for 3d6 fire damage and lingering fire field.'
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
                cooldown: 22,
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
                cooldown: 12,
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
                cooldown: 10,
                statusEffect: { type: 'BLESSED', duration: 8 },
                desc: 'Infuse weapon with holy light: +2d6 radiant damage and grants Blessed aura.'
            },
            {
                id: 'turn_undead',
                name: 'Holy Terror (Turn Foes)',
                level: 2,
                icon: '☀️',
                delivery: 'AOE',
                range: 0,
                radius: 2,
                type: 'aoe_fear',
                cooldown: 18,
                statusEffect: { type: 'TERRIFIED', duration: 4 },
                desc: 'Present holy symbol! Infuses divine dread, compelling nearby foes to flee in TERROR!'
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
                cooldown: 20,
                desc: 'Positive burst: heals hero for 2d8 HP while searing surrounding foes for 2d6 holy damage.'
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
                cooldown: 24,
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
                cooldown: 16,
                statusEffect: { type: 'BLESSED', duration: 15 },
                desc: 'Stirring ballad: grants Blessed aura (+2 AC, +2 Attack, +Holy damage) for 15 turns.'
            },
            {
                id: 'dissonant_whispers',
                name: 'Dissonant Whispers (Fear)',
                level: 1,
                icon: '😱',
                delivery: 'RANGED',
                range: 6,
                type: 'ranged_damage',
                dice: 6,
                diceCount: 1,
                damageType: 'SONIC',
                cooldown: 12,
                statusEffect: { type: 'TERRIFIED', duration: 3 },
                desc: 'Whisper discordant dread into target mind: deals 1d6 sonic damage and causes TERROR!'
            },
            {
                id: 'healing_ballad',
                name: 'Healing Ballad',
                level: 2,
                icon: '💖',
                delivery: 'SELF',
                type: 'heal_over_time',
                isPositive: true,
                cooldown: 16,
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
                cooldown: 18,
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
                cooldown: 25,
                statusEffect: { type: 'STUNNED', duration: 3 },
                desc: 'Hypnotic melody: puts all foes in a 3x3 area into deep slumber (Stunned for 3 turns).'
            }
        ]
    },
    RANGER: {
        id: 'ranger',
        name: 'Ranger',
        title: 'Wilderness Scout',
        icon: '🏹',
        desc: 'Master of line-of-sight marksmanship, beast tracking, and snare traps.',
        hitDie: 8,
        primaryStat: 'dex',
        proficiencies: {
            armor: ['Light', 'Medium'],
            weapons: ['Simple', 'Martial', 'Bows', 'Crossbows', 'Spears'],
            skills: ['Perception', 'Survival', 'Stealth']
        },
        abilities: [
            {
                id: 'aimed_shot',
                name: 'Aimed Shot',
                level: 1,
                icon: '🎯',
                delivery: 'RANGED',
                range: 8,
                type: 'ranged_damage',
                dice: 8,
                diceCount: 1,
                bonusFlat: 3,
                cooldown: 8,
                desc: 'Carefully sighted sniper shot dealing 1d8+DEX+3 damage with critical accuracy.'
            },
            {
                id: 'hunters_mark',
                name: "Hunter's Stalk",
                level: 1,
                icon: '👁️',
                delivery: 'SELF',
                type: 'buff_all',
                cooldown: 14,
                statusEffect: { type: 'ENERGY', duration: 15 },
                desc: 'Tap into tracker instinct: grants Energy Rush (+3 DEX, +2 Attack) for 15 turns.'
            },
            {
                id: 'snare_trap',
                name: 'Snare Trap',
                level: 2,
                icon: '🕸️',
                delivery: 'ZONE',
                range: 4,
                radius: 1,
                type: 'zone',
                cooldown: 14,
                zoneEffect: { type: 'WEB_ZONE', duration: 5 },
                desc: 'Toss a spiked net creating an entangling web that roots and slows foes.'
            },
            {
                id: 'rain_of_arrows',
                name: 'Volley of Arrows',
                level: 4,
                icon: '🏹',
                delivery: 'AOE',
                range: 7,
                radius: 2,
                type: 'aoe_range',
                dice: 6,
                diceCount: 2,
                cooldown: 20,
                statusEffect: { type: 'BLEEDING', duration: 3 },
                desc: 'Rain piercing arrows in a 5x5 area: deals 2d6 physical damage and causes bleeding.'
            }
        ]
    }
};

// Skill Ranks and Progression Benefits
export const SKILLS = {
    ATHLETICS: { id: 'athletics', name: 'Athletics', icon: '🏋️', desc: '+2 Max HP and +1 Melee Strike Damage per rank' },
    ACROBATICS: { id: 'acrobatics', name: 'Acrobatics', icon: '🤸', desc: '+1 Dodge Armor Class (AC) per rank' },
    PERCEPTION: { id: 'perception', name: 'Perception Radar', icon: '👁️', desc: '+1 Sight Radius & +2 Secret/Trap Detection DC' },
    ARCANA: { id: 'arcana', name: 'Arcana & Spellcraft', icon: '🔮', desc: '+2 Magic Damage and +1 Range to all spells' },
    MEDICINE: { id: 'medicine', name: 'Medicine & Survival', icon: '🩹', desc: 'Accelerates passive health regeneration rate by 2 turns' }
};

// Extensible Class Management Architecture
export class ClassManager {
    static registerClass(classDef) {
        if (!classDef || !classDef.id) return false;
        const key = classDef.id.toUpperCase();
        CLASSES[key] = classDef;
        return true;
    }

    static getClass(id) {
        if (!id) return CLASSES.WARRIOR;
        const key = id.toUpperCase();
        return CLASSES[key] || Object.values(CLASSES).find(c => c.id.toLowerCase() === id.toLowerCase()) || CLASSES.WARRIOR;
    }

    static getAllClasses() {
        return Object.values(CLASSES);
    }

    static getFeatsForClass(id) {
        const cls = this.getClass(id);
        return cls ? cls.abilities : [];
    }

    static getFeatsByTier(id, level) {
        const feats = this.getFeatsForClass(id);
        return feats.filter(f => f.level <= level);
    }

    static getDefaultFeatsForClass(id) {
        const feats = this.getFeatsForClass(id);
        const defaults = [];
        const seenLevels = new Set();
        for (const f of feats) {
            if (!seenLevels.has(f.level)) {
                seenLevels.add(f.level);
                defaults.push(f.id);
            }
        }
        return defaults;
    }
}

// Experience Point Thresholds (Levels 1 to 20)
export const XP_TABLE = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4 (Milestone Boost)
    900,    // Level 5 (Special Feat Tier)
    1400,   // Level 6
    2000,   // Level 7
    2800,   // Level 8 (Milestone Boost)
    3800,   // Level 9
    5000,   // Level 10 (Mastery Milestone)
    6500,   // Level 11
    8200,   // Level 12 (Milestone Boost)
    10200,  // Level 13
    12500,  // Level 14
    15000,  // Level 15
    18000,  // Level 16 (Milestone Boost)
    21500,  // Level 17
    25500,  // Level 18
    30000,  // Level 19 (Milestone Boost)
    35000   // Level 20
];

export function isAttributeMilestone(level) {
    return [4, 8, 12, 16, 19].includes(level);
}

