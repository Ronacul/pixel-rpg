// Boss turn engine: scripted move cycle with one-turn TELEGRAPHS for the dangerous attacks.
// A telegraphed move is announced (tiles tinted red on the map) on the boss' turn and lands on its NEXT turn,
// which gives the player exactly one action to step out of the marked tiles.

import { MAP_WIDTH, MAP_HEIGHT, TILES } from '../map/Dungeon.js';
import { EffectSystem } from './Effects.js';
import { CombatSystem, rollMonsterDamage } from './Combat.js';

const SOLID = new Set([TILES.WALL, TILES.WATER, TILES.PILLAR, TILES.RUBBLE, TILES.DOOR_CLOSED, TILES.LOCKED_DOOR, TILES.SECRET_DOOR, TILES.BARREL]);

function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT; }
function isSolid(terrain, x, y) { return !inBounds(x, y) || SOLID.has(terrain[y * MAP_WIDTH + x]); }

export function currentPhase(boss) {
    const pct = (boss.hp / boss.maxHp) * 100;
    let idx = 0;
    boss.def.phases.forEach((p, i) => { if (pct <= p.below) idx = i; });
    return idx;
}

// Which tiles a telegraphed move will hit (computed when announced)
function telegraphTiles(boss, move, ctx) {
    const { player, terrain } = ctx;
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const sx = horizontal ? Math.sign(dx) || 1 : 0;
    const sy = horizontal ? 0 : (Math.sign(dy) || 1);
    const tiles = [];

    if (move === 'charge') {
        for (let i = 1; i <= 6; i++) {
            const x = boss.x + sx * i, y = boss.y + sy * i;
            if (isSolid(terrain, x, y)) break;
            tiles.push({ x, y });
        }
    } else if (move === 'slam' || move === 'land') {
        const r = boss.def.id === 'giant' ? 2 : 1;
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
            if (xx === 0 && yy === 0) continue;
            const x = boss.x + xx, y = boss.y + yy;
            if (!isSolid(terrain, x, y)) tiles.push({ x, y });
        }
    } else if (move === 'breath') {
        const len = boss.def.breath?.length || 5;
        for (let dist = 1; dist <= len; dist++) {
            const half = Math.floor(dist / 2);
            for (let w = -half; w <= half; w++) {
                const x = boss.x + sx * dist + (horizontal ? 0 : w);
                const y = boss.y + sy * dist + (horizontal ? w : 0);
                if (isSolid(terrain, x, y)) continue;
                if (EffectSystem.bresenhamRaycast(boss.x, boss.y, x, y, terrain).clear) tiles.push({ x, y });
            }
        }
    } else if (move === 'boulder') {
        for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) {
            const x = player.x + xx, y = player.y + yy;
            if (!isSolid(terrain, x, y)) tiles.push({ x, y });
        }
    }
    return tiles;
}

function dealDamage(boss, ctx, mult, label) {
    const dmg = Math.max(1, Math.round(rollMonsterDamage(ctx.prng, boss) * mult * (boss.dmgMult || 1)));
    return ctx.damagePlayer(dmg, label);
}

