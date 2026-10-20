// Test-mode "kitchen sink" floor: a fixed hand-built layout that contains one of everything so features can be
// checked in seconds. Activated by a seed starting with "TEST" (e.g. ?seed=TEST-0001) or ?test=1.
//
//   Spine corridor (y=50) leads east from the spawn room past 14 side rooms:
//     N0  closed door   | chest, 5 mushroom types, barrels, fresh corpses (harvest meat + venom)
//     N1  SECRET door   | altar + secret chest
//     N2  open door     | spike/fire/gas traps, pit, rubble, foliage patch, pillars
//     N3-N6 / S0        | every monster of biome 1..5 (3 each), pillars for cover tests
//     S1  closed door   | STAIRS DOWN
//     S2  closed door   | easy rats + chest (XP / level-up fodder)
//     S3  open door     | empty camp room (rest test)
//     S4  SECRET door   | two secret chests
//     S5  LOCKED door   | two vault chests (needs the Iron Key)
//     S6  closed door   | the Iron Key, HIDDEN until you Search (E)
//   Far east: a vault (closed door) holding one chest per BASE_ITEM (every equipment slot incl. both ring slots).

import { MAP_WIDTH, MAP_HEIGHT, TILES } from './Dungeon.js';
import { getBiomeForFloor, BIOMES } from '../data/Biomes.js';
import { BASE_ITEMS, createItemFromBase, MUSHROOM_TYPES } from '../data/Items.js';
import { makeMonster } from './Generator.js';
import { buildMerchantStock } from '../data/Economy.js';
import { PRNG } from '../core/RNG.js';
import { assignFloorXp } from '../data/Difficulty.js';

export const TEST_MIN_MAP_SIZE = 100;

export function isTestSeed(seed) {
    return typeof seed === 'string' && /^TEST/i.test(seed.trim());
}

