// Perception Radar, Line of Sight, Secret Door Detection & Trap Discovery

import { MAP_WIDTH, MAP_HEIGHT, TILES, VISIBILITY } from '../map/Dungeon.js';

export class PerceptionSystem {
    static calculateSightRadius(perScore) {
        if (perScore < 12) return 3;
        if (perScore < 16) return 4;
        if (perScore < 20) return 5;
        return 6;
    }

    // Updates visibility map and detects secret doors and hidden traps within line-of-sight
    static updateVisibility(floorData, playerX, playerY, perScore, perMod, onSecretFound = null, onTrapFound = null) {
        const { terrain, visibility } = floorData;
        if (!floorData.trapsRevealed) floorData.trapsRevealed = new Set();

        const radius = this.calculateSightRadius(perScore);

        // Transition current VISIBLE tiles to EXPLORED (Fog of War)
        for (let i = 0; i < visibility.length; i++) {
            if (visibility[i] === VISIBILITY.VISIBLE) {
                visibility[i] = VISIBILITY.EXPLORED;
            }
        }

        // Raycasting / Bresenham radial sweep
        const numRays = 130;
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

                // 1. Passive Secret Door Check
                if (tile === TILES.SECRET_DOOR) {
                    const checkDC = 12;
                    const roll = Math.floor(Math.random() * 20) + 1 + perMod;
                    if (roll >= checkDC || dist <= 1.5) {
                        terrain[idx] = TILES.DOOR_CLOSED;
                        if (onSecretFound) onSecretFound(tx, ty);
                    }
                }

                // 2. Passive Hidden Trap Check
                const isTrap = (tile === TILES.TRAP_SPIKE || tile === TILES.TRAP_FIRE || tile === TILES.TRAP_GAS);
                if (isTrap && !floorData.trapsRevealed.has(idx)) {
                    const checkDC = 13;
                    const roll = Math.floor(Math.random() * 20) + 1 + perMod;
                    if (roll >= checkDC || dist <= 1.2) {
                        floorData.trapsRevealed.add(idx);
                        if (onTrapFound) onTrapFound(tx, ty, tile);
                    }
                }

                // Vision blockers: walls, closed doors, rubble, and solid stone pillars
                if (tile === TILES.WALL || tile === TILES.DOOR_CLOSED || tile === TILES.RUBBLE || tile === TILES.PILLAR) {
                    break;
                }
            }
        }
    }
}
