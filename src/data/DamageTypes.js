// Damage types: what a hit IS decides how it behaves.
//
//   SHARP   blades, arrows, bolts, claws    may open a bleeding wound on living foes
//   BLUNT   maces, hammers, staves, stones  may stun; shatters bone and stone
//   FIRE    flames, oil, fire spells        may set the target alight; ignites brush
//   COLD    frost                           may slow the target
//   POISON  venom, gas                      may poison; bone and stone do not care
//   ARCANE  raw magic (wands, missiles)     no rider
//   HOLY    radiance                        bane of the undead and the infernal
//   SONIC   bardic sound                    no rider
//
// Every monster can have an AFFINITY: types it resists (half damage), is weak to (+50%) or is immune to (none).
// Add a row to MONSTER_AFFINITY (matched on sprite id or name keyword) to teach a new foe how it reacts.
// Heroes use the same rules through the weapon or ability they attack with.

export const DAMAGE_TYPES = {
    SHARP:  { id: 'SHARP',  name: 'Sharp',  icon: '🗡️', color: '#dfe6f2' },
    BLUNT:  { id: 'BLUNT',  name: 'Blunt',  icon: '🔨', color: '#c9a36a' },
    FIRE:   { id: 'FIRE',   name: 'Fire',   icon: '🔥', color: '#ff8a2a' },
    COLD:   { id: 'COLD',   name: 'Cold',   icon: '❄️', color: '#8fd8ff' },
    POISON: { id: 'POISON', name: 'Poison', icon: '☠️', color: '#7be04a' },
    ARCANE: { id: 'ARCANE', name: 'Arcane', icon: '✨', color: '#b57bff' },
    HOLY:   { id: 'HOLY',   name: 'Holy',   icon: '✝️', color: '#ffe27a' },
    SONIC:  { id: 'SONIC',  name: 'Sonic',  icon: '🎶', color: '#ffb0e0' }
};

export const AFFINITY_MULT = { resist: 0.5, weak: 1.5, immune: 0 };

// sprite id (from the monster's spriteId, e.g. "monster.skeleton") or a lowercase name keyword -> affinities
export const MONSTER_AFFINITY = {
    skeleton: { resist: ['SHARP', 'COLD'], weak: ['BLUNT', 'HOLY'], immune: ['POISON'] },
    wight:    { resist: ['SHARP', 'COLD'], weak: ['HOLY', 'FIRE'], immune: ['POISON'] },
    wraith:   { resist: ['SHARP', 'BLUNT', 'COLD'], weak: ['HOLY', 'ARCANE'], immune: ['POISON'] },
    slime:    { resist: ['BLUNT', 'SHARP'], weak: ['FIRE', 'COLD'], immune: [] },
    golem:    { resist: ['SHARP', 'ARCANE', 'COLD'], weak: ['BLUNT'], immune: ['POISON'] },
    treant:   { resist: ['BLUNT', 'POISON'], weak: ['FIRE', 'SHARP'], immune: [] },
    spider:   { resist: [], weak: ['FIRE'], immune: [] },
    bat:      { resist: [], weak: ['SONIC'], immune: [] },
    hound:    { resist: ['FIRE'], weak: ['COLD'], immune: [] },
    demon:    { resist: ['FIRE'], weak: ['HOLY'], immune: [] },
    eye:      { resist: ['ARCANE'], weak: ['SHARP'], immune: [] },
    lizard:   { resist: ['POISON'], weak: ['COLD'], immune: [] },
    // bosses (by definition id)
    troll:    { resist: [], weak: ['FIRE'], immune: [] },
    chimaera: { resist: ['FIRE'], weak: ['COLD'], immune: [] },
    dragon:   { resist: ['FIRE', 'POISON'], weak: ['COLD'], immune: [] },
    giant:    { resist: ['BLUNT'], weak: ['ARCANE'], immune: [] }
};

// Names that are never "fleshy" (they do not bleed)
const BLOODLESS = ['skeleton', 'wight', 'wraith', 'slime', 'golem', 'treant', 'eye'];

export function affinityOf(monster) {
    if (!monster) return null;
    const keys = [];
    if (monster.spriteId) keys.push(monster.spriteId.replace(/^monster\./, ''));
    if (monster.def?.id) keys.push(monster.def.id);
    const name = (monster.baseName || monster.name || '').toLowerCase();
    for (const k of Object.keys(MONSTER_AFFINITY)) if (name.includes(k)) keys.push(k);
    for (const k of keys) if (MONSTER_AFFINITY[k]) return { key: k, ...MONSTER_AFFINITY[k] };
    return null;
}

export function isBloodless(monster) {
    const a = affinityOf(monster);
    return !!a && BLOODLESS.includes(a.key);
}

// What a weapon or ability deals. Abilities and flasks name their type; weapons are classified by name.
export function damageTypeOf(source) {
    if (!source) return 'BLUNT'; // fists
    if (source.damageType && DAMAGE_TYPES[source.damageType]) return source.damageType;
    if (source.zoneType === 'FIRE' || source.statusOnHit === 'BURNING') return 'FIRE';
    if (source.zoneType === 'POISON_GAS') return 'POISON';
    if (source.zoneType === 'CONSECRATION') return 'HOLY';
    const n = (source.baseName || source.name || '').toLowerCase();
    if (/wand/.test(n)) return 'ARCANE';
    if (/sling|mace|hammer|flail|staff|quarterstaff|club|fist|unarmed|wraps|lute|scepter/.test(n)) return 'BLUNT';
    return 'SHARP';
}

// { mult, tag } for a type hitting a monster
export function affinityMultiplier(monster, type) {
    const a = affinityOf(monster);
    if (!a) return { mult: 1, tag: '' };
    if (a.immune?.includes(type)) return { mult: AFFINITY_MULT.immune, tag: 'immune' };
    if (a.weak?.includes(type)) return { mult: AFFINITY_MULT.weak, tag: 'weak' };
    if (a.resist?.includes(type)) return { mult: AFFINITY_MULT.resist, tag: 'resisted' };
    return { mult: 1, tag: '' };
}

// Rider chance per type: { status, duration, chance } applied on a damaging hit (before affinities adjust it)
export const RIDERS = {
    SHARP:  { status: 'BLEEDING', duration: 3, chance: 0.15, needsFlesh: true },
    BLUNT:  { status: 'STUNNED', duration: 2, chance: 0.12, weakBonus: 0.2 },
    FIRE:   { status: 'BURNING', duration: 3, chance: 0.35 },
    COLD:   { status: 'CLUMSY', duration: 3, chance: 0.3 },
    POISON: { status: 'POISONED', duration: 4, chance: 0.35 }
};

// Short label for the combat log, e.g. " (fire, weak!)"
export function describeHit(type, tag) {
    const t = DAMAGE_TYPES[type];
    const bit = tag === 'weak' ? ', weak!' : tag === 'resisted' ? ', resisted' : tag === 'immune' ? ', immune!' : '';
    return t ? ` (${t.name.toLowerCase()}${bit})` : '';
}
