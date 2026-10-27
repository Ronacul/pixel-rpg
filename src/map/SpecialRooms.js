// Special rooms: every floor has at least one room that is more than a box of monsters. A special room has a TYPE (what
// it is) and a RATING from 1 to 5 stars (how rich or dangerous it is), both rolled from the floor seed, so two floors
// with the same type can be very different. Deeper floors skew to higher ratings; luck improves what you find inside
// (see the chest code in main.js).
//
// Types
//   temple   ⛩️  an open room with a choice shrine at its heart. Peaceful. 4+ stars offers an extra boon; 5 adds an altar.
//   vault    🔒  a small sealed room behind a LOCKED door (the key is somewhere on the floor): several chests of fine loot.
//   cache    💎  a small room behind a SECRET door (search for it): chests and gems.
//   lair     🐺  a nest of elite monsters guarding a hoard.
//   crypt    ☠️  unidentified, often cursed treasure guarded by the restless dead. High risk, high reward.
//   sanctum  ⛲  fountains (and at 5 stars an altar) in a quiet room.
//   boss     👑  the boss arena on boss floors.

import { MAP_WIDTH, MAP_HEIGHT, TILES } from './Dungeon.js';
import { generateLootItem, createItemFromBase, BASE_ITEMS } from '../data/Items.js';
import { randomGem } from '../data/Gems.js';
import { SHRINE_OFFERS } from '../data/Shrines.js';
import { forceAffixes, rollMonsterLevel } from '../data/Difficulty.js';

export const SPECIAL_TYPES = {
    temple:  { id: 'temple',  icon: '⛩️', name: 'Temple',         tint: '255, 215, 0',   weight: 4, needsRoom: true },
    vault:   { id: 'vault',   icon: '🔒', name: 'Treasure Vault', tint: '255, 160, 40',  weight: 4, stub: 'locked' },
    cache:   { id: 'cache',   icon: '💎', name: 'Hidden Cache',   tint: '90, 220, 255',  weight: 3, stub: 'secret' },
    lair:    { id: 'lair',    icon: '🐺', name: 'Monster Lair',   tint: '255, 70, 70',   weight: 4, needsRoom: true },
    crypt:   { id: 'crypt',   icon: '☠️', name: 'Cursed Crypt',   tint: '170, 80, 230',  weight: 3, needsRoom: true },
    sanctum: { id: 'sanctum', icon: '⛲', name: 'Spring Sanctum', tint: '80, 150, 255',  weight: 3, needsRoom: true },
    boss:    { id: 'boss',    icon: '👑', name: 'Boss Arena',     tint: '255, 60, 120',  weight: 0 }
};
export const SPECIAL_ORDER = Object.keys(SPECIAL_TYPES); // index + 1 is the value stored in specialMap

export function stars(r) {
    return '★'.repeat(r) + '☆'.repeat(5 - r);
}

// 1..5 stars; deeper floors push the odds up
export function rollRating(prng, depth) {
    const w = [38, 30, 19, 9, 4];
    const shift = Math.min(0.6, depth * 0.02);
    for (let i = 3; i < 5; i++) w[i] *= 1 + shift * 4;
    w[0] *= 1 - shift;
    const total = w.reduce((a, b) => a + b, 0);
    let r = prng.next() * total;
    for (let i = 0; i < 5; i++) { r -= w[i]; if (r <= 0) return i + 1; }
    return 1;
}

const inBounds = (x, y, m = 3) => x >= m && y >= m && x < MAP_WIDTH - m && y < MAP_HEIGHT - m;
const idx = (x, y) => y * MAP_WIDTH + x;

