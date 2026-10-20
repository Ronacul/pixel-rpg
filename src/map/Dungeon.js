// Dungeon Manager with 25 Floor Bi-directional Caching and a configurable (per-run) map size

// Selectable square map sizes (tiles per side). 50x50 (Tiny) is the default.
export const MAP_SIZES = [
    { size: 50,  label: "Tiny (50x50) - default" },
    { size: 100, label: 'Small (100x100)' },
    { size: 150, label: "Standard (150x150)" },
    { size: 200, label: 'Large (200x200)' }
];
export const DEFAULT_MAP_SIZE = 50;

// Live ES-module bindings: every importer sees the new value after setMapSize().
// A map size is fixed for the lifetime of a playthrough (floors are cached at that size).
export let MAP_WIDTH = DEFAULT_MAP_SIZE;
export let MAP_HEIGHT = DEFAULT_MAP_SIZE;
export let TOTAL_TILES = MAP_WIDTH * MAP_HEIGHT;

export function normalizeMapSize(size) {
    const n = parseInt(size, 10);
    return MAP_SIZES.some(s => s.size === n) ? n : DEFAULT_MAP_SIZE;
}

export function setMapSize(size) {
    const n = normalizeMapSize(size);
    MAP_WIDTH = n;
    MAP_HEIGHT = n;
    TOTAL_TILES = n * n;
    return n;
}

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
    FOLIAGE: 16,          // Dense brush: slow passage, flammable into fire zone
    LOCKED_DOOR: 17       // Needs the matching key (floor.lockedDoors[].keyId) to open
};

export const VISIBILITY = {
    UNEXPLORED: 0, // Completely black
    EXPLORED: 1,   // In memory (fog of war)
    VISIBLE: 2     // Actively illuminated
};

export class DungeonManager {
    constructor(baseSeedString, options = {}) {
        this.baseSeedString = baseSeedString;
        this.currentFloor = 1;
        this.mapSize = MAP_WIDTH;
        this.testMode = !!options.testMode; // Test seeds generate the kitchen-sink level
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