// Applies the effect of a telegraphed move that was announced last turn
function resolveTelegraph(boss, ctx) {
    const t = boss.telegraph;
    boss.telegraph = null;
    const { player, floor } = ctx;
    const hit = t.tiles.some(p => p.x === player.x && p.y === player.y);
    const key = (x, y) => `${x},${y}`;

    if (t.move === 'charge') {
        // Boss rushes along the lane and stops before the first obstacle / the player
        let last = { x: boss.x, y: boss.y };
        for (const p of t.tiles) {
            if (p.x === player.x && p.y === player.y) break;
            if (floor.monsters.some(m => m.alive && m !== boss && m.x === p.x && m.y === p.y)) break;
            last = p;
        }
        boss.x = last.x; boss.y = last.y;
        if (hit) {
            ctx.post(`💥 ${boss.name} barrels into you!`, 'msg-miss');
            const died = dealDamage(boss, ctx, 1.1, boss.name);
            EffectSystem.applyStatus(player, 'CLUMSY', 3, 1, boss.name);
            return died;
        }
        ctx.post(`💨 ${boss.name} thunders past, missing you!`, 'msg-info');
    } else if (t.move === 'slam' || t.move === 'land') {
        ctx.post(`🌋 ${boss.name} ${t.move === 'land' ? 'crashes down' : 'slams the ground'}!`, hit ? 'msg-miss' : 'msg-info');
        if (t.move === 'land') boss.airborne = false;
        if (hit) return dealDamage(boss, ctx, 1.0, boss.name);
    } else if (t.move === 'breath') {
        const zone = boss.def.breath?.zone || 'FIRE';
        for (const p of t.tiles) EffectSystem.addZone(floor, p.x, p.y, zone, 3, 1, 'monster');
        ctx.post(`🔥 ${boss.name} breathes ${zone === 'FIRE' ? 'fire' : 'a toxic cloud'}!`, hit ? 'msg-miss' : 'msg-info');
        if (hit) {
            const died = dealDamage(boss, ctx, 1.1, boss.name);
            EffectSystem.applyStatus(player, zone === 'FIRE' ? 'BURNING' : 'POISONED', 3, 1, boss.name);
            return died;
        }
    } else if (t.move === 'boulder') {
        const c = t.center;
        const idx = c.y * MAP_WIDTH + c.x;
        if (floor.terrain[idx] === TILES.FLOOR && !(player.x === c.x && player.y === c.y)) floor.terrain[idx] = TILES.RUBBLE;
        ctx.post(`🪨 A boulder crashes down!`, hit ? 'msg-miss' : 'msg-info');
        if (hit) return dealDamage(boss, ctx, 1.0, boss.name);
    }
    return false;
}

function spawnMinions(boss, ctx, count) {
    const def = boss.def.minion;
    if (!def) return;
    const { floor } = ctx;
    const alive = floor.monsters.filter(m => m.alive && m.isMinionOf === boss.id).length;
    let toSpawn = Math.min(count, 4 - alive);
    for (let r = 1; r <= 3 && toSpawn > 0; r++) {
        for (let yy = -r; yy <= r && toSpawn > 0; yy++) for (let xx = -r; xx <= r && toSpawn > 0; xx++) {
            const x = boss.x + xx, y = boss.y + yy;
            if (isSolid(floor.terrain, x, y)) continue;
            if (floor.terrain[y * MAP_WIDTH + x] !== TILES.FLOOR) continue;
            if (ctx.player.x === x && ctx.player.y === y) continue;
            if (floor.monsters.some(m => m.alive && m.x === x && m.y === y)) continue;
            const m = ctx.spawnMonster(def, x, y);
            m.isMinionOf = boss.id;
            m.alert = true;
            m.unaware = false;
            toSpawn--;
        }
    }
}

