// Visual effects for ranged attacks, spells, thrown objects and impacts. Purely cosmetic: the attack has already been
// resolved by the combat code; this just shows what flew where. Drawn on the map canvas in tile coordinates.
//
//   Projectiles.fire('arrow', from, to)       from/to: tile coords {x,y}
//   Projectiles.impact(x, y, '#ff8a2a')       a small burst of sparks on a tile
//   Projectiles.kindFor(weaponOrAbility)      picks the look from the weapon / ability / flask
//
// Kinds: arrow, bolt, stone, dagger, spear, arcane, fire, frost, venom, holy, sound, boulder, fireflask, gasflask, holyflask,
// breath (a stream of flame or gas along a line).

import { damageTypeOf, DAMAGE_TYPES } from '../data/DamageTypes.js';

const LOBBED = new Set(['stone', 'dagger', 'fireflask', 'gasflask', 'holyflask', 'boulder']);
const SPEED = { arrow: 26, bolt: 30, stone: 15, dagger: 18, spear: 20, arcane: 18, fire: 15, frost: 17, venom: 15, holy: 20, sound: 12, boulder: 10, fireflask: 12, gasflask: 12, holyflask: 12, breath: 22 };
const FLASK_COLOR = { fireflask: '#ff8a2a', gasflask: '#7be04a', holyflask: '#ffe27a' };

const now = () => performance.now();

