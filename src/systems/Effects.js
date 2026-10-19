// Unified Combat Delivery, Status Effects, Hazard Zones & Terrain Mechanics
// Supports Melee, Ranged Projectiles, AoE Blasts, Lingering Hazard Zones, and Statuses

import { MAP_WIDTH, MAP_HEIGHT, TILES } from '../map/Dungeon.js';

export const STATUS_TYPES = {
    BLEEDING: {
        id: 'BLEEDING',
        name: 'Bleeding',
        icon: '🩸',
        isHarmful: true,
        tickMin: 1,
        tickMax: 3,
        damageType: 'PHYSICAL',
        desc: 'Losing blood steadily each turn.'
    },
    POISONED: {
        id: 'POISONED',
        name: 'Poisoned',
        icon: '🧪',
        isHarmful: true,
        tickMin: 1,
        tickMax: 4,
        damageType: 'POISON',
        desc: 'Deadly toxins bypass armor and drain vitality.'
    },
    BURNING: {
        id: 'BURNING',
        name: 'Burning',
        icon: '🔥',
        isHarmful: true,
        tickMin: 2,
        tickMax: 5,
        damageType: 'FIRE',
        desc: 'Engulfed in raging flames.'
    },
    CLUMSY: {
        id: 'CLUMSY',
        name: 'Clumsy',
        icon: '💫',
        isHarmful: true,
        dexPenalty: 4,
        acPenalty: 2,
        attackPenalty: 2,
        desc: 'Entangled or staggered: -4 DEX, -2 AC, -2 Attack rolls.'
    },
    STUNNED: {
        id: 'STUNNED',
        name: 'Stunned',
        icon: '⚡',
        isHarmful: true,
        skipsTurn: true,
        desc: 'Reeling from an impact: cannot take actions this turn.'
    },
    BLESSED: {
        id: 'BLESSED',
        name: 'Blessed',
        icon: '✨',
        isHarmful: false,
        attackBonus: 2,
        acBonus: 2,
        damageBonus: 3,
        desc: 'Sanctified with holy light: +2 Attack, +2 AC, +1d4 Holy damage.'
    },
    REGEN: {
        id: 'REGEN',
        name: 'Regeneration',
        icon: '💖',
        isHarmful: false,
        tickHeal: [2, 4],
        desc: 'Rapid cellular rejuvenation restores HP every turn.'
    },
    TERRIFIED: {
        id: 'TERRIFIED',
        name: 'Terrified',
        icon: '😱',
        isHarmful: true,
        isFear: true,
        attackPenalty: 4,
        acPenalty: 2,
        desc: 'Overwhelmed with sheer dread! Panics and flees away from the hero, unable to attack.'
    },
    HALLUCINATING: {
        id: 'HALLUCINATING',
        name: 'Hallucinating',
        icon: '🌀',
        isHarmful: false,
        isHallucination: true,
        desc: 'Perception warped by psychedelic fungal spores. Distorts senses, reveals phantom visions.'
    },
    ENERGY: {
        id: 'ENERGY',
        name: 'Energy Rush',
        icon: '⚡',
        isHarmful: false,
        dexBonus: 3,
        attackBonus: 2,
        desc: 'Surging with mushroom adrenaline: +3 DEX, +2 Attack rolls.'
    },
    STONESKIN: {
        id: 'STONESKIN',
        name: 'Stoneskin',
        icon: '🪨',
        isHarmful: false,
        acBonus: 3,
        desc: 'Flesh hardened like granite: +3 Armor Class.'
    },
    STARVING: {
        id: 'STARVING',
        name: 'Starving',
        icon: '🥀',
        isHarmful: true,
        attackPenalty: 2,
        desc: 'Weakened by extreme hunger: -2 Attack, passive HP recovery halted.'
    },
    WELL_FED: {
        id: 'WELL_FED',
        name: 'Well Fed',
        icon: '🍖',
        isHarmful: false,
        acBonus: 1,
        attackBonus: 1,
        desc: 'Nourished by hearty rations: +1 AC, +1 Attack, enhanced vigor.'
    }
};

