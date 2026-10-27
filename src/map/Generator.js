// Procedural Dungeon Generator (configurable map size, 150x150 default) with Dense Small Rooms, Short Hallways, Doors & Secret Doors

import { MAP_WIDTH, MAP_HEIGHT, TILES, VISIBILITY } from './Dungeon.js';
import { stageForFloor, bossForFloor, layoutForFloor, activeModule, depthOffset, CORE_MODULE_ID } from '../data/Modules.js';
import { PRNG } from '../core/RNG.js';
import { roughenWalls, addWater } from './Terrain.js';
import { UNDEAD_SPRITES } from '../data/ClassPerks.js';
import { planSpecials, furnishSpecials, buildSpecialMap, SPECIAL_ORDER } from './SpecialRooms.js';
import { generateLootItem, MUSHROOM_TYPES } from '../data/Items.js';
import { rollFloorModifier, FLOOR_MODIFIERS } from '../data/FloorModifiers.js';
import { buildMerchantStock } from '../data/Economy.js';
import { SHRINE_OFFERS } from '../data/Shrines.js';
import { DIFFICULTY, applyDifficulty, labelDread, scaleMonsterStats, rollMonsterLevel, rollAffixes, assignFloorXp, floorXpBudget } from '../data/Difficulty.js';

// Shared monster factory (also used by the test-level generator and runtime spawns).
// opts: { level, affixes } override the floor-based level and elite affixes.
export function makeMonster(def, id, x, y, floorLevel, opts = {}) {
    const level = opts.level ?? floorLevel;
    const m = {
        id,
        name: def.name,
        baseName: def.name,
        icon: def.icon,
        spriteId: def.sprite ? `monster.${def.sprite}` : null,
        x,
        y,
        hp: def.hp,
        maxHp: def.hp,
        ac: def.ac,
        dice: def.dice,
        desc: def.desc,
        alive: true,
        undead: UNDEAD_SPRITES.includes(def.sprite),
        unaware: true // Surprise mechanic: unaware until player steps into line of sight
    };
    applyDifficulty(m, def, level, opts.affixes || []);
    labelDread(m, floorLevel);
    return m;
}

// Boss monster: a large, scripted foe (see data/Bosses.js and systems/BossAI.js).
// HP follows the depth curve times the boss's multiplier; damage, attack and XP scale with the floor too.
export function makeBoss(def, x, y, floorLevel) {
    const standard = scaleMonsterStats({ hp: 20, ac: def.ac }, floorLevel);
    const hp = Math.max(def.hp, Math.round(standard.hp * (def.hpMult || 4)));
    return {
        id: `boss_${def.id}`,
        name: def.name,
        baseName: def.name,
        icon: def.icon,
        spriteId: def.sprite ? `monster.${def.sprite.id}` : null,
        spriteRoles: def.sprite?.roles || {},
        x, y,
        hp, maxHp: hp,
        ac: def.ac + Math.floor((floorLevel - 1) / 6),
        dice: def.dice, diceCount: def.diceCount, bonusDmg: (def.bonusDmg || 0) + Math.round(floorLevel * 0.12),
        attackBonus: 2 + Math.floor(floorLevel * DIFFICULTY.attackPerLevel),
        level: floorLevel + 2,
        xp: Math.round(floorXpBudget(floorLevel) * DIFFICULTY.bossBudgetShare),
        desc: def.desc,
        alive: true,
        unaware: false,
        isBoss: true,
        def,
        scale: def.scale,
        phaseIdx: -1,
        scriptIdx: 0,
        telegraph: null,
        airborne: false,
        dmgMult: 1,
        fightTurns: 0
    };
}

// How hard the generator tries to pack rooms in (more rooms = more usable floor, shorter corridors)
const ROOM_DENSITY = 3.2;

