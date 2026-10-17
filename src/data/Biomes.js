// Regional Biomes & Schemas for 25 Dungeon Floors

export const BIOMES = [
    {
        id: 'castle_dungeon',
        name: 'Castle Dungeons & Crypts',
        floorMin: 1,
        floorMax: 5,
        wallColor: '#3d4052',
        floorColor: '#12131a',
        borderColor: '#252632',
        doorColor: '#8b5a2b',
        secretColor: '#45495e',
        ambientDesc: 'Cold flagstone masonry lined with rusty iron sconces and oak timber doors.',
        monsters: [
            { name: 'Sewer Rat', icon: '🐀', hp: 6, ac: 10, dice: 4, desc: 'Scavenging dungeon vermin.' },
            { name: 'Dungeon Bat', icon: '🦇', hp: 5, ac: 12, dice: 4, desc: 'Erratic flying beast lurking in dark rafters.' },
            { name: 'Goblin Scout', icon: '👺', hp: 9, ac: 11, dice: 6, desc: 'Sneaky dungeon dweller wielding a rusted shiv.' }
        ]
    },
    {
        id: 'sunken_caverns',
        name: 'Sunken Caverns & Grottoes',
        floorMin: 6,
        floorMax: 10,
        wallColor: '#2b3a42',
        floorColor: '#0d161a',
        borderColor: '#192429',
        doorColor: '#4e6d7a',
        secretColor: '#344751',
        ambientDesc: 'Natural winding limestone caves glistening with damp moss and subterranean condensation.',
        monsters: [
            { name: 'Cave Crawler', icon: '🕷️', hp: 12, ac: 12, dice: 6, desc: 'Venomous arachnid stalking the crevices.' },
            { name: 'Slime Mass', icon: '🟢', hp: 16, ac: 9, dice: 4, desc: 'Acidic amoebic creature that digests stone and armor.' },
            { name: 'Troglodyte', icon: '🦎', hp: 15, ac: 13, dice: 6, desc: 'Subterranean hunter with acute night vision.' }
        ]
    },
    {
        id: 'overgrown_ruins',
        name: 'Overgrown Forest Catacombs',
        floorMin: 11,
        floorMax: 15,
        wallColor: '#2a4030',
        floorColor: '#0f1c12',
        borderColor: '#182b1d',
        doorColor: '#5c4033',
        secretColor: '#34523c',
        ambientDesc: 'Ancient subterranean temples invaded by massive ancient tree roots and creeping vines.',
        monsters: [
            { name: 'Thorn Stalker', icon: '🐺', hp: 18, ac: 13, dice: 8, desc: 'Feral briar-infused predator.' },
            { name: 'Entling Guard', icon: '🪵', hp: 25, ac: 14, dice: 8, desc: 'Living wooden construct protecting forgotten shrines.' },
            { name: 'Moss Skeleton', icon: '💀', hp: 20, ac: 12, dice: 6, desc: 'Restless remains of ancient elven tomb wardens.' }
        ]
    },
    {
        id: 'dwarven_forges',
        name: 'Dwarven Deep Forges',
        floorMin: 16,
        floorMax: 20,
        wallColor: '#4d3326',
        floorColor: '#1c120c',
        borderColor: '#301f15',
        doorColor: '#7a5a3a',
        secretColor: '#5e3e2f',
        ambientDesc: 'Imposing monumental granite pillars and magma ducts carved by ancient dwarven engineers.',
        monsters: [
            { name: 'Forge Golem', icon: '🤖', hp: 32, ac: 16, dice: 10, desc: 'Brass-plated automaton fueled by internal magma.' },
            { name: 'Magma Hound', icon: '🐕', hp: 24, ac: 14, dice: 8, desc: 'Fiery beast with blistering breath.' },
            { name: 'Deep Dwarf Wight', icon: '🧟', hp: 28, ac: 15, dice: 8, desc: 'Cursed forge master bound to guard the vaults.' }
        ]
    },
    {
        id: 'abyssal_sanctum',
        name: 'Abyssal Sanctum of the Void',
        floorMin: 21,
        floorMax: 25,
        wallColor: '#361e45',
        floorColor: '#130919',
        borderColor: '#23112e',
        doorColor: '#6a3682',
        secretColor: '#4c265e',
        ambientDesc: 'Unfathomable obsidian architecture buzzing with otherworldly cosmic void energy.',
        monsters: [
            { name: 'Void Wraith', icon: '👻', hp: 35, ac: 16, dice: 10, desc: 'Phasing specter that feeds on the life essence of mortals.' },
            { name: 'Eldritch Eye', icon: '👁️', hp: 30, ac: 15, dice: 12, desc: 'Floating aberration that perceives through dimensional veils.' },
            { name: 'Abyssal Overlord', icon: '😈', hp: 50, ac: 18, dice: 12, desc: 'Lord of the 25th floor depths. Master of the dungeon.' }
        ]
    }
];

export function getBiomeForFloor(floorNumber) {
    const clamped = Math.max(1, Math.min(25, floorNumber));
    return BIOMES.find(b => clamped >= b.floorMin && clamped <= b.floorMax) || BIOMES[0];
}
