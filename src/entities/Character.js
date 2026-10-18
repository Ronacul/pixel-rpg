import { ITEM_SLOTS, calculateEquippedSetBonuses, MUSHROOM_TYPES } from '../data/Items.js';
import { CLASSES, XP_TABLE, ClassManager, isAttributeMilestone } from '../data/Classes.js';
import { EffectSystem } from '../systems/Effects.js';

export class PlayerCharacter {
    constructor(classKey = 'WARRIOR') {
        this.x = 0;
        this.y = 0;
        this.level = 1;
        this.xp = 0;
        this.bonusHp = 0;
        this.attributePoints = 0;
        this.turnCount = 0;
        this.alive = true;

        // Class Assignment
        this.characterClass = CLASSES[classKey] || CLASSES.WARRIOR;

        // Cooldowns, Active Buffs & Status Effects
        this.cooldowns = {};
        this.activeBuffs = [];
        this.statuses = [];

        // Hunger & Rations Sustenance
        this.rations = 5;
        this.hungerTurns = 0;

        // Active & Learned Feats / Talents
        this.activeFeats = ClassManager.getDefaultFeatsForClass(this.characterClass.id);
        this.learnedFeats = [...this.activeFeats];

        // Skill Specializations (Ranks earned upon level milestones)
        this.skills = {
            athletics: 0,   // +2 Max HP and +1 Melee Strike Damage per rank
            acrobatics: 0,  // +1 Dodge AC per rank
            perception: 0,  // +2 Passive Perception Radar & Trap Detection per rank
            arcana: 0,      // +2 Magic Damage & +1 Spell Range
            medicine: 0     // Accelerates passive HP regen rate
        };

        // Complete Level-by-Level Progression History
        this.progressionHistory = [
            {
                level: 1,
                hpGain: 0,
                choiceType: 'baseline',
                choiceLabel: `Class Baseline (${this.characterClass.title})`,
                unlockedAbilities: this.characterClass.abilities.filter(a => a.level === 1).map(a => a.name)
            }
        ];

        // Class-Based Baseline RPG Attributes
        this.setClassAttributes(this.characterClass.id);

        // 10 Categorized Paperdoll Equipment Slots
        this.equipment = {
            [ITEM_SLOTS.HELM]: null,
            [ITEM_SLOTS.AMULET]: null,
            [ITEM_SLOTS.ARMOR]: { name: 'Padded Vest', slot: ITEM_SLOTS.ARMOR, ac: 1, icon: '🦺', desc: '+1 AC' },
            [ITEM_SLOTS.CLOAK]: null,
            [ITEM_SLOTS.MAIN_HAND]: { name: 'Iron Blade', slot: ITEM_SLOTS.MAIN_HAND, dice: 6, str: 0, dex: 0, icon: '⚔️', desc: '1d6 Dmg' },
            [ITEM_SLOTS.OFF_HAND]: { name: 'Buckler', slot: ITEM_SLOTS.OFF_HAND, ac: 1, icon: '🛡️', desc: '+1 AC' },
            [ITEM_SLOTS.GAUNTLETS]: null,
            [ITEM_SLOTS.BOOTS]: null,
            [ITEM_SLOTS.RING_LEFT]: null,
            [ITEM_SLOTS.RING_RIGHT]: null
        };

        // 15 Backpack Storage Slots (10 Body + 15 Bag = 25 Total Slots)
        this.backpack = [];
        for (let i = 0; i < 15; i++) {
            this.backpack.push(null);
        }

        this.hp = this.maxHp;
    }

    setClassAttributes(classId) {
        const id = (classId || '').toLowerCase();
        if (id === 'mage') {
            this.baseStr = 8; this.baseDex = 12; this.baseCon = 10; this.baseInt = 16; this.baseWis = 12; this.baseCha = 10;
        } else if (id === 'cleric') {
            this.baseStr = 12; this.baseDex = 10; this.baseCon = 12; this.baseInt = 10; this.baseWis = 16; this.baseCha = 10;
        } else if (id === 'bard') {
            this.baseStr = 10; this.baseDex = 14; this.baseCon = 10; this.baseInt = 12; this.baseWis = 10; this.baseCha = 16;
        } else if (id === 'ranger') {
            this.baseStr = 10; this.baseDex = 16; this.baseCon = 12; this.baseInt = 10; this.baseWis = 12; this.baseCha = 8;
        } else {
            // warrior default
            this.baseStr = 14; this.baseDex = 12; this.baseCon = 14; this.baseInt = 8; this.baseWis = 10; this.baseCha = 10;
        }
    }

