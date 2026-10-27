// d20 Combat Engine with Surprise Advantage, Distance Ranged Attacks, Cover Bonuses, AoE, and Status Effects

import { PERK } from '../data/ClassPerks.js';
import { damageTypeOf, affinityMultiplier, isBloodless, RIDERS, DAMAGE_TYPES } from '../data/DamageTypes.js';
import { EffectSystem } from './Effects.js';
import { triggerPowers } from './Powers.js';

// Monster damage: diceCount x d(dice) + bonusDmg (single die for ordinary monsters)
export function rollMonsterDamage(prng, monster) {
    const count = monster.diceCount || 1;
    let total = monster.bonusDmg || 0;
    for (let i = 0; i < count; i++) total += prng.nextInt(1, monster.dice || 4);
    return Math.max(1, Math.round(total * (monster.enrageMult || 1)));
}

export class CombatSystem {
    // Resolves player attack on monster with surprise advantage, tactical cover, and on-hit status effects
    static resolvePlayerAttack(prng, player, monster, isSurpriseAttack = false, terrain = null, attackSource = null) {
        const weapon = attackSource || player.weapon || { name: 'Fists', dice: 3, diceCount: 1, delivery: 'ADJACENT' };
        const isRanged = weapon.delivery === 'RANGED' || weapon.delivery === 'AOE';

        let roll1 = prng.nextInt(1, 20);
        let roll2 = prng.nextInt(1, 20);
        let d20 = isSurpriseAttack ? Math.max(roll1, roll2) : roll1;

        // Buffs & Status modifiers
        let bonusAttack = 0;
        if (player.activeBuffs) {
            bonusAttack = player.activeBuffs.filter(b => b.stat === 'attack').reduce((sum, b) => sum + (b.value || 0), 0);
        }
        const playerStatusMods = EffectSystem.getStatusModifiers(player);
        bonusAttack += playerStatusMods.attackMod;
        bonusAttack += (player.passiveMods?.attack || 0); // Feats & masteries

        const bab = Math.max(1, Math.floor(player.level / 2) + 1);
        const statMod = isRanged ? player.dexMod : Math.max(player.strMod, player.dexMod);
        const attackTotal = d20 + statMod + bab + bonusAttack;

        // Tactical cover against ranged attacks
        let coverBonus = 0;
        if (isRanged && terrain) {
            const cover = EffectSystem.calculateTacticalCover(monster.x, monster.y, player.x, player.y, terrain);
            if (cover.hasCover && !(isSurpriseAttack && player.characterClass?.id === 'ranger')) {
                coverBonus = cover.bonusAc;
            }
        }

        // Status penalty on monster (e.g. Clumsy reduces monster AC)
        const monsterStatusMods = EffectSystem.getStatusModifiers(monster);
        const effectiveMonsterAC = (isSurpriseAttack ? 10 : monster.ac) + coverBonus + monsterStatusMods.acMod;
        // Ranger Focus: an unaware foe, 4+ tiles away, is never missed
        const focus = isSurpriseAttack && isRanged && player.characterClass?.id === 'ranger' && Math.hypot(player.x - monster.x, player.y - monster.y) >= PERK.rangerFocusMinDist;
        const isHit = focus || attackTotal >= effectiveMonsterAC;

        let damage = 0;
        let backstab = false;
        let damageType = damageTypeOf(weapon);
        let affinityTag = '';
        let riderStatus = null;
        let featBonusDmg = 0;
        let appliedStatus = null;
        let procs = [];

        if (isHit) {
            // Check for Power Strike or damage buffs
            if (player.activeBuffs) {
                const pStrikeIdx = player.activeBuffs.findIndex(b => b.id === 'power_strike');
                if (pStrikeIdx !== -1) {
                    featBonusDmg = prng.nextInt(2, 12); // +2d6
                    player.activeBuffs.splice(pStrikeIdx, 1);
                }
            }

            const dice = weapon.dice || 6;
            const diceCount = weapon.diceCount || 1;
            let rollDmg = 0;
            for (let d = 0; d < diceCount; d++) {
                rollDmg += prng.nextInt(1, dice);
            }

            const holyBonus = playerStatusMods.bonusDmg; // Blessed buff bonus
            let skillBonusDmg = 0;
            if (player.skills) {
                if (!isRanged) skillBonusDmg += (player.skills.athletics || 0); // Athletics: +1 Melee Strike Dmg
                if (weapon.damageType === 'ARCANE' || weapon.damageType === 'COLD' || weapon.damageType === 'FIRE' || weapon.damageType === 'HOLY') {
                    skillBonusDmg += (player.skills.arcana || 0) * 2; // Arcana: +2 Magic Dmg
                }
            }
            damage = Math.max(1, rollDmg + statMod + featBonusDmg + holyBonus + (player.passiveMods?.dmg || 0) + (weapon.bonusFlat || 0) + skillBonusDmg);
            if (player.characterClass?.id === 'cleric' && monster.undead) damage += PERK.clericUndeadBonus; // Sanctify
            // A thief striking an unaware foe from the shadows deals double damage
            if (isSurpriseAttack && player.characterClass?.id === 'thief') { damage = Math.round(damage * 2); backstab = true; }
            // Damage type: what the weapon IS decides how the foe takes it (resist / weak / immune), and may add a rider
            damageType = damageTypeOf(weapon);
            const aff = affinityMultiplier(monster, damageType);
            affinityTag = aff.tag;
            if (aff.mult !== 1) damage = aff.mult === 0 ? 0 : Math.max(1, Math.round(damage * aff.mult));
            monster.hp = Math.max(0, monster.hp - damage);
            if (monster.hp <= 0) monster.alive = false;
            const rider = RIDERS[damageType];
            if (rider && monster.alive && aff.mult > 0 && !(rider.needsFlesh && isBloodless(monster))) {
                const chance = rider.chance + (aff.tag === 'weak' ? (rider.weakBonus || 0.1) : 0) - (aff.tag === 'resisted' ? 0.1 : 0);
                if (prng.chance(Math.max(0, chance))) {
                    EffectSystem.applyStatus(monster, rider.status, rider.duration, 1, DAMAGE_TYPES[damageType].name);
                    riderStatus = rider.status;
                }
            }

            // Apply weapon or ability status effect on hit
            const statusToApply = weapon.statusOnHit || weapon.statusEffect?.type;
            const statusDuration = weapon.statusDuration || weapon.statusEffect?.duration || 3;
            if (statusToApply && monster.alive) {
                EffectSystem.applyStatus(monster, statusToApply, statusDuration, 1, weapon.name);
                appliedStatus = statusToApply;
            }

            // Equipment powers: on-hit procs (ignite, lifesteal, ...)
            procs = triggerPowers(player, 'onHit', { monster, damage }, prng);
        }

        // Monster retaliation only occurs if adjacent, alive, and not stunned
        let monsterCounter = null;
        const dist = Math.hypot(player.x - monster.x, player.y - monster.y);
        const monsterIsStunned = monsterStatusMods.isStunned;

        if (monster.alive && dist <= 1.5 && !monsterIsStunned) {
            const mRoll = prng.nextInt(1, 20);
            const mTotal = mRoll + 1 + monsterStatusMods.attackMod;
            const mHit = mTotal >= player.ac;
            let mDmg = 0;
            if (mHit) {
                mDmg = rollMonsterDamage(prng, monster);
                player.hp = Math.max(0, player.hp - mDmg);
            }
            monsterCounter = { roll: mTotal, isHit: mHit, damage: mDmg };
        }

        return {
            isHit,
            d20,
            roll1,
            roll2,
            isSurprise: isSurpriseAttack,
            backstab,
            focus,
            damageType,
            affinityTag,
            riderStatus,
            hasCover: coverBonus > 0,
            attackTotal,
            targetAC: effectiveMonsterAC,
            damage,
            appliedStatus,
            procs,
            monsterDied: !monster.alive,
            monsterCounter
        };
    }