export const ZONE_TYPES = {
    FIRE: {
        id: 'FIRE',
        name: 'Fire Field',
        icon: '🔥',
        color: 'rgba(255, 90, 20, 0.45)',
        borderColor: '#ff4400',
        minDmg: 2,
        maxDmg: 6,
        inflictsStatus: 'BURNING',
        statusDuration: 3,
        ignitesFoliage: true,
        desc: 'Roaring flames that burn anything within and ignite surrounding dry brush.'
    },
    POISON_GAS: {
        id: 'POISON_GAS',
        name: 'Poison Gas Cloud',
        icon: '☁️',
        color: 'rgba(70, 200, 50, 0.4)',
        borderColor: '#55dd33',
        minDmg: 1,
        maxDmg: 4,
        inflictsStatus: 'POISONED',
        statusDuration: 4,
        desc: 'Choking toxic cloud that inflicts ongoing poison.'
    },
    CONSECRATION: {
        id: 'CONSECRATION',
        name: 'Consecrated Ground',
        icon: '✨',
        color: 'rgba(255, 220, 60, 0.35)',
        borderColor: '#ffd700',
        isPositive: true,
        minHeal: 2,
        maxHeal: 5,
        minDmgUndead: 3,
        maxDmgUndead: 7,
        desc: 'Sacred aura: continually heals the hero while smiting unholy monsters.'
    },
    ACID_POOL: {
        id: 'ACID_POOL',
        name: 'Acid Pool',
        icon: '🧪',
        color: 'rgba(160, 240, 40, 0.4)',
        borderColor: '#99ee00',
        minDmg: 1,
        maxDmg: 4,
        inflictsStatus: 'CLUMSY',
        statusDuration: 3,
        desc: 'Corrosive chemical puddle that burns flesh and melts footing.'
    },
    WEB_ZONE: {
        id: 'WEB_ZONE',
        name: 'Spider Web Trap',
        icon: '🕸️',
        color: 'rgba(220, 220, 230, 0.35)',
        borderColor: '#ffffff',
        inflictsStatus: 'CLUMSY',
        statusDuration: 3,
        desc: 'Sticky silk threads that entangle and slow movement.'
    }
};

export const DELIVERY_TYPES = {
    ADJACENT: 'ADJACENT',
    RANGED: 'RANGED',
    AOE: 'AOE',
    ZONE: 'ZONE',
    SELF: 'SELF'
};

export class EffectSystem {
    // ==========================================
    // 1. STATUS EFFECTS ENGINE
    // ==========================================

    static applyStatus(entity, statusId, duration = 3, power = 1, sourceName = '') {
        if (!entity || !STATUS_TYPES[statusId]) return null;
        if (!entity.statuses) entity.statuses = [];

        // Dwarven 3pc Set Bonus: Stoneblood Resilience (Immunity to Stun & Bleed)
        if (entity.setBonuses?.stoneblood && (statusId === 'STUNNED' || statusId === 'BLEEDING')) {
            return null;
        }

        const def = STATUS_TYPES[statusId];
        const existing = entity.statuses.find(s => s.id === statusId);

        if (existing) {
            existing.duration = Math.max(existing.duration, duration);
            existing.power = Math.max(existing.power, power);
            return { refreshed: true, status: existing };
        } else {
            const newStatus = {
                id: statusId,
                name: def.name,
                icon: def.icon,
                duration,
                power,
                source: sourceName
            };
            entity.statuses.push(newStatus);
            return { refreshed: false, status: newStatus };
        }
    }

    static removeStatus(entity, statusId) {
        if (!entity || !entity.statuses) return;
        entity.statuses = entity.statuses.filter(s => s.id !== statusId);
    }

    static hasStatus(entity, statusId) {
        return !!(entity?.statuses && entity.statuses.some(s => s.id === statusId));
    }

    static getStatusModifiers(entity) {
        let dexMod = 0;
        let acMod = 0;
        let attackMod = 0;
        let bonusDmg = 0;
        let isStunned = false;
        let isTerrified = false;
        let isHallucinating = false;

        if (!entity || !entity.statuses) {
            return { dexMod, acMod, attackMod, bonusDmg, isStunned, isTerrified, isHallucinating };
        }

        for (const s of entity.statuses) {
            const def = STATUS_TYPES[s.id];
            if (!def) continue;

            if (def.dexPenalty) dexMod -= def.dexPenalty;
            if (def.acPenalty) acMod -= def.acPenalty;
            if (def.attackPenalty) attackMod -= def.attackPenalty;
            if (def.skipsTurn) isStunned = true;
            if (def.isFear) isTerrified = true;
            if (def.isHallucination) isHallucinating = true;

            if (def.dexBonus) dexMod += def.dexBonus;
            if (def.acBonus) acMod += def.acBonus;
            if (def.attackBonus) attackMod += def.attackBonus;
            if (def.damageBonus) bonusDmg += def.damageBonus;
        }

        return { dexMod, acMod, attackMod, bonusDmg, isStunned, isTerrified, isHallucinating };
    }

