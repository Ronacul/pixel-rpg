// Perception Radar, Line of Sight, and Secret Door Detection

import { MAP_WIDTH, MAP_HEIGHT, TILES, VISIBILITY } from '../map/Dungeon.js';

export class PerceptionSystem {
    constructor() {}

    static calculateSightRadius(perScore) {
        if (perScore < 12) return 3;
        if (perScore < 16) return 4;
        if (perScore < 20) return 5;
        return 6;
    }

    // Updates visibility map and detects secret doors within line-of-sight
    static updateVisibility(floorData, playerX, playerY, perScore, perMod, onSecretFound) {
        const { terrain, visibility } = floorData;
        const radius = this.calculateSightRadius(perScore);

        // Transition current VISIBLE tiles to EXPLORED (Fog of War)
        for (let i = 0; i < visibility.length; i++) {
            if (visibility[i] === VISIBILITY.VISIBLE) {
                visibility[i] = VISIBILITY.EXPLORED;
            }
        }

        // Raycasting / Bresenham radial sweep
        const numRays = 120;
        for (let r = 0; r < numRays; r++) {
            const angle = (r / numRays) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            for (let dist = 0; dist <= radius; dist += 0.5) {
                const tx = Math.round(playerX + cos * dist);
                const ty = Math.round(playerY + sin * dist);

                if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) break;

                const idx = ty * MAP_WIDTH + tx;
                visibility[idx] = VISIBILITY.VISIBLE;

                const tile = terrain[idx];

                // Passive Secret Door Check: if secret door is in active sight
                if (tile === TILES.SECRET_DOOR) {
                    const checkDC = 12;
                    const roll = Math.floor(Math.random() * 20) + 1 + perMod;
                    if (roll >= checkDC || dist <= 1.5) {
                        // Reveal secret door as a closed door
                        terrain[idx] = TILES.DOOR_CLOSED;
                        if (onSecretFound) onSecretFound(tx, ty);
                    }
                }

                // Vision blockers: walls, closed doors, rubble
                if (tile === TILES.WALL || tile === TILES.DOOR_CLOSED || tile === TILES.RUBBLE) {
                    break;
                }
            }
        }
    }
}
