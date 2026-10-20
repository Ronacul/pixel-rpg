// Rebindable hotkeys. Every action lists the keys that trigger it (first = shown in the UI). Presets cover the
// common setups, including two one-handed layouts. Custom rebinds are layered on top of the chosen preset.

export const KEY_ACTIONS = [
    { id: 'up',         label: 'Move up' },
    { id: 'down',       label: 'Move down' },
    { id: 'left',       label: 'Move left' },
    { id: 'right',      label: 'Move right' },
    { id: 'attack',     label: 'Attack (auto-target)' },
    { id: 'power',      label: 'Use main power' },
    { id: 'cyclePower', label: 'Switch main power' },
    { id: 'search',     label: 'Search' },
    { id: 'wait',       label: 'Wait a turn' },
    { id: 'rest',       label: 'Camp rest' },
    { id: 'quickHeal',  label: 'Quick heal (best potion)' },
    { id: 'spells',     label: 'Spells and feats' },
    { id: 'aim',        label: 'Manual aim' },
    { id: 'gear',       label: 'Gear / character' },
    { id: 'zoom',       label: 'Cycle zoom' },
    { id: 'menu',       label: 'Menu' }
];

export const KEY_PRESETS = {
    classic: {
        name: 'Classic (WASD or arrows)',
        binds: {
            up: ['w', 'ArrowUp'], down: ['s', 'ArrowDown'], left: ['a', 'ArrowLeft'], right: ['d', 'ArrowRight'],
            attack: ['q', 'Tab'], power: ['Enter'], cyclePower: ['x'], search: ['e'], wait: [' '], rest: ['r'],
            quickHeal: ['h'], spells: ['f'], aim: ['t'], gear: ['c', 'i'], zoom: ['z'], menu: ['m']
        }
    },
    leftHand: {
        name: 'One-handed, left hand (WASD + nearby keys)',
        binds: {
            up: ['w', 'ArrowUp'], down: ['s', 'ArrowDown'], left: ['a', 'ArrowLeft'], right: ['d', 'ArrowRight'],
            attack: [' '], power: ['q'], cyclePower: ['Tab'], search: ['e'], wait: ['z'], rest: ['r'],
            quickHeal: ['f'], spells: ['v'], aim: ['t'], gear: ['c'], zoom: ['x'], menu: ['g']
        }
    },
    rightHand: {
        name: 'One-handed, right hand (arrows + nearby keys)',
        binds: {
            up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
            attack: ['Enter'], power: ['/'], cyclePower: ['.'], search: [','], wait: [' '], rest: ['l'],
            quickHeal: ['k'], spells: [';'], aim: ["'"], gear: ['i'], zoom: ['-'], menu: ['m']
        }
    }
};

export const DEFAULT_PRESET = 'classic';

// Keys that can never be bound (they are reserved for closing dialogs)
export const RESERVED_KEYS = ['Escape'];

export function normalizeKey(key) {
    if (key === 'Spacebar') return ' ';
    return key.length === 1 ? key.toLowerCase() : key;
}

export function keyLabel(key) {
    if (key === ' ') return 'Space';
    if (key.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[key];
    if (key.length === 1) return key.toUpperCase();
    return key;
}

// Active bindings = preset + user overrides ({ action: [keys] })
export function resolveBinds(presetId, overrides = {}) {
    const base = (KEY_PRESETS[presetId] || KEY_PRESETS[DEFAULT_PRESET]).binds;
    const out = {};
    for (const a of KEY_ACTIONS) out[a.id] = [...(overrides[a.id] || base[a.id] || [])];
    return out;
}

// key -> action lookup
export function buildKeyMap(binds) {
    const map = new Map();
    for (const [action, keys] of Object.entries(binds)) for (const k of keys) map.set(normalizeKey(k), action);
    return map;
}
