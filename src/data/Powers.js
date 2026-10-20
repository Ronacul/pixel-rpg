// Equipment POWERS: triggered / passive effects an item can bestow, beyond flat stats.
// An item carries instances like { id: 'ignite', chance: 0.25 } in item.powers; this file defines what each id does.
//
// triggers: onHit (player damages a foe), onKill (a foe dies), onDamaged (a foe hurts the player), passive (always on)
// effect kinds (applied by systems/Powers.js):
//   status      apply `status` for `duration` turns to the foe that was hit
//   lifesteal   heal the hero for `fraction` of the damage dealt
//   heal        heal the hero for `value` HP
//   thorns      deal `value` damage back to the attacker
//   selfStatus  apply `status` to the hero (e.g. a brief Stoneskin)
//   ward        passive: halve damage from a hazard zone family (value = zone ids list)
//   sense       passive: auto-detect traps / secret doors (`trap`) or hidden keys (`key`) within `value` tiles

export const POWER_DEFS = {
    ignite:     { id: 'ignite',     icon: '🔥', suffix: 'Embers',     trigger: 'onHit',     kind: 'status', status: 'BURNING',  duration: 3, defaultChance: 0.2,  label: (p) => `${pct(p)}% to ignite foes on hit` },
    frostbite:  { id: 'frostbite',  icon: '❄️', suffix: 'Frost',      trigger: 'onHit',     kind: 'status', status: 'CLUMSY',   duration: 4, defaultChance: 0.25, label: (p) => `${pct(p)}% to chill foes (slows, -AC) on hit` },
    venom:      { id: 'venom',      icon: '🧪', suffix: 'Venom',      trigger: 'onHit',     kind: 'status', status: 'POISONED', duration: 4, defaultChance: 0.25, label: (p) => `${pct(p)}% to poison foes on hit` },
    rend:       { id: 'rend',       icon: '🩸', suffix: 'Rending',    trigger: 'onHit',     kind: 'status', status: 'BLEEDING', duration: 4, defaultChance: 0.25, label: (p) => `${pct(p)}% to make foes bleed on hit` },
    stun:       { id: 'stun',       icon: '💫', suffix: 'Thunder',    trigger: 'onHit',     kind: 'status', status: 'STUNNED',  duration: 1, defaultChance: 0.08, label: (p) => `${pct(p)}% to stun foes on hit` },
    vampiric:   { id: 'vampiric',   icon: '🦇', suffix: 'the Leech',  trigger: 'onHit',     kind: 'lifesteal', fraction: 0.2, defaultChance: 1, label: (p) => `heal ${Math.round((p.value ?? 0.2) * 100)}% of damage dealt` },
    zeal:       { id: 'zeal',       icon: '⚔️', suffix: 'Valor',      trigger: 'onKill',    kind: 'heal', value: 4, defaultChance: 1, label: (p) => `heal ${p.value ?? 4} HP when a foe dies` },
    thorns:     { id: 'thorns',     icon: '🌵', suffix: 'Thorns',     trigger: 'onDamaged', kind: 'thorns', value: 3, defaultChance: 1, label: (p) => `reflect ${p.value ?? 3} damage to attackers` },
    stoneguard: { id: 'stoneguard', icon: '🪨', suffix: 'Stone',      trigger: 'onDamaged', kind: 'selfStatus', status: 'STONESKIN', duration: 3, defaultChance: 0.2, label: (p) => `${pct(p)}% to gain Stoneskin when struck` },
    fireward:   { id: 'fireward',   icon: '🧯', suffix: 'Warding',    trigger: 'passive',   kind: 'ward', zones: ['FIRE'], statuses: ['BURNING'], defaultChance: 1, label: () => 'halves fire and burning damage' },
    poisonward: { id: 'poisonward', icon: '🛡️', suffix: 'Purity',     trigger: 'passive',   kind: 'ward', zones: ['POISON_GAS', 'ACID_POOL'], statuses: ['POISONED'], defaultChance: 1, label: () => 'halves poison and acid damage' },
    trapsense:  { id: 'trapsense',  icon: '🪤', suffix: 'Wariness',   trigger: 'passive',   kind: 'sense', sense: 'trap', value: 3, defaultChance: 1, label: (p) => `auto-detects traps and secret doors within ${p.value ?? 3} tiles` },
    keysight:   { id: 'keysight',   icon: '🗝️', suffix: 'Seeking',    trigger: 'passive',   kind: 'sense', sense: 'key', value: 5, defaultChance: 1, label: (p) => `reveals hidden keys within ${p.value ?? 5} tiles` }
};

function pct(p) {
    const def = POWER_DEFS[p.id];
    return Math.round((p.chance ?? def?.defaultChance ?? 1) * 100);
}

export function describePower(p) {
    const def = POWER_DEFS[p.id];
    return def ? `${def.icon} ${def.label(p)}` : p.id;
}

// Random powers by item category (used by loot rolls)
export const POWER_POOLS = {
    weapon:  ['ignite', 'frostbite', 'venom', 'rend', 'stun', 'vampiric', 'zeal'],
    armor:   ['thorns', 'stoneguard', 'fireward', 'poisonward', 'zeal', 'trapsense'],
    jewelry: ['trapsense', 'keysight', 'fireward', 'poisonward', 'vampiric', 'zeal']
};

export function powerCategoryForSlot(slot) {
    if (slot === 'main_hand') return 'weapon';
    if (slot === 'amulet' || slot === 'ring_left' || slot === 'ring_right') return 'jewelry';
    return 'armor';
}

// Roll one random power instance for an item slot
export function rollPower(prng, slot, floorLevel = 1) {
    const pool = POWER_POOLS[powerCategoryForSlot(slot)];
    const id = prng.choice(pool);
    const def = POWER_DEFS[id];
    const p = { id };
    if (def.kind === 'status') p.chance = Math.min(0.5, def.defaultChance + floorLevel * 0.005);
    if (def.kind === 'lifesteal') p.value = 0.1 + Math.min(0.15, floorLevel * 0.006);
    if (def.kind === 'thorns') p.value = 2 + Math.floor(floorLevel / 4);
    if (def.kind === 'heal') p.value = 3 + Math.floor(floorLevel / 3);
    if (def.kind === 'sense') p.value = (def.value || 3) + Math.floor(floorLevel / 8);
    return p;
}
