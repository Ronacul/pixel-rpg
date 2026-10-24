// Terrain passes used by module layouts: ragged cave walls, lakes, rivers with fords, and a connectivity repair.
// All passes are deterministic (they use the floor's seeded PRNG) and only touch ordinary terrain.

import { MAP_WIDTH, MAP_HEIGHT, TILES } from './Dungeon.js';

const idx = (x, y) => y * MAP_WIDTH + x;
const inside = (x, y, m = 2) => x >= m && y >= m && x < MAP_WIDTH - m && y < MAP_HEIGHT - m;

// Wall tiles touching floor become floor with probability `amount` (0-1); the result looks like worn cave rock.
// Skips the surroundings of secret rooms so they stay hidden.
export function roughenWalls(terrain, prng, rooms, amount) {
    if (amount <= 0) return;
    const keepOut = rooms.filter(r => r.isSecret);
    const nearSecret = (x, y) => keepOut.some(r => x >= r.x - 2 && x <= r.x + r.w + 1 && y >= r.y - 2 && y <= r.y + r.h + 1);
    const grow = [];
    for (let y = 2; y < MAP_HEIGHT - 2; y++) {
        for (let x = 2; x < MAP_WIDTH - 2; x++) {
            if (terrain[idx(x, y)] !== TILES.WALL || nearSecret(x, y)) continue;
            let floors = 0;
            if (terrain[idx(x - 1, y)] === TILES.FLOOR) floors++;
            if (terrain[idx(x + 1, y)] === TILES.FLOOR) floors++;
            if (terrain[idx(x, y - 1)] === TILES.FLOOR) floors++;
            if (terrain[idx(x, y + 1)] === TILES.FLOOR) floors++;
            if (floors > 0 && prng.chance(amount * (0.5 + floors * 0.25))) grow.push(idx(x, y));
        }
    }
    for (const i of grow) terrain[i] = TILES.FLOOR;
}

const CONVERTIBLE = new Set([TILES.WALL, TILES.FLOOR, TILES.FOLIAGE, TILES.RUBBLE]);

// Big blob lake: deep core, shallow rim. Eats rock as well as floor so lakes read as bodies of water, not puddles.
function lake(terrain, prng, cx, cy, radius, protect) {
    const r2 = radius * radius;
    for (let y = cy - radius - 1; y <= cy + radius + 1; y++) {
        for (let x = cx - radius - 1; x <= cx + radius + 1; x++) {
            if (!inside(x, y, 2)) continue;
            const dx = x - cx, dy = (y - cy) * 1.25; // slightly wider than tall
            // wobbly edge
            const wob = (Math.sin(x * 1.7 + cy) + Math.cos(y * 1.3 + cx)) * 0.9;
            const d2 = dx * dx + dy * dy + wob * radius * 0.5;
            if (d2 > r2 || protect(x, y)) continue;
            const i = idx(x, y);
            if (!CONVERTIBLE.has(terrain[i])) continue;
            const rim = d2 > r2 * 0.62;
            terrain[i] = rim ? TILES.SHALLOWS : TILES.WATER;
        }
    }
}

// Meandering river from one side to the other, 2-3 wide, with fords (shallows) every so often
function river(terrain, prng, horizontal, protect) {
    const len = horizontal ? MAP_WIDTH : MAP_HEIGHT;
    const span = horizontal ? MAP_HEIGHT : MAP_WIDTH;
    let across = prng.nextInt(Math.floor(span * 0.25), Math.floor(span * 0.75));
    const width = prng.chance(0.5) ? 3 : 2;
    let nextFord = prng.nextInt(6, 12);
    let ford = 0;
    for (let a = 2; a < len - 2; a++) {
        if (prng.chance(0.4)) across += prng.chance(0.5) ? 1 : -1;
        across = Math.max(4, Math.min(span - 5, across));
        if (--nextFord <= 0) { ford = prng.nextInt(2, 3); nextFord = prng.nextInt(8, 14); }
        for (let w = 0; w < width; w++) {
            const x = horizontal ? a : across + w;
            const y = horizontal ? across + w : a;
            if (!inside(x, y, 2) || protect(x, y)) continue;
            const i = idx(x, y);
            if (!CONVERTIBLE.has(terrain[i])) continue;
            terrain[i] = ford > 0 ? TILES.SHALLOWS : TILES.WATER;
        }
        if (ford > 0) ford--;
    }
}

const PASSABLE = (t) => t !== TILES.WALL && t !== TILES.PILLAR && t !== TILES.PIT && t !== TILES.RUBBLE && t !== TILES.WATER;

// Everything in `targets` must be reachable from `start` on foot. Where water cuts a path, a ford of shallows is laid
// along the shortest crossing.
export function ensureCrossings(terrain, start, targets) {
    const total = MAP_WIDTH * MAP_HEIGHT;
    const reach = new Uint8Array(total);
    const flood = () => {
        reach.fill(0);
        const q = [idx(start.x, start.y)];
        reach[q[0]] = 1;
        for (let h = 0; h < q.length; h++) {
            const i = q[h], x = i % MAP_WIDTH, y = (i - x) / MAP_WIDTH;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
                const ni = idx(nx, ny);
                if (!reach[ni] && PASSABLE(terrain[ni])) { reach[ni] = 1; q.push(ni); }
            }
        }
    };
    flood();
    for (const t of targets) {
        if (reach[idx(t.x, t.y)]) continue;
        // BFS from the reached region through floor + water to the target; then shallow-ise the water on the path
        const parent = new Int32Array(total).fill(-2);
        const q = [];
        for (let i = 0; i < total; i++) if (reach[i]) { parent[i] = -1; q.push(i); }
        let found = -1;
        for (let h = 0; h < q.length && found < 0; h++) {
            const i = q[h], x = i % MAP_WIDTH, y = (i - x) / MAP_WIDTH;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
                const ni = idx(nx, ny);
                if (parent[ni] !== -2) continue;
                if (!PASSABLE(terrain[ni]) && terrain[ni] !== TILES.WATER) continue;
                parent[ni] = i;
                if (nx === t.x && ny === t.y) { found = ni; break; }
                q.push(ni);
            }
        }
        for (let i = found; i >= 0 && parent[i] >= 0; i = parent[i]) {
            if (terrain[i] === TILES.WATER) terrain[i] = TILES.SHALLOWS;
        }
        flood();
    }
}

// opts: { lakes, rivers }; protectPoints: [{x,y,r}] areas that stay dry (stairs, boss arena); rooms/targets keep connectivity
export function addWater(terrain, prng, opts, protectPoints, spawn, targets) {
    const protect = (x, y) => protectPoints.some(p => Math.abs(x - p.x) <= p.r && Math.abs(y - p.y) <= p.r);
    const scale = Math.max(0.6, Math.min(1.8, MAP_WIDTH / 100 + 0.5)); // bigger maps get bigger lakes
    for (let i = 0; i < (opts.lakes || 0); i++) {
        const cx = prng.nextInt(8, MAP_WIDTH - 9), cy = prng.nextInt(8, MAP_HEIGHT - 9);
        const radius = Math.round(prng.nextInt(4, 8) * scale);
        lake(terrain, prng, cx, cy, radius, protect);
    }
    for (let i = 0; i < (opts.rivers || 0); i++) river(terrain, prng, prng.chance(0.5), protect);
    ensureCrossings(terrain, spawn, targets);
}
