// In-page playtest bot. It plays through the REAL input paths: mouse events on the map canvas (tap to move), clicks on the
// Attack / Power / Search / Camp buttons, the level-up modal buttons and the start-screen buttons. It reads game state
// through window.pixelDebug (read-only helpers) to decide what to do.
//
// Usage (browser console or a test driver):
//   const { PlaytestBot } = await import('/src/devtools/PlaytestBot.js');
//   const bot = new PlaytestBot({ maxFloor: 5 });
//   const report = await bot.run();      // plays the current character until maxFloor is cleared or it dies
// Every run returns a report: floors reached, turns, kills, deaths, anomalies (NaN/undefined text, stuck states, errors).

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);
const BAD_TEXT = /\bNaN\b|undefined|\[object|Infinity/;

// tile ids (mirror of TILES in map/Dungeon.js, read from the live module so they never drift)
async function loadTiles() {
    const m = await import('/src/map/Dungeon.js');
    return { T: m.TILES, W: () => m.MAP_WIDTH, H: () => m.MAP_HEIGHT, VIS: m.VISIBILITY };
}

export class PlaytestBot {
    constructor(opts = {}) {
        this.opts = { maxFloor: 5, maxIterations: 4000, stepDelay: 12, fightBudget: 400, verbose: false, stopOnDeath: false, ...opts };
        this.report = { class: null, race: null, floors: [], deaths: 0, kills: 0, iterations: 0, anomalies: [], errors: [], stuck: 0, taps: 0, attacks: 0, powers: 0, potions: 0, camps: 0, notes: [] };
        this.errors = [];
        this._onErr = (e) => this.errors.push(String(e.message || e.reason || e));
        window.addEventListener('error', this._onErr);
        window.addEventListener('unhandledrejection', this._onErr);
        this.blacklist = new Set();
    }

    dispose() {
        window.removeEventListener('error', this._onErr);
        window.removeEventListener('unhandledrejection', this._onErr);
    }

    get pd() { return window.pixelDebug; }
    get p() { return this.pd.player(); }
    get f() { return this.pd.floor(); }
    note(msg) { this.report.notes.push(msg); if (this.opts.verbose) console.log('[bot]', msg); }
    anomaly(kind, detail) { this.report.anomalies.push({ kind, detail, floor: this.f?.floor, turn: this.p?.turnCount }); if (this.opts.verbose) console.warn('[bot anomaly]', kind, detail); }

    // ---- scanning for broken text ----
    scanText() {
        const ids = ['message-bar', 'status-strip', 'hud-statuses', 'hud-hp', 'hud-max-hp', 'hud-ac', 'hud-gold', 'hud-rations', 'hud-floor', 'hud-level'];
        for (const id of ids) {
            const t = $(id)?.innerText || '';
            if (BAD_TEXT.test(t)) this.anomaly('bad-text', `${id}: ${t.slice(0, 120)}`);
        }
        const hp = this.p.hp, mx = this.p.maxHp;
        if (!Number.isFinite(hp) || !Number.isFinite(mx) || !Number.isFinite(this.p.ac)) this.anomaly('bad-number', `hp ${hp}/${mx} ac ${this.p.ac}`);
    }

    // ---- real input ----
    tapWorld(wx, wy) {
        const cam = this.pd.camera();
        const canvas = $('stage');
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        const tx = wx - (cam.player.x - Math.floor(cam.cols / 2) + cam.panX);
        const ty = wy - (cam.player.y - Math.floor(cam.rows / 2) + cam.panY);
        if (tx < 0 || ty < 0 || tx >= cam.cols || ty >= cam.rows) return false;
        const cx = rect.left + ((tx + 0.5) * cam.tileSize) / scale;
        const cy = rect.top + ((ty + 0.5) * cam.tileSize) / scale;
        const init = { clientX: cx, clientY: cy, button: 0, bubbles: true, cancelable: true };
        canvas.dispatchEvent(new MouseEvent('mousedown', init));
        canvas.dispatchEvent(new MouseEvent('mouseup', init));
        this.report.taps++;
        return true;
    }

    click(id) {
        const el = $(id);
        if (!el || el.disabled) return false;
        el.click();
        return true;
    }

    async settle(maxMs = 2500) {
        // wait for the walking timer to finish: position and turn counter stop changing
        let last = '', still = 0;
        const t0 = Date.now();
        while (Date.now() - t0 < maxMs) {
            const key = `${this.p.x},${this.p.y},${this.p.turnCount}`;
            if (key === last) { if (++still >= 4) break; } else { still = 0; last = key; }
            await sleep(this.opts.stepDelay + 6);
        }
    }

    // ---- state helpers ----
    ctx() {
        const f = this.f, p = this.p, { T, VIS } = this.tiles;
        const W = this.tiles.W(), H = this.tiles.H();
        return { f, p, T, VIS, W, H };
    }

    passableKnown(x, y, c) {
        const { f, T, VIS, W, H } = c;
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        const i = y * W + x;
        if (f.visibility[i] === VIS.UNEXPLORED) return false;
        const t = f.terrain[i];
        if (t === T.LOCKED_DOOR) { const l = f.lockedDoors?.find(d => d.x === x && d.y === y); return !!(l && this.p.hasKey(l.keyId)); }
        return !(t === T.WALL || t === T.SECRET_DOOR || t === T.PILLAR || t === T.PIT || t === T.WATER || t === T.RUBBLE || t === T.BARREL ||
            t === T.FOUNTAIN || t === T.SHRINE) && !(f.trapsRevealed && f.trapsRevealed.has(i));
    }

    // BFS over known walkable tiles. Returns { dist, prev } maps keyed by index.
    bfs(c, from) {
        const { W } = c;
        const dist = new Map([[from.y * W + from.x, 0]]);
        const prev = new Map();
        const q = [from.y * W + from.x];
        for (let h = 0; h < q.length; h++) {
            const i = q[h], x = i % W, y = (i - x) / W;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy, ni = ny * W + nx;
                if (dist.has(ni) || !this.passableKnown(nx, ny, c)) continue;
                dist.set(ni, dist.get(i) + 1); prev.set(ni, i);
                const tt = c.f.terrain[ni];
                if (tt !== c.T.STAIRS_UP && tt !== c.T.STAIRS_DOWN) q.push(ni); // stairs end a route: stepping on them changes floor
                // doors stop the search through them (the game opens them by bumping)
                const t = c.f.terrain[ni];
                if (t === c.T.DOOR_CLOSED || t === c.T.LOCKED_DOOR) { dist.set(ni, dist.get(i) + 1); }
            }
        }
        return { dist, prev };
    }

    pathTo(c, search, target) {
        const { W } = c;
        const out = [];
        let i = target.y * W + target.x;
        while (search.prev.has(i)) { out.push({ x: i % W, y: (i - (i % W)) / W }); i = search.prev.get(i); }
        return out.reverse();
    }

    // Walk toward (tx,ty) by tapping the furthest point of the BFS path that is on screen
    stuckContext() {
        try {
            const c = this.ctx(), { f, p, W } = c;
            const around = [];
            for (let dy = -1; dy <= 1; dy++) { const row = []; for (let dx = -1; dx <= 1; dx++) row.push(f.terrain[(p.y + dy) * W + p.x + dx]); around.push(row.join(',')); }
            return JSON.stringify({ pos: [p.x, p.y], goal: this.lastGoal || null, stairs: f.stairsDownPos, around, log: this.pd.log(3), mod: f.modifier });
        } catch (e) { return 'ctx-error ' + e; }
    }

    async walkTo(c, search, target) {
        this.lastGoal = { x: target.x, y: target.y, why: target.why };
        const path = this.pathTo(c, search, target);
        if (!path.length) return false;
        let best = null;
        for (const n of path) {
            if (!this.tapOk(n)) break;
            best = n;
            // the game's route stops at a closed door: tap the door itself (walk up and bump it open), never past it
            const tt = c.f.terrain[n.y * c.W + n.x];
            if (tt === c.T.DOOR_CLOSED || tt === c.T.LOCKED_DOOR || tt === c.T.SECRET_DOOR) break;
        }
        best = best || path[0];
        const before = `${this.p.x},${this.p.y},${this.p.turnCount}`;
        if (!this.tapWorld(best.x, best.y)) return false;
        await this.settle();
        return `${this.p.x},${this.p.y},${this.p.turnCount}` !== before;
    }

    tapOk(n) {
        const cam = this.pd.camera();
        const tx = n.x - (cam.player.x - Math.floor(cam.cols / 2) + cam.panX);
        const ty = n.y - (cam.player.y - Math.floor(cam.rows / 2) + cam.panY);
        return tx >= 1 && ty >= 1 && tx < cam.cols - 1 && ty < cam.rows - 1;
    }

    hostiles(c) {
        const { f, p, W, VIS } = c;
        return f.monsters.filter(m => m.alive && f.visibility[m.y * W + m.x] === VIS.VISIBLE && (m.alert || Math.hypot(m.x - p.x, m.y - p.y) <= 5) && !(this.ignore && this.ignore.has(m.id) && Math.hypot(m.x - p.x, m.y - p.y) > 1.6));
    }

    potionIndex() {
        const p = this.p;
        return p.backpack.findIndex(i => i && i.isConsumable && i.healPotency >= 15 && !i.rations);
    }

    foodIndex() {
        const p = this.p;
        return p.backpack.findIndex(i => i && i.isConsumable && i.rations > 0 && !i.statusOnHit && i.mushroomType !== 'DEATHSTOOL');
    }

    // ---- modal handling ----
    handleModals() {
        let handled = false;
        const lu = $('levelup-modal');
        if (lu && lu.classList.contains('active')) {
            const btns = [...document.querySelectorAll('#levelup-choices button')];
            if (btns.length) { btns[0].click(); handled = true; } else { this.pd.autoLevelChoices?.(); lu.classList.remove('active'); handled = true; }
        }
        for (const id of ['shop-modal', 'shrine-modal', 'victory-modal', 'sheet-modal', 'settings-modal', 'log-modal', 'status-modal', 'inspect-modal', 'gem-picker-modal', 'slot-picker-modal']) {
            const m = $(id);
            if (m && m.classList.contains('active') && id !== 'victory-modal') { m.classList.remove('active'); handled = true; }
        }
        const vm = $('victory-modal');
        if (vm && vm.classList.contains('active')) { vm.classList.remove('active'); this.report.victory = true; handled = true; }
        return handled;
    }

    isDead() {
        return !this.p.alive;
    }

    // ---- one decision ----
    async step() {
        this.tiles = this.tiles || await loadTiles();
        const c = this.ctx();
        const { f, p, W, T, VIS } = c;
        this.report.iterations++;
        this.handleModals();
        this.scanText();

        // 1. survival
        const hostiles = this.hostiles(c);
        const hpPct = p.hp / p.maxHp;
        if (hpPct < 0.5) {
            const pi = this.potionIndex();
            if (pi >= 0) { window.consumeBackpackItem(pi); this.report.potions++; this.pd.closeSheet?.(); return 'potion'; }
        }
        if (p.rations > 0 && hostiles.length === 0 && hpPct < 0.6 && p.hp > 0) { this.click('btn-camp-main'); this.report.camps++; await sleep(20); return 'camp'; }
        if (hostiles.length === 0 && p.rations <= 1) {
            const fi = this.foodIndex();
            if (fi >= 0) { window.consumeBackpackItem(fi); return 'eat'; }
        }

        // 2. fight
        if (hostiles.length) {
            this.fightTurns = (this.fightTurns || 0) + 1;
            if (this.fightTurns > this.opts.fightBudget) { this.anomaly('fight-too-long', `${hostiles[0].name}`); this.fightTurns = 0; this.blacklist.add(`${hostiles[0].x},${hostiles[0].y}`); return 'fight-giveup'; }
            const usePower = this.fightTurns % 2 === 0 && /ready|cast|strike|use/i.test($('btn-power-main')?.innerText || '');
            if (usePower && this.click('btn-power-main')) this.report.powers++; else { this.click('btn-attack-main'); this.report.attacks++; }
            await sleep(this.opts.stepDelay);
            // a foe the game says it cannot reach (across water, a pit...) is ignored until it comes close
            const last = (this.pd.log(1)[0] || '');
            if (/out of reach|no path/i.test(last)) {
                this.ignore = this.ignore || new Set();
                const nearest = hostiles.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
                this.ignore.add(nearest.id);
                this.report.unreachableFoes = (this.report.unreachableFoes || 0) + 1;
            }
            return 'fight';
        }
        this.fightTurns = 0;

        // 3. housekeeping
        if (this.report.iterations % 40 === 0) { try { window.equipUpgrades?.(); this.pd.closeSheet?.(); } catch (e) { this.errors.push(String(e)); } this.handleModals(); }
        if (p.gold > 150 && f.merchant) { /* shopping is not simulated */ }

        // 4. things to pick up: keys, chests, ground items, then exploration frontier
        const search = this.bfs(c, p);
        const targets = [];
        for (const k of f.keys || []) if (!k.hidden) targets.push({ x: k.x, y: k.y, why: 'key' });
        for (const ch of f.chests || []) if (!ch.opened && p.canStore(ch.item)) targets.push({ x: ch.x, y: ch.y, why: 'chest' });
        for (const g of f.groundItems || []) if (!g.fresh && p.canStore(g.item)) targets.push({ x: g.x, y: g.y, why: 'item' });
        for (const m of f.mushrooms || []) targets.push({ x: m.x, y: m.y, why: 'shroom' });
        for (const l of f.lockedDoors || []) if (p.hasKey(l.keyId) && f.terrain[l.y * W + l.x] === T.LOCKED_DOOR) targets.push({ x: l.x, y: l.y, why: 'lock' });
        const reachable = (t) => search.dist.has(t.y * W + t.x) && !this.blacklist.has(`${t.x},${t.y},${t.why}`);
        let goal = targets.filter(reachable).sort((a, b) => search.dist.get(a.y * W + a.x) - search.dist.get(b.y * W + b.x))[0];

        const stairsKnown = f.visibility[f.stairsDownPos.y * W + f.stairsDownPos.x] !== VIS.UNEXPLORED;
        const bossAlive = f.monsters.some(m => m.isBoss && m.alive);
        const floorTurns = p.turnCount - (this.floorStartTurn || 0);

        if (!goal) {
            // frontier: a known walkable tile touching unexplored space (or a closed door)
            let bestF = null, bestD = Infinity;
            for (const [i, d] of search.dist) {
                if (d === 0 || d >= bestD) continue;
                if (f.terrain[i] === T.STAIRS_UP || f.terrain[i] === T.STAIRS_DOWN) continue; // stairs are never exploration targets
                const x = i % W, y = (i - x) / W;
                const t = f.terrain[i];
                let open = t === T.DOOR_CLOSED;
                if (!open) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < c.H && f.visibility[ny * W + nx] === VIS.UNEXPLORED && f.terrain[ny * W + nx] !== undefined) { open = true; break; } }
                if (open && !this.blacklist.has(`${x},${y},explore`)) { bestF = { x, y, why: 'explore' }; bestD = d; }
            }
            goal = bestF;
        }

        // 5. stairs when the floor is done (or the bot has dawdled long enough)
        const wantStairs = !goal || floorTurns > 900;
        if (wantStairs && stairsKnown) {
            const st = { x: f.stairsDownPos.x, y: f.stairsDownPos.y, why: 'stairs' };
            if (bossAlive) {
                // the boss waits in the arena around the stairs: walk up to it and let the fight code take over
                const boss = f.monsters.find(m => m.isBoss && m.alive);
                const near = search.dist.has(boss.y * W + boss.x) ? boss : st;
                if (search.dist.has(near.y * W + near.x) || true) {
                    const ok = search.dist.has(st.y * W + st.x) ? await this.walkTo(c, search, st) : false;
                    if (!ok) { this.click('btn-attack-main'); this.report.attacks++; await sleep(20); }
                    return 'to-boss';
                }
            }
            if (search.dist.has(st.y * W + st.x)) {
                const floorBefore = this.pd.state().floor;
                const moved = await this.walkTo(c, search, st);
                if (this.pd.state().floor !== floorBefore) return 'descended';
                if (!moved) this.blacklist.add(`${st.x},${st.y},stairs`);
                return 'to-stairs';
            }
        }

        if (goal) {
            const moved = await this.walkTo(c, search, goal);
            if (!moved) {
                this.blacklist.add(`${goal.x},${goal.y},${goal.why}`);
                this.stuckCount = (this.stuckCount || 0) + 1;
            } else this.stuckCount = 0;
            return goal.why;
        }

        // 6. nothing reachable and no stairs known: secret doors/keys. Search, then wander to a random room.
        this.report.searches = (this.report.searches || 0) + 1;
        this.click('btn-search-main');
        await sleep(30);
        if (this.report.searches % 4 === 0) {
            const room = f.rooms[(this.report.searches / 4) % f.rooms.length | 0];
            if (room && search.dist.has(room.cy * W + room.cx)) await this.walkTo(c, search, { x: room.cx, y: room.cy });
        }
        if (this.report.searches > 60 && !this.report['softlock-flag-' + f.floor]) {
            this.report['softlock-flag-' + f.floor] = true;
            this.anomaly('no-route', `floor ${f.floor}: no reachable goal and stairs unknown after 60 searches`);
            this.pd.teleportToStairs?.();
        }
        return 'search';
    }

    async run() {
        this.tiles = await loadTiles();
        const start = this.pd.player();
        this.report.class = start.characterClass.id;
        this.report.race = start.race.id;
        this.report.startFloor = this.pd.state().floor;
        let lastFloor = this.pd.state().floor;
        this.floorStartTurn = this.p.turnCount;
        this.floorLog = { floor: lastFloor, startTurn: this.p.turnCount, startLevel: this.p.level };
        let sameKey = '', sameCount = 0;
        const t0 = Date.now();
        while (this.report.iterations < this.opts.maxIterations) {
            if (this.isDead()) {
                this.report.deaths++;
                this.report.deathAt = { floor: this.f.floor, level: this.p.level, turn: this.p.turnCount, log: this.pd.log(4) };
                this.report.finished = 'died';
                break;
            }
            let what;
            try { what = await this.step(); } catch (e) { this.errors.push('step: ' + (e.stack || e)); this.anomaly('exception', String(e.message || e)); await sleep(30); what = 'error'; if (this.errors.length > 8) break; }
            const floor = this.pd.state().floor;
            if (floor !== lastFloor) {
                this.report.floors.push({ floor: lastFloor, turns: this.p.turnCount - this.floorLog.startTurn, level: this.p.level, hp: `${this.p.hp}/${this.p.maxHp}`, rations: this.p.rations });
                lastFloor = floor;
                this.floorLog = { floor, startTurn: this.p.turnCount };
                this.floorStartTurn = this.p.turnCount;
                this.blacklist.clear();
                this.report.searches = 0;
                if (floor > this.opts.maxFloor) { this.report.finished = 'reached-floor-' + floor; break; }
            }
            const key = `${floor},${this.p.x},${this.p.y},${this.p.turnCount},${this.p.hp}`;
            if (key === sameKey) { if (++sameCount > 25) { this.report.stuck++; this.anomaly('stuck', `no change for 25 steps (${what}) ${this.stuckContext()}`); sameCount = 0; this.blacklist.clear(); this.click('btn-search-main'); } } else { sameKey = key; sameCount = 0; }
            if (this.report.stuck > 6) { this.report.finished = 'stuck'; break; }
        }
        if (!this.report.finished) this.report.finished = this.report.iterations >= this.opts.maxIterations ? 'iteration-cap' : 'ended';
        this.report.finalFloor = this.pd.state().floor;
        this.report.level = this.p.level;
        this.report.turns = this.p.turnCount;
        this.report.kills = this.p.stats?.kills;
        this.report.seconds = Math.round((Date.now() - t0) / 1000);
        this.report.errors = [...new Set(this.errors)].slice(0, 8);
        this.dispose();
        return this.report;
    }
}
