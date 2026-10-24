// Adventure MODULES: a module is a self-contained, data-only campaign chapter (theme, number of floors, look,
// monsters, bosses and layout style). The built-in "Dungeons of the Deep" is one; more are plain JSON files in /modules.
//
// ---- Module file format (everything but id/name/floors/stages is optional) -----------------------------------
// {
//   "id": "sunken_reaches",            lowercase letters, digits, underscore
//   "name": "The Sunken Reaches",
//   "icon": "🌊", "theme": "Water", "author": "you",
//   "desc": "One or two sentences shown in the module menu.",
//   "floors": 10,                      how many levels (3-40)
//   "layout": {                        how floors are built (all optional, 1 = the classic dungeon)
//       "roomSize": [6, 11],           room width/height range
//       "rooms": 1, "doors": 1, "traps": 1, "pillars": 1, "barrels": 1, "foliage": 1,   (multipliers)
//       "rough": 0.3,                  0-1, ragged cave walls
//       "lakes": 3, "rivers": 1        big lakes / rivers (with fords) - use with a "water" palette
//   },
//   "stages": [                        which look + monsters apply to which floors (must cover 1..floors)
//       { "name": "Mangrove Shallows", "floors": [1, 3], "palette": "marsh", "desc": "...",
//         "monsters": ["giant_crab", "bog_lizard"],            library ids, or inline {name,icon,hp,ac,dice,desc,sprite}
//         "layout": { "lakes": 5 } }                           optional per-stage layout override
//   ],
//   "bosses": { "5": "troll", "10": { ...inline boss... } }    floor -> library id or inline boss; FINAL floor needs one
// }
// Palettes: see PALETTES below. Monster library ids: see MONSTER_LIBRARY. Boss library ids: bugbear, troll, chimaera, giant, dragon.
// Inline boss: { name, icon, hp, ac, dice, diceCount, bonusDmg, hpMult, xpBonus, scale, desc, sprite:{id}, minion, breath:{zone,length},
//   phases:[{ below:100, script:["melee","slam"] }, ...] } using moves melee charge slam breath boulder summon roar fly land.

import { BIOMES } from './Biomes.js';
import { BOSSES } from './Bosses.js';
import { DIFFICULTY } from './Difficulty.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ---------------------------------------------------------------- monster library
const m = (name, sprite, icon, hp, ac, dice, desc) => ({ name, sprite, icon, hp, ac, dice, desc });

export const MONSTER_LIBRARY = {};
for (const b of BIOMES) for (const mon of b.monsters) MONSTER_LIBRARY[slug(mon.name)] = mon;
Object.assign(MONSTER_LIBRARY, {
    // water
    giant_crab:     m('Giant Crab', 'spider', '🦀', 14, 14, 6, 'Armoured pincers that crack shields.'),
    bog_lizard:     m('Bog Lizard', 'lizard', '🦎', 15, 12, 6, 'Ambushes from the reeds.'),
    drowned_dead:   m('Drowned Dead', 'skeleton', '💀', 18, 11, 6, 'Waterlogged bones that never stopped walking.'),
    mire_slime:     m('Mire Slime', 'slime', '🟢', 18, 9, 4, 'Swamp ooze that eats leather and rust alike.'),
    river_serpent:  m('River Serpent', 'lizard', '🐍', 20, 13, 8, 'Fast and venomous, rises from the current.'),
    kelp_horror:    m('Kelp Horror', 'treant', '🪸', 28, 13, 8, 'A strangling tangle of living kelp.'),
    tide_hag:       m('Tide Hag', 'wight', '🧜', 24, 14, 8, 'Sings sailors off the shore.'),
    water_wraith:   m('Water Wraith', 'wraith', '👻', 26, 15, 8, 'A cold shape dragging a wake of mist.'),
    kraken_spawn:   m('Kraken Spawn', 'eye', '🦑', 34, 15, 10, 'A young horror of the deep, all arms and hunger.'),
    // forest / cave / valley
    dire_wolf:      m('Dire Wolf', 'wolf', '🐺', 16, 13, 8, 'Pack hunter with a bite like a trap.'),
    cave_bat:       m('Cave Bat', 'bat', '🦇', 8, 13, 4, 'Swarms out of the dark in numbers.'),
    web_weaver:     m('Web Weaver', 'spider', '🕷️', 15, 13, 6, 'Spins snares across every passage.'),
    wood_goblin:    m('Wood Goblin', 'goblin', '👺', 12, 12, 6, 'Bark-painted raider with a hunting bow.'),
    owlbear:        m('Owlbear', 'hound', '🐻', 30, 14, 10, 'A feathered brute with a bear\'s temper.'),
    fungal_ooze:    m('Fungal Ooze', 'slime', '🍄', 18, 9, 5, 'Spore-laden slime that clouds the air.'),
    stone_golem:    m('Stone Golem', 'golem', '🗿', 34, 16, 10, 'A boulder that remembers being shaped.'),
    briar_wisp:     m('Briar Wisp', 'eye', '✨', 20, 15, 8, 'A will-o\'-the-wisp that leads travellers astray.'),
    valley_troll:   m('Valley Troll', 'wight', '🧌', 36, 15, 10, 'Lumbering and sullen; regrows what you cut.')
});