    // Dynamic Attribute Getters (Base + Equipment + Active Buffs + Set Bonuses)
    getEquippedItems() {
        return Object.values(this.equipment).filter(Boolean);
    }

    get setBonuses() {
        return calculateEquippedSetBonuses(this).totals;
    }

    get str() {
        return this.baseStr + this.getEquippedItems().reduce((sum, item) => sum + (item.str || 0), 0) + (this.setBonuses.str || 0);
    }

    get dex() {
        const statusDex = EffectSystem.getStatusModifiers(this).dexMod;
        const equipDex = this.getEquippedItems().reduce((sum, item) => sum + (item.dex || 0), 0);
        return Math.max(1, this.baseDex + equipDex + statusDex + (this.setBonuses.dex || 0));
    }

    get con() {
        return this.baseCon + this.getEquippedItems().reduce((sum, item) => sum + (item.con || 0), 0) + (this.setBonuses.con || 0);
    }

    get int() {
        const intBonus = EffectSystem.hasStatus(this, 'HALLUCINATING') ? 3 : 0;
        return this.baseInt + this.getEquippedItems().reduce((sum, item) => sum + (item.int || 0), 0) + (this.setBonuses.int || 0) + intBonus;
    }

    get wis() {
        return this.baseWis + this.getEquippedItems().reduce((sum, item) => sum + (item.wis || 0), 0) + (this.setBonuses.wis || 0);
    }

    get cha() {
        return this.baseCha + this.getEquippedItems().reduce((sum, item) => sum + (item.cha || 0), 0) + (this.setBonuses.cha || 0);
    }

    // Stat Modifiers
    get strMod() { return Math.floor((this.str - 10) / 2); }
    get dexMod() { return Math.floor((this.dex - 10) / 2); }
    get conMod() { return Math.floor((this.con - 10) / 2); }
    get intMod() { return Math.floor((this.int - 10) / 2); }
    get wisMod() { return Math.floor((this.wis - 10) / 2); }
    get chaMod() { return Math.floor((this.cha - 10) / 2); }

    // Perception Metric: (DEX + INT + WIS) / 3 + Skill bonus + Set bonus
    get per() {
        const setPer = this.setBonuses.perRadar || 0;
        return Math.floor((this.dex + this.int + this.wis) / 3) + ((this.skills?.perception || 0) * 2) + setPer;
    }
    get perMod() {
        return Math.floor((this.per - 10) / 2);
    }

    // Hit Points: Base 20 + CON modifier * 8 + Cumulative Level-Up Bonus HP + Athletics Skill Rank + Set Bonus
    get maxHp() {
        return 20 + (this.conMod * 8) + this.bonusHp + ((this.skills?.athletics || 0) * 2) + (this.setBonuses.maxHp || 0);
    }

    // Armor Class: 10 + Equipment AC + DEX Mod + Active Buffs + Status Modifiers + Acrobatics Skill Rank + Set AC
    get ac() {
        const equipAc = this.getEquippedItems().reduce((sum, item) => sum + (item.ac || 0), 0);
        const buffAc = this.activeBuffs
            .filter(b => b.stat === 'ac')
            .reduce((sum, b) => sum + (b.value || 0), 0);
        const statusAc = EffectSystem.getStatusModifiers(this).acMod;
        const skillAcro = this.skills?.acrobatics || 0;
        const setAc = this.setBonuses.ac || 0;
        return Math.max(5, 10 + equipAc + this.dexMod + buffAc + statusAc + skillAcro + setAc);
    }

    get regenRate() {
        return Math.max(4, 12 - ((this.skills?.medicine || 0) * 2));
    }

    get weapon() {
        return this.equipment[ITEM_SLOTS.MAIN_HAND] || { name: 'Fists', delivery: 'ADJACENT', range: 1, dice: 3, desc: '1d3 Unarmed' };
    }

    get isStunned() {
        return EffectSystem.getStatusModifiers(this).isStunned;
    }

    // ==========================================
    // INVENTORY & PAPERDOLL ACTIONS
    // ==========================================

    addToBackpack(item) {
        if (!item) return false;
        const emptyIdx = this.backpack.findIndex(s => s === null);
        if (emptyIdx === -1) return false;
        this.backpack[emptyIdx] = item;
        return true;
    }

    removeFromBackpack(idx) {
        if (idx < 0 || idx >= this.backpack.length) return null;
        const item = this.backpack[idx];
        this.backpack[idx] = null;
        return item;
    }

