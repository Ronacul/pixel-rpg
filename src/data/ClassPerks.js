// Small class-identity mechanics. Numbers live in PERK so they are easy to tune; descriptions here are what the
// player sees (Menu → Actions → Class perk, and the status chips under the map).
//
//   ranger   Focus          first ranged shot at an UNAWARE foe from 4+ tiles away always hits, and ignores cover
//   wizard   Spell Charge   wait 2 turns in a row: your next ability has no cooldown
//   cleric   Sanctify       regenerate on holy ground (temples, sanctums, beside altars); extra damage to undead
//   thief    Slip into Shadow  utility spell: hunters at range lose you and you stay Hidden for a few turns.
//                              Thieves are also only noticed from a short distance
//   bard     Song           a Lute in the off-hand gives +1 AC and +1 attack
//   warrior  Shield Bash    utility ability with a shield equipped: damage and a one-turn stun
//   (monk, druid: no perk yet)

import { traitsFor } from './Proficiency.js';

export const PERK = {
    rangerFocusMinDist: 3, // sight is only 3-4 tiles, so 4+ would almost never apply
    wizardChargeWaits: 2,
    clericSanctifyHeal: 1,
    clericUndeadBonus: 2,
    thiefShadowTurns: 8,
    thiefNoticeRadius: 2,
    bardSongAc: 1,
    bardSongAttack: 1
};

// Sprites of monsters that count as undead for the Cleric's bonus
export const UNDEAD_SPRITES = ['skeleton', 'wight', 'wraith'];

export const CLASS_PERKS = {
    ranger:  { icon: '🎯', name: 'Focus', desc: `Your first ranged shot at an unaware foe from ${PERK.rangerFocusMinDist}+ tiles away never misses and ignores cover. Stay out of sight, then open with the bow.` },
    wizard:  { icon: '🔮', name: 'Spell Charge', desc: `Wait (Space) ${PERK.wizardChargeWaits} turns in a row without acting: your next ability goes off with no cooldown. Any other action breaks the charge.` },
    cleric:  { icon: '✝️', name: 'Sanctify', desc: `You regain ${PERK.clericSanctifyHeal} HP every turn on holy ground (a temple or sanctum floor, or beside an altar), and your blows deal +${PERK.clericUndeadBonus} to the undead.` },
    thief:   { icon: '🌑', name: 'Shadow', desc: `Foes only notice you from ${PERK.thiefNoticeRadius} tiles away. Slip into Shadow (Spells menu) makes distant hunters lose you and keeps you Hidden ${PERK.thiefShadowTurns} turns. Any strike on an unaware foe is a double-damage backstab.` },
    bard:    { icon: '🎶', name: 'Song', desc: `With a Lute in your off-hand your song gives +${PERK.bardSongAc} AC and +${PERK.bardSongAttack} attack.` },
    warrior: { icon: '🛡️', name: 'Shield Bash', desc: 'With a shield equipped, Shield Bash (Spells menu) strikes an adjacent foe for damage and stuns it for a turn.' }
};

export function perkFor(player) {
    return CLASS_PERKS[player?.characterClass?.id] || null;
}

export function hasShield(player) {
    const off = player?.equipment?.off_hand;
    return !!(off && !off.isConsumable && traitsFor(off)?.shield);
}

export function hasLute(player) {
    const off = player?.equipment?.off_hand;
    return !!(off && /lute/i.test(off.baseName || off.name || ''));
}
