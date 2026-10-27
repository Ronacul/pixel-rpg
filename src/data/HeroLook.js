// How the hero's pixel sprite shows what they wear. Data only: to give a new item a look, add its name below.
// The sprite layers themselves live in art/sprites/hero.json (hero.helm.*, hero.armor.*, hero.cloak ...).
//
// Layer order, bottom to top: cloak, body, race, class outfit, boots, armor, gloves, helm, weapon, off-hand.
// The class outfit and its head/hand details are always drawn, so a hero in nothing but their starting kit still
// looks like their class (pointed hat for a wizard, hood for a thief...). Gear is drawn on top of that.
//
// Lookups use the item's BASE name (affixes like "Keen" or "of Embers" never matter). Anything not listed falls back
// to the slot's `default`; `null` means "draw nothing for this one".

export const HERO_LOOK = {
    helm: {
        default: 'cap',
        'Iron Coif': 'helm', 'Great Helm': 'greathelm', 'Iron Dwarven Greathelm': 'greathelm',
        'Shadow Hood': 'hood', "Thieves' Hood": 'hood',
        'Helm of the King of Kings': 'crown', 'Crown of the Woodland': 'crown'
    },
    armor: {
        default: 'leather',
        'Padded Robes': null, 'Leather Jerkin': 'leather', 'Hide Armor': 'leather',
        'Chainmail Hauberk': 'chain', 'Thornmail Hauberk': 'chain',
        'Plate Cuirass': 'plate', 'Mithril Plate Cuirass': 'plate'
    },
    cloak: {
        default: 'grey',
        'Shadow Cloak': 'shadow', 'Sylvan Cloak': 'green', 'Sovereign Royal Mantle': 'royal', 'Emberproof Cloak': 'ember'
    },
    gauntlets: { default: 'leather', 'Steel Gauntlets': 'steel', 'Monk Wraps': null },
    boots: { default: 'leather', 'Iron Sabatons': 'iron', 'Elven Tracker Boots': 'leaf', 'Silent Stride Boots': 'leather' },
    // Off-hand: shields by name; an instrument or flask shows nothing unless listed
    offhand: { 'Buckler': 'buckler', 'Heater Shield': 'heater', 'Stoneward Shield': 'heater', 'Wooden Lute': 'lute' }
};

// Weapons are matched by keyword in the item name, first match wins
export const WEAPON_LOOK = [
    [/wand/i, 'wand'],
    [/crossbow|arbalest|bow|sling/i, 'bow'],
    [/dagger|stiletto|knife/i, 'dagger'],
    [/rapier/i, 'rapier'],
    [/sickle|nature/i, 'staff_nature'],
    [/staff|quarterstaff|scepter/i, 'staff'],
    [/spear|pike|halberd/i, 'spear'],
    [/axe/i, 'axe'],
    [/warhammer|hammer/i, 'hammer'],
    [/mace|flail/i, 'mace']
];

function baseNameOf(item) {
    if (!item) return null;
    return item.baseName || item.name;
}

function pick(table, item) {
    if (!item) return undefined;
    const name = baseNameOf(item);
    if (name in table) return table[name];
    // affixed names ("Keen Great Helm of Embers"): any listed base name inside
    const hit = Object.keys(table).find(k => k !== 'default' && (item.trueName || item.name || '').includes(k));
    return hit !== undefined ? table[hit] : table.default;
}

export function weaponLookFor(item) {
    if (!item) return 'none';
    const n = item.baseName || item.name || '';
    for (const [re, id] of WEAPON_LOOK) if (re.test(n)) return id;
    return 'sword';
}

// Everything the sprite renderer needs as one small, cache-friendly object
export function heroLookFor(equipment) {
    const e = equipment || {};
    const off = e.off_hand;
    return {
        helm: pick(HERO_LOOK.helm, e.helm) ?? null,
        armor: e.armor ? pick(HERO_LOOK.armor, e.armor) ?? null : null,
        cloak: pick(HERO_LOOK.cloak, e.cloak) ?? null,
        gloves: pick(HERO_LOOK.gauntlets, e.gauntlets) ?? null,
        boots: pick(HERO_LOOK.boots, e.boots) ?? null,
        weapon: weaponLookFor(e.main_hand),
        offhand: off ? (pick(HERO_LOOK.offhand, off) ?? null) : null
    };
}