// A small closed room attached to `room` by a short corridor ending in a door. Returns the new room or null.
function carveStub(ctx, type) {
    const { prng, terrain, rooms } = ctx;
    const size = 5;
    const sources = rooms.filter((r, i) => i !== 0 && !r.special && !r.isSecret && !r.isArena);
    const order = sources.map(r => ({ r, k: prng.next() })).sort((a, b) => a.k - b.k).map(o => o.r);
    const sides = ['E', 'W', 'N', 'S'];
    const gap = 3;
    for (const room of order) {
        const tryOrder = sides.map(s => ({ s, k: prng.next() })).sort((a, b) => a.k - b.k).map(o => o.s);
        for (const side of tryOrder) {
            let corridor = [], box;
            if (side === 'E') {
                box = { x: room.x + room.w + gap, y: room.cy - 2 };
                for (let k = 0; k < gap; k++) corridor.push({ x: room.x + room.w + k, y: room.cy });
            } else if (side === 'W') {
                box = { x: room.x - gap - size, y: room.cy - 2 };
                for (let k = 0; k < gap; k++) corridor.push({ x: room.x - 1 - k, y: room.cy });
            } else if (side === 'S') {
                box = { x: room.cx - 2, y: room.y + room.h + gap };
                for (let k = 0; k < gap; k++) corridor.push({ x: room.cx, y: room.y + room.h + k });
            } else {
                box = { x: room.cx - 2, y: room.y - gap - size };
                for (let k = 0; k < gap; k++) corridor.push({ x: room.cx, y: room.y - 1 - k });
            }
            // everything the stub will use (plus a 1-tile margin around the box) must be solid rock
            let ok = inBounds(box.x - 1, box.y - 1) && inBounds(box.x + size, box.y + size);
            for (let y = box.y - 1; ok && y <= box.y + size; y++) {
                for (let x = box.x - 1; x <= box.x + size; x++) if (terrain[idx(x, y)] !== TILES.WALL) { ok = false; break; }
            }
            for (const c of corridor) if (!ok || !inBounds(c.x, c.y, 2) || terrain[idx(c.x, c.y)] !== TILES.WALL) ok = false;
            if (!ok) continue;

            for (let y = box.y; y < box.y + size; y++) for (let x = box.x; x < box.x + size; x++) terrain[idx(x, y)] = TILES.FLOOR;
            for (const c of corridor) terrain[idx(c.x, c.y)] = TILES.FLOOR;
            const door = corridor[corridor.length - 1]; // the tile touching the stub
            terrain[idx(door.x, door.y)] = type === 'vault' ? TILES.LOCKED_DOOR : TILES.SECRET_DOOR;
            const stub = { x: box.x, y: box.y, w: size, h: size, cx: box.x + 2, cy: box.y + 2, isSecret: type === 'cache', isStub: true, door };
            rooms.push(stub);
            return stub;
        }
    }
    return null;
}

// Chooses the special rooms for a floor and carves any stubs. At least one is always produced.
// ctx: { prng, terrain, rooms, floorLevel, exitRoom, bossDef, bossArena }
export function planSpecials(ctx) {
    const { prng, rooms, floorLevel, exitRoom, bossDef } = ctx;
    const specials = [];
    const eligible = () => rooms.filter((r, i) => i !== 0 && r !== exitRoom && !r.special && !r.isSecret && !r.isStub && r.w * r.h >= 30);

    let wanted = 1 + (rooms.length >= 9 && prng.chance(0.5) ? 1 : 0) + (floorLevel >= 8 && rooms.length >= 12 && prng.chance(0.3) ? 1 : 0);
    if (bossDef) wanted = Math.max(0, wanted - 1); // the boss arena already counts as one
    const used = new Set();

    const attempt = (typeId) => {
        const t = SPECIAL_TYPES[typeId];
        let room = null;
        if (t.stub) room = carveStub(ctx, typeId);
        else {
            let pool = eligible();
            // hostile set pieces never sit near the arrival stairs
            if (typeId === 'lair' || typeId === 'crypt') pool = pool.filter(r => Math.hypot(r.cx - rooms[0].cx, r.cy - rooms[0].cy) >= 12);
            if (!pool.length) return false;
            // prefer the larger rooms for the big set pieces
            const sorted = pool.map(r => ({ r, k: r.w * r.h + prng.next() * 20 })).sort((a, b) => b.k - a.k);
            room = sorted[Math.min(sorted.length - 1, prng.nextInt(0, Math.min(2, sorted.length - 1)))].r;
        }
        if (!room) return false;
        room.special = { type: typeId, rating: rollRating(prng, floorLevel) };
        specials.push({ ...room.special, room });
        used.add(typeId);
        return true;
    };

    const weighted = () => {
        const pool = Object.values(SPECIAL_TYPES).filter(t => t.weight > 0 && !used.has(t.id));
        const total = pool.reduce((s, t) => s + t.weight, 0);
        let r = prng.next() * total;
        for (const t of pool) { r -= t.weight; if (r <= 0) return t.id; }
        return pool[0]?.id;
    };

    for (let n = 0; n < wanted; n++) {
        let done = false;
        for (let tries = 0; tries < 6 && !done; tries++) { const id = weighted(); if (id) done = attempt(id); }
    }
    // Guarantee: if nothing worked (tiny map, no eligible rooms), try every type once, then any room at all
    if (!specials.length && !bossDef) {
        for (const id of ['temple', 'lair', 'sanctum', 'crypt', 'vault', 'cache']) if (attempt(id)) break;
    }
    if (!specials.length && !bossDef) {
        const any = rooms.find((r, i) => i !== 0 && r !== exitRoom && !r.special);
        if (any) { any.special = { type: 'sanctum', rating: 1 }; specials.push({ ...any.special, room: any }); }
    }
    return specials;
}

// Marks every tile of every special room so the renderer can tint it
export function buildSpecialMap(rooms, bossArena) {
    const map = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    for (const r of rooms) {
        if (!r.special) continue;
        const code = SPECIAL_ORDER.indexOf(r.special.type) + 1;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inBounds(x, y, 0)) map[idx(x, y)] = code;
    }
    if (bossArena) {
        const code = SPECIAL_ORDER.indexOf('boss') + 1;
        for (let y = bossArena.cy - bossArena.half; y <= bossArena.cy + bossArena.half; y++) for (let x = bossArena.cx - bossArena.half; x <= bossArena.cx + bossArena.half; x++) if (inBounds(x, y, 0)) map[idx(x, y)] = code;
    }
    return map;
}