    // Tick entity statuses (called every turn for player and living monsters)
    static tickEntityStatuses(entity, isPlayer, prng, callbacks = {}) {
        if (!entity || !entity.statuses || entity.statuses.length === 0) return [];
        const events = [];

        for (let i = entity.statuses.length - 1; i >= 0; i--) {
            const s = entity.statuses[i];
            const def = STATUS_TYPES[s.id];

            if (def) {
                // Harmful DoTs
                if (def.tickMin && def.tickMax) {
                    const dmg = prng.nextInt(def.tickMin, def.tickMax) * (s.power || 1);
                    entity.hp = Math.max(0, entity.hp - dmg);
                    events.push({
                        type: 'damage',
                        status: s.name,
                        icon: s.icon,
                        damage: dmg,
                        damageType: def.damageType
                    });

                    if (callbacks.onDamage) {
                        callbacks.onDamage(entity, isPlayer, s, dmg, def.damageType);
                    }

                    if (s.id === 'BLEEDING' && callbacks.onBlood) {
                        callbacks.onBlood(entity.x, entity.y);
                    }
                }

                // Positive Regeneration
                if (def.tickHeal) {
                    const heal = prng.nextInt(def.tickHeal[0], def.tickHeal[1]) * (s.power || 1);
                    const prevHp = entity.hp;
                    entity.hp = Math.min(entity.maxHp, entity.hp + heal);
                    const actualHeal = entity.hp - prevHp;
                    events.push({
                        type: 'heal',
                        status: s.name,
                        icon: s.icon,
                        heal: actualHeal
                    });

                    if (callbacks.onHeal) {
                        callbacks.onHeal(entity, isPlayer, s, actualHeal);
                    }
                }
            }

            s.duration--;
            if (s.duration <= 0) {
                events.push({ type: 'expired', status: s.name, icon: s.icon });
                entity.statuses.splice(i, 1);
            }
        }

        return events;
    }

    // ==========================================
    // 2. LINGERING HAZARD ZONES ENGINE
    // ==========================================

    static addZone(floorData, x, y, zoneType, duration = 4, intensity = 1, createdBy = 'player') {
        if (!floorData.hazardZones) floorData.hazardZones = [];
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return null;

        const def = ZONE_TYPES[zoneType];
        if (!def) return null;

        const existing = floorData.hazardZones.find(z => z.x === x && z.y === y && z.type === zoneType);
        if (existing) {
            existing.duration = Math.max(existing.duration, duration);
            existing.intensity = Math.max(existing.intensity, intensity);
            return existing;
        }

        const newZone = {
            x,
            y,
            type: zoneType,
            duration,
            intensity,
            createdBy
        };
        floorData.hazardZones.push(newZone);
        return newZone;
    }

