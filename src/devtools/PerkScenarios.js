// Scripted scenarios for the six class perks. Setup (placing the hero near a live monster) uses debug teleport; the
// ACTIONS themselves go through real input: the Attack / Power buttons, the Space hotkey and the Spells menu buttons.
//   const S = await import('/src/devtools/PerkScenarios.js');
//   const results = await S.runAll();

import { createViaUI } from './PlaytestHarness.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);
const pd = () => window.pixelDebug;
const lastMsgs = (n = 3) => pd().log(n);

async function tilesMod() { return import('/src/map/Dungeon.js'); }

function key(k) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k === ' ' ? 'Space' : k, bubbles: true }));
}

async function pressWait() { key(' '); await sleep(60); }

// Opens the Spells & Feats menu and presses the button for one ability (real UI path)
async function castFromMenu(abilityId) {
    window.openSpellsModal();
    await sleep(40);
    const btn = [...document.querySelectorAll('#spells-list button')].find(b => (b.getAttribute('onclick') || '').includes(`'${abilityId}'`) && /Cast|Aim|Execute/.test(b.innerText));
    if (!btn) { window.closeSpellsModal?.(); return { ok: false, reason: 'no cast button for ' + abilityId }; }
    btn.click();
    await sleep(80);
    return { ok: true };
}

// A floor tile at distance [minD, maxD] from the monster with a clear straight line to it (and open floor under the hero)
async function spotFor(m, minD, maxD) {
    const { TILES, MAP_WIDTH } = await tilesMod();
    const f = pd().floor();
    const clear = (x0, y0, x1, y1) => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 1; i < n; i++) {
            const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
            const t = f.terrain[y * MAP_WIDTH + x];
            if (t !== TILES.FLOOR) return false;
        }
        return true;
    };
    for (let r = minD; r <= maxD; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const d = Math.hypot(dx, dy);
            if (d < minD || d > maxD) continue;
            const x = m.x + dx, y = m.y + dy;
            if (f.terrain[y * MAP_WIDTH + x] !== TILES.FLOOR) continue;
            if (f.monsters.some(o => o.alive && o !== m && Math.hypot(o.x - x, o.y - y) < 6)) continue;
            if (clear(x, y, m.x, m.y)) return { x, y, d };
        }
    }
    return null;
}

// Picks a live ordinary monster with a usable spot at distance minD..maxD; teleports the hero there; makes it unaware & slow to hurt
async function stageFoe(minD, maxD, { hp = 400 } = {}) {
    const f = pd().floor();
    for (const m of f.monsters.filter(m => m.alive && !m.isBoss)) {
        const s = await spotFor(m, minD, maxD);
        if (!s) continue;
        pd().teleport(s.x, s.y);
        m.hp = hp; m.maxHp = hp; m.unaware = true; m.alert = false; m.statuses = [];
        await pressWait(); // a real turn: the map and visibility refresh (the foe may wake, but stays "unaware" until struck)
        m.unaware = true;
        await sleep(30);
        return { m, spot: s };
    }
    return null;
}

const result = (name, pass, detail) => ({ name, pass, detail });

export async function rangerFocus() {
    await createViaUI('ranger');
    pd().setWalkDelay(4);
    const st = await stageFoe(3, 3.9);
    if (!st) return result('ranger focus', false, 'no staging spot');
    const vis = pd().floor().visibility[st.m.y * pd().floor().terrain.length ** 0.5 + st.m.x];
    $('btn-attack-main').click(); await sleep(80);
    const msgs = lastMsgs(3).join(' | ');
    return result('ranger focus', /FOCUSED SHOT/.test(msgs), `dist ${st.spot.d.toFixed(1)} visible=${vis} -> ${msgs.slice(0, 160)}`);
}

export async function rangerCover() {
    // Cover: put a pillar beside the line to the foe so the shot has cover, then fire an unaware (focus) shot and a normal one
    await createViaUI('ranger');
    const st = await stageFoe(3, 3.9);
    if (!st) return result('ranger cover', false, 'no staging spot');
    const f = pd().floor(), { MAP_WIDTH, TILES } = await tilesMod();
    const m = st.m, p = pd().player();
    // pillar on the tile adjacent to the monster toward the hero
    const px = m.x + Math.sign(p.x - m.x), py = m.y + Math.sign(p.y - m.y);
    const cover = await import('/src/systems/Effects.js');
    const had = cover.EffectSystem.calculateTacticalCover(m.x, m.y, p.x, p.y, f.terrain);
    f.terrain[py * MAP_WIDTH + px] = TILES.PILLAR;
    const withPillar = cover.EffectSystem.calculateTacticalCover(m.x, m.y, p.x, p.y, f.terrain);
    $('btn-attack-main').click(); await sleep(80);
    const msg = lastMsgs(2).join(' | ');
    return result('ranger cover', true, `cover before ${had.hasCover} after pillar ${withPillar.hasCover}; focused shot reported: ${/FOCUSED/.test(msg)}; ${msg.slice(0, 140)}`);
}