// ---------------------------------------------------------------- palettes (wall/floor/border/door/secret + which art look to use)
const pal = (wall, floor, border, door, secret, look, water = '#1d4e7a') => ({ wall, floor, border, door, secret, look, water });
export const PALETTES = {
    stone:   pal('#3d4052', '#12131a', '#252632', '#8b5a2b', '#45495e', 'castle'),
    cave:    pal('#2b3a42', '#0d161a', '#192429', '#4e6d7a', '#344751', 'caverns'),
    forest:  pal('#2a4030', '#0f1c12', '#182b1d', '#5c4033', '#34523c', 'forest'),
    forge:   pal('#4d3326', '#1c120c', '#301f15', '#7a5a3a', '#5e3e2f', 'forge'),
    void:    pal('#361e45', '#130919', '#23112e', '#6a3682', '#4c265e', 'abyss'),
    marsh:   pal('#2f4a3a', '#0e1a16', '#1b2e25', '#58503a', '#3a5a47', 'forest', '#2a5d63'),
    lagoon:  pal('#274a5c', '#0b1a24', '#163040', '#4a6f7a', '#2f5a6c', 'caverns', '#1f6a9a'),
    reef:    pal('#27405c', '#0a1424', '#142a44', '#3f6a8a', '#2a4c70', 'caverns', '#1a5fb0'),
    deep:    pal('#1f2f4f', '#070d1c', '#101c36', '#365a8c', '#243c66', 'abyss', '#13408a'),
    glade:   pal('#35563a', '#12261a', '#1f3a26', '#6a4a32', '#3f6a47', 'forest', '#2a6a6a'),
    grotto:  pal('#3a3a46', '#101018', '#22222c', '#5a5a6e', '#43435a', 'caverns', '#235a7a'),
    autumn:  pal('#4a3d2a', '#17120a', '#2a2214', '#7a5a2e', '#5a4a30', 'forest')
};

// ---------------------------------------------------------------- layout defaults
export const LAYOUT_DEFAULTS = { roomSize: [5, 9], rooms: 1, doors: 1, traps: 1, pillars: 1, barrels: 1, foliage: 1, rough: 0, lakes: 0, rivers: 0 };

export const BOSS_MOVES = ['melee', 'charge', 'slam', 'breath', 'boulder', 'summon', 'roar', 'fly', 'land'];