// ---------------------------------------------------------------- furnishing
// ctx adds: { monsters, chests, shrineOffers, biome, makeMonster, mod }
export function furnishSpecials(ctx, specials) {
    const { prng, terrain, monsters, chests, floorLevel } = ctx;

    const interior = (room) => {
        const out = [];
        for (let y = room.y + 1; y < room.y + room.h - 1; y++) for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
            if (terrain[idx(x, y)] === TILES.FLOOR && !chests.some(c => c.x === x && c.y === y) && !monsters.some(m => m.x === x && m.y === y)) out.push({ x, y });
        }
        return out;
    };
    const takeTile = (room, near = null) => {
        const tiles = interior(room);
        if (!tiles.length) return null;
        if (near) tiles.sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y));
        else return tiles[prng.nextInt(0, tiles.length - 1)];
        return tiles[0];
    };
    const addChest = (room, item, rating, extra = {}) => {
        const t = takeTile(room);
        if (!t) return false;
        chests.push({ x: t.x, y: t.y, opened: false, isSecret: !!room.isSecret, item, special: room.special.type, rating, ...extra });
        return true;
    };
    const lootAt = (bonus) => generateLootItem(prng, floorLevel + bonus);
    // The first two floors are gentle: no extra levels, few or no affixes, smaller packs
    const spawn = (room, def, n, levelBonus, affixCount) => {
        if (floorLevel <= 2) { levelBonus = 0; affixCount = affixCount >= 2 ? 1 : 0; n = Math.min(n, floorLevel + 1); }
        for (let i = 0; i < n; i++) {
            const t = takeTile(room);
            if (!t) break;
            const lvl = rollMonsterLevel(prng, floorLevel) + levelBonus;
            const m = ctx.makeMonster(def, `sp_${floorLevel}_${room.x}_${room.y}_${i}`, t.x, t.y, floorLevel, { level: lvl, affixes: forceAffixes(prng, affixCount) });
            monsters.push(m);
        }
    };

    for (const sp of specials) {
        const room = sp.room, r = sp.rating;
        switch (sp.type) {
            case 'temple': {
                const c = takeTile(room, { x: room.cx, y: room.cy });
                if (!c) break;
                terrain[idx(c.x, c.y)] = TILES.SHRINE;
                const pool = SHRINE_OFFERS.map(o => o.id);
                const picks = [];
                const count = r >= 4 ? 4 : 3;
                while (picks.length < count && pool.length) picks.push(...pool.splice(prng.nextInt(0, pool.length - 1), 1));
                ctx.shrineOffers[idx(c.x, c.y)] = picks;
                if (r >= 5) { const a = takeTile(room, { x: c.x, y: c.y + 2 }); if (a) terrain[idx(a.x, a.y)] = TILES.ALTAR; }
                break;
            }
            case 'vault': {
                const n = Math.min(4, 1 + r);
                for (let i = 0; i < n; i++) addChest(room, i % 2 === 1 && r >= 3 ? randomGem(prng, floorLevel + 4) : lootAt(2 + r), r, { isVault: true });
                break;
            }
            case 'cache': {
                const n = Math.min(3, 1 + Math.ceil(r / 2));
                for (let i = 0; i < n; i++) addChest(room, i === 0 && r >= 2 ? randomGem(prng, floorLevel + 3 + r) : lootAt(1 + r), r);
                break;
            }
            case 'lair': {
                const def = prng.choice(ctx.biome.monsters);
                spawn(room, def, Math.min(6, 2 + r), 1, r >= 3 ? 2 : 1);
                const n = r >= 4 ? 2 : 1;
                for (let i = 0; i < n; i++) addChest(room, lootAt(2 + r), r);
                break;
            }
            case 'crypt': {
                const def = prng.choice(ctx.biome.monsters);
                spawn(room, def, 1 + Math.floor(r / 2), 2, 1);
                const n = 1 + Math.floor((r + 1) / 2);
                for (let i = 0; i < n; i++) {
                    // the lure: unidentified treasure, often cursed
                    let item = null;
                    for (let tries = 0; tries < 30 && !(item && item.unid); tries++) item = generateLootItem(prng, floorLevel + 3 + r);
                    addChest(room, item, r);
                }
                if (r >= 3) addChest(room, createItemFromBase(BASE_ITEMS.find(b => b.name === 'Holy Water Vial')), r);
                break;
            }
            case 'sanctum': {
                const n = Math.min(3, 1 + Math.floor(r / 2));
                for (let i = 0; i < n; i++) { const t = takeTile(room); if (t) terrain[idx(t.x, t.y)] = TILES.FOUNTAIN; }
                if (r >= 4) { const a = takeTile(room, { x: room.cx, y: room.cy }); if (a) terrain[idx(a.x, a.y)] = TILES.ALTAR; }
                break;
            }
            default: break;
        }
    }
}