class ProjectileSystem {
    constructor() {
        this.list = [];      // flying things
        this.bursts = [];    // impact sparks / clouds
        this.redraw = null;  // set by the renderer: () => void
        this.enabled = true;
        this.timeScale = 1; // tests slow the animation down to look at it
        this.raf = 0;
        try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.reduced = true; } catch (e) { /* ignore */ }
    }

    get active() { return this.list.length > 0 || this.bursts.length > 0; }

    // The look for a weapon, ability or flask
    kindFor(src) {
        if (!src) return 'dagger';
        const n = (src.baseName || src.name || '').toLowerCase();
        if (src.zoneType === 'FIRE') return 'fireflask';
        if (src.zoneType === 'POISON_GAS') return 'gasflask';
        if (src.zoneType === 'CONSECRATION') return 'holyflask';
        if (/crossbow|arbalest/.test(n)) return 'bolt';
        if (/bow/.test(n)) return 'arrow';
        if (/sling/.test(n)) return 'stone';
        if (/spear|pike|javelin/.test(n)) return 'spear';
        if (/dagger|knife|stiletto|axe/.test(n)) return 'dagger';
        const t = damageTypeOf(src);
        return { ARCANE: 'arcane', FIRE: 'fire', COLD: 'frost', POISON: 'venom', HOLY: 'holy', SONIC: 'sound' }[t] || 'arrow';
    }

    colorFor(type) {
        return DAMAGE_TYPES[type]?.color || '#ffffff';
    }

    // Starts a projectile. opts: { delay, onDone, color }
    fire(kind, from, to, opts = {}) {
        if (!this.enabled || this.reduced || !from || !to) { opts.onDone && opts.onDone(); return; }
        const dist = Math.max(0.5, Math.hypot(to.x - from.x, to.y - from.y));
        const dur = Math.min(520, Math.max(110, (dist / (SPEED[kind] || 18)) * 1000)) * this.timeScale;
        this.list.push({ kind, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, t0: now() + (opts.delay || 0), dur, onDone: opts.onDone, color: opts.color, trail: [], spin: Math.random() * 6 });
        this.kick();
    }

    // Several flames/clouds along a line (boss breath, cone of fire)
    stream(kind, from, tiles, opts = {}) {
        tiles.forEach((p, i) => this.fire(kind === 'breath' ? (opts.gas ? 'venom' : 'fire') : kind, from, p, { delay: i * 35, color: opts.color }));
    }

    impact(x, y, color = '#ffffff', opts = {}) {
        if (!this.enabled || this.reduced) return;
        const n = opts.big ? 14 : 8;
        const parts = [];
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * (opts.big ? 1.8 : 1.1);
            parts.push({ dx: Math.cos(a) * s, dy: Math.sin(a) * s - 0.2, size: 0.05 + Math.random() * 0.06 });
        }
        this.bursts.push({ x, y, color, t0: now() + (opts.delay || 0), dur: opts.cloud ? 520 : 260, parts, cloud: !!opts.cloud });
        this.kick();
    }

    kick() {
        if (this.raf) return;
        const tick = () => {
            this.raf = 0;
            this.prune();
            if (this.redraw) this.redraw();
            if (this.active) this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
    }

    prune() {
        const t = now();
        this.list = this.list.filter(p => {
            if (t >= p.t0 + p.dur) {
                if (!p.done) { p.done = true; this.impact(p.to.x, p.to.y, p.color || this.defaultColor(p.kind), { cloud: p.kind === 'gasflask', big: p.kind === 'fireflask' || p.kind === 'boulder', delay: 0 }); p.onDone && p.onDone(); }
                return false;
            }
            return true;
        });
        this.bursts = this.bursts.filter(b => t < b.t0 + b.dur);
    }

    defaultColor(kind) {
        return { arrow: '#e8eef8', bolt: '#e8eef8', stone: '#b9bcc4', dagger: '#e8eef8', spear: '#e8eef8', arcane: '#b57bff', fire: '#ff8a2a', frost: '#8fd8ff', venom: '#7be04a', holy: '#ffe27a', sound: '#ffb0e0', boulder: '#9a9ca6', fireflask: '#ff8a2a', gasflask: '#7be04a', holyflask: '#ffe27a' }[kind] || '#ffffff';
    }

    // Draws everything. camX/camY: world tile at the top-left of the viewport; s: tile size in pixels.
    draw(ctx, camX, camY, s) {
        if (!this.active) return;
        const t = now();
        for (const p of this.list) {
            const u = (t - p.t0) / p.dur;
            if (u < 0) continue;
            const e = Math.min(1, u);
            const wx = p.from.x + (p.to.x - p.from.x) * e;
            const wy = p.from.y + (p.to.y - p.from.y) * e;
            const arc = LOBBED.has(p.kind) ? Math.sin(Math.PI * e) * Math.min(1.6, 0.35 + 0.18 * Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y)) : 0;
            const px = (wx - camX + 0.5) * s;
            const py = (wy - camY + 0.5 - arc) * s;
            const ang = Math.atan2((p.to.y - p.from.y) - (LOBBED.has(p.kind) ? Math.cos(Math.PI * e) * 0.9 : 0), p.to.x - p.from.x);
            p.trail.push({ x: px, y: py });
            if (p.trail.length > 6) p.trail.shift();
            this.drawOne(ctx, p, px, py, ang, s, t);
        }
        for (const b of this.bursts) {
            const u = (t - b.t0) / b.dur;
            if (u < 0 || u > 1) continue;
            const cx = (b.x - camX + 0.5) * s, cy = (b.y - camY + 0.5) * s;
            ctx.save();
            if (b.cloud) {
                const r = s * (0.5 + 0.9 * u);
                ctx.globalAlpha = 0.45 * (1 - u);
                ctx.fillStyle = b.color;
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx - r * 0.4, cy + r * 0.2, r * 0.6, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.globalAlpha = 1 - u;
                ctx.fillStyle = b.color;
                for (const q of b.parts) {
                    const d = u * s * 0.9;
                    const sz = Math.max(2, q.size * s * (1 - u * 0.5));
                    ctx.fillRect(cx + q.dx * d - sz / 2, cy + q.dy * d - sz / 2, sz, sz);
                }
                ctx.globalAlpha = (1 - u) * 0.6;
                ctx.beginPath(); ctx.arc(cx, cy, s * 0.55 * u + 2, 0, Math.PI * 2); ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.stroke();
            }
            ctx.restore();
        }
    }

    drawOne(ctx, p, px, py, ang, s, t) {
        const col = p.color || this.defaultColor(p.kind);
        ctx.save();
        ctx.lineCap = 'round';
        // fading trail for magical and fiery shots
        if (['arcane', 'fire', 'frost', 'venom', 'holy', 'sound', 'fireflask'].includes(p.kind)) {
            p.trail.forEach((q, i) => {
                ctx.globalAlpha = (i / p.trail.length) * 0.5;
                ctx.fillStyle = col;
                ctx.beginPath(); ctx.arc(q.x, q.y, s * 0.11 * (i / p.trail.length + 0.3), 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
        }
        ctx.translate(px, py);
        switch (p.kind) {
            case 'arrow':
            case 'bolt': {
                ctx.rotate(ang);
                const len = s * (p.kind === 'arrow' ? 0.62 : 0.42);
                ctx.strokeStyle = '#a9824f'; ctx.lineWidth = Math.max(2, s * (p.kind === 'arrow' ? 0.07 : 0.1));
                ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
                ctx.fillStyle = '#eef3fb'; ctx.beginPath(); ctx.moveTo(len / 2 + s * 0.12, 0); ctx.lineTo(len / 2 - s * 0.04, -s * 0.07); ctx.lineTo(len / 2 - s * 0.04, s * 0.07); ctx.fill();
                if (p.kind === 'arrow') { ctx.strokeStyle = '#d04648'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(-len / 2 - s * 0.08, -s * 0.06); ctx.moveTo(-len / 2, 0); ctx.lineTo(-len / 2 - s * 0.08, s * 0.06); ctx.stroke(); }
                break;
            }
            case 'spear': {
                ctx.rotate(ang);
                ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = Math.max(2, s * 0.08);
                ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.lineTo(s * 0.3, 0); ctx.stroke();
                ctx.fillStyle = '#eef3fb'; ctx.beginPath(); ctx.moveTo(s * 0.45, 0); ctx.lineTo(s * 0.28, -s * 0.07); ctx.lineTo(s * 0.28, s * 0.07); ctx.fill();
                break;
            }
            case 'stone':
            case 'boulder': {
                const r = s * (p.kind === 'boulder' ? 0.3 : 0.1);
                ctx.fillStyle = p.kind === 'boulder' ? '#8c8f9a' : '#b9bcc4';
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#3a3c46'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.rotate((t / 90) + p.spin);
                ctx.fillStyle = '#6b6e79'; ctx.fillRect(-r * 0.2, -r * 0.6, r * 0.4, r * 0.5);
                break;
            }
            case 'dagger': {
                ctx.rotate((t / 55) + p.spin);
                ctx.fillStyle = '#eef3fb'; ctx.fillRect(-s * 0.05, -s * 0.2, s * 0.1, s * 0.26);
                ctx.fillStyle = '#854c30'; ctx.fillRect(-s * 0.05, s * 0.06, s * 0.1, s * 0.12);
                ctx.fillStyle = '#d2b04a'; ctx.fillRect(-s * 0.12, s * 0.04, s * 0.24, s * 0.05);
                break;
            }
            case 'fireflask': case 'gasflask': case 'holyflask': {
                ctx.rotate((t / 120) + p.spin);
                const c = FLASK_COLOR[p.kind];
                ctx.fillStyle = 'rgba(210,235,255,0.85)'; ctx.fillRect(-s * 0.09, -s * 0.05, s * 0.18, s * 0.17);
                ctx.fillStyle = c; ctx.fillRect(-s * 0.07, 0, s * 0.14, s * 0.1);
                ctx.fillStyle = '#c9a36a'; ctx.fillRect(-s * 0.04, -s * 0.12, s * 0.08, s * 0.08);
                if (p.kind === 'fireflask') { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, -s * 0.16, Math.max(1, s * 0.06 + Math.sin(t / 40) * 1.5), 0, Math.PI * 2); ctx.fill(); }
                break;
            }
            case 'arcane': case 'holy': case 'sound': case 'frost': case 'venom': case 'fire': {
                const r = s * (p.kind === 'fire' ? 0.17 : 0.14) * (1 + Math.sin(t / 60) * 0.12);
                ctx.shadowColor = col; ctx.shadowBlur = s * 0.4;
                ctx.fillStyle = col;
                if (p.kind === 'frost') { ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(r * 1.5, 0); ctx.lineTo(0, -r * 0.7); ctx.lineTo(-r, 0); ctx.lineTo(0, r * 0.7); ctx.closePath(); ctx.fill(); }
                else if (p.kind === 'holy') { for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4 + t / 300); ctx.fillRect(-r * 0.2, -r * 1.2, r * 0.4, r * 2.4); } }
                else if (p.kind === 'sound') { ctx.globalAlpha = 0.8; ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 1.7, -0.9, 0.9); ctx.stroke(); }
                else { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.4, 0, Math.PI * 2); ctx.fill(); }
                break;
            }
            default: {
                ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    }
}

export const Projectiles = new ProjectileSystem();