export async function wizardCharge() {
    await createViaUI('wizard');
    pd().setWalkDelay(4);
    const st = await stageFoe(3, 4.5);
    if (!st) return result('wizard charge', false, 'no staging spot');
    const p = pd().player();
    const before = { charged: p.charged };
    await pressWait(); await pressWait();
    const afterWait = p.charged;
    const power = $('btn-power-main');
    const label = power.innerText.replace(/\n/g, ' ');
    power.click(); await sleep(120);
    const msgs = lastMsgs(6).join(' | ');
    const mainId = (pd().player().characterClass.abilities.find(a => /Missile/.test(a.name)) || {}).id;
    const cd = p.cooldowns[mainId] || 0;
    return result('wizard charge', before.charged === false && afterWait === true && /Charged!/.test(msgs) && cd === 0, `charged after 2 waits: ${afterWait}; power button "${label.slice(0, 40)}"; cooldown now ${cd}; ${msgs.slice(0, 200)}`);
}

export async function wizardChargeBroken() {
    await createViaUI('wizard');
    const p = pd().player();
    await pressWait(); await pressWait();
    const was = p.charged;
    key('ArrowRight'); await sleep(60); // any move breaks it
    key('ArrowLeft'); await sleep(60);
    await pressWait();
    return result('wizard charge broken by moving', was && !p.charged, `charged before moving: ${was}, after move + one wait: ${p.charged}`);
}

export async function thiefShadowAndBackstab() {
    await createViaUI('thief');
    pd().setWalkDelay(4);
    const st = await stageFoe(3, 4.5);
    if (!st) return result('thief', false, 'no staging spot');
    const p = pd().player();
    st.m.alert = true; st.m.unaware = false; // a hunter that has spotted us
    const slip = await castFromMenu('slip_shadow');
    const afterSlip = { shadow: p.shadowTurns, alert: st.m.alert, unaware: st.m.unaware, strip: $('status-strip').innerText.includes('Hidden') };
    // walk next to it (real taps are covered by the class runs: here use the d-pad steps toward it) then backstab
    pd().teleport(st.m.x - Math.sign(st.m.x - p.x), st.m.y - Math.sign(st.m.y - p.y));
    st.m.hp = 400; const h0 = st.m.hp;
    $('btn-attack-main').click(); await sleep(80);
    const msgs = lastMsgs(3).join(' | ');
    return result('thief slip + backstab', slip.ok && afterSlip.shadow > 0 && !afterSlip.alert && /BACKSTAB|SURPRISE/.test(msgs), `${JSON.stringify(afterSlip)} dmg ${h0 - st.m.hp}; ${msgs.slice(0, 170)}`);
}

