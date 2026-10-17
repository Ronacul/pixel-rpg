// Procedural 100x100 Dungeon Generator with Dense Small Rooms, Short Hallways, Doors & Secret Doors

import { MAP_WIDTH, MAP_HEIGHT, TILES, VISIBILITY } from './Dungeon.js';
import { getBiomeForFloor } from '../data/Biomes.js';
import { PRNG } from '../core/RNG.js';
import { generateLootItem } from '../data/Items.js';

export function generateFloor(baseSeed, floorLevel) {
    const floorSeed = `${baseSeed}_L${floorLevel}`;
    const prng = new PRNG(floorSeed);
    const biome = getBiomeForFloor(floorLevel);

    const terrain = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    const visibility = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);

    // Fill completely with solid wall
    terrain.fill(TILES.WALL);

    // Generate smaller, dense rooms (5-9 tiles wide/high)
    const rooms = [];
    const roomAttempts = prng.nextInt(65, 85);

    for (let i = 0; i < roomAttempts; i++) {
        const w = prng.nextInt(5, 9);
        const h = prng.nextInt(5, 9);
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

    // Carve floor utility
    function carveFloor(x, y) {
        if (x >= 1 && x < MAP_WIDTH - 1 && y >= 1 && y < MAP_HEIGHT - 1) {
            terrain[y * MAP_WIDTH + x] = TILES.FLOOR;
        }
    }

    // Carve room interiors
    rooms.forEach(room => {
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
            if (room.w >= 7 && room.h >= 7 && prng.chance(0.65)) {
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
            if (prng.chance(0.7)) {
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
            if (prng.chance(0.35)) {
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

    // Connect all rooms via minimum distance spanning tree
    if (rooms.length > 1) {
        const connected = [rooms[0]];
        const unconnected = rooms.slice(1);

        while (unconnected.length > 0) {
            let bestDist = Infinity;
            let bestA = null;
            let bestBIdx = -1;

            for (const rA of connected) {
                for (let b = 0; b < unconnected.length; b++) {
                    const rB = unconnected[b];
                    const dist = Math.hypot(rA.cx - rB.cx, rA.cy - rB.cy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestA = rA;
                        bestBIdx = b;
                    }
                }
            }

            const bestB = unconnected.splice(bestBIdx, 1)[0];
            carveCorridor(bestA.cx, bestA.cy, bestB.cx, bestB.cy);
            connected.push(bestB);
        }

        // Add 4-6 extra loop connections between close neighbors for non-linear exploration
        const extraConnections = Math.min(6, Math.floor(rooms.length / 4));
        for (let e = 0; e < extraConnections; e++) {
            const r1 = prng.choice(rooms);
            // find another close room
            let closest = null;
            let closestDist = Infinity;
            for (const r2 of rooms) {
                if (r1 === r2) continue;
                const d = Math.hypot(r1.cx - r2.cx, r1.cy - r2.cy);
                if (d < 22 && d < closestDist) {
                    closestDist = d;
                    closest = r2;
                }
            }
            if (closest) {
                carveCorridor(r1.cx, r1.cy, closest.cx, closest.cy);
            }
        }
    }

    // Designate 2-3 rooms as Secret Rooms
    const secretRoomCandidates = rooms.slice(Math.floor(rooms.length / 2));
    for (let s = 0; s < Math.min(3, secretRoomCandidates.length); s++) {
        secretRoomCandidates[s].isSecret = true;
    }

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

                if ((isHorizontalChoke || isVerticalChoke) && prng.chance(0.28)) {
                    const inSecretRoom = rooms.some(r => r.isSecret && Math.abs(r.cx - x) < r.w && Math.abs(r.cy - y) < r.h);
                    if (inSecretRoom) {
                        terrain[y * MAP_WIDTH + x] = TILES.SECRET_DOOR;
                    } else {
                        terrain[y * MAP_WIDTH + x] = prng.chance(0.12) ? TILES.SECRET_DOOR : TILES.DOOR_CLOSED;
                    }
                    doors.push({ x, y, type: terrain[y * MAP_WIDTH + x] });
                } else if ((isHorizontalChoke || isVerticalChoke) && prng.chance(0.08)) {
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
    terrain[stairsDownPos.y * MAP_WIDTH + stairsDownPos.x] = (floorLevel < 25) ? TILES.STAIRS_DOWN : TILES.FLOOR;

    // Monsters & Chests
    const monsters = [];
    const chests = [];

    rooms.forEach((room, idx) => {
        // Skip spawn room for monsters
        if (idx === 0) return;

        // Populate monsters based on biome & difficulty scaling
        const monsterDef = prng.choice(biome.monsters);
        const monsterCount = room.isSecret ? 1 : prng.nextInt(1, 2);

        for (let m = 0; m < monsterCount; m++) {
            const mx = prng.nextInt(room.x + 1, room.x + room.w - 2);
            const my = prng.nextInt(room.y + 1, room.y + room.h - 2);

            if (terrain[my * MAP_WIDTH + mx] === TILES.FLOOR) {
                const levelBonusHp = (floorLevel - 1) * 3;
                const levelBonusAc = Math.floor((floorLevel - 1) / 3);

                monsters.push({
                    id: `m_${floorLevel}_${idx}_${m}`,
                    name: monsterDef.name,
                    icon: monsterDef.icon,
                    x: mx,
                    y: my,
                    hp: monsterDef.hp + levelBonusHp,
                    maxHp: monsterDef.hp + levelBonusHp,
                    ac: monsterDef.ac + levelBonusAc,
                    dice: monsterDef.dice,
                    desc: monsterDef.desc,
                    alive: true,
                    unaware: true // Surprise mechanic: unaware until player steps into line of sight
                });
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

    return {
        floorLevel,
        biome,
        terrain,
        visibility,
        rooms,
        doors,
        stairsUpPos,
        stairsDownPos,
        monsters,
        chests,
        hazardZones: [],
        trapsRevealed: new Set(),
        bloodStains: []
    };
}