export function generateTestFloor(baseSeed, floorLevel) {
    const biome = getBiomeForFloor(floorLevel);
    const terrain = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    const visibility = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    terrain.fill(TILES.WALL);

    const at = (x, y) => y * MAP_WIDTH + x;
    const put = (x, y, t) => { terrain[at(x, y)] = t; };
    const rect = (x, y, w, h, t = TILES.FLOOR) => {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, t);
    };

    const rooms = [];
    const monsters = [];
    const chests = [];
    const mushrooms = [];
    const corpses = [];
    const keys = [];
    const lockedDoors = [];
    let mId = 0;

    const addMonster = (def, x, y) => monsters.push(makeMonster(def, `t_${floorLevel}_${mId++}`, x, y, floorLevel));
    const addChest = (x, y, item, isSecret = false) => chests.push({ x, y, opened: false, isSecret, item });

    // Spawn room + spine corridor
    rect(3, 47, 7, 7);
    rooms.push({ x: 3, y: 47, w: 7, h: 7, cx: 6, cy: 50, isSecret: false });
    rect(4, 50, 94, 1); // spine y=50, x=4..97
    put(6, 50, TILES.STAIRS_UP);
    put(11, 50, TILES.DOOR_CLOSED); // door directly on the spine
    put(5, 52, TILES.SHRINE);       // choice shrine
    const merchant = { x: 8, y: 48, name: 'Wandering Merchant', icon: '🧙', stock: buildMerchantStock(new PRNG('TEST-SHOP'), floorLevel) };
    const shrineOffers = { [52 * MAP_WIDTH + 5]: ['vigor', 'fortune', 'wager'] };

    const stairsUpPos = { x: 6, y: 50 };
    let stairsDownPos = { x: 6, y: 52 };

    const ROOM_W = 8, ROOM_H = 7;
    const slots = [];
    for (let k = 0; k < 7; k++) slots.push({ x0: 14 + k * 12, ry: 40, north: true, k });
    for (let k = 0; k < 7; k++) slots.push({ x0: 14 + k * 12, ry: 54, north: false, k });

    const entranceFor = {
        N0: TILES.DOOR_CLOSED, N1: TILES.SECRET_DOOR, N2: TILES.DOOR_OPEN, N3: TILES.DOOR_CLOSED,
        N4: TILES.DOOR_CLOSED, N5: TILES.DOOR_CLOSED, N6: TILES.DOOR_CLOSED,
        S0: TILES.DOOR_CLOSED, S1: TILES.DOOR_CLOSED, S2: TILES.DOOR_CLOSED, S3: TILES.DOOR_OPEN,
        S4: TILES.SECRET_DOOR, S5: TILES.LOCKED_DOOR, S6: TILES.DOOR_CLOSED
    };

    const biomeMonsterRooms = { N3: 0, N4: 1, N5: 2, N6: 3, S0: 4 };

    for (const s of slots) {
        const name = `${s.north ? 'N' : 'S'}${s.k}`;
        const { x0, ry } = s;
        rect(x0, ry, ROOM_W, ROOM_H);
        rooms.push({ x: x0, y: ry, w: ROOM_W, h: ROOM_H, cx: x0 + 4, cy: ry + 3, isSecret: entranceFor[name] === TILES.SECRET_DOOR });

        // Entrance column connecting the room to the spine
        const ex = x0 + 3;
        if (s.north) { rect(ex, 47, 1, 3); put(ex, 47, entranceFor[name]); }
        else { rect(ex, 51, 1, 3); put(ex, 53, entranceFor[name]); }

        if (name === 'N0') {
            addChest(x0 + 1, ry + 1, createItemFromBase(BASE_ITEMS.find(b => b.name === 'Broadsword')));
            Object.keys(MUSHROOM_TYPES).forEach((key, i) => {
                const d = MUSHROOM_TYPES[key];
                mushrooms.push({ id: `t_shroom_${key}`, x: x0 + 1 + i, y: ry + 5, type: key, name: d.name, icon: d.icon, color: d.color,
                    desc: d.desc, rations: d.rations || 0, heal: d.heal || 0, status: d.status || null, duration: d.duration || 0 });
            });
            put(x0 + 6, ry + 1, TILES.BARREL);
            put(x0 + 6, ry + 5, TILES.BARREL);
            corpses.push({ id: 'tc_meat', x: x0 + 1, y: ry + 3, name: 'Wolf Carcass', monsterName: 'Wolf', icon: '🥩', isVenomous: false, harvested: false });
            corpses.push({ id: 'tc_venom', x: x0 + 3, y: ry + 3, name: 'Cave Crawler Carcass', monsterName: 'Cave Crawler', icon: '🥩', isVenomous: true, harvested: false });
        } else if (name === 'N1') {
            put(x0 + 4, ry + 3, TILES.ALTAR);
            addChest(x0 + 1, ry + 1, createItemFromBase(BASE_ITEMS.find(b => b.name === 'Amulet of the Owl')), true);
        } else if (name === 'N2') {
            put(x0 + 1, ry + 1, TILES.TRAP_SPIKE);
            put(x0 + 2, ry + 1, TILES.TRAP_FIRE);
            put(x0 + 3, ry + 1, TILES.TRAP_GAS);
            put(x0 + 5, ry + 1, TILES.PIT);
            put(x0 + 6, ry + 1, TILES.RUBBLE);
            rect(x0 + 3, ry + 4, 3, 3, TILES.FOLIAGE);
            put(x0 + 1, ry + 3, TILES.PILLAR);
            put(x0 + 6, ry + 3, TILES.PILLAR);
        } else if (name in biomeMonsterRooms) {
            const defs = BIOMES[biomeMonsterRooms[name]].monsters;
            defs.forEach((def, i) => addMonster(def, x0 + 1 + i * 3, ry + 1 + (i % 2) * 3));
            put(x0 + 3, ry + 3, TILES.PILLAR); // cover-bonus test
        } else if (name === 'S1') {
            stairsDownPos = { x: x0 + 4, y: ry + 3 };
            put(stairsDownPos.x, stairsDownPos.y, floorLevel < 25 ? TILES.STAIRS_DOWN : TILES.FLOOR);
        } else if (name === 'S2') {
            const rat = BIOMES[0].monsters[0];
            addMonster(rat, x0 + 2, ry + 2);
            addMonster(rat, x0 + 5, ry + 4);
            addChest(x0 + 4, ry + 1, createItemFromBase(BASE_ITEMS.find(b => b.name === 'Ring of Quickness')));
        } else if (name === 'S5') {
            lockedDoors.push({ x: ex, y: 53, keyId: 'key_test_0', keyName: 'Iron Key' });
            addChest(x0 + 2, ry + 2, createItemFromBase(BASE_ITEMS.find(b => b.name === 'Plate Cuirass')));
            addChest(x0 + 5, ry + 2, createItemFromBase(BASE_ITEMS.find(b => b.name === 'Elven Longbow')));
        } else if (name === 'S6') {
            keys.push({ x: x0 + 4, y: ry + 3, keyId: 'key_test_0', name: 'Iron Key', hidden: true }); // reveal with Search (E)
        } else if (name === 'S4') {
            addChest(x0 + 2, ry + 2, createItemFromBase(BASE_ITEMS.find(b => b.name === 'Band of Fortitude')), true);
            addChest(x0 + 5, ry + 2, createItemFromBase(BASE_ITEMS.find(b => b.name === 'Signet of Might')), true);
        }
    }

    // Vault: one chest per base item (covers every equipment slot, both rings, flasks, set pieces, consumables)
    rect(97, 51, 1, 23);       // vertical corridor x=97, y=51..73
    rect(95, 73, 3, 1);        // vault approach y=73
    put(95, 73, TILES.DOOR_CLOSED);
    rect(10, 70, 85, 7);       // vault interior x=10..94, y=70..76
    rooms.push({ x: 10, y: 70, w: 85, h: 7, cx: 52, cy: 73, isSecret: false });
    BASE_ITEMS.forEach((base, i) => {
        const row = Math.floor(i / 41);
        const x = 12 + 2 * (i % 41);
        const y = 71 + row * 2;
        addChest(x, y, createItemFromBase(base));
    });

    const avgMonsterXp = assignFloorXp(monsters, floorLevel);
    return {
        floorLevel,
        biome,
        terrain,
        visibility,
        rooms,
        doors: [],
        stairsUpPos,
        stairsDownPos,
        monsters,
        chests,
        mushrooms,
        keys,
        avgMonsterXp,
        spawnClock: 0,
        merchant,
        shrineOffers,
        modifier: null,
        xpMult: 1,
        goldMult: 1,
        sightPenalty: 0,
        lockedDoors,
        corpses,
        hazardZones: [],
        trapsRevealed: new Set(),
        bloodStains: [],
        isTestFloor: true
    };
}
