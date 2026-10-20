import { ITEM_SLOTS, calculateEquippedSetBonuses, MUSHROOM_TYPES, getCompatibleSlots, createItemFromBase, findBaseItem } from '../data/Items.js';
import { ClassManager } from '../data/Classes.js';
import { PROGRESSION, XP_TABLE, getGrantsForLevel, MASTERIES } from '../data/Progression.js';
import { RaceManager, DEFAULT_RACE_ID } from '../data/Races.js';
import { FEATS } from '../data/Feats.js';
import { EffectSystem } from '../systems/Effects.js';
import { wardMultiplier as powersWardMultiplier } from '../systems/Powers.js';

export class PlayerCharacter {
    constructor(classKey = 'warrior', raceKey = DEFAULT_RACE_ID) {
        this.x = 0;
        this.y = 0;
        this.level = 1;
        this.xp = 0;
        this.bonusHp = 0;
        this.attributePoints = 0;
        this.gold = 0;
        this.keyRing = []; // { keyId, name } for locked doors (never occupy bag slots)
        this.xpMultiplier = 1;   // per-floor modifier (e.g. Pitch Dark +25% XP)
        this.xpBonusMult = 1;    // legacy perk
        this.stats = { kills: 0, bossesSlain: 0, gold: 0, chests: 0, disarmed: 0, deepest: 1, bestItem: null, victory: false };
        this.turnCount = 0;
        this.alive = true;

        // Class & Race Assignment (data-driven registries)
        this.characterClass = ClassManager.getClass(classKey);
        this.race = RaceManager.getRace(raceKey);

        // Permanent passives gained through levelling (ids into FEATS / MASTERIES)
        this.generalFeats = [];
        this.masteries = [];

        // Cooldowns, Active Buffs & Status Effects
        this.cooldowns = {};
        this.activeBuffs = [];
        this.statuses = [];

        // Hunger & Rations Sustenance
        this.rations = 5;
        this.hungerTurns = 0;

        // Active & Learned Class Abilities
        this.activeFeats = ClassManager.getDefaultFeatsForClass(this.characterClass.id);
        this.learnedFeats = [...this.activeFeats];

        // Skill Specializations (Ranks earned upon level-ups)
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
                choiceLabel: `${this.race.name} ${this.characterClass.name} (${this.characterClass.title})`,
                unlockedAbilities: this.characterClass.abilities.filter(a => a.level === 1).map(a => a.name)
            }
        ];

        // Class + Race Baseline RPG Attributes
        this.setClassAttributes(this.characterClass.id);

        // 10 Categorized Paperdoll Equipment Slots, filled from the class' starting kit
        this.equipment = {
            [ITEM_SLOTS.HELM]: null,
            [ITEM_SLOTS.AMULET]: null,
            [ITEM_SLOTS.ARMOR]: null,
            [ITEM_SLOTS.CLOAK]: null,
            [ITEM_SLOTS.MAIN_HAND]: null,
            [ITEM_SLOTS.OFF_HAND]: null,
            [ITEM_SLOTS.GAUNTLETS]: null,
            [ITEM_SLOTS.BOOTS]: null,
            [ITEM_SLOTS.RING_LEFT]: null,
            [ITEM_SLOTS.RING_RIGHT]: null
        };
        this.applyStartingGear();

        // 15 Backpack Storage Slots (10 Body + 15 Bag = 25 Total Slots)
        this.backpack = [];
        for (let i = 0; i < 15; i++) {
            this.backpack.push(null);
        }

        this.hp = this.maxHp;
    }

    applyStartingGear() {
        const kit = this.characterClass.startingGear || {};
        for (const slot of Object.keys(this.equipment)) {
            this.equipment[slot] = null;
        }
        for (const [slot, baseName] of Object.entries(kit)) {
            const base = findBaseItem(baseName);
            if (base && slot in this.equipment) this.equipment[slot] = createItemFromBase(base);
        }
    }

    // Class base attributes + race modifiers (never below 3)
    setClassAttributes(classId) {
        const cls = ClassManager.getClass(classId);
        const a = cls.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const r = this.race?.attrs || {};
        const v = (k) => Math.max(3, (a[k] || 10) + (r[k] || 0));
        this.baseStr = v('str'); this.baseDex = v('dex'); this.baseCon = v('con');
        this.baseInt = v('int'); this.baseWis = v('wis'); this.baseCha = v('cha');
    }

    // Sum of permanent passive modifiers from race, general feats and heroic masteries
    get passiveMods() {
        const totals = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ac: 0, maxHp: 0, attack: 0, dmg: 0, per: 0, regen: 0 };
        const add = (mods) => { for (const k in mods) totals[k] = (totals[k] || 0) + mods[k]; };
        add(this.race?.mods);
        for (const id of this.generalFeats) add(FEATS[id]?.mods);
        for (const id of this.masteries) add(MASTERIES[id]?.mods);
        for (const item of this.getEquippedItems()) add(item.mods); // socketed gems
        return totals;
    }

    // Dynamic Attribute Getters (Base + Equipment + Active Buffs + Set Bonuses + Feats)
    getEquippedItems() {
        return Object.values(this.equipment).filter(Boolean);
    }

    get setBonuses() {
        return calculateEquippedSetBonuses(this).totals;
    }

    get str() {
        return this.baseStr + this.getEquippedItems().reduce((sum, item) => sum + (item.str || 0), 0) + (this.setBonuses.str || 0) + this.passiveMods.str;
    }

    get dex() {
        const statusDex = EffectSystem.getStatusModifiers(this).dexMod;
        const equipDex = this.getEquippedItems().reduce((sum, item) => sum + (item.dex || 0), 0);
        return Math.max(1, this.baseDex + equipDex + statusDex + (this.setBonuses.dex || 0) + this.passiveMods.dex);
    }

    get con() {
        return this.baseCon + this.getEquippedItems().reduce((sum, item) => sum + (item.con || 0), 0) + (this.setBonuses.con || 0) + this.passiveMods.con;
    }

    get int() {
        const intBonus = EffectSystem.hasStatus(this, 'HALLUCINATING') ? 3 : 0;
        return this.baseInt + this.getEquippedItems().reduce((sum, item) => sum + (item.int || 0), 0) + (this.setBonuses.int || 0) + intBonus + this.passiveMods.int;
    }

    get wis() {
        return this.baseWis + this.getEquippedItems().reduce((sum, item) => sum + (item.wis || 0), 0) + (this.setBonuses.wis || 0) + this.passiveMods.wis;
    }

    get cha() {
        return this.baseCha + this.getEquippedItems().reduce((sum, item) => sum + (item.cha || 0), 0) + (this.setBonuses.cha || 0) + this.passiveMods.cha;
    }

    // Stat Modifiers
    get strMod() { return Math.floor((this.str - 10) / 2); }
    get dexMod() { return Math.floor((this.dex - 10) / 2); }
    get conMod() { return Math.floor((this.con - 10) / 2); }
    get intMod() { return Math.floor((this.int - 10) / 2); }
    get wisMod() { return Math.floor((this.wis - 10) / 2); }
    get chaMod() { return Math.floor((this.cha - 10) / 2); }

    // Perception Metric: (DEX + INT + WIS) / 3 + Skill bonus + Set bonus + Feats/Race
    get per() {
        const setPer = this.setBonuses.perRadar || 0;
        return Math.floor((this.dex + this.int + this.wis) / 3) + ((this.skills?.perception || 0) * 2) + setPer + this.passiveMods.per + (this.legacyPer || 0);
    }
    get perMod() {
        return Math.floor((this.per - 10) / 2);
    }

    // Hit Points: class base HP + CON modifier * 8 + Cumulative Level-Up Bonus HP + Athletics + Set Bonus + Feats
    get maxHp() {
        const base = this.characterClass.baseHp ?? 20;
        return base + (this.conMod * 8) + this.bonusHp + ((this.skills?.athletics || 0) * 2) + (this.setBonuses.maxHp || 0) + this.passiveMods.maxHp;
    }

    // Armor Class: 10 + Equipment AC + DEX Mod + Active Buffs + Status Modifiers + Acrobatics Skill Rank + Set AC + Feats
    get ac() {
        const equipAc = this.getEquippedItems().reduce((sum, item) => sum + (item.ac || 0), 0);
        const buffAc = this.activeBuffs
            .filter(b => b.stat === 'ac')
            .reduce((sum, b) => sum + (b.value || 0), 0);
        const statusAc = EffectSystem.getStatusModifiers(this).acMod;
        const skillAcro = this.skills?.acrobatics || 0;
        const setAc = this.setBonuses.ac || 0;
        return Math.max(5, 10 + equipAc + this.dexMod + buffAc + statusAc + skillAcro + setAc + this.passiveMods.ac);
    }

    get regenRate() {
        return Math.max(3, 9 - ((this.skills?.medicine || 0) * 2) - (this.passiveMods.regen * 2));
    }

    get weapon() {
        return this.equipment[ITEM_SLOTS.MAIN_HAND] || {
            name: this.characterClass.unarmedDie ? 'Martial Arts' : 'Fists',
            delivery: 'ADJACENT', range: 1,
            dice: this.characterClass.unarmedDie || 3,
            desc: `1d${this.characterClass.unarmedDie || 3} Unarmed`
        };
    }

    // Damage multiplier vs a hazard (zone id or status id) from equipped warding powers
    wardMultiplier(id) {
        return powersWardMultiplier(this, id);
    }

    get isStunned() {
        return EffectSystem.getStatusModifiers(this).isStunned;
    }

    // ==========================================
    // INVENTORY & PAPERDOLL ACTIONS
    // ==========================================

    // Consumables (food, mushrooms, potions, flasks...) stack by name. Gear and gems occupy one slot each.
    static isStackable(item) {
        return !!item && !!item.isConsumable && !item.isKey;
    }

    // Adds to the first matching stack, else an empty slot. Returns false only when nothing could be stored.
    addToBackpack(item) {
        if (!item) return false;
        if (PlayerCharacter.isStackable(item)) {
            const add = item.count || 1;
            const stack = this.backpack.find(s => s && PlayerCharacter.isStackable(s) && s.name === item.name && (s.count || 1) < 99);
            if (stack) {
                stack.count = (stack.count || 1) + add;
                return true;
            }
            item.count = add;
        }
        const emptyIdx = this.backpack.findIndex(s => s === null);
        if (emptyIdx === -1) return false;
        this.backpack[emptyIdx] = item;
        return true;
    }

    // Would this item fit (a free slot, or room on an existing stack)?
    canStore(item) {
        if (!item) return false;
        if (this.backpack.some(s => s === null)) return true;
        return PlayerCharacter.isStackable(item) && this.backpack.some(s => s && PlayerCharacter.isStackable(s) && s.name === item.name && (s.count || 1) < 99);
    }

    // Removes the whole slot contents (a full stack leaves together)
    removeFromBackpack(idx) {
        if (idx < 0 || idx >= this.backpack.length) return null;
        const item = this.backpack[idx];
        this.backpack[idx] = null;
        return item;
    }

    // Removes ONE unit: decrements a stack, or empties the slot. Returns the removed unit.
    removeOneFromBackpack(idx) {
        if (idx < 0 || idx >= this.backpack.length) return null;
        const item = this.backpack[idx];
        if (!item) return null;
        if ((item.count || 1) > 1) {
            item.count--;
            return { ...item, count: 1 };
        }
        this.backpack[idx] = null;
        return item;
    }

    // Key ring: keys never take bag slots
    hasKey(keyId) { return this.keyRing.some(k => k.keyId === keyId); }
    useKey(keyId) {
        const i = this.keyRing.findIndex(k => k.keyId === keyId);
        if (i === -1) return null;
        return this.keyRing.splice(i, 1)[0];
    }

    // Every owned backpack item that may be worn in `slot` (rings fit either ring slot).
    getEquipCandidates(slot) {
        const out = [];
        this.backpack.forEach((item, idx) => {
            if (item && getCompatibleSlots(item).includes(slot)) out.push({ idx, item });
        });
        return out;
    }

    // Slot an item would be equipped into when no slot is specified: its first empty compatible slot,
    // otherwise its preferred slot (so a 3rd ring swaps out the item in its natural ring slot).
    pickAutoSlot(item) {
        const slots = getCompatibleSlots(item);
        return slots.find(s => !this.equipment[s]) || slots[0] || null;
    }

    // Equip backpack[backpackIdx] into targetSlot (defaults to auto-pick). The displaced item swaps into the bag.
    equipFromBackpack(backpackIdx, targetSlot = null) {
        if (backpackIdx < 0 || backpackIdx >= this.backpack.length) return null;
        const item = this.backpack[backpackIdx];
        if (!item || !item.slot) return null;

        const slot = targetSlot || this.pickAutoSlot(item);
        if (!slot || !getCompatibleSlots(item).includes(slot)) return null;

        const previousItem = this.equipment[slot];

        // Equipping from a stack (e.g. a flask) takes ONE unit; the displaced item goes back into the bag
        if ((item.count || 1) > 1) {
            if (previousItem && !this.canStore(previousItem)) return null;
            const one = { ...item, count: 1 };
            item.count--;
            this.equipment[slot] = one;
            if (previousItem) this.addToBackpack(previousItem);
            return { equipped: one, unequipped: previousItem, slot };
        }

        // Clean swap: equipped item gets new item, backpack slot gets previous item (or null)
        this.equipment[slot] = item;
        this.backpack[backpackIdx] = previousItem;

        return { equipped: item, unequipped: previousItem, slot };
    }

    unequipToBackpack(slot) {
        const item = this.equipment[slot];
        if (!item) return { success: false, reason: 'Slot is empty' };
        if (!this.canStore(item)) return { success: false, reason: 'Backpack is full (15/15)' };
        this.addToBackpack(item);
        this.equipment[slot] = null;
        const backpackIdx = this.backpack.findIndex(s => s && (s === item || (PlayerCharacter.isStackable(item) && s.name === item.name)));
        return { success: true, item, slot, backpackIdx };
    }

    // ==========================================
    // EXPERIENCE & LEVEL UP PROGRESSION
    // ==========================================

    getNextLevelXp() {
        return XP_TABLE[this.level] ?? Infinity;
    }

    // Applies HP + queues the data-driven grants for each level gained. Choices (skill / attribute / feat /
    // mastery) are resolved afterwards by the UI via learnFeat / chooseMastery / boostSkill / boostAttribute.
    gainXp(amount, raw = false) {
        if (!raw) amount = Math.max(1, Math.round(amount * (this.xpMultiplier || 1) * (this.xpBonusMult || 1)));
        this.xp += amount;
        const levelUps = [];

        while (this.level < PROGRESSION.maxLevel && this.xp >= this.getNextLevelXp()) {
            this.level++;
            const hitDie = this.characterClass.hitDie || 8;
            const hpGain = PROGRESSION.hp.everyLevel
                ? Math.max(PROGRESSION.hp.minHp, Math.floor(hitDie / 2) + 1 + this.conMod + (this.race?.hpPerLevel || 0))
                : 0;
            this.bonusHp += hpGain;
            this.hp = this.maxHp; // Full recovery on level-up

            const unlockedAbilities = this.characterClass.abilities.filter(a => a.level === this.level);
            // Newly unlocked abilities are auto-slotted while a free slot (max 4) remains
            for (const a of unlockedAbilities) {
                if (this.activeFeats.length < 4 && !this.activeFeats.includes(a.id)) this.activeFeats.push(a.id);
            }

            levelUps.push({
                level: this.level,
                hpGain,
                grants: getGrantsForLevel(this.level),
                unlockedAbilities
            });
        }

        return levelUps;
    }

    boostAttribute(stat) {
        switch (stat.toLowerCase()) {
            case 'str': this.baseStr++; break;
            case 'dex': this.baseDex++; break;
            case 'con': this.baseCon++; this.hp = this.maxHp; break;
            case 'int': this.baseInt++; break;
            case 'wis': this.baseWis++; break;
            case 'cha': this.baseCha++; break;
            default: return false;
        }
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

    learnFeat(featId) {
        const feat = FEATS[featId];
        if (!feat || this.generalFeats.includes(featId)) return null;
        this.generalFeats.push(featId);
        if (feat.mods?.maxHp || feat.mods?.con) this.hp = Math.min(this.maxHp, this.hp + (feat.mods.maxHp || 0));
        return feat;
    }

    chooseMastery(masteryId) {
        const m = MASTERIES[masteryId];
        if (!m || this.masteries.includes(masteryId)) return null;
        this.masteries.push(masteryId);
        if (m.mods?.maxHp) this.hp = Math.min(this.maxHp, this.hp + m.mods.maxHp);
        if (m.resetCooldowns) {
            for (const k in this.cooldowns) this.cooldowns[k] = 0;
        }
        return m;
    }

    // `choices` = [{ type, label }] for each grant resolved at this level
    recordProgression(level, hpGain, choices, unlockedAbilities = []) {
        if (!this.progressionHistory) this.progressionHistory = [];
        const list = Array.isArray(choices) ? choices : [];
        this.progressionHistory.push({
            level,
            hpGain,
            choiceType: list.map(c => c.type).join('+') || 'hp',
            choiceLabel: list.map(c => c.label).join(' • ') || 'Hit points only',
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
        this.activeFeats = ClassManager.getDefaultFeatsForClass(cls.id, this.level);
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
                this.activeFeats.shift(); // rotate oldest
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

        this.removeOneFromBackpack(backpackIdx);

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