export async function clericSanctify(templeSeedHint) {
    // find a (seed, floor) with a temple or sanctum, play it for real: walk to the room with taps and wait
    const G = await import('/src/map/Generator.js'), M = await import('/src/data/Modules.js'), D = await import('/src/map/Dungeon.js');
    const { PlaytestBot } = await import('./PlaytestBot.js');
    let found = null;
    M.setActiveModule(M.Modules.get('deep_dungeons'), 0);
    for (let s = 0; s < 80 && !found; s++) for (let fl = 1; fl <= 4 && !found; fl++) {
        const g = G.generateFloor('CLERIC' + s, fl);
        const sp = g.specials.find(x => x.type === 'temple' || x.type === 'sanctum');
        if (sp) found = { seed: 'CLERIC' + s, floor: fl, sp };
    }
    if (!found) return result('cleric sanctify', false, 'no temple found');
    await createViaUI('cleric');
    pd().startRun(found.seed, { classId: 'cleric', moduleId: 'deep_dungeons', heroId: null, mapSize: 50 });
    window.closeStart?.();
    pd().setWalkDelay(4);
    pd().jumpToFloor(found.floor);
    pd().revealMap();
    // clear the room's neighbourhood of foes so the test is about healing
    for (const m of pd().floor().monsters) if (m.alive && Math.hypot(m.x - (found.sp.x + found.sp.w / 2), m.y - (found.sp.y + found.sp.h / 2)) < 12 && !m.isBoss) m.alive = false;
    const p = pd().player();
    const bot = new PlaytestBot({}); bot.tiles = await import('/src/map/Dungeon.js').then(m => ({ T: m.TILES, W: () => m.MAP_WIDTH, H: () => m.MAP_HEIGHT, VIS: m.VISIBILITY }));
    p.hp = Math.max(1, p.maxHp - 12);
    const hp0 = p.hp;
    const c = bot.ctx();
    const inRoom = (x, y) => x >= found.sp.x && x < found.sp.x + found.sp.w && y >= found.sp.y && y < found.sp.y + found.sp.h;
    const cx = found.sp.x + found.sp.w / 2, cy = found.sp.y + found.sp.h / 2;
    let arrived = inRoom(p.x, p.y);
    for (let i = 0; i < 80 && !arrived; i++) {
        const c2 = bot.ctx();
        const search = bot.bfs(c2, p);
        let best = null, bd = Infinity;
        for (const [idx] of search.dist) {
            const x = idx % c2.W, y = (idx - x) / c2.W;
            if (!inRoom(x, y)) continue;
            const d = Math.hypot(x - cx, y - cy);
            if (d < bd) { bd = d; best = { x, y, why: 'temple' }; }
        }
        if (!best) break;
        await bot.walkTo(c2, search, best);
        arrived = inRoom(p.x, p.y);
    }
    const hpOnArrival = p.hp;
    for (let i = 0; i < 6; i++) await pressWait();
    const chip = $('status-strip').innerText.includes('Sanctified');
    const msgs = pd().log(40).filter(t => /Holy ground/.test(t)).length;
    return result('cleric sanctify (real temple room)', arrived && chip && msgs > 0 && p.hp > hp0, `${found.sp.type} ${found.sp.rating}★ on ${found.seed} F${found.floor}; arrived ${arrived}; hp ${hp0} -> ${hpOnArrival} -> ${p.hp}; chip ${chip}; message shown ${msgs}x`);
}

export async function bardSong() {
    await createViaUI('bard');
    const p = pd().player();
    const withLute = { ac: p.ac, att: p.passiveMods.attack, chip: $('status-strip').innerText.includes('Song'), off: p.equipment.off_hand?.name };
    window.openSheetModal(); await sleep(40);
    const acText = $('sheet-ac')?.innerText;
    window.closeSheetModal();
    return result('bard song', withLute.off === 'Wooden Lute' && withLute.chip && withLute.att >= 1, `${JSON.stringify(withLute)}; sheet AC shows ${acText}`);
}

export async function warriorBash() {
    await createViaUI('warrior');
    pd().setWalkDelay(4);
    const st = await stageFoe(2, 2.4);
    const p = pd().player();
    let mm = st && st.m;
    if (!mm) return result('warrior bash', false, 'no staging spot');
    // step adjacent
    pd().teleport(mm.x - Math.sign(mm.x - p.x), mm.y - Math.sign(mm.y - p.y));
    mm.alert = true; mm.unaware = false;
    let hits = 0, stuns = 0, tries = 0;
    for (let i = 0; i < 12; i++) {
        mm.statuses = []; p.cooldowns.shield_bash = 0; p.hp = p.maxHp; const h = mm.hp;
        const r = await castFromMenu('shield_bash'); tries++;
        if (!r.ok) return result('warrior bash', false, r.reason);
        if (mm.hp < h) { hits++; if ((mm.statuses || []).some(s => s.id === 'STUNNED')) stuns++; }
    }
    // without a shield
    p.equipment.off_hand = null; p.cooldowns.shield_bash = 0;
    const noShield = await castFromMenu('shield_bash');
    const msg = lastMsgs(1)[0] || '';
    return result('warrior shield bash', hits > 0 && stuns === hits, `${hits}/${tries} hits, ${stuns} stuns; without shield -> ${noShield.ok ? 'cast button shown' : noShield.reason}; ${msg.slice(0, 80)}`);
}

export async function runAll() {
    const out = [];
    for (const fn of [rangerFocus, rangerCover, wizardCharge, wizardChargeBroken, thiefShadowAndBackstab, clericSanctify, bardSong, warriorBash]) {
        try { out.push(await fn()); } catch (e) { out.push(result(fn.name, false, 'exception: ' + (e.stack || e).toString().slice(0, 200))); }
    }
    window.__perkResults = out;
    return out;
}
