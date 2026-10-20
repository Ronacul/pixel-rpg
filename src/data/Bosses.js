// Boss registry: one boss guards the stairs on every 5th floor (5, 10, 15, 20, 25).
//
// A boss runs a repeating TURN SCRIPT. Each entry is a move id (see BossAI.js): melee, charge, slam, breath, boulder,
// summon, roar, fly, land. Dangerous moves are TELEGRAPHED: the boss spends a turn marking the affected tiles red
// (the player can step out of them), then the attack lands on the following turn.
//
// phases: ordered list; the LAST phase whose `below` (percent of max HP) the boss has fallen to or under is active.
// `onEnter` (optional) fires once when a phase starts: { msg, summon: true, dmgMult }.

export const BOSSES = {
    bugbear: {
        id: 'bugbear', floor: 5, name: 'Bugbear Chieftain', icon: '👹', scale: 1.5,
        hp: 80, ac: 14, dice: 8, diceCount: 2, bonusDmg: 2, xpBonus: 120,
        desc: 'A hulking, hairy brute who charges anything in his way and shouts for his goblin warband.',
        minion: { name: 'Goblin Scout', icon: '👺', hp: 9, ac: 11, dice: 6, desc: 'Sneaky dungeon dweller wielding a rusted shiv.' },
        phases: [
            { below: 100, script: ['melee', 'melee', 'charge'] },
            { below: 50, script: ['melee', 'summon', 'charge', 'melee'], onEnter: { msg: 'bellows for his warband!', summon: true } }
        ],
        loot: { gem: 1 }
    },
    troll: {
        id: 'troll', floor: 10, name: 'Cave Troll', icon: '🧌', scale: 1.55,
        hp: 150, ac: 15, dice: 10, diceCount: 2, bonusDmg: 3, xpBonus: 220, regen: 6,
        desc: 'A towering troll whose wounds close before your eyes. Fire and acid stop the regeneration.',
        phases: [
            { below: 100, script: ['melee', 'slam', 'melee', 'melee'] },
            { below: 40, script: ['slam', 'melee', 'slam'], onEnter: { msg: 'flies into a regenerating rage!', dmgMult: 1.25 } }
        ],
        loot: { gem: 1 }
    },
    chimaera: {
        id: 'chimaera', floor: 15, name: 'Chimaera', icon: '🦁', scale: 1.55,
        hp: 210, ac: 17, dice: 10, diceCount: 2, bonusDmg: 4, xpBonus: 340,
        desc: 'Lion, goat and serpent in one body: bites, sweeps its tail, and exhales fire in a cone.',
        phases: [
            { below: 100, script: ['melee', 'breath', 'melee', 'slam'] },
            { below: 40, script: ['breath', 'breath', 'slam', 'melee'], onEnter: { msg: 'rears back, flames pouring from all three heads!' } }
        ],
        breath: { zone: 'FIRE', length: 5 },
        loot: { gem: 2 }
    },
    giant: {
        id: 'giant', floor: 20, name: 'Stone Giant', icon: '🗿', scale: 1.6,
        hp: 320, ac: 18, dice: 10, diceCount: 3, bonusDmg: 4, xpBonus: 500,
        desc: 'A slow colossus who hurls boulders from range and stomps the ground flat. Pillars break its line of fire.',
        phases: [
            { below: 100, script: ['boulder', 'melee', 'slam', 'melee'] },
            { below: 50, script: ['boulder', 'boulder', 'slam'], onEnter: { msg: 'tears a chunk of the wall loose!' } }
        ],
        loot: { gem: 2 }
    },
    dragon: {
        id: 'dragon', floor: 25, name: 'Ancient Dragon', icon: '🐉', scale: 1.7,
        hp: 480, ac: 20, dice: 10, diceCount: 3, bonusDmg: 6, xpBonus: 900,
        desc: 'The Abyssal Sanctum\'s master. It takes wing between breaths: melee cannot reach it while it flies.',
        minion: { name: 'Drake Whelp', icon: '🦎', hp: 32, ac: 14, dice: 8, desc: 'A snarling dragon hatchling.' },
        phases: [
            { below: 100, script: ['melee', 'fly', 'breath', 'land'] },
            { below: 50, script: ['summon', 'fly', 'breath', 'breath', 'land', 'melee'], onEnter: { msg: 'roars, scales glowing white-hot!', dmgMult: 1.25, summon: true } }
        ],
        breath: { zone: 'FIRE', length: 6 },
        loot: { gem: 3, final: true }
    }
};

export function getBossForFloor(floorLevel) {
    if (floorLevel < 5 || floorLevel % 5 !== 0) return null;
    return Object.values(BOSSES).find(b => b.floor === floorLevel) || null;
}
