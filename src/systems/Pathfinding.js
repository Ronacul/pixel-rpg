// Bounded A* Pathfinding (4-directional) for any configured map size.
// Uses typed arrays and a binary min-heap sized to the search box, so cost depends on the
// distance being walked, never on the total map area.

import { MAP_WIDTH, MAP_HEIGHT, TILES } from '../map/Dungeon.js';

const SEARCH_MARGIN = 20;
const MAX_NODE_EXPANSIONS = 12000;

class MinHeap {
    constructor() {
        this.nodes = [];
        this.scores = [];
    }
    get size() { return this.nodes.length; }
    push(node, score) {
        const n = this.nodes, s = this.scores;
        let i = n.length;
        n.push(node);
        s.push(score);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (s[p] <= s[i]) break;
            [n[p], n[i]] = [n[i], n[p]];
            [s[p], s[i]] = [s[i], s[p]];
            i = p;
        }
    }
    pop() {
        const n = this.nodes, s = this.scores;
        const top = n[0];
        const lastNode = n.pop();
        const lastScore = s.pop();
        if (n.length > 0) {
            n[0] = lastNode;
            s[0] = lastScore;
            let i = 0;
            const len = n.length;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < len && s[l] < s[m]) m = l;
                if (r < len && s[r] < s[m]) m = r;
                if (m === i) break;
                [n[m], n[i]] = [n[i], n[m]];
                [s[m], s[i]] = [s[i], s[m]];
                i = m;
            }
        }
        return top;
    }
}

// avoid (optional): { blocked: Set<tileIndex> impassable unless it is the destination, costs: Map<tileIndex, extraStepCost> }
export function findPath(startX, startY, endX, endY, terrain, monsters, maxRadius = 50, avoid = null) {
    if (startX === endX && startY === endY) return [];
    if (endX < 0 || endX >= MAP_WIDTH || endY < 0 || endY >= MAP_HEIGHT) return [];

    const dist = Math.hypot(endX - startX, endY - startY);
    if (dist > maxRadius) return [];

    // Bounded search box (clamped to the map)
    const minX = Math.max(0, Math.min(startX, endX) - SEARCH_MARGIN);
    const maxX = Math.min(MAP_WIDTH - 1, Math.max(startX, endX) + SEARCH_MARGIN);
    const minY = Math.max(0, Math.min(startY, endY) - SEARCH_MARGIN);
    const maxY = Math.min(MAP_HEIGHT - 1, Math.max(startY, endY) + SEARCH_MARGIN);
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;

    // Live-monster lookup (once per call instead of once per tile)
    const occupied = new Set();
    for (const m of monsters) {
        if (m.alive) occupied.add(m.y * MAP_WIDTH + m.x);
    }

    const local = (x, y) => (y - minY) * boxW + (x - minX);
    const gScore = new Float32Array(boxW * boxH).fill(Infinity);
    const parent = new Int32Array(boxW * boxH).fill(-1);
    const closed = new Uint8Array(boxW * boxH);

    const isPassable = (x, y) => {
        const tile = terrain[y * MAP_WIDTH + x];
        // Solid impassable obstacles
        if (tile === TILES.WALL || tile === TILES.RUBBLE || tile === TILES.SECRET_DOOR || tile === TILES.PILLAR || tile === TILES.PIT || tile === TILES.WATER) return false;
        // Target can be an entity, barrel, or door to interact with
        if (x === endX && y === endY) return true;
        // Avoid walking through closed doors, destructible barrels, or live monsters mid-path
        if (tile === TILES.DOOR_CLOSED || tile === TILES.LOCKED_DOOR || tile === TILES.BARREL || tile === TILES.SHRINE || tile === TILES.FOUNTAIN) return false;
        // Stairs change floors the moment you step on them, so a route never crosses one by accident
        if (tile === TILES.STAIRS_UP || tile === TILES.STAIRS_DOWN) return false;
        if (avoid && avoid.blocked.has(y * MAP_WIDTH + x)) return false;
        if (occupied.has(y * MAP_WIDTH + x)) return false;
        return true;
    };

    const heuristic = (x, y) => Math.abs(x - endX) + Math.abs(y - endY);
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    const open = new MinHeap();
    const startLocal = local(startX, startY);
    gScore[startLocal] = 0;
    open.push(startLocal, heuristic(startX, startY));

    let expansions = 0;
    let found = false;
    const endLocal = local(endX, endY);

    while (open.size > 0 && expansions < MAX_NODE_EXPANSIONS) {
        const cur = open.pop();
        if (closed[cur]) continue;
        closed[cur] = 1;
        expansions++;

        if (cur === endLocal) {
            found = true;
            break;
        }

        const cx = (cur % boxW) + minX;
        const cy = Math.floor(cur / boxW) + minY;

        for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
            const nl = local(nx, ny);
            if (closed[nl] || !isPassable(nx, ny)) continue;
            const tentative = gScore[cur] + 1 + (avoid ? (avoid.costs.get(ny * MAP_WIDTH + nx) || 0) : 0);
            if (tentative < gScore[nl]) {
                gScore[nl] = tentative;
                parent[nl] = cur;
                open.push(nl, tentative + heuristic(nx, ny));
            }
        }
    }

    if (!found) return [];

    const path = [];
    let curr = endLocal;
    while (curr !== startLocal && curr !== -1) {
        path.unshift([(curr % boxW) + minX, Math.floor(curr / boxW) + minY]);
        curr = parent[curr];
    }
    return path;
}
