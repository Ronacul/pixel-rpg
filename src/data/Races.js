// Data-driven Race registry.
//   attrs:      flat modifiers added to the class' base attributes at character creation
//   mods:       permanent passive modifiers (keys as in Feats.js: ac, per, attack, dmg, maxHp, regen...)
//   hpPerLevel: extra max HP gained on every level-up
//   traits:     descriptive list shown in the UI (mechanics live in attrs / mods / hpPerLevel)
//   bannedClasses: class ids this race cannot choose at character creation

export const RACES = {
    HUMAN: {
        id: 'human', name: 'Human', icon: '🧑',
        desc: 'Adaptable and ambitious, humans excel at whatever path they choose.',
        attrs: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
        mods: {}, hpPerLevel: 0,
        traits: [{ name: 'Versatile', desc: '+1 to every attribute.' }]
    },
    ELF: {
        id: 'elf', name: 'Elf', icon: '🧝',
        desc: 'Graceful and keen-eyed, but slight of frame.',
        attrs: { str: 0, dex: 2, con: -1, int: 1, wis: 0, cha: 0 },
        mods: { per: 1 }, hpPerLevel: 0,
        traits: [{ name: 'Keen Senses', desc: '+1 Perception.' }, { name: 'Fey Grace', desc: '+2 DEX, +1 INT, -1 CON.' }]
    },
    DWARF: {
        id: 'dwarf', name: 'Dwarf', icon: '🧔', bannedClasses: ['wizard', 'druid'],
        desc: 'Stout mountain-folk, tough as the stone they delve.',
        attrs: { str: 1, dex: 0, con: 2, int: 0, wis: 0, cha: -1 },
        mods: {}, hpPerLevel: 1,
        traits: [{ name: 'Dwarven Resilience', desc: '+1 extra Max HP every level.' }, { name: 'Stoneblood', desc: '+2 CON, +1 STR, -1 CHA.' }]
    },
    HALFLING: {
        id: 'halfling', name: 'Halfling', icon: '🧒', bannedClasses: ['warrior'],
        desc: 'Small, nimble and uncannily lucky.',
        attrs: { str: -1, dex: 2, con: 0, int: 0, wis: 0, cha: 1 },
        mods: { ac: 1 }, hpPerLevel: 0,
        traits: [{ name: 'Small & Lucky', desc: '+1 AC.' }, { name: 'Nimble', desc: '+2 DEX, +1 CHA, -1 STR.' }]
    },
    GNOME: {
        id: 'gnome', name: 'Gnome', icon: '🧙', bannedClasses: ['warrior', 'ranger'],
        desc: 'Curious tinkerers with sharp minds and hardy constitutions.',
        attrs: { str: -1, dex: 0, con: 1, int: 2, wis: 0, cha: 0 },
        mods: {}, hpPerLevel: 0,
        traits: [{ name: 'Inquisitive Mind', desc: '+2 INT, +1 CON, -1 STR.' }]
    },
    HALF_ELF: {
        id: 'half_elf', name: 'Half-Elf', icon: '🧑‍🦰',
        desc: 'Charming wanderers between two worlds.',
        attrs: { str: 0, dex: 1, con: 0, int: 1, wis: 0, cha: 2 },
        mods: { per: 1 }, hpPerLevel: 0,
        traits: [{ name: 'Fey Heritage', desc: '+1 Perception.' }, { name: 'Silver Tongue', desc: '+2 CHA, +1 DEX, +1 INT.' }]
    }
};

export const DEFAULT_RACE_ID = 'human';

export class RaceManager {
    static registerRace(def) {
        if (!def || !def.id) return false;
        RACES[def.id.toUpperCase()] = def;
        return true;
    }

    static getRace(id) {
        if (!id) return RACES.HUMAN;
        const lower = id.toLowerCase();
        return Object.values(RACES).find(r => r.id === lower) || RACES.HUMAN;
    }

    static getAllRaces() {
        return Object.values(RACES);
    }
}
