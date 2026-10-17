// 200x200 Dungeon Manager with 25 Floor Bi-directional Caching

export const MAP_WIDTH = 200;
export const MAP_HEIGHT = 200;
export const TOTAL_TILES = MAP_WIDTH * MAP_HEIGHT; // 40,000 tiles

export const TILES = {
    FLOOR: 0,
    WALL: 1,
    DOOR_CLOSED: 2,
    DOOR_OPEN: 3,
    SECRET_DOOR: 4,       // Hidden: renders as wall until detected
    STAIRS_DOWN: 5,
    STAIRS_UP: 6,
    RUBBLE: 7
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

