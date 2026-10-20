// Applies equipment powers (see data/Powers.js) at combat / turn triggers.

import { POWER_DEFS } from '../data/Powers.js';
import { EffectSystem } from './Effects.js';

export function collectPowers(player) {
    const out = [];
    for (const item of player.getEquippedItems()) {
        for (const p of item.powers || []) {
            if (POWER_DEFS[p.id]) out.push({ ...p, def: POWER_DEFS[p.id], source: item.name });
        }
    }
    return out;
}

// Fires every equipped power for `trigger`. ctx: { monster, damage, attacker }.
// Returns short text fragments describing what procced (for the message bar).
export function triggerPowers(player, trigger, ctx, prng) {
    const texts = [];
    for (const p of collectPowers(player)) {
        if (p.def.trigger !== trigger) continue;
        const chance = p.chance ?? p.def.defaultChance ?? 1;
        if (chance < 1 && !prng.chance(chance)) continue;

        switch (p.def.kind) {
            case 'status': {
                const m = ctx.monster;
                if (m && m.alive !== false && m.hp > 0) {
                    EffectSystem.applyStatus(m, p.def.status, p.def.duration, 1, p.source);
                    texts.push(`${p.def.icon} ${p.def.status}`);
                }
                break;
            }
            case 'lifesteal': {
                const heal = Math.max(1, Math.round((ctx.damage || 0) * (p.value ?? p.def.fraction)));
                const before = player.hp;
                player.hp = Math.min(player.maxHp, player.hp + heal);
                if (player.hp > before) texts.push(`${p.def.icon} +${player.hp - before} HP`);
                break;
            }
            case 'heal': {
                const before = player.hp;
                player.hp = Math.min(player.maxHp, player.hp + (p.value ?? p.def.value));
                if (player.hp > before) texts.push(`${p.def.icon} +${player.hp - before} HP`);
                break;
            }
            case 'thorns': {
                const m = ctx.attacker;
                if (m && m.hp > 0) {
                    const dmg = p.value ?? p.def.value;
                    m.hp = Math.max(0, m.hp - dmg);
                    if (m.hp <= 0) { m.alive = false; ctx.reflectKill = true; }
                    texts.push(`${p.def.icon} ${dmg} reflected`);
                }
                break;
            }
            case 'selfStatus':
                EffectSystem.applyStatus(player, p.def.status, p.def.duration, 1, p.source);
                texts.push(`${p.def.icon} ${p.def.status}`);
                break;
            default:
                break;
        }
    }
    return texts;
}

// Passive helpers
export function senseRadius(player, kind) {
    let best = 0;
    for (const p of collectPowers(player)) {
        if (p.def.kind === 'sense' && p.def.sense === kind) best = Math.max(best, p.value ?? p.def.value ?? 3);
    }
    return best;
}

// Damage multiplier for a hazard source (zone id or status id): 0.5 per matching ward, never below 0.25
export function wardMultiplier(player, zoneIdOrStatus) {
    let mult = 1;
    for (const p of collectPowers(player)) {
        if (p.def.kind !== 'ward') continue;
        if (p.def.zones.includes(zoneIdOrStatus) || p.def.statuses.includes(zoneIdOrStatus)) mult *= 0.5;
    }
    return Math.max(0.25, mult);
}
