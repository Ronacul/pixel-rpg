// 100x100 Dungeon Manager with 25 Floor Bi-directional Caching

export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;
export const TOTAL_TILES = MAP_WIDTH * MAP_HEIGHT; // 10,000 tiles

export const TILES = {
    FLOOR: 0,
    WALL: 1,
    DOOR_CLOSED: 2,
    DOOR_OPEN: 3,
    SECRET_DOOR: 4,       // Hidden: renders as wall until detected
    STAIRS_DOWN: 5,
    STAIRS_UP: 6,
    RUBBLE: 7,
    PILLAR: 8,            // Marble/stone column: impassable, blocks sight, provides cover
    PIT: 9,               // Bottomless pit/chasm: impassable hazard
    TRAP_SPIKE: 10,       // Hidden floor spike trap: inflicts 1d8 + bleeding
    TRAP_FIRE: 11,        // Hidden fire plate trap: spawns 3x3 fire zone + burning
    TRAP_GAS: 12,         // Hidden spore trap: spawns 3x3 poison gas zone + poison
    BARREL: 13,           // Destructible obstacle: drops loot or explosive blast
    ALTAR: 14,            // Sacred shrine: grants full heal and blessed buff
    ALTAR_INERT: 15,      // Depleted shrine
    FOLIAGE: 16           // Dense brush: slow passage, flammable into fire zone
};

export const VISIBILITY = {
    UNEXPLORED: 0, // Completely black
    EXPLORED: 1,   // In memory (fog of war)
    VISIBLE: 2     // Actively illuminated
};

export class DungeonManager {
    constructor(baseSeedString) {
        this.baseSeedString = baseSeedString;
        this.currentFloor = 1;
        this.floorCache = new Map(); // floorNumber -> FloorData
    }

    getFloorKey(floorNum) {
        return `floor_${floorNum}`;
    }

    hasFloor(floorNum) {
        return this.floorCache.has(this.getFloorKey(floorNum));
    }

    getFloor(floorNum) {
        return this.floorCache.get(this.getFloorKey(floorNum));
    }

    storeFloor(floorNum, floorData) {
        this.floorCache.set(this.getFloorKey(floorNum), floorData);
    }
}

