// Game-side sprite store: loads the art pack (art/*.json), renders sprites to small cached canvases, and draws them
// scaled with nearest-neighbour. Every call returns false when sprites are off / not loaded / unknown, so the renderer
// can fall back to the emoji glyphs.

import { loadArt, expand, toRGBA, mergeRoles, compose } from '../../art/sprite-lib.js';
import { TILES } from '../map/Dungeon.js';
import { weaponLookFor } from '../data/HeroLook.js';

const BIOME_KEYS = {
    castle_dungeon: 'castle',
    sunken_caverns: 'caverns',
    overgrown_ruins: 'forest',
    dwarven_forges: 'forge',
    abyssal_sanctum: 'abyss'
};

// Weapon sprite id for an equipped main-hand item (the rules live in data/HeroLook.js)
export const weaponSpriteFor = weaponLookFor;

class SpriteStoreClass {
    constructor() {
        this.art = null;
        this.ready = false;
        this.enabled = true;
        this.cache = new Map();
        this.loading = null;
    }

    load(base = './art') {
        if (this.loading) return this.loading;
        this.loading = loadArt(base).then(art => {
            this.art = art;
            this.ready = true;
            return art;
        }).catch(err => {
            console.warn('Sprite art failed to load, using emoji fallback:', err);
            this.ready = false;
        });
        return this.loading;
    }

    get active() {
        return this.enabled && this.ready;
    }

    biomeKey(biome) {
        return biome?.look || BIOME_KEYS[biome?.id] || 'castle';
    }

    // Cached canvas for a sprite id + role selection
    canvasFor(id, selection = {}) {
        if (!this.ready) return null;
        const key = `${id}|${JSON.stringify(selection)}`;
        let c = this.cache.get(key);
        if (c !== undefined) return c;
        const def = this.art.sprites[id];
        c = def ? this.render(def, selection) : null;
        this.cache.set(key, c);
        return c;
    }

    render(def, selection) {
        const { w, h, rows } = expand(def);
        const rgba = toRGBA(rows, w, h, this.art.palette, mergeRoles(this.art, selection));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
        return c;
    }

    // look = heroLookFor(equipment): { cloak, armor, helm, gloves, boots, weapon, offhand } sprite names (or null)
    heroCanvas(race, cls, look = {}) {
        if (!this.ready) return null;
        const key = `hero|${race}|${cls}|${JSON.stringify(look)}`;
        let c = this.cache.get(key);
        if (c !== undefined) return c;
        const s = this.art.sprites;
        const part = (group, name) => (name ? s[`hero.${group}.${name}`] : null);
        const layers = [
            look.cloak ? s['hero.cloak'] : null,
            s['hero.body'], s[`hero.race.${race}`], s[`hero.class.${cls}`],
            part('boots', look.boots), part('armor', look.armor), part('gloves', look.gloves), part('helm', look.helm),
            look.weapon && look.weapon !== 'none' ? s[`hero.weapon.${look.weapon}`] : null,
            part('shield', look.offhand)
        ];
        const valid = layers.filter(Boolean);
        c = valid.length >= 2 ? this.render(compose(valid), { race, class: cls, cloak: look.cloak || 'grey' }) : null;
        this.cache.set(key, c);
        return c;
    }

    // Draws a cached canvas into a tile cell (or scaled around it)
    blit(ctx, canvas, x, y, size, scale = 1, alpha = 1) {
        if (!canvas) return false;
        const s = size * scale;
        const off = (size - s) / 2;
        ctx.imageSmoothingEnabled = false;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * alpha;
        ctx.drawImage(canvas, x + off, y + off - (scale > 1 ? size * 0.08 : 0), s, s);
        ctx.globalAlpha = prev;
        return true;
    }

    // Floor variants are picked by position so the pattern is stable
    floorId(x, y) {
        if ((x * 7 + y * 3) % 5 === 0) return 'tile.floor_c';
        return (x + y) % 2 ? 'tile.floor_a' : 'tile.floor_b';
    }

    // Draws the terrain sprite(s) for a tile. Returns false when this tile has no sprite (caller uses emoji fallback).
    drawTile(ctx, tile, worldX, worldY, screenX, screenY, size, biome, isDim, trapRevealed) {
        if (!this.active) return false;
        const sel = { biome: this.biomeKey(biome) };
        const dim = isDim ? 0.55 : 0;
        const draw = (id) => this.blit(ctx, this.canvasFor(id, sel), screenX, screenY, size, 1, 1);
        const floor = () => draw(this.floorId(worldX, worldY));

        switch (tile) {
            case TILES.WALL:
            case TILES.SECRET_DOOR:
                if (!draw('tile.wall')) return false;
                break;
            case TILES.FLOOR:
                if (!floor()) return false;
                break;
            case TILES.TRAP_SPIKE:
            case TILES.TRAP_FIRE:
            case TILES.TRAP_GAS:
                if (!floor()) return false;
                if (trapRevealed) draw('tile.trap_plate');
                break;
            case TILES.ALTAR_INERT:
                if (!floor()) return false;
                ctx.save(); ctx.globalAlpha = 0.45; draw('tile.altar'); ctx.restore();
                break;
            default: {
                const id = {
                    [TILES.DOOR_CLOSED]: 'tile.door_closed',
                    [TILES.DOOR_OPEN]: 'tile.door_open',
                    [TILES.LOCKED_DOOR]: 'tile.door_locked',
                    [TILES.STAIRS_DOWN]: 'tile.stairs_down',
                    [TILES.STAIRS_UP]: 'tile.stairs_up',
                    [TILES.RUBBLE]: 'tile.rubble',
                    [TILES.PILLAR]: 'tile.pillar',
                    [TILES.PIT]: 'tile.pit',
                    [TILES.BARREL]: 'tile.barrel',
                    [TILES.ALTAR]: 'tile.altar',
                    [TILES.SHRINE]: 'tile.shrine',
                    [TILES.FOLIAGE]: 'tile.foliage'
                }[tile];
                if (!id || !this.art.sprites[id]) return false;
                if (!floor()) return false;
                draw(id);
            }
        }
        if (dim > 0) {
            ctx.fillStyle = `rgba(6, 7, 14, ${dim})`;
            ctx.fillRect(screenX, screenY, size, size);
        }
        return true;
    }

    // A standalone entity sprite (chest, key, mushroom, monster...). Returns false for emoji fallback.
    drawEntity(ctx, id, selection, x, y, size, scale = 1, alpha = 1) {
        if (!this.active) return false;
        return this.blit(ctx, this.canvasFor(id, selection), x, y, size, scale, alpha);
    }
}

export const SpriteStore = new SpriteStoreClass();