    equipFromBackpack(backpackIdx) {
        if (backpackIdx < 0 || backpackIdx >= this.backpack.length) return null;
        const item = this.backpack[backpackIdx];
        if (!item || !item.slot) return null;

        const slot = item.slot;
        const previousItem = this.equipment[slot];

        // Clean swap: equipped item gets new item, backpack slot gets previous item (or null)
        this.equipment[slot] = item;
        this.backpack[backpackIdx] = previousItem;

        return { equipped: item, unequipped: previousItem, slot };
    }

    unequipToBackpack(slot) {
        const item = this.equipment[slot];
        if (!item) return { success: false, reason: 'Slot is empty' };

        const emptyIdx = this.backpack.findIndex(s => s === null);
        if (emptyIdx === -1) return { success: false, reason: 'Backpack is full (15/15)' };

        this.backpack[emptyIdx] = item;
        this.equipment[slot] = null;

        return { success: true, item, slot, backpackIdx: emptyIdx };
    }

    // ==========================================
    // EXPERIENCE & LEVEL UP PROGRESSION
    // ==========================================

    getNextLevelXp() {
        return XP_TABLE[this.level] || Infinity;
    }

    gainXp(amount) {
        this.xp += amount;
        const levelUps = [];

        while (this.level < 20 && this.xp >= this.getNextLevelXp()) {
            this.level++;
            const hitDie = this.characterClass.hitDie || 8;
            const hpGain = Math.max(2, Math.floor(hitDie / 2) + 1 + this.conMod);
            this.bonusHp += hpGain;
            this.hp = this.maxHp; // Full recovery on level milestone

            const milestone = isAttributeMilestone(this.level);
            if (milestone) {
                this.attributePoints++;
            }

            const unlockedAbilities = this.characterClass.abilities.filter(a => a.level === this.level);

            levelUps.push({
                level: this.level,
                hpGain,
                milestone,
                unlockedAbilities
            });
        }

        return levelUps;
    }

    boostAttribute(stat) {
        if (this.attributePoints <= 0) return false;
        switch (stat.toLowerCase()) {
            case 'str': this.baseStr++; break;
            case 'dex': this.baseDex++; break;
            case 'con': this.baseCon++; this.hp = this.maxHp; break;
            case 'int': this.baseInt++; break;
            case 'wis': this.baseWis++; break;
            case 'cha': this.baseCha++; break;
            default: return false;
        }
        this.attributePoints--;
        return true;
    }

    boostSkill(skillId) {
        if (!this.skills || this.skills[skillId] === undefined) return false;
        this.skills[skillId]++;
        if (skillId === 'athletics') {
            this.hp = this.maxHp;
        }
        return true;
    }

    recordProgression(level, hpGain, choiceType, choiceLabel, unlockedAbilities = []) {
        if (!this.progressionHistory) this.progressionHistory = [];
        this.progressionHistory.push({
            level,
            hpGain,
            choiceType,
            choiceLabel,
            unlockedAbilities: unlockedAbilities.map(a => typeof a === 'string' ? a : a.name),
            skills: { ...this.skills },
            totalHp: this.maxHp,
            ac: this.ac
        });
    }

    // ==========================================
    // CLASS FEATS, TALENTS & ABILITIES
    // ==========================================

    changeClass(classId) {
        const cls = ClassManager.getClass(classId);
        if (!cls) return false;
        this.characterClass = cls;
        this.setClassAttributes(cls.id);
        this.activeFeats = ClassManager.getDefaultFeatsForClass(cls.id);
        this.learnedFeats = [...this.activeFeats];
        this.cooldowns = {};
        this.hp = Math.min(this.hp, this.maxHp);
        return true;
    }

    toggleFeat(featId) {
        const feat = this.characterClass.abilities.find(a => a.id === featId);
        if (!feat || feat.level > this.level) return { success: false, reason: 'Feat locked' };

        const idx = this.activeFeats.indexOf(featId);
        if (idx !== -1) {
            // Cannot unequip if it is the only active feat
            if (this.activeFeats.length <= 1) {
                return { success: false, reason: 'Must keep at least 1 active feat equipped' };
            }
            this.activeFeats.splice(idx, 1);
            return { success: true, active: false, featId, name: feat.name };
        } else {
            // Allow up to 4 active equipped feats
            if (this.activeFeats.length >= 4) {
                const removedId = this.activeFeats.shift(); // rotate oldest
            }
            this.activeFeats.push(featId);
            return { success: true, active: true, featId, name: feat.name };
        }
    }

    isFeatActive(featId) {
        return this.activeFeats.includes(featId);
    }

