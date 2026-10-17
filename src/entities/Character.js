// Player Character Model with 6 Attributes, 25-Slot Paperdoll System, Modular Classes, XP & Feats

import { ITEM_SLOTS } from '../data/Items.js';
import { CLASSES, XP_TABLE, isAttributeMilestone } from '../data/Classes.js';
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

        // Six Core RPG Attributes (Warrior default baseline)
        this.baseStr = 12;
        this.baseDex = 10;
        this.baseCon = 12;
        this.baseInt = 10;
        this.baseWis = 10;
        this.baseCha = 10;

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

    // Dynamic Attribute Getters (Base + Equipment + Active Buffs)
    getEquippedItems() {
        return Object.values(this.equipment).filter(Boolean);
    }

    get str() {
        return this.baseStr + this.getEquippedItems().reduce((sum, item) => sum + (item.str || 0), 0);
    }

    get dex() {
        const statusDex = EffectSystem.getStatusModifiers(this).dexMod;
        const equipDex = this.getEquippedItems().reduce((sum, item) => sum + (item.dex || 0), 0);
        return Math.max(1, this.baseDex + equipDex + statusDex);
    }

    get con() {
        return this.baseCon + this.getEquippedItems().reduce((sum, item) => sum + (item.con || 0), 0);
    }

    get int() {
        return this.baseInt + this.getEquippedItems().reduce((sum, item) => sum + (item.int || 0), 0);
    }

    get wis() {
        return this.baseWis + this.getEquippedItems().reduce((sum, item) => sum + (item.wis || 0), 0);
    }

    get cha() {
        return this.baseCha + this.getEquippedItems().reduce((sum, item) => sum + (item.cha || 0), 0);
    }

    // Stat Modifiers
    get strMod() { return Math.floor((this.str - 10) / 2); }
    get dexMod() { return Math.floor((this.dex - 10) / 2); }
    get conMod() { return Math.floor((this.con - 10) / 2); }
    get intMod() { return Math.floor((this.int - 10) / 2); }
    get wisMod() { return Math.floor((this.wis - 10) / 2); }
    get chaMod() { return Math.floor((this.cha - 10) / 2); }

    // Perception Metric: (DEX + INT + WIS) / 3 + Skill bonus
    get per() {
        return Math.floor((this.dex + this.int + this.wis) / 3) + ((this.skills?.perception || 0) * 2);
    }
    get perMod() {
        return Math.floor((this.per - 10) / 2);
    }

    // Hit Points: Base 20 + CON modifier * 8 + Cumulative Level-Up Bonus HP + Athletics Skill Rank
    get maxHp() {
        return 20 + (this.conMod * 8) + this.bonusHp + ((this.skills?.athletics || 0) * 2);
    }

    // Armor Class: 10 + Equipment AC + DEX Mod + Active Buffs + Status Modifiers + Acrobatics Skill Rank
    get ac() {
        const equipAc = this.getEquippedItems().reduce((sum, item) => sum + (item.ac || 0), 0);
        const buffAc = this.activeBuffs
            .filter(b => b.stat === 'ac')
            .reduce((sum, b) => sum + (b.value || 0), 0);
        const statusAc = EffectSystem.getStatusModifiers(this).acMod;
        const skillAcro = this.skills?.acrobatics || 0;
        return Math.max(5, 10 + equipAc + this.dexMod + buffAc + statusAc + skillAcro);
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
    // CLASS FEATS & ABILITIES
    // ==========================================

    getAvailableAbilities() {
        return this.characterClass.abilities.filter(a => a.level <= this.level);
    }

    canUseAbility(abilityId) {
        const ability = this.characterClass.abilities.find(a => a.id === abilityId);
        if (!ability || ability.level > this.level) return false;
        const cd = this.cooldowns[abilityId] || 0;
        return cd <= 0;
    }

    triggerAbilityCooldown(abilityId) {
        const ability = this.characterClass.abilities.find(a => a.id === abilityId);
        if (ability) {
            this.cooldowns[abilityId] = ability.cooldown;
        }
    }

    // Time & Turn Progression with Passive Regen & Cooldown / Buff decay
    advanceTurn() {
        this.turnCount++;
        let healed = false;

        // Passive health regeneration using dynamic regenRate
        if (this.turnCount % this.regenRate === 0) {
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

        return { turn: this.turnCount, healed };
    }
}