export function generateFloor(baseSeed, moduleFloor) {
    // moduleFloor = level within the module (display, stairs, bosses); floorLevel = difficulty depth (a stronger hero starts deeper)
    const floorLevel = moduleFloor + depthOffset;
    const lay = layoutForFloor(moduleFloor);
    const floorSeed = activeModule.id === CORE_MODULE_ID && depthOffset === 0 ? `${baseSeed}_L${moduleFloor}` : `${baseSeed}_${activeModule.id}_L${moduleFloor}`;
    const prng = new PRNG(floorSeed);
    const biome = stageForFloor(moduleFloor);
    let modifierId = rollFloorModifier(prng, floorLevel);
    if (bossForFloor(moduleFloor)) modifierId = null; // boss floors are never modified
    const mod = FLOOR_MODIFIERS[modifierId] || {};

    const terrain = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    const visibility = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);

    // Fill completely with solid wall
    terrain.fill(TILES.WALL);

    // Generate smaller, dense rooms (5-9 tiles wide/high)
    const rooms = [];
    // Room attempts scale with map area (65-85 attempts on a 100x100 map)
    const areaScale = (MAP_WIDTH * MAP_HEIGHT) / 10000;
    const roomHi = Math.max(5, Math.min(lay.roomSize[1], Math.floor(MAP_WIDTH / 4)));
    const roomLo = Math.min(lay.roomSize[0], roomHi);
    const roomAttempts = Math.max(8, Math.round(prng.nextInt(65, 85) * areaScale * lay.rooms * ROOM_DENSITY));

    for (let i = 0; i < roomAttempts; i++) {
        const w = prng.nextInt(roomLo, roomHi);
        const h = prng.nextInt(roomLo, roomHi);
        const x = prng.nextInt(3, MAP_WIDTH - w - 3);
        const y = prng.nextInt(3, MAP_HEIGHT - h - 3);

        const newRoom = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2), isSecret: false };

        // Check overlap with 1-tile wall padding to maximize room packing
        let overlap = false;
        for (const other of rooms) {
            if (
                newRoom.x <= other.x + other.w + 1 &&
                newRoom.x + newRoom.w + 1 >= other.x &&
                newRoom.y <= other.y + other.h + 1 &&
                newRoom.y + newRoom.h + 1 >= other.y
            ) {
                overlap = true;
                break;
            }
        }

        if (!overlap) {
            rooms.push(newRoom);
        }
    }

    // Tiny maps may rarely roll fewer than 2 rooms: keep trying until stairs have somewhere to live
    for (let guard = 0; rooms.length < 2 && guard < 200; guard++) {
        const w = prng.nextInt(5, 7);
        const h = prng.nextInt(5, 7);
        const x = prng.nextInt(3, MAP_WIDTH - w - 3);
        const y = prng.nextInt(3, MAP_HEIGHT - h - 3);
        const clear = rooms.every(o => !(x <= o.x + o.w + 1 && x + w + 1 >= o.x && y <= o.y + o.h + 1 && y + h + 1 >= o.y));
        if (clear) rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2), isSecret: false });
    }

    // Carve floor utility
    function carveFloor(x, y) {
        if (x >= 1 && x < MAP_WIDTH - 1 && y >= 1 && y < MAP_HEIGHT - 1) {
            terrain[y * MAP_WIDTH + x] = TILES.FLOOR;
        }
    }

    // Carve room interiors
    rooms.forEach((room, idx) => {
        for (let ry = room.y; ry < room.y + room.h; ry++) {
            for (let rx = room.x; rx < room.x + room.w; rx++) {
                carveFloor(rx, ry);
            }
        }

        // Tactical Terrain & Interactive Features
        if (idx !== 0) {
            // Sacred Altar in Secret Rooms
            if (room.isSecret && (idx === 1 || idx === 2)) {
                terrain[room.cy * MAP_WIDTH + room.cx] = TILES.ALTAR;
            }

            // Symmetrical Stone Pillars in large rooms (Provides Cover)
            if (room.w >= 7 && room.h >= 7 && prng.chance(0.65 * lay.pillars)) {
                const px1 = room.x + 2;
                const py1 = room.y + 2;
                const px2 = room.x + room.w - 3;
                const py2 = room.y + room.h - 3;
                terrain[py1 * MAP_WIDTH + px1] = TILES.PILLAR;
                terrain[py2 * MAP_WIDTH + px2] = TILES.PILLAR;
                if (room.w >= 8 && room.h >= 8) {
                    terrain[py1 * MAP_WIDTH + px2] = TILES.PILLAR;
                    terrain[py2 * MAP_WIDTH + px1] = TILES.PILLAR;
                }
            }

            // Destructible Barrels & Crates in room corners
            if (prng.chance(0.7 * lay.barrels)) {
                const cornerCandidates = [
                    { x: room.x + 1, y: room.y + 1 },
                    { x: room.x + room.w - 2, y: room.y + 1 },
                    { x: room.x + 1, y: room.y + room.h - 2 },
                    { x: room.x + room.w - 2, y: room.y + room.h - 2 }
                ];
                for (const c of cornerCandidates) {
                    if (prng.chance(0.4) && terrain[c.y * MAP_WIDTH + c.x] === TILES.FLOOR) {
                        terrain[c.y * MAP_WIDTH + c.x] = TILES.BARREL;
                    }
                }
            }

            // Flammable Foliage & Briars in damp cavern rooms
            if (prng.chance(Math.min(0.95, 0.35 * lay.foliage))) {
                const fx = prng.nextInt(room.x + 1, room.x + room.w - 2);
                const fy = prng.nextInt(room.y + 1, room.y + room.h - 2);
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const tx = fx + dx;
                        const ty = fy + dy;
                        if (tx >= room.x + 1 && tx < room.x + room.w - 1 && ty >= room.y + 1 && ty < room.y + room.h - 1) {
                            if (terrain[ty * MAP_WIDTH + tx] === TILES.FLOOR && prng.chance(0.6)) {
                                terrain[ty * MAP_WIDTH + tx] = TILES.FOLIAGE;
                            }
                        }
                    }
                }
            }

            // Pits & Chasms (Rare impassable terrain hazard)
            if (prng.chance(0.12) && room.w >= 6 && room.h >= 6) {
                const pitX = prng.nextInt(room.x + 2, room.x + room.w - 3);
                const pitY = prng.nextInt(room.y + 2, room.y + room.h - 3);
                if (terrain[pitY * MAP_WIDTH + pitX] === TILES.FLOOR) {
                    terrain[pitY * MAP_WIDTH + pitX] = TILES.PIT;
                }
            }

            // Rubble
            if (room.w >= 7 && room.h >= 7 && prng.chance(0.3)) {
                const ox = prng.nextInt(room.x + 1, room.x + room.w - 2);
                const oy = prng.nextInt(room.y + 1, room.y + room.h - 2);
                if (terrain[oy * MAP_WIDTH + ox] === TILES.FLOOR) {
                    terrain[oy * MAP_WIDTH + ox] = TILES.RUBBLE;
                }
            }
        }
    });

    // Short Corridor Carving using Nearest-Neighbor Graph (Minimal Hallways)
    function carveCorridor(x1, y1, x2, y2) {
        let cx = x1, cy = y1;
        if (prng.chance(0.5)) {
            while (cx !== x2) { carveFloor(cx, cy); cx += (cx < x2) ? 1 : -1; }
            while (cy !== y2) { carveFloor(cx, cy); cy += (cy < y2) ? 1 : -1; }
        } else {
            while (cy !== y2) { carveFloor(cx, cy); cy += (cy < y2) ? 1 : -1; }
            while (cx !== x2) { carveFloor(cx, cy); cx += (cx < x2) ? 1 : -1; }
        }
        carveFloor(x2, y2);
    }

    // Connect the rooms. First a minimum spanning tree (everything reachable), then LOOPS so a route back is rarely the
    // same as the route in: extra links between rooms that are not yet linked, and a second exit for most dead ends.
    const links = []; // [roomIndexA, roomIndexB]
    const linked = new Set();
    const linkKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    const addLink = (a, b) => {
        if (a === b || linked.has(linkKey(a, b))) return false;
        linked.add(linkKey(a, b));
        links.push([a, b]);
        carveCorridor(rooms[a].cx, rooms[a].cy, rooms[b].cx, rooms[b].cy);
        return true;
    };
    const roomDist = (a, b) => Math.hypot(rooms[a].cx - rooms[b].cx, rooms[a].cy - rooms[b].cy);

    if (rooms.length > 1) {
        const connected = [0];
        const unconnected = rooms.map((_, i) => i).slice(1);
        while (unconnected.length > 0) {
            let bestDist = Infinity, bestA = -1, bestBIdx = -1;
            for (const a of connected) {
                for (let b = 0; b < unconnected.length; b++) {
                    const dist = roomDist(a, unconnected[b]);
                    if (dist < bestDist) { bestDist = dist; bestA = a; bestBIdx = b; }
                }
            }
            const b = unconnected.splice(bestBIdx, 1)[0];
            addLink(bestA, b);
            connected.push(b);
        }

        // Loops: nearest unlinked pairs first, within a sensible walking distance
        const maxLoop = Math.max(14, MAP_WIDTH * 0.45);
        const pairs = [];
        for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) {
            const d = roomDist(a, b);
            if (d <= maxLoop) pairs.push({ a, b, d: d + prng.next() * 6 }); // a little noise so loops vary by seed
        }
        pairs.sort((p, q) => p.d - q.d);
        const wantedLoops = Math.max(2, Math.round(rooms.length * 0.45));
        let made = 0;
        for (const p of pairs) {
            if (made >= wantedLoops) break;
            if (addLink(p.a, p.b)) made++;
        }

        // Most dead-end rooms get a second exit (a few stay dead ends: good places to hide things)
        const degree = new Array(rooms.length).fill(0);
        for (const [a, b] of links) { degree[a]++; degree[b]++; }
        for (let a = 1; a < rooms.length; a++) {
            if (degree[a] > 1 || !prng.chance(0.7)) continue;
            const options = pairs.filter(p => (p.a === a || p.b === a) && !linked.has(linkKey(p.a, p.b))).slice(0, 3);
            if (options.length) {
                const p = prng.choice(options);
                if (addLink(p.a, p.b)) { degree[p.a]++; degree[p.b]++; }
            }
        }
    }

    // Designate 2-3 rooms as Secret Rooms
    const secretRoomCandidates = rooms.slice(Math.floor(rooms.length / 2));
    for (let s = 0; s < Math.min(3, secretRoomCandidates.length); s++) {
        secretRoomCandidates[s].isSecret = true;
    }

    // Module layout: ragged cave rock before doors are placed
    roughenWalls(terrain, prng, rooms, lay.rough);

    // Door Placement along doorways / chokepoints
    const doors = [];
    for (let y = 2; y < MAP_HEIGHT - 2; y++) {
        for (let x = 2; x < MAP_WIDTH - 2; x++) {
            if (terrain[y * MAP_WIDTH + x] === TILES.FLOOR) {
                const north = terrain[(y - 1) * MAP_WIDTH + x];
                const south = terrain[(y + 1) * MAP_WIDTH + x];
                const west  = terrain[y * MAP_WIDTH + (x - 1)];
                const east  = terrain[y * MAP_WIDTH + (x + 1)];

                const isHorizontalChoke = (north === TILES.WALL && south === TILES.WALL && west === TILES.FLOOR && east === TILES.FLOOR);
                const isVerticalChoke   = (west === TILES.WALL && east === TILES.WALL && north === TILES.FLOOR && south === TILES.FLOOR);

                if ((isHorizontalChoke || isVerticalChoke) && prng.chance(0.28 * lay.doors)) {
                    const inSecretRoom = rooms.some(r => r.isSecret && Math.abs(r.cx - x) < r.w && Math.abs(r.cy - y) < r.h);
                    if (inSecretRoom) {
                        terrain[y * MAP_WIDTH + x] = TILES.SECRET_DOOR;
                    } else {
                        terrain[y * MAP_WIDTH + x] = prng.chance(0.12) ? TILES.SECRET_DOOR : TILES.DOOR_CLOSED;
                    }
                    doors.push({ x, y, type: terrain[y * MAP_WIDTH + x] });
                } else if ((isHorizontalChoke || isVerticalChoke) && prng.chance(0.035 * (mod.trapMult || 1) * lay.traps)) {
                    // Hidden Floor Traps in chokepoint hallways (Avoid spawn room cx/cy)
                    const isNearSpawn = Math.hypot(rooms[0].cx - x, rooms[0].cy - y) < 4;
                    if (!isNearSpawn) {
                        const roll = prng.nextInt(1, 100);
                        if (roll <= 45) {
                            terrain[y * MAP_WIDTH + x] = TILES.TRAP_SPIKE;
                        } else if (roll <= 75) {
                            terrain[y * MAP_WIDTH + x] = TILES.TRAP_FIRE;
                        } else {
                            terrain[y * MAP_WIDTH + x] = TILES.TRAP_GAS;
                        }
                    }
                }
            }
        }
    }

    // Place Stairs Up (Spawn Room)
    const spawnRoom = rooms[0];
    const stairsUpPos = { x: spawnRoom.cx, y: spawnRoom.cy };
    terrain[stairsUpPos.y * MAP_WIDTH + stairsUpPos.x] = TILES.STAIRS_UP;

    // Place Stairs Down (Furthest Room from spawn)
    let exitRoom = rooms[rooms.length - 1];
    let maxDist = 0;
    for (const r of rooms) {
        const d = Math.hypot(r.cx - spawnRoom.cx, r.cy - spawnRoom.cy);
        if (d > maxDist) {
            maxDist = d;
            exitRoom = r;
        }
    }
    const stairsDownPos = { x: exitRoom.cx, y: exitRoom.cy };
    terrain[stairsDownPos.y * MAP_WIDTH + stairsDownPos.x] = (moduleFloor < activeModule.floors) ? TILES.STAIRS_DOWN : TILES.FLOOR;

    // Boss floors (5, 10, 15, 20, 25): carve a pillared arena around the exit room. The boss waits there and the
    // stairs stay sealed until it falls (enforced in main.js).
    const bossDef = bossForFloor(moduleFloor);
    let bossArena = null;
    if (bossDef) {
        const ax = exitRoom.cx, ay = exitRoom.cy;
        const half = Math.max(3, Math.min(5, ax - 3, ay - 3, MAP_WIDTH - 4 - ax, MAP_HEIGHT - 4 - ay));
        for (let y = ay - half; y <= ay + half; y++) {
            for (let x = ax - half; x <= ax + half; x++) terrain[y * MAP_WIDTH + x] = TILES.FLOOR;
        }
        if (half >= 5) {
            for (const [px, py] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) terrain[(ay + py) * MAP_WIDTH + ax + px] = TILES.PILLAR;
        }
        stairsDownPos.x = ax;
        stairsDownPos.y = ay + half - 1;
        terrain[stairsDownPos.y * MAP_WIDTH + stairsDownPos.x] = (moduleFloor < activeModule.floors) ? TILES.STAIRS_DOWN : TILES.FLOOR;
        bossArena = { cx: ax, cy: ay, half };
    }

    // Module layout: lakes and rivers (kept off the stairs and boss arena; fords guarantee every room stays reachable)
    if (lay.lakes > 0 || lay.rivers > 0) {
        const dry = [{ x: stairsUpPos.x, y: stairsUpPos.y, r: 3 }, { x: stairsDownPos.x, y: stairsDownPos.y, r: 3 }];
        if (bossArena) dry.push({ x: bossArena.cx, y: bossArena.cy, r: bossArena.half + 2 });
        const wetTargets = rooms.filter(r => !r.isSecret).map(r => ({ x: r.cx, y: r.cy }));
        wetTargets.push({ x: stairsDownPos.x, y: stairsDownPos.y });
        addWater(terrain, prng, { lakes: lay.lakes, rivers: lay.rivers }, dry, stairsUpPos, wetTargets);
    }

    // Special rooms: every floor has at least one (temple, vault, cache, lair, crypt, sanctum; the boss arena on boss floors)
    if (bossDef) exitRoom.isArena = true;
    const specials = planSpecials({ prng, terrain, rooms, floorLevel, exitRoom, bossDef });

    // Monsters & Chests
    const monsters = [];
    const chests = [];

    rooms.forEach((room, idx) => {
        // Skip the spawn room (and, on boss floors, the arena) for ordinary monsters
        if (idx === 0 || (bossDef && room === exitRoom) || room.special) return;

        // Populate monsters based on biome & difficulty scaling
        const monsterDef = prng.choice(biome.monsters);
        let monsterCount = room.isSecret ? 1 : prng.nextInt(1, 2);
        if (mod.monsterMult) {
            const scaled = monsterCount * mod.monsterMult;
            monsterCount = Math.floor(scaled) + (prng.chance(scaled % 1) ? 1 : 0);
        }

        for (let m = 0; m < monsterCount; m++) {
            const mx = prng.nextInt(room.x + 1, room.x + room.w - 2);
            const my = prng.nextInt(room.y + 1, room.y + room.h - 2);

            if (terrain[my * MAP_WIDTH + mx] === TILES.FLOOR) {
                const mon = makeMonster(monsterDef, `m_${floorLevel}_${idx}_${m}`, mx, my, floorLevel, { level: rollMonsterLevel(prng, floorLevel), affixes: rollAffixes(prng, floorLevel) });
                if (mod.monsterHpMult) { mon.hp = Math.round(mon.hp * mod.monsterHpMult); mon.maxHp = mon.hp; }
                monsters.push(mon);
            }
        }

        // Place Chests in secret rooms or with ~35% chance in regular rooms
        if (room.isSecret || prng.chance(0.35)) {
            const cx = prng.nextInt(room.x + 1, room.x + room.w - 2);
            const cy = prng.nextInt(room.y + 1, room.y + room.h - 2);
            if (terrain[cy * MAP_WIDTH + cx] === TILES.FLOOR) {
                chests.push({
                    x: cx,
                    y: cy,
                    opened: false,
                    isSecret: room.isSecret,
                    item: generateLootItem(prng, floorLevel)
                });
            }
        }
    });

    // Spawn Forageable Mushrooms across rooms (2 to 5 per floor)
    const mushrooms = [];
    const mushroomKeys = Object.keys(MUSHROOM_TYPES);
    rooms.forEach((room, idx) => {
        if (idx !== 0 && !room.special && prng.chance(0.35)) {
            const mx = prng.nextInt(room.x + 1, room.x + room.w - 2);
            const my = prng.nextInt(room.y + 1, room.y + room.h - 2);
            const posIdx = my * MAP_WIDTH + mx;
            const notOccupied = terrain[posIdx] === TILES.FLOOR && 
                !chests.some(c => c.x === mx && c.y === my) && 
                !monsters.some(m => m.x === mx && m.y === my) &&
                !mushrooms.some(m => m.x === mx && m.y === my);

            if (notOccupied) {
                const typeKey = prng.choice(mushroomKeys);
                const mDef = MUSHROOM_TYPES[typeKey];
                mushrooms.push({
                    id: `shroom_${floorLevel}_${idx}`,
                    x: mx,
                    y: my,
                    type: typeKey,
                    name: mDef.name,
                    icon: mDef.icon,
                    color: mDef.color,
                    desc: mDef.desc,
                    rations: mDef.rations || 0,
                    heal: mDef.heal || 0,
                    status: mDef.status || null,
                    duration: mDef.duration || 0
                });
            }
        }
    });

    // ------------------------------------------------------------------
    // Floor extras: modifier bonus chests, a wandering merchant, a choice shrine
    // ------------------------------------------------------------------
    const candidateRooms = rooms.filter((r, i) => i !== 0 && !r.isSecret && !r.special && !(bossDef && r === exitRoom) && r !== exitRoom);
    const freeTileInRoom = (room) => {
        for (let attempt = 0; attempt < 25; attempt++) {
            const x = prng.nextInt(room.x + 1, room.x + room.w - 2);
            const y = prng.nextInt(room.y + 1, room.y + room.h - 2);
            if (terrain[y * MAP_WIDTH + x] === TILES.FLOOR &&
                !chests.some(c => c.x === x && c.y === y) && !monsters.some(m => m.x === x && m.y === y) &&
                !mushrooms.some(m => m.x === x && m.y === y)) return { x, y };
        }
        return null;
    };

    for (let i = 0; i < (mod.extraChests || 0) && candidateRooms.length > 0; i++) {
        const spot = freeTileInRoom(prng.choice(candidateRooms));
        if (spot) chests.push({ x: spot.x, y: spot.y, opened: false, isSecret: false, item: generateLootItem(prng, floorLevel + 1) });
    }

    let merchant = null;
    if (!bossDef && floorLevel >= 2 && candidateRooms.length > 1 && prng.chance(0.3)) {
        const spot = freeTileInRoom(prng.choice(candidateRooms));
        if (spot) merchant = { x: spot.x, y: spot.y, name: 'Wandering Merchant', icon: '🧙', stock: buildMerchantStock(prng, floorLevel) };
    }

    // Shrines now live in temples (special rooms), never in an ordinary room
    const shrineOffers = {};
    furnishSpecials({ prng, terrain, monsters, chests, shrineOffers, floorLevel, biome, makeMonster, mod }, specials);

    // A fountain somewhere quiet (more often where the layout has water): drink for a random boon, or a curse
    if (!bossDef && candidateRooms.length > 1 && prng.chance(lay.lakes > 0 || lay.rivers > 0 ? 0.5 : 0.28)) {
        const spot = freeTileInRoom(prng.choice(candidateRooms));
        if (spot && !(merchant && merchant.x === spot.x && merchant.y === spot.y) && terrain[spot.y * MAP_WIDTH + spot.x] === TILES.FLOOR) {
            terrain[spot.y * MAP_WIDTH + spot.x] = TILES.FOUNTAIN;
        }
    }


    // Clear stray monsters / loot out of the arena, then place the boss
    if (bossArena) {
        const inArena = (x, y) => Math.abs(x - bossArena.cx) <= bossArena.half && Math.abs(y - bossArena.cy) <= bossArena.half;
        for (let i = monsters.length - 1; i >= 0; i--) if (inArena(monsters[i].x, monsters[i].y)) monsters.splice(i, 1);
        for (let i = chests.length - 1; i >= 0; i--) if (inArena(chests[i].x, chests[i].y)) chests.splice(i, 1);
        for (let i = mushrooms.length - 1; i >= 0; i--) if (inArena(mushrooms[i].x, mushrooms[i].y)) mushrooms.splice(i, 1);
        monsters.push(makeBoss(bossDef, bossArena.cx, bossArena.cy - 1, floorLevel));
    }

    // Divide this floor's XP budget across its monsters (floors give steady XP no matter the map size)
    const avgMonsterXp = assignFloorXp(monsters, floorLevel);

    // ------------------------------------------------------------------
    // Locked vault door(s) + matching key(s). A door is only locked if the stairs stay reachable without
    // it, so locks always guard OPTIONAL areas; a bonus chest is placed in the sealed-off part.
    // ------------------------------------------------------------------
    const lockedDoors = [];
    const keys = [];
    const KEY_NAMES = ['Iron Key', 'Brass Key', 'Silver Key'];
    // Vault specials are sealed by a locked door of their own
    for (const sp of specials) {
        if (sp.type === 'vault' && sp.room.door) lockedDoors.push({ x: sp.room.door.x, y: sp.room.door.y, keyId: `key_${floorLevel}_${lockedDoors.length}`, keyName: KEY_NAMES[lockedDoors.length % KEY_NAMES.length], isVaultSpecial: true });
    }
    const SOLID = new Set([TILES.WALL, TILES.PILLAR, TILES.PIT, TILES.RUBBLE, TILES.LOCKED_DOOR, TILES.WATER]);
    const flood = (start) => {
        const seen = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
        const q = [start.y * MAP_WIDTH + start.x];
        seen[q[0]] = 1;
        for (let h = 0; h < q.length; h++) {
            const i = q[h];
            const x = i % MAP_WIDTH;
            const y = (i - x) / MAP_WIDTH;
            if (x > 0 && !seen[i - 1] && !SOLID.has(terrain[i - 1])) { seen[i - 1] = 1; q.push(i - 1); }
            if (x < MAP_WIDTH - 1 && !seen[i + 1] && !SOLID.has(terrain[i + 1])) { seen[i + 1] = 1; q.push(i + 1); }
            if (y > 0 && !seen[i - MAP_WIDTH] && !SOLID.has(terrain[i - MAP_WIDTH])) { seen[i - MAP_WIDTH] = 1; q.push(i - MAP_WIDTH); }
            if (y < MAP_HEIGHT - 1 && !seen[i + MAP_WIDTH] && !SOLID.has(terrain[i + MAP_WIDTH])) { seen[i + MAP_WIDTH] = 1; q.push(i + MAP_WIDTH); }
        }
        return seen;
    };
    const isFree = (x, y) => terrain[y * MAP_WIDTH + x] === TILES.FLOOR && !(merchant && merchant.x === x && merchant.y === y) &&
        !chests.some(c => c.x === x && c.y === y) && !monsters.some(m => m.x === x && m.y === y) &&
        !mushrooms.some(m => m.x === x && m.y === y) && !keys.some(k => k.x === x && k.y === y);

    const wantedLocks = Math.min(2, Math.max(1, Math.round(areaScale * 0.8)));
    const baseSeen = flood(stairsUpPos);
    const doorCandidates = doors.filter(d => terrain[d.y * MAP_WIDTH + d.x] === TILES.DOOR_CLOSED);
    for (let tries = 0; tries < 30 && lockedDoors.length < wantedLocks && doorCandidates.length > 0; tries++) {
        const cand = doorCandidates.splice(prng.nextInt(0, doorCandidates.length - 1), 1)[0];
        const ci = cand.y * MAP_WIDTH + cand.x;
        terrain[ci] = TILES.LOCKED_DOOR;
        const seen = flood(stairsUpPos);
        const stairsOk = seen[stairsDownPos.y * MAP_WIDTH + stairsDownPos.x] === 1;
        const behind = [];
        if (stairsOk) {
            for (let i = 0; i < seen.length; i++) {
                if (baseSeen[i] && !seen[i] && terrain[i] === TILES.FLOOR) behind.push(i);
            }
        }
        if (stairsOk && behind.length >= 12) {
            const keyDef = { x: cand.x, y: cand.y, keyId: `key_${floorLevel}_${lockedDoors.length}`, keyName: KEY_NAMES[lockedDoors.length % KEY_NAMES.length] };
            lockedDoors.push(keyDef);
            // Bonus vault loot in the sealed-off section (2 chests, better loot)
            for (let c = 0; c < 2 && behind.length > 0; c++) {
                for (let attempt = 0; attempt < 10; attempt++) {
                    const i = behind[prng.nextInt(0, behind.length - 1)];
                    const bx = i % MAP_WIDTH, by = (i - bx) / MAP_WIDTH;
                    if (isFree(bx, by)) {
                        chests.push({ x: bx, y: by, opened: false, isSecret: false, isVault: true, item: generateLootItem(prng, floorLevel + 3) });
                        break;
                    }
                }
            }
        } else {
            terrain[ci] = TILES.DOOR_CLOSED; // would trap the stairs or guard nothing: revert
        }
    }

    // Place each key somewhere reachable WITHOUT any lock (the first is lying in plain sight, later ones are hidden until searched)
    if (lockedDoors.length > 0) {
        const finalSeen = flood(stairsUpPos);
        const reachableFloors = [];
        for (let i = 0; i < finalSeen.length; i++) {
            if (finalSeen[i] && terrain[i] === TILES.FLOOR) reachableFloors.push(i);
        }
        lockedDoors.forEach((lock, n) => {
            for (let attempt = 0; attempt < 40; attempt++) {
                const i = reachableFloors[prng.nextInt(0, reachableFloors.length - 1)];
                const kx = i % MAP_WIDTH, ky = (i - kx) / MAP_WIDTH;
                const nearStart = Math.hypot(kx - stairsUpPos.x, ky - stairsUpPos.y) < 6;
                const inBossArena = bossArena && Math.abs(kx - bossArena.cx) <= bossArena.half + 1 && Math.abs(ky - bossArena.cy) <= bossArena.half + 1;
                if (isFree(kx, ky) && !nearStart && !inBossArena) {
                    keys.push({ x: kx, y: ky, keyId: lock.keyId, name: lock.keyName, hidden: n > 0 || prng.chance(0.35) });
                    break;
                }
            }
        });
    }

    return {
        floorLevel,
        floor: moduleFloor,
        biome,
        terrain,
        visibility,
        rooms,
        links,
        specials: [...specials.map(s => ({ type: s.type, rating: s.rating, x: s.room.x, y: s.room.y, w: s.room.w, h: s.room.h })), ...(bossDef && bossArena ? [{ type: 'boss', rating: 5, x: bossArena.cx - bossArena.half, y: bossArena.cy - bossArena.half, w: bossArena.half * 2 + 1, h: bossArena.half * 2 + 1 }] : [])],
        specialMap: buildSpecialMap(rooms, bossArena),
        specialSeen: new Set(),
        doors,
        keys,
        lockedDoors,
        bossArena,
        avgMonsterXp,
        spawnClock: 0,
        merchant,
        shrineOffers,
        modifier: modifierId,
        xpMult: mod.xpMult || 1,
        goldMult: mod.goldMult || 1,
        sightPenalty: mod.sightPenalty || 0,
        stairsUpPos,
        stairsDownPos,
        monsters,
        chests,
        mushrooms,
        corpses: [],
        hazardZones: [],
        trapsRevealed: new Set(),
        bloodStains: []
    };
}

