// Floor modifiers: some floors roll one at generation. Shown on arrival.
//   sightPenalty  - reduces sight radius      trapMult   - multiplies trap frequency
//   monsterHpMult - multiplies monster HP     monsterMult - multiplies monster count
//   extraChests   - bonus chests              xpMult / goldMult - reward multipliers

export const FLOOR_MODIFIERS = {
    dark:        { id: 'dark',        icon: '🌑', name: 'Pitch Dark',    desc: 'Sight radius -1, but +25% XP.', sightPenalty: 1, xpMult: 1.25 },
    bountiful:   { id: 'bountiful',   icon: '💰', name: 'Bountiful',     desc: 'Extra chests and +50% gold.',   extraChests: 3, goldMult: 1.5 },
    treacherous: { id: 'treacherous', icon: '🪤', name: 'Treacherous',   desc: 'Many more traps, +20% XP. Bring Search!', trapMult: 3, xpMult: 1.2 },
    ironhide:    { id: 'ironhide',    icon: '🛡️', name: 'Ironhide',      desc: 'Foes have +30% HP; +40% XP and gold.', monsterHpMult: 1.3, xpMult: 1.4, goldMult: 1.4 },
    swarming:    { id: 'swarming',    icon: '🐀', name: 'Swarming',      desc: 'About 50% more foes; +15% XP.', monsterMult: 1.5, xpMult: 1.15 },
    quiet:       { id: 'quiet',       icon: '🤫', name: 'Eerie Quiet',   desc: 'Fewer foes, all unaware, -10% XP.', monsterMult: 0.6, xpMult: 0.9 }
};

// ~40% of ordinary floors (not floor 1, not boss floors) roll a modifier
export function rollFloorModifier(prng, floorLevel) {
    if (floorLevel < 2 || floorLevel % 5 === 0) return null;
    if (!prng.chance(0.4)) return null;
    return prng.choice(Object.keys(FLOOR_MODIFIERS));
}
