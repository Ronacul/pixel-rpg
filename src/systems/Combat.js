// d20 Combat Engine with Surprise Advantage, Distance Ranged Attacks, Cover Bonuses, AoE, and Status Effects

import { EffectSystem } from './Effects.js';

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

        const bab = Math.max(1, Math.floor(player.level / 2) + 1);
        const statMod = isRanged ? player.dexMod : Math.max(player.strMod, player.dexMod);
        const attackTotal = d20 + statMod + bab + bonusAttack;

        // Tactical cover against ranged attacks
        let coverBonus = 0;
        if (isRanged && terrain) {
            const cover = EffectSystem.calculateTacticalCover(monster.x, monster.y, player.x, player.y, terrain);
            if (cover.hasCover) {
                coverBonus = cover.bonusAc;
            }
        }

        // Status penalty on monster (e.g. Clumsy reduces monster AC)
        const monsterStatusMods = EffectSystem.getStatusModifiers(monster);
        const effectiveMonsterAC = (isSurpriseAttack ? 10 : monster.ac) + coverBonus + monsterStatusMods.acMod;
        const isHit = attackTotal >= effectiveMonsterAC;

        let damage = 0;
        let featBonusDmg = 0;
        let appliedStatus = null;

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
            damage = Math.max(1, rollDmg + statMod + featBonusDmg + holyBonus + (weapon.bonusFlat || 0));
            monster.hp = Math.max(0, monster.hp - damage);
            if (monster.hp <= 0) monster.alive = false;

            // Apply weapon or ability status effect on hit
            const statusToApply = weapon.statusOnHit || weapon.statusEffect?.type;
            const statusDuration = weapon.statusDuration || weapon.statusEffect?.duration || 3;
            if (statusToApply && monster.alive) {
                EffectSystem.applyStatus(monster, statusToApply, statusDuration, 1, weapon.name);
                appliedStatus = statusToApply;
            }
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
                mDmg = prng.nextInt(1, monster.dice || 4);
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
            hasCover: coverBonus > 0,
            attackTotal,
            targetAC: effectiveMonsterAC,
            damage,
            appliedStatus,
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

        let coverBonus = 0;
        if (terrain) {
            const cover = EffectSystem.calculateTacticalCover(player.x, player.y, monster.x, monster.y, terrain);
            if (cover.hasCover) {
                coverBonus = cover.bonusAc;
            }
        }

        const effectivePlayerAc = player.ac + coverBonus;
        const mRoll = prng.nextInt(1, 20) + 1 + monsterStatusMods.attackMod;
        const isHit = mRoll >= effectivePlayerAc;

        let damage = 0;
        let appliedStatus = null;

        if (isHit) {
            damage = prng.nextInt(1, monster.dice || 4);
            player.hp = Math.max(0, player.hp - damage);

            // Monster status on hit based on type
            const mNameLower = monster.name.toLowerCase();
            if (mNameLower.includes('spider') || mNameLower.includes('viper') || mNameLower.includes('snake')) {
                if (prng.chance(0.5)) {
                    EffectSystem.applyStatus(player, 'POISONED', 4, 1, monster.name);
                    appliedStatus = 'POISONED';
                }
            } else if (mNameLower.includes('wolf') || mNameLower.includes('beast') || mNameLower.includes('bat')) {
                if (prng.chance(0.4)) {
                    EffectSystem.applyStatus(player, 'BLEEDING', 3, 1, monster.name);
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
            appliedStatus
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
                dmg = Math.max(1, dmg + statMod + (actionDef.bonusFlat || 0));

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

                hits.push({ monster: m, damage: dmg, died, status });

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