    static addAoEZones(floorData, cx, cy, radius, zoneType, duration = 4, intensity = 1, createdBy = 'player') {
        const added = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.hypot(dx, dy) <= radius + 0.5) {
                    const tx = cx + dx;
                    const ty = cy + dy;
                    if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                        const tile = floorData.terrain[ty * MAP_WIDTH + tx];
                        // Don't spawn ground zones inside solid stone walls
                        if (tile !== TILES.WALL && tile !== TILES.PILLAR) {
                            const z = this.addZone(floorData, tx, ty, zoneType, duration, intensity, createdBy);
                            if (z) added.push(z);
                        }
                    }
                }
            }
        }
        return added;
    }

    // Ticks all floor hazard zones, checks collisions, spreads fire to foliage, decays duration
    static tickFloorZones(floorData, player, prng, callbacks = {}) {
        if (!floorData.hazardZones || floorData.hazardZones.length === 0) return [];
        const logs = [];
        const { terrain, monsters } = floorData;
        const newZonesToAdd = [];

        for (let i = floorData.hazardZones.length - 1; i >= 0; i--) {
            const z = floorData.hazardZones[i];
            const def = ZONE_TYPES[z.type];
            if (!def) continue;

            // 1. Affect Player if standing in zone
            if (player.alive && player.x === z.x && player.y === z.y) {
                if (def.isPositive) {
                    const heal = prng.nextInt(def.minHeal, def.maxHeal);
                    const prevHp = player.hp;
                    player.hp = Math.min(player.maxHp, player.hp + heal);
                    logs.push(`✨ Holy Consecration restored ${player.hp - prevHp} HP!`);
                    if (callbacks.onPlayerHeal) callbacks.onPlayerHeal(player.hp - prevHp);
                } else if (def.minDmg && def.maxDmg) {
                    const dmg = prng.nextInt(def.minDmg, def.maxDmg);
                    player.hp = Math.max(0, player.hp - dmg);
                    logs.push(`⚠️ Stepped into ${def.name} for ${dmg} damage!`);
                    if (callbacks.onPlayerDamage) callbacks.onPlayerDamage(dmg, def.name);
                    if (def.inflictsStatus) {
                        this.applyStatus(player, def.inflictsStatus, def.statusDuration, 1, def.name);
                    }
                }
            }

            // 2. Affect Monsters occupying zone
            for (const m of monsters) {
                if (!m.alive || m.x !== z.x || m.y !== z.y) continue;

                if (def.isPositive && def.minDmgUndead) {
                    const holyDmg = prng.nextInt(def.minDmgUndead, def.maxDmgUndead);
                    m.hp = Math.max(0, m.hp - holyDmg);
                    logs.push(`☀️ Holy ground burned ${m.name} for ${holyDmg} radiant damage!`);
                    if (callbacks.onMonsterDamage) callbacks.onMonsterDamage(m, holyDmg, 'HOLY');
                } else if (def.minDmg && def.maxDmg) {
                    const dmg = prng.nextInt(def.minDmg, def.maxDmg);
                    m.hp = Math.max(0, m.hp - dmg);
                    logs.push(`${def.icon} ${m.name} caught in ${def.name}, taking ${dmg} damage!`);
                    if (callbacks.onMonsterDamage) callbacks.onMonsterDamage(m, dmg, def.id);
                    if (def.inflictsStatus) {
                        this.applyStatus(m, def.inflictsStatus, def.statusDuration, 1, def.name);
                    }
                }
            }

            // 3. Fire spreading to adjacent flammable Foliage
            if (def.ignitesFoliage) {
                const adjacents = [
                    { x: z.x, y: z.y - 1 },
                    { x: z.x, y: z.y + 1 },
                    { x: z.x - 1, y: z.y },
                    { x: z.x + 1, y: z.y }
                ];
                for (const adj of adjacents) {
                    if (adj.x >= 0 && adj.x < MAP_WIDTH && adj.y >= 0 && adj.y < MAP_HEIGHT) {
                        const idx = adj.y * MAP_WIDTH + adj.x;
                        if (terrain[idx] === TILES.FOLIAGE) {
                            // Turn foliage into floor and ignite into fire zone
                            terrain[idx] = TILES.FLOOR;
                            newZonesToAdd.push({ x: adj.x, y: adj.y, type: 'FIRE', duration: 4, intensity: 1 });
                            logs.push(`🔥 Foliage at (${adj.x}, ${adj.y}) ignited into raging fire!`);
                        }
                    }
                }
            }

            // 4. Decrement duration
            z.duration--;
            if (z.duration <= 0) {
                floorData.hazardZones.splice(i, 1);
            }
        }

        // Add newly ignited zones
        for (const nz of newZonesToAdd) {
            this.addZone(floorData, nz.x, nz.y, nz.type, nz.duration, nz.intensity, 'fire_spread');
        }

        return logs;
    }

    // ==========================================
    // 3. LINE OF SIGHT & BRESENHAM RAYCASTING
    // ==========================================

    static bresenhamRaycast(x0, y0, x1, y1, terrain) {
        const points = [];
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let currX = x0;
        let currY = y0;

        while (true) {
            points.push({ x: currX, y: currY });
            if (currX === x1 && currY === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                currX += sx;
            }
            if (e2 < dx) {
                err += dx;
                currY += sy;
            }
        }

        let clear = true;
        let hitPoint = null;

        // Skip starting origin tile (caster's position)
        for (let i = 1; i < points.length; i++) {
            const pt = points[i];
            const tile = terrain[pt.y * MAP_WIDTH + pt.x];

            // Obstacles that block projectile trajectory
            if (tile === TILES.WALL || tile === TILES.PILLAR || tile === TILES.DOOR_CLOSED || tile === TILES.LOCKED_DOOR || tile === TILES.RUBBLE) {
                clear = false;
                hitPoint = pt;
                // Truncate path to collision point
                return {
                    clear: false,
                    path: points.slice(0, i + 1),
                    blockedAt: hitPoint,
                    tile
                };
            }
        }

        return {
            clear: true,
            path: points,
            blockedAt: null
        };
    }

    // Tactical Pillar Cover Calculation (+2 AC if adjacent to a pillar or column)
    static calculateTacticalCover(targetX, targetY, sourceX, sourceY, terrain) {
        const adjacentOffsets = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
        ];

        for (const off of adjacentOffsets) {
            const px = targetX + off.dx;
            const py = targetY + off.dy;
            if (px >= 0 && px < MAP_WIDTH && py >= 0 && py < MAP_HEIGHT) {
                const t = terrain[py * MAP_WIDTH + px];
                if (t === TILES.PILLAR) {
                    return { hasCover: true, bonusAc: 2, pillarPos: { x: px, y: py } };
                }
            }
        }
        return { hasCover: false, bonusAc: 0 };
    }

    // ==========================================
    // 4. AREA OF EFFECT (AOE) CALCULATION
    // ==========================================

    static getAoETiles(centerX, centerY, radius = 1) {
        const tiles = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.hypot(dx, dy) <= radius + 0.5) {
                    const tx = centerX + dx;
                    const ty = centerY + dy;
                    if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                        tiles.push({ x: tx, y: ty, dist: Math.hypot(dx, dy) });
                    }
                }
            }
        }
        return tiles;
    }
}