// ---------------------------------------------------------------- the built-in module
function buildCore() {
    const bosses = {};
    for (const b of Object.values(BOSSES)) bosses[b.floor] = b;
    return {
        id: 'deep_dungeons', name: 'Dungeons of the Deep', icon: '🏰', theme: 'Classic dungeon', author: 'Pixel RPG', builtin: true,
        desc: 'The original descent: crypts, caverns, ruins, forges and the Abyssal Sanctum, with a boss every five floors.',
        floors: 25, layout: { ...LAYOUT_DEFAULTS },
        stages: BIOMES, // already in stage shape
        bosses, startNote: 'Five regions, five bosses.'
    };
}

// ---------------------------------------------------------------- validation + normalisation
function resolveMonster(ref, errors, where) {
    if (typeof ref === 'string') {
        const lib = MONSTER_LIBRARY[ref];
        if (!lib) errors.push(`${where}: unknown monster "${ref}" (see MONSTER_LIBRARY in src/data/Modules.js)`);
        return lib || null;
    }
    if (ref && typeof ref === 'object') {
        const miss = ['name', 'icon', 'hp', 'ac', 'dice'].filter(k => ref[k] === undefined);
        if (miss.length) { errors.push(`${where}: inline monster is missing ${miss.join(', ')}`); return null; }
        return { desc: '', ...ref };
    }
    errors.push(`${where}: monster must be a library id or an object`);
    return null;
}

function resolveBoss(ref, floor, isFinal, errors) {
    const where = `boss on floor ${floor}`;
    let def;
    if (typeof ref === 'string') {
        if (!BOSSES[ref]) { errors.push(`${where}: unknown boss "${ref}" (library: ${Object.keys(BOSSES).join(', ')})`); return null; }
        def = { ...BOSSES[ref] };
    } else if (ref && typeof ref === 'object') {
        const miss = ['name', 'icon', 'hp', 'ac', 'dice', 'phases'].filter(k => ref[k] === undefined);
        if (miss.length) { errors.push(`${where}: missing ${miss.join(', ')}`); return null; }
        def = { id: slug(ref.name), hpMult: 4, diceCount: 1, bonusDmg: 0, xpBonus: 100, scale: 1.5, desc: '', sprite: null, ...ref };
        for (const ph of def.phases) {
            if (typeof ph.below !== 'number' || !Array.isArray(ph.script) || !ph.script.length) { errors.push(`${where}: each phase needs below + script[]`); return null; }
            for (const mv of ph.script) if (!BOSS_MOVES.includes(mv)) { errors.push(`${where}: unknown move "${mv}" (use ${BOSS_MOVES.join(', ')})`); return null; }
        }
        if (typeof def.minion === 'string') def.minion = resolveMonster(def.minion, errors, where);
        if (typeof def.sprite === 'string') def.sprite = { id: def.sprite };
    } else {
        errors.push(`${where}: must be a library id or an object`);
        return null;
    }
    def.floor = floor;
    def.loot = { ...(def.loot || {}), final: isFinal };
    return def;
}

