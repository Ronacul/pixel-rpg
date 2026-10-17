// Procedural 200x200 Dungeon Generator with Rooms, Corridors, Doors & Secret Doors

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

    const rooms = [];
    const roomCount = prng.nextInt(35, 50);

    for (let i = 0; i < roomCount; i++) {
        const w = prng.nextInt(8, 18);
        const h = prng.nextInt(8, 18);
        const x = prng.nextInt(5, MAP_WIDTH - w - 5);
        const y = prng.nextInt(5, MAP_HEIGHT - h - 5);

        const newRoom = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2), isSecret: false };

        // Check overlap with padding
        let overlap = false;
        for (const other of rooms) {
            if (
                newRoom.x <= other.x + other.w + 2 &&
                newRoom.x + newRoom.w + 2 >= other.x &&
                newRoom.y <= other.y + other.h + 2 &&
                newRoom.y + newRoom.h + 2 >= other.y
            ) {
                overlap = true;
                break;
            }
        }

        if (!overlap) {
            rooms.push(newRoom);
        }
    }

    // Carve room interiors
    function carveFloor(x, y) {
        if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
            terrain[y * MAP_WIDTH + x] = TILES.FLOOR;
        }
    }

    rooms.forEach((room, idx) => {
        for (let ry = room.y; ry < room.y + room.h; ry++) {
            for (let rx = room.x; rx < room.x + room.w; rx++) {
                carveFloor(rx, ry);
            }
        }

        // Add 2-4 rubble obstacles in larger rooms
        if (room.w > 10 && room.h > 10) {
            const rubbleCount = prng.nextInt(2, 4);
            for (let r = 0; r < rubbleCount; r++) {
                const ox = prng.nextInt(room.x + 2, room.x + room.w - 3);
                const oy = prng.nextInt(room.y + 2, room.y + room.h - 3);
                terrain[oy * MAP_WIDTH + ox] = TILES.RUBBLE;
            }
        }

        // Connect room to previous room via hallway
        if (idx > 0) {
            const prev = rooms[idx - 1];
            let cx = prev.cx;
            let cy = prev.cy;

            // Connect horizontally then vertically
            while (cx !== room.cx) {
                carveFloor(cx, cy);
                cx += (cx < room.cx) ? 1 : -1;
            }
            while (cy !== room.cy) {
                carveFloor(cx, cy);
                cy += (cy < room.cy) ? 1 : -1;
            }
        }
    });

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

                if ((isHorizontalChoke || isVerticalChoke) && prng.chance(0.25)) {
                    // Check if near secret room
                    const inSecretRoom = rooms.some(r => r.isSecret && Math.abs(r.cx - x) < r.w && Math.abs(r.cy - y) < r.h);
                    if (inSecretRoom) {
                        terrain[y * MAP_WIDTH + x] = TILES.SECRET_DOOR;
                    } else {
                        terrain[y * MAP_WIDTH + x] = prng.chance(0.12) ? TILES.SECRET_DOOR : TILES.DOOR_CLOSED;
                    }
                    doors.push({ x, y, type: terrain[y * MAP_WIDTH + x] });
                }
            }
        }
    }

    // Place Stairs Up (Spawn Room)
    const spawnRoom = rooms[0];
    const stairsUpPos = { x: spawnRoom.cx, y: spawnRoom.cy };
    terrain[stairsUpPos.y * MAP_WIDTH + stairsUpPos.x] = TILES.STAIRS_UP;

    // Place Stairs Down (Farthest Room)
    const exitRoom = rooms[rooms.length - 1];
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
        chests
    };
}
