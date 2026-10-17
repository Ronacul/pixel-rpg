// d20 Combat Engine with Surprise Advantage & DEX Bonus Denial

export class CombatSystem {
    // Resolves player attack on monster with potential surprise advantage
    static resolvePlayerAttack(prng, player, monster, isSurpriseAttack = false) {
        let roll1 = prng.nextInt(1, 20);
        let roll2 = prng.nextInt(1, 20);
        let d20 = isSurpriseAttack ? Math.max(roll1, roll2) : roll1;

        const bab = 1;
        const attackTotal = d20 + player.dexMod + bab;

        // On surprise, monster is denied DEX bonus to AC
        const effectiveMonsterAC = isSurpriseAttack ? 10 : monster.ac;
        const isHit = attackTotal >= effectiveMonsterAC;

        let damage = 0;
        if (isHit) {
            const weaponDice = player.weapon?.dice || 6;
            const weaponDmg = prng.nextInt(1, weaponDice);
            damage = Math.max(1, weaponDmg + player.strMod);
            monster.hp = Math.max(0, monster.hp - damage);
            if (monster.hp <= 0) monster.alive = false;
        }

        // Monster retaliation if alive
        let monsterCounter = null;
        if (monster.alive) {
            const mRoll = prng.nextInt(1, 20);
            const mTotal = mRoll + 1;
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
            attackTotal,
            targetAC: effectiveMonsterAC,
            damage,
            monsterDied: !monster.alive,
            monsterCounter
        };
    }
}