    // Resolves monster turn attack against player
    static resolveMonsterAttack(prng, monster, player, terrain = null) {
        const monsterStatusMods = EffectSystem.getStatusModifiers(monster);
        if (monsterStatusMods.isStunned) {
            return { skipped: true, reason: 'Stunned' };
        }
        if (monsterStatusMods.isTerrified) {
            return { skipped: true, reason: 'Terrified' };
        }

        let coverBonus = 0;
        if (terrain) {
            const cover = EffectSystem.calculateTacticalCover(player.x, player.y, monster.x, monster.y, terrain);
            if (cover.hasCover) {
                coverBonus = cover.bonusAc;
            }
        }

        const effectivePlayerAc = player.ac + coverBonus;
        const mRoll = prng.nextInt(1, 20) + 1 + (monster.attackBonus || 0) + monsterStatusMods.attackMod;
        const isHit = mRoll >= effectivePlayerAc;

        let damage = 0;
        let appliedStatus = null;
        let reflectKill = false;
        const reflectTexts = [];

        if (isHit) {
            damage = rollMonsterDamage(prng, monster);
            player.hp = Math.max(0, player.hp - damage);

            // Equipment powers: when-struck procs (thorns, stoneguard...)
            const dmgCtx = { attacker: monster, reflectKill: false };
            const hurtProcs = triggerPowers(player, 'onDamaged', dmgCtx, prng);
            if (dmgCtx.reflectKill) reflectKill = true;
            if (hurtProcs.length) appliedStatus = appliedStatus || null;
            reflectTexts.push(...hurtProcs);

            // Elite affixes: on-hit status and life drain
            if (monster.onHitStatus && prng.chance(monster.onHitStatus.chance ?? 0.5)) {
                EffectSystem.applyStatus(player, monster.onHitStatus.status, monster.onHitStatus.duration || 3, 1, monster.name);
                appliedStatus = monster.onHitStatus.status;
            }
            if (monster.lifesteal && monster.hp > 0) {
                monster.hp = Math.min(monster.maxHp, monster.hp + Math.max(1, Math.round(damage * monster.lifesteal)));
            }

            // Monster status on hit based on type
            const mNameLower = monster.name.toLowerCase();
            if (mNameLower.includes('spider') || mNameLower.includes('viper') || mNameLower.includes('snake')) {
                if (prng.chance(0.5)) {
                    EffectSystem.applyStatus(player, 'POISONED', 4, 1, monster.name);
                    appliedStatus = 'POISONED';
                }
            } else if (mNameLower.includes('wolf') || mNameLower.includes('beast') || mNameLower.includes('bat')) {
                if (prng.chance(monster.level <= 2 ? 0.2 : 0.4)) { // early floors: bites bleed less often and for less time
                    EffectSystem.applyStatus(player, 'BLEEDING', monster.level <= 2 ? 2 : 3, 1, monster.name);
                    appliedStatus = 'BLEEDING';
                }
            }
        }

        return {
            isHit,
            roll: mRoll,
            targetAC: effectivePlayerAc,
            hasCover: coverBonus > 0,
            damage,
            appliedStatus,
            reflectKill,
            procs: reflectTexts
        };
    }

