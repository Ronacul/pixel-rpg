// Bounded A* / BFS Pathfinding for 200x200 Grid

import { MAP_WIDTH, MAP_HEIGHT, TILES } from '../map/Dungeon.js';

export function findPath(startX, startY, endX, endY, terrain, monsters, maxRadius = 50) {
    if (startX === endX && startY === endY) return [];

    // Bounded search box
    const minX = Math.max(0, Math.min(startX, endX) - 10);
    const maxX = Math.min(MAP_WIDTH - 1, Math.max(startX, endX) + 10);
    const minY = Math.max(0, Math.min(startY, endY) - 10);
    const maxY = Math.min(MAP_HEIGHT - 1, Math.max(startY, endY) + 10);

    const dist = Math.hypot(endX - startX, endY - startY);
    if (dist > maxRadius) return [];

    const queue = [[startX, startY]];
    const visited = new Set();
    const parent = new Map();

    const key = (x, y) => `${x},${y}`;
    visited.add(key(startX, startY));

    const isPassable = (x, y) => {
        if (x < minX || x > maxX || y < minY || y > maxY) return false;
        const tile = terrain[y * MAP_WIDTH + x];
        // Solid obstacles
        if (tile === TILES.WALL || tile === TILES.RUBBLE || tile === TILES.SECRET_DOOR) return false;
        // Target can be an entity or door to interact with
        if (x === endX && y === endY) return true;
        // Avoid walking through closed doors or live monsters mid-path
        if (tile === TILES.DOOR_CLOSED) return false;
        if (monsters.some(m => m.alive && m.x === x && m.y === y)) return false;
        return true;
    };

    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];

    let found = false;
    let iterations = 0;

    while (queue.length > 0 && iterations < 1500) {
        iterations++;
        const [cx, cy] = queue.shift();
        if (cx === endX && cy === endY) {
            found = true;
            break;
        }

        for (const d of dirs) {
            const nx = cx + d.dx;
            const ny = cy + d.dy;
            const k = key(nx, ny);

            if (!visited.has(k) && isPassable(nx, ny)) {
                visited.add(k);
                parent.set(k, [cx, cy]);
                queue.push([nx, ny]);
            }
        }
    }

    if (!found) return [];

    const path = [];
    let curr = [endX, endY];
    while (curr[0] !== startX || curr[1] !== startY) {
        path.unshift(curr);
        const p = parent.get(key(curr[0], curr[1]));
        if (!p) break;
        curr = p;
    }
    return path;
}