// Returns { ok, errors, module }. Never throws on bad input, so user-submitted files fail politely.
export function validateModule(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object') return { ok: false, errors: ['Not a JSON object'] };
    if (!/^[a-z0-9_]{2,40}$/.test(raw.id || '')) errors.push('id must be 2-40 lowercase letters, digits or _');
    if (!raw.name) errors.push('name is required');
    const floors = parseInt(raw.floors, 10);
    if (!(floors >= 3 && floors <= 40)) errors.push('floors must be a number from 3 to 40');
    if (!Array.isArray(raw.stages) || !raw.stages.length) errors.push('stages must be a non-empty list');
    if (errors.length) return { ok: false, errors };

    const layoutOf = (o) => ({ ...LAYOUT_DEFAULTS, ...(o || {}) });
    const base = layoutOf(raw.layout);

    const covered = new Set();
    const stages = raw.stages.map((s, i) => {
        const where = `stage ${i + 1}${s.name ? ` "${s.name}"` : ''}`;
        const [a, b] = Array.isArray(s.floors) ? s.floors : [];
        if (!(a >= 1 && b >= a && b <= floors)) errors.push(`${where}: floors must be [first, last] within 1-${floors}`);
        else for (let f = a; f <= b; f++) { if (covered.has(f)) errors.push(`${where}: floor ${f} is in two stages`); covered.add(f); }
        const palette = PALETTES[s.palette] || (s.palette ? (errors.push(`${where}: unknown palette "${s.palette}" (${Object.keys(PALETTES).join(', ')})`), null) : PALETTES.stone);
        const monsters = (s.monsters || []).map((r, k) => resolveMonster(r, errors, `${where} monster ${k + 1}`)).filter(Boolean);
        if (!monsters.length) errors.push(`${where}: needs at least one monster`);
        const p = palette || PALETTES.stone;
        return {
            id: `${raw.id}:${i}`, name: s.name || `Stage ${i + 1}`, floorMin: a, floorMax: b,
            wallColor: p.wall, floorColor: p.floor, borderColor: p.border, doorColor: p.door, secretColor: p.secret,
            waterColor: p.water, look: p.look, ambientDesc: s.desc || '', monsters,
            layout: s.layout ? { ...base, ...s.layout } : base
        };
    });
    for (let f = 1; f <= floors; f++) if (!covered.has(f)) { errors.push(`floor ${f} is not covered by any stage`); break; }

    const bosses = {};
    for (const [k, v] of Object.entries(raw.bosses || {})) {
        const f = parseInt(k, 10);
        if (!(f >= 2 && f <= floors)) { errors.push(`boss floor ${k} must be within 2-${floors}`); continue; }
        const def = resolveBoss(v, f, f === floors, errors);
        if (def) bosses[f] = def;
    }
    if (!bosses[floors]) errors.push(`the final floor (${floors}) needs a boss`);
    if (errors.length) return { ok: false, errors };

    return {
        ok: true, errors: [],
        module: {
            id: raw.id, name: raw.name, icon: raw.icon || '📜', theme: raw.theme || '', author: raw.author || 'unknown',
            desc: raw.desc || '', floors, layout: base, stages, bosses, builtin: false
        }
    };
}

// ---------------------------------------------------------------- registry + the module currently being played
const registry = new Map();
const core = buildCore();
registry.set(core.id, core);
export const CORE_MODULE_ID = core.id;

export const Modules = {
    list() { return [...registry.values()]; },
    get(id) { return registry.get(id) || core; },
    has(id) { return registry.has(id); },
    // Validates and adds (or replaces) a module. Returns the validation result.
    register(raw) {
        const res = validateModule(raw);
        if (res.ok) registry.set(res.module.id, res.module);
        return res;
    }
};

export let activeModule = core;
export let depthOffset = 0; // added to a floor number to get its difficulty depth (a level-9 hero starts deeper)

export function setActiveModule(mod, offset = 0) {
    activeModule = mod || core;
    depthOffset = Math.max(0, offset | 0);
}

export function stageForFloor(floor) {
    const f = Math.max(1, Math.min(activeModule.floors, floor));
    return activeModule.stages.find(s => f >= s.floorMin && f <= s.floorMax) || activeModule.stages[0];
}

export function bossForFloor(floor) {
    return activeModule.bosses[floor] || null;
}

export function layoutForFloor(floor) {
    const st = stageForFloor(floor);
    return { ...LAYOUT_DEFAULTS, ...(activeModule.layout || {}), ...(st.layout || {}) };
}

// ---------------------------------------------------------------- hero level <-> difficulty depth
export function depthForLevel(level) {
    return Math.max(1, Math.round((Math.max(1, level) - 1) / DIFFICULTY.playerLevelPerFloor) + 1);
}
export function levelAtDepth(depth) {
    return Math.max(1, Math.round(1 + (depth - 1) * DIFFICULTY.playerLevelPerFloor));
}
// Expected hero level span for a module entered at the given offset: { from, to }
export function levelBand(mod, offset = 0) {
    return { from: levelAtDepth(1 + offset), to: levelAtDepth(mod.floors + offset) };
}