    // Resolves an Area of Effect (AoE) blast at target coordinates
    static resolveAoE(prng, caster, targetX, targetY, actionDef, floorData, callbacks = {}) {
        const radius = actionDef.radius || 1;
        const aoeTiles = EffectSystem.getAoETiles(targetX, targetY, radius);
        const { monsters, terrain } = floorData;
        const hits = [];
        let totalDamage = 0;
        let totalHeal = 0;

        // 1. If positive AoE (e.g. Holy Nova or Healing Word)
        if (actionDef.isPositive) {
            const inRadius = aoeTiles.some(t => t.x === caster.x && t.y === caster.y);
            if (inRadius) {
                const healDice = actionDef.healDice || 8;
                const healCount = actionDef.healDiceCount || 2;
                let healAmt = 0;
                for (let d = 0; d < healCount; d++) healAmt += prng.nextInt(1, healDice);
                healAmt += (caster.wisMod || 0);

                const prevHp = caster.hp;
                caster.hp = Math.min(caster.maxHp, caster.hp + healAmt);
                totalHeal = caster.hp - prevHp;
            }
        }

        // 2. Affect all monsters in the blast radius
        for (const tile of aoeTiles) {
            const m = monsters.find(mon => mon.alive && mon.x === tile.x && mon.y === tile.y);
            if (m) {
                const dice = actionDef.dice || 6;
                const diceCount = actionDef.diceCount || 2;
                let dmg = 0;
                for (let d = 0; d < diceCount; d++) dmg += prng.nextInt(1, dice);

                const statMod = caster.intMod || caster.wisMod || caster.strMod || 0;
                let arcanaBonus = 0;
                if (caster.skills && (actionDef.damageType === 'ARCANE' || actionDef.damageType === 'FIRE' || actionDef.damageType === 'COLD' || actionDef.damageType === 'SONIC' || actionDef.damageType === 'HOLY')) {
                    arcanaBonus = (caster.skills.arcana || 0) * 2;
                }
                dmg = Math.max(1, dmg + statMod + (actionDef.bonusFlat || 0) + arcanaBonus);

                const aoeType = damageTypeOf(actionDef);
                const affA = affinityMultiplier(m, aoeType);
                if (affA.mult !== 1) dmg = affA.mult === 0 ? 0 : Math.max(1, Math.round(dmg * affA.mult));
                m.hp = Math.max(0, m.hp - dmg);
                totalDamage += dmg;
                const died = (m.hp <= 0);
                if (died) m.alive = false;

                let status = null;
                const statusType = actionDef.statusEffect?.type || actionDef.statusOnHit;
                const duration = actionDef.statusEffect?.duration || actionDef.statusDuration || 3;
                if (statusType && m.alive) {
                    EffectSystem.applyStatus(m, statusType, duration, 1, actionDef.name);
                    status = statusType;
                }

                hits.push({ monster: m, damage: dmg, died, status, damageType: aoeType, affinityTag: affA.tag });

                if (callbacks.onBlood) callbacks.onBlood(m.x, m.y);
            }
        }

        // 3. Create lingering ground hazard zone if action defines one (e.g. Fireball leaves FIRE field)
        const zoneType = actionDef.zoneEffect?.type || actionDef.zoneType;
        if (zoneType) {
            const duration = actionDef.zoneEffect?.duration || actionDef.zoneDuration || 4;
            EffectSystem.addAoEZones(floorData, targetX, targetY, radius, zoneType, duration, 1, 'player');
        }

        return { hits, totalDamage, totalHeal, tilesAffected: aoeTiles.length };
    }
}