// Returns true if the hero died during this boss turn
export function bossTurn(boss, ctx) {
    const { player, prng, terrain } = ctx;
    const def = boss.def;

    // Phase change
    const phaseIdx = currentPhase(boss);
    if (phaseIdx !== boss.phaseIdx) {
        boss.phaseIdx = phaseIdx;
        boss.scriptIdx = 0;
        const enter = def.phases[phaseIdx].onEnter;
        if (enter) {
            ctx.post(`⚠️ ${boss.name} ${enter.msg}`, 'msg-victory');
            if (enter.dmgMult) boss.dmgMult = (boss.dmgMult || 1) * enter.dmgMult;
            if (enter.summon) spawnMinions(boss, ctx, 2);
        }
    }

    // Regeneration (stopped by burning / standing in fire)
    if (def.regen) {
        const burning = EffectSystem.hasStatus(boss, 'BURNING') || EffectSystem.hasStatus(boss, 'POISONED') ||
            ctx.floor.hazardZones?.some(z => z.x === boss.x && z.y === boss.y && (z.type === 'FIRE' || z.type === 'ACID_POOL'));
        if (!burning && boss.hp < boss.maxHp) boss.hp = Math.min(boss.maxHp, boss.hp + def.regen);
    }

    const mods = EffectSystem.getStatusModifiers(boss);
    if (mods.isStunned) {
        boss.telegraph = null;
        ctx.post(`⚡ ${boss.name} is stunned and loses its turn!`, 'msg-hit');
        return false;
    }

    // Land a telegraphed attack from the previous turn
    if (boss.telegraph) return resolveTelegraph(boss, ctx);

    const script = def.phases[boss.phaseIdx].script;
    boss.fightTurns = (boss.fightTurns || 0) + 1;
    const frenzy = Math.max(0, boss.fightTurns - 18); // long fights get nastier: +4% damage per turn after 18
    boss.enrageMult = 1 + 0.04 * frenzy;
    if (frenzy === 1) ctx.post(`🔥 ${boss.name} grows frenzied as the fight drags on!`, 'msg-miss');
    let move = script[boss.scriptIdx % script.length];
    // Unpredictability: about one turn in five the boss improvises instead of following its script
    if (!boss.airborne && prng.chance(0.22)) {
        const pool = [...new Set(script.filter(m => m !== 'fly' && m !== 'land'))];
        if (pool.length > 1) move = prng.choice(pool);
    }
    boss.scriptIdx++;
    const dist = Math.hypot(player.x - boss.x, player.y - boss.y);

    const announce = (m, text, center = null) => {
        boss.telegraph = { move: m, tiles: telegraphTiles(boss, m, ctx), center };
        ctx.post(`⚠️ ${boss.name} ${text}`, 'msg-miss');
    };

    switch (move) {
        case 'melee': {
            if (boss.airborne) { boss.airborne = false; ctx.post(`${boss.name} swoops down.`, 'msg-info'); return false; }
            if (dist <= 1.5) {
                const res = CombatSystem.resolveMonsterAttack(prng, boss, player, terrain);
                if (res.isHit) {
                    ctx.addBlood(player.x, player.y);
                    ctx.post(`🩸 ${boss.name} smashes you for ${res.damage} dmg! (${player.hp}/${player.maxHp} HP)`, 'msg-miss');
                    return player.hp <= 0;
                }
                ctx.post(`🛡️ You evade ${boss.name}'s blow.`);
                return false;
            }
            const step = ctx.stepTowards(boss);
            if (step) { boss.x = step.x; boss.y = step.y; }
            return false;
        }
        case 'charge': {
            if (dist < 2.5) return bossMeleeFallback(boss, ctx); // too close to wind up: just hit
            announce('charge', 'lowers its head and prepares to CHARGE!');
            return false;
        }
        case 'slam':
            announce('slam', 'raises its fists to SLAM the ground!');
            return false;
        case 'breath':
            announce('breath', 'draws a deep breath...');
            return false;
        case 'boulder':
            announce('boulder', 'hoists a boulder overhead!', { x: player.x, y: player.y });
            return false;
        case 'land':
            announce('land', 'folds its wings and dives!');
            return false;
        case 'fly':
            boss.airborne = true;
            ctx.post(`🦅 ${boss.name} beats its wings and rises out of melee reach!`, 'msg-miss');
            return false;
        case 'summon':
            ctx.post(`📯 ${boss.name} summons reinforcements!`, 'msg-miss');
            spawnMinions(boss, ctx, 2);
            return false;
        case 'roar':
            EffectSystem.applyStatus(player, 'CLUMSY', 3, 1, boss.name);
            ctx.post(`😱 ${boss.name} roars, shaking you off balance!`, 'msg-miss');
            return false;
        default:
            return bossMeleeFallback(boss, ctx);
    }
}

function bossMeleeFallback(boss, ctx) {
    const dist = Math.hypot(ctx.player.x - boss.x, ctx.player.y - boss.y);
    if (dist <= 1.5) {
        const res = CombatSystem.resolveMonsterAttack(ctx.prng, boss, ctx.player, ctx.terrain);
        if (res.isHit) {
            ctx.addBlood(ctx.player.x, ctx.player.y);
            ctx.post(`🩸 ${boss.name} strikes you for ${res.damage} dmg! (${ctx.player.hp}/${ctx.player.maxHp} HP)`, 'msg-miss');
            return ctx.player.hp <= 0;
        }
        ctx.post(`🛡️ You evade ${boss.name}'s blow.`);
        return false;
    }
    const step = ctx.stepTowards(boss);
    if (step) { boss.x = step.x; boss.y = step.y; }
    return false;
}