    getAvailableAbilities() {
        return this.characterClass.abilities.filter(a => a.level <= this.level && this.activeFeats.includes(a.id));
    }

    getAllUnlockedAbilities() {
        return this.characterClass.abilities.filter(a => a.level <= this.level);
    }

    canUseAbility(abilityId) {
        const ability = this.characterClass.abilities.find(a => a.id === abilityId);
        if (!ability || ability.level > this.level) return false;
        if (!this.activeFeats.includes(abilityId)) return false;
        const cd = this.cooldowns[abilityId] || 0;
        return cd <= 0;
    }

    triggerAbilityCooldown(abilityId) {
        const ability = this.characterClass.abilities.find(a => a.id === abilityId);
        if (ability) {
            this.cooldowns[abilityId] = ability.cooldown;
        }
    }

    // ==========================================
    // SUSTENANCE, CAMP REST & ITEM CONSUMPTION
    // ==========================================

    campRest() {
        if (this.rations <= 0) {
            return { success: false, reason: 'No rations remaining! Forage mushrooms or harvest meat before resting.' };
        }
        this.rations--;
        const healAmt = Math.max(10, Math.floor(this.maxHp * 0.6));
        const prevHp = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + healAmt);

        // Reset all active ability cooldowns
        for (const id in this.cooldowns) {
            this.cooldowns[id] = 0;
        }

        // Cleanse Starving status and grant Well-Fed vigor (+1 AC, +1 Attack) for 40 turns
        EffectSystem.removeStatus(this, 'STARVING');
        EffectSystem.applyStatus(this, 'WELL_FED', 40, 1, 'Hearty Camp Meal');

        return {
            success: true,
            healed: this.hp - prevHp,
            rationsLeft: this.rations
        };
    }

    consumeItem(backpackIdx) {
        if (backpackIdx < 0 || backpackIdx >= this.backpack.length) return null;
        const item = this.backpack[backpackIdx];
        if (!item || !item.isConsumable) return null;

        this.removeFromBackpack(backpackIdx);

        let healAmt = item.healPotency || 0;
        let rationsGained = item.rations || 0;
        let statusApplied = null;

        if (rationsGained > 0) {
            this.rations += rationsGained;
            EffectSystem.removeStatus(this, 'STARVING');
        }

        if (healAmt > 0) {
            const prevHp = this.hp;
            this.hp = Math.min(this.maxHp, this.hp + healAmt);
            healAmt = this.hp - prevHp;
        }

        if (item.cleansesBleed) {
            EffectSystem.removeStatus(this, 'BLEEDING');
        }

        // Apply mushroom or potion status effects
        if (item.mushroomType) {
            const mDef = MUSHROOM_TYPES[item.mushroomType];
            if (mDef && mDef.status) {
                EffectSystem.applyStatus(this, mDef.status, mDef.duration || 20, 1, item.name);
                statusApplied = mDef.status;
            }
        } else if (item.statusOnHit) {
            EffectSystem.applyStatus(this, item.statusOnHit, item.statusDuration || 4, 1, item.name);
            statusApplied = item.statusOnHit;
        }

        return {
            item,
            healAmt,
            rationsGained,
            statusApplied
        };
    }

    // Time & Turn Progression with Passive Regen, Hunger & Cooldown / Buff decay
    advanceTurn() {
        this.turnCount++;
        this.hungerTurns++;
        let healed = false;
        let hungerMsg = null;

        // Hunger consumption check every 60 turns
        if (this.hungerTurns >= 60) {
            this.hungerTurns = 0;
            if (this.rations > 0) {
                this.rations--;
                hungerMsg = 'ration_consumed';
            } else {
                EffectSystem.applyStatus(this, 'STARVING', 999, 1, 'Hunger');
                hungerMsg = 'starving';
            }
        }

        const isStarving = EffectSystem.hasStatus(this, 'STARVING');

        // Passive health regeneration using dynamic regenRate (halted if starving)
        if (!isStarving && this.turnCount % this.regenRate === 0) {
            if (this.hp < this.maxHp) {
                this.hp = Math.min(this.maxHp, this.hp + 1);
                healed = true;
            }
        }

        // Decrement ability cooldowns
        for (const id in this.cooldowns) {
            if (this.cooldowns[id] > 0) {
                this.cooldowns[id]--;
            }
        }

        // Decrement & clean active buffs
        this.activeBuffs.forEach(b => { b.turnsLeft--; });
        this.activeBuffs = this.activeBuffs.filter(b => b.turnsLeft > 0);

        return { turn: this.turnCount, healed, hungerMsg };
    }
}
