// Data-driven Class registry: each class declares its hit die, base attributes, starting kit, proficiencies and ability list.
// Sub-classes (Paladin, Ninja, Gladiator, Necromancer...) plug into the same registry later: see SUBCLASS_PLANS / ClassManager.
import { EXTENDED_CLASSES } from './ClassesExtended.js';

export const CLASSES = {
    WARRIOR: {
        id: 'warrior',
        name: 'Warrior',
        title: 'Martial Champion',
        icon: '⚔️',
        desc: 'Master of melee weapons, heavy armor, and frontline endurance.',
        hitDie: 10,
        primaryStat: 'str',
        baseHp: 22,
        attributes: { str: 14, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
        startingGear: { main_hand: 'Shortsword', armor: 'Leather Jerkin', off_hand: 'Buckler' },
        parentClasses: [],
        isSubclass: false,
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
    WIZARD: {
        id: 'wizard',
        name: 'Wizard',
        title: 'Arcane Scholar',
        icon: '🔮',
        desc: 'Wielder of devastating elemental sorcery and dimensional magic.',
        hitDie: 6,
        primaryStat: 'int',
        baseHp: 16,
        attributes: { str: 8, dex: 12, con: 10, int: 16, wis: 12, cha: 10 },
        startingGear: { main_hand: 'Apprentice Wand', armor: 'Padded Robes' },
        parentClasses: [],
        isSubclass: false,
        proficiencies: {
            armor: ['Light'],
            weapons: ['Daggers', 'Staves', 'Wands'],
            skills: ['Arcana', 'Investigation']
        },
        abilities: [
            {
                id: 'arcane_sight',
                name: 'Arcane Sight',
                level: 1,
                icon: '🔮',
                delivery: 'SELF',
                type: 'identify',
                utility: true,
                isPositive: true,
                cooldown: 25,
                desc: 'Read the weave in an item: identifies the selected item, else the first unknown thing you wear or carry (hidden magic, gems and curses).'
            },
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
        baseHp: 20,
        attributes: { str: 12, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
        startingGear: { main_hand: 'Flanged Mace', armor: 'Leather Jerkin', off_hand: 'Buckler', amulet: 'Holy Symbol' },
        parentClasses: [],
        isSubclass: false,
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
                id: 'remove_curse',
                name: 'Remove Curse',
                level: 3,
                icon: '🕊️',
                delivery: 'SELF',
                type: 'uncurse',
                utility: true,
                isPositive: true,
                cooldown: 45,
                desc: 'Lift every curse from the gear you wear, gems included.'
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
        baseHp: 18,
        attributes: { str: 10, dex: 14, con: 10, int: 12, wis: 10, cha: 16 },
        startingGear: { main_hand: 'Rapier', armor: 'Leather Jerkin', off_hand: 'Wooden Lute' },
        parentClasses: [],
        isSubclass: false,
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
        baseHp: 20,
        attributes: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 8 },
        startingGear: { main_hand: 'Shortbow', armor: 'Leather Jerkin', boots: 'Traveler Boots' },
        parentClasses: [],
        isSubclass: false,
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

// Merge extended classes into the central registry
Object.assign(CLASSES, EXTENDED_CLASSES);

// Planned sub-classes. These are NOT selectable yet; the registry shape for them is defined here so they can be
// added later as ordinary class defs via ClassManager.registerClass({ ...def, isSubclass: true, parentClasses: [...] }).
// A subclass def uses the same schema as a base class plus:
//   parentClasses: ['warrior', 'cleric']   // base classes it branches from
//   unlockLevel: 5                          // level at which the branch becomes available
//   inheritAbilities: true                  // keep parent abilities, add its own on top
export const SUBCLASS_PLANS = [
    { id: 'paladin',     name: 'Paladin',     parentClasses: ['warrior', 'cleric'], unlockLevel: 5, status: 'planned' },
    { id: 'ninja',       name: 'Ninja',       parentClasses: ['thief', 'monk'],     unlockLevel: 5, status: 'planned' },
    { id: 'gladiator',   name: 'Gladiator',   parentClasses: ['warrior', 'bard'],   unlockLevel: 5, status: 'planned' },
    { id: 'necromancer', name: 'Necromancer', parentClasses: ['wizard', 'cleric'],  unlockLevel: 5, status: 'planned' }
];

// Extensible Class Management Architecture
export class ClassManager {
    static registerClass(classDef) {
        if (!classDef || !classDef.id) return false;
        const key = classDef.id.toUpperCase();
        CLASSES[key] = classDef;
        return true;
    }

    // Legacy ids that saved links / old code may still use
    static ALIASES = { mage: 'wizard' };

    static getClass(id) {
        if (!id) return CLASSES.WARRIOR;
        const lower = (this.ALIASES[id.toLowerCase()] || id).toLowerCase();
        return CLASSES[lower.toUpperCase()] || Object.values(CLASSES).find(c => c.id.toLowerCase() === lower) || CLASSES.WARRIOR;
    }

    static getAllClasses() {
        return Object.values(CLASSES);
    }

    // Classes offered at character creation (base classes only; sub-classes unlock through play)
    static getSelectableClasses() {
        return Object.values(CLASSES).filter(c => !c.isSubclass);
    }

    static getSubclassesOf(parentId) {
        return Object.values(CLASSES).filter(c => c.isSubclass && (c.parentClasses || []).includes(parentId));
    }

    static getPlannedSubclasses() {
        return SUBCLASS_PLANS.filter(p => p.status === 'planned');
    }

    static getFeatsForClass(id) {
        const cls = this.getClass(id);
        return cls ? cls.abilities : [];
    }

    static getFeatsByTier(id, level) {
        const feats = this.getFeatsForClass(id);
        return feats.filter(f => f.level <= level);
    }

    // Abilities slotted by default: everything already unlocked at `level`, up to the 4-slot cap.
    static getDefaultFeatsForClass(id, level = 1) {
        return this.getFeatsForClass(id).filter(f => f.level <= level && !f.utility).slice(0, 4).map(f => f.id);
    }
}

// Experience thresholds and level-up grants now live in Progression.js (data-driven); re-exported for compatibility.
export { XP_TABLE } from './Progression.js';
