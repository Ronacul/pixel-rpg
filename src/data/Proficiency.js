// Class equipment proficiencies. Every class lists the armor weights, shields and weapon families it can use
// (see `proficiencies` in Classes.js). Items map to those families here by base name; anything not listed
// (rings, amulets, cloaks, instruments, flasks, boots of any weight we do not list) is usable by everyone.
//
// A class that lacks the proficiency cannot EQUIP the item: it is skipped by "Equip upgrades", greyed out in the bag
// and rated 0 on the value scale (so it is the first thing to drop or sell).

// armor: weight class an armor-type item needs.  weapon: any ONE of these families is enough.  shield: needs 'Shields'.
export const ITEM_TRAITS = {
    // armor
    'Padded Robes': { armor: 'Light' }, 'Leather Jerkin': { armor: 'Light' }, 'Hide Armor': { armor: 'Medium' },
    'Chainmail Hauberk': { armor: 'Medium' }, 'Thornmail Hauberk': { armor: 'Medium' }, 'Plate Cuirass': { armor: 'Heavy' },
    'Mithril Plate Cuirass': { armor: 'Heavy' },
    // helms, gauntlets, boots: only the heavy pieces are restricted
    'Great Helm': { armor: 'Heavy' }, 'Iron Dwarven Greathelm': { armor: 'Heavy' },
    'Steel Gauntlets': { armor: 'Heavy' }, 'Iron Sabatons': { armor: 'Heavy' },
    // shields
    'Buckler': { shield: true }, 'Heater Shield': { shield: true }, 'Stoneward Shield': { shield: true },
    // weapons
    'Dagger': { weapon: ['Daggers', 'Simple'] }, 'Poisoned Stiletto': { weapon: ['Daggers'] }, 'Throwing Daggers': { weapon: ['Daggers'] },
    'Shortsword': { weapon: ['Shortswords', 'Martial'] }, 'Broadsword': { weapon: ['Martial'] }, 'Warhammer': { weapon: ['Warhammers', 'Martial'] },
    'Hunting Spear': { weapon: ['Spears', 'Simple'] }, 'War Pike': { weapon: ['Spears', 'Martial'] }, 'Dungeon Halberd': { weapon: ['Martial'] },
    'Jagged Flail': { weapon: ['Maces', 'Martial'] }, 'Flanged Mace': { weapon: ['Maces', 'Simple'] },
    'Hunting Sling': { weapon: ['Slings', 'Simple'] },
    'Shortbow': { weapon: ['Shortbows', 'Bows', 'Simple'] }, 'Composite Bow': { weapon: ['Bows', 'Martial'] }, 'Elven Longbow': { weapon: ['Bows', 'Martial'] },
    'Hand Crossbow': { weapon: ['Hand Crossbows', 'Crossbows', 'Simple'] }, 'Heavy Crossbow': { weapon: ['Crossbows', 'Martial'] }, 'Sniper Arbalest': { weapon: ['Crossbows', 'Martial'] },
    'Oak Quarterstaff': { weapon: ['Staves', 'Quarterstaves', 'Simple'] }, 'Apprentice Wand': { weapon: ['Wands'] },
    'Rapier': { weapon: ['Rapiers', 'Martial'] }, 'Druidic Sickle': { weapon: ['Sickles', 'Simple'] },
    'Emberfang': { weapon: ['Shortswords', 'Martial'] }, 'Frostbrand Rapier': { weapon: ['Rapiers', 'Martial'] },
    'Bloodthirst Axe': { weapon: ['Martial'] }, 'Dwarven Battleaxe': { weapon: ['Martial'] }, 'Scepter of Dominion': { weapon: ['Simple', 'Maces'] }
};

const NAMES_LONGEST_FIRST = Object.keys(ITEM_TRAITS).sort((a, b) => b.length - a.length);

// Base item name: stored at generation, else inferred (affixed names like "Venomous Plate Cuirass of Stone")
export function traitsFor(item) {
    if (!item) return null;
    const key = item.baseName && ITEM_TRAITS[item.baseName] ? item.baseName : NAMES_LONGEST_FIRST.find(n => (item.trueName || item.name || '').includes(n));
    return key ? { key, ...ITEM_TRAITS[key] } : null;
}

// { ok, reason }: can this class equip this item?
export function usability(classDef, item) {
    if (!classDef || !item || !item.slot || item.isConsumable || item.isGem) return { ok: true };
    const t = traitsFor(item);
    if (!t) return { ok: true };
    const prof = classDef.proficiencies || { armor: [], weapons: [] };
    if (t.armor) {
        if (!(prof.armor || []).includes(t.armor)) return { ok: false, reason: `${classDef.name}s cannot wear ${t.armor.toLowerCase()} armor` };
    }
    if (t.shield) {
        if (!(prof.armor || []).includes('Shields')) return { ok: false, reason: `${classDef.name}s cannot use shields` };
    }
    if (t.weapon) {
        const have = prof.weapons || [];
        if (!t.weapon.some(w => have.includes(w))) return { ok: false, reason: `${classDef.name}s are not trained with ${t.key.toLowerCase()}s` };
    }
    return { ok: true };
}
