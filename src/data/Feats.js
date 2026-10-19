// General Feat registry. A feat is a permanent passive picked at feat levels (see Progression.js).
// `mods` keys understood by PlayerCharacter.passiveMods: str dex con int wis cha ac maxHp attack dmg per regen
// Optional gating: `classes` (class ids) and `races` (race ids) limit who may pick it; omit for everyone.

export const FEATS = {
    toughness:     { id: 'toughness',     icon: '💪', name: 'Toughness',        desc: '+8 Max HP.',                                  mods: { maxHp: 8 } },
    alertness:     { id: 'alertness',     icon: '👁️', name: 'Alertness',        desc: '+2 Perception.',                              mods: { per: 2 } },
    iron_will:     { id: 'iron_will',     icon: '🧠', name: 'Iron Will',        desc: '+1 WIS and +1 CON.',                          mods: { wis: 1, con: 1 } },
    weapon_focus:  { id: 'weapon_focus',  icon: '⚔️', name: 'Weapon Focus',     desc: '+1 to attack rolls.',                         mods: { attack: 1 } },
    power_attack:  { id: 'power_attack',  icon: '💥', name: 'Power Attack',     desc: '+2 weapon damage.',                           mods: { dmg: 2 } },
    dodge:         { id: 'dodge',         icon: '🤸', name: 'Dodge',            desc: '+1 AC.',                                      mods: { ac: 1 } },
    nimble:        { id: 'nimble',        icon: '🏃', name: 'Nimble',           desc: '+2 DEX.',                                     mods: { dex: 2 } },
    brawn:         { id: 'brawn',         icon: '🏋️', name: 'Brawn',            desc: '+2 STR.',                                     mods: { str: 2 } },
    scholar:       { id: 'scholar',       icon: '📚', name: 'Scholar',          desc: '+2 INT.',                                     mods: { int: 2 } },
    silver_tongue: { id: 'silver_tongue', icon: '🗣️', name: 'Silver Tongue',    desc: '+2 CHA.',                                     mods: { cha: 2 } },
    endurance:     { id: 'endurance',     icon: '🫀', name: 'Endurance',        desc: 'Natural regeneration is 2 turns faster.', mods: { regen: 1 } },
    sharpshooter:  { id: 'sharpshooter',  icon: '🏹', name: 'Sharpshooter',     desc: '+1 attack and +1 damage.',                    mods: { attack: 1, dmg: 1 }, classes: ['ranger', 'thief', 'wizard', 'bard'] },
    arcane_focus:  { id: 'arcane_focus',  icon: '🔮', name: 'Arcane Focus',     desc: '+1 INT and +1 attack.',                       mods: { int: 1, attack: 1 }, classes: ['wizard', 'bard', 'druid'] },
    divine_grace:  { id: 'divine_grace',  icon: '✨', name: 'Divine Grace',     desc: '+1 WIS and +1 AC.',                           mods: { wis: 1, ac: 1 }, classes: ['cleric', 'druid', 'monk'] },
    lucky:         { id: 'lucky',         icon: '🍀', name: 'Lucky',            desc: '+1 attack and +1 AC.',                        mods: { attack: 1, ac: 1 } }
};

export class FeatManager {
    static getFeat(id) { return FEATS[id] || null; }

    static getAllFeats() { return Object.values(FEATS); }

    // Feats a character may still choose (not already owned, class/race permitting)
    static getAvailableFeats(player) {
        const owned = new Set(player.generalFeats || []);
        const classId = player.characterClass?.id;
        const raceId = player.race?.id;
        return Object.values(FEATS).filter(f =>
            !owned.has(f.id) &&
            (!f.classes || f.classes.includes(classId)) &&
            (!f.races || f.races.includes(raceId))
        );
    }

    static registerFeat(def) {
        if (!def || !def.id) return false;
        FEATS[def.id] = def;
        return true;
    }
}
