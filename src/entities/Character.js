import { lockReason } from '../data/Curses.js';
import { usability } from '../data/Proficiency.js';
import { PERK, hasLute, hasShield } from '../data/ClassPerks.js';
import { ITEM_SLOTS, calculateEquippedSetBonuses, MUSHROOM_TYPES, getCompatibleSlots, createItemFromBase, findBaseItem } from '../data/Items.js';
import { ClassManager } from '../data/Classes.js';
import { PROGRESSION, XP_TABLE, getGrantsForLevel, MASTERIES } from '../data/Progression.js';
import { RaceManager, DEFAULT_RACE_ID } from '../data/Races.js';
import { finalScores } from '../data/Creation.js';
import { TOTAL_SLOTS, compartmentOf, compartmentRange, COMPARTMENTS } from '../data/Inventory.js';
import { FEATS } from '../data/Feats.js';
import { EffectSystem } from '../systems/Effects.js';
import { wardMultiplier as powersWardMultiplier } from '../systems/Powers.js';

export class PlayerCharacter {
    // scoreRolls: optional six ability scores (rolled or standard array), assigned to the class' stats by priority
    constructor(classKey = 'warrior', raceKey = DEFAULT_RACE_ID, scoreRolls = null) {
        this.scoreRolls = scoreRolls;
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
        this.stats = { killsByType: {}, kills: 0, bossesSlain: 0, gold: 0, chests: 0, disarmed: 0, deepest: 1, bestItem: null, victory: false };
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
        for (let i = 0; i < TOTAL_SLOTS; i++) {
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
        const s = finalScores(cls, this.race, this.scoreRolls);
        this.baseStr = s.str; this.baseDex = s.dex; this.baseCon = s.con;
        this.baseInt = s.int; this.baseWis = s.wis; this.baseCha = s.cha;
    }

    // Sum of permanent passive modifiers from race, general feats and heroic masteries
    get passiveMods() {
        const totals = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ac: 0, maxHp: 0, attack: 0, dmg: 0, per: 0, regen: 0 };
        const add = (mods) => { for (const k in mods) totals[k] = (totals[k] || 0) + mods[k]; };
        add(this.race?.mods);
        for (const id of this.generalFeats) add(FEATS[id]?.mods);
        for (const id of this.masteries) add(MASTERIES[id]?.mods);
        for (const item of this.getEquippedItems()) add(item.mods); // socketed gems
        if (this.characterClass?.id === 'bard' && hasLute(this)) add({ ac: PERK.bardSongAc, attack: PERK.bardSongAttack }); // Song
        return totals;
    }

    // Dynamic Attribute Getters (Base + Equipment + Active Buffs + Set Bonuses + Feats)
    // ---- persistence (hero roster): everything except the registry-owned class/race objects ----
    toSave() {
        const o = JSON.parse(JSON.stringify(this, (k, v) => (k === 'characterClass' || k === 'race') ? undefined : v));
        o.classId = this.characterClass.id;
        o.raceId = this.race.id;
        return o;
    }

    static fromSave(d) {
        const { classId, raceId, ...rest } = d;
        const p = new PlayerCharacter(classId, raceId, d.scoreRolls ?? null);
        Object.assign(p, JSON.parse(JSON.stringify(rest)));
        // A new chapter: fresh body, fresh effects, floor-bound progress reset
        p.alive = true;
        p.activeBuffs = [];
        p.statuses = [];
        p.cooldowns = {};
        p.hungerTurns = 0;
        p.xpMultiplier = 1;
        p.stats = { ...p.stats, deepest: 1 };
        p.hp = p.maxHp;
        return p;
    }

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

    // Luck nudges chest rewards (see main.js). Charisma, a blessing and a hopeful heart (Bard) all help.
    get luck() {
        return this.chaMod + (EffectSystem.hasStatus(this, 'BLESSED') ? 2 : 0) + (this.characterClass?.id === 'bard' ? 1 : 0);
    }

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

    // Consumables (food, mushrooms, potions, flasks...) stack by name. Gear and gems take one slot each.
    static isStackable(item) {
        if (item && item.isGem) return true; // gems stack by colour and tier
        return !!item && !!item.isConsumable && !item.isKey;
    }

    // Items stack when their keys match. A gem whose curse is hidden must not merge with clean ones, but must not look different either.
    static stackKey(item) {
        return `${item.name}|${item.cursed ? 'c' : ''}${item.curseKnown ? 'k' : ''}${item.checked ? 'v' : ''}`;
    }

    // Index range [start, end) of the compartment an item belongs to
    rangeFor(item) {
        return compartmentRange(compartmentOf(item));
    }

    // Adds to the first matching stack in the item's compartment, else an empty slot there.
    // Returns false only when that compartment has no room.
    addToBackpack(item) {
        if (!item) return false;
        const [a, b] = this.rangeFor(item);
        if (PlayerCharacter.isStackable(item)) {
            const add = item.count || 1;
            for (let i = a; i < b; i++) {
                const s = this.backpack[i];
                if (s && PlayerCharacter.isStackable(s) && PlayerCharacter.stackKey(s) === PlayerCharacter.stackKey(item) && (s.count || 1) < 99) {
                    s.count = (s.count || 1) + add;
                    return true;
                }
            }
            item.count = add;
        }
        for (let i = a; i < b; i++) {
            if (this.backpack[i] === null) {
                this.backpack[i] = item;
                return true;
            }
        }
        return false;
    }

    // Would this item fit (a free slot, or room on a stack, in its compartment)?
    canStore(item) {
        if (!item) return false;
        const [a, b] = this.rangeFor(item);
        for (let i = a; i < b; i++) {
            const s = this.backpack[i];
            if (s === null) return true;
            if (PlayerCharacter.isStackable(item) && s && PlayerCharacter.isStackable(s) && PlayerCharacter.stackKey(s) === PlayerCharacter.stackKey(item) && (s.count || 1) < 99) return true;
        }
        return false;
    }

    // Used / total slots of a compartment
    compartmentUsage(id) {
        const [a, b] = compartmentRange(id);
        let used = 0;
        for (let i = a; i < b; i++) if (this.backpack[i]) used++;
        return { used, size: b - a };
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
        this.blockReason = null;
        if (backpackIdx < 0 || backpackIdx >= this.backpack.length) return null;
        const item = this.backpack[backpackIdx];
        if (!item || !item.slot) return null;

        const slot = targetSlot || this.pickAutoSlot(item);
        if (!slot || !getCompatibleSlots(item).includes(slot)) return null;

        const can = usability(this.characterClass, item);
        if (!can.ok) { this.blockReason = can.reason; return null; }

        const previousItem = this.equipment[slot];
        this.blockReason = null;
        if (previousItem && lockReason(previousItem)) {
            this.blockReason = lockReason(previousItem);
            return null;
        }

        // Equipping from a stack (e.g. a flask) takes ONE unit; the displaced item goes back into the bag
        if ((item.count || 1) > 1) {
            if (previousItem && !this.canStore(previousItem)) return null;
            const one = { ...item, count: 1 };
            item.count--;
            this.equipment[slot] = one;
            if (previousItem) this.addToBackpack(previousItem);
            return { equipped: one, unequipped: previousItem, slot };
        }

        // Displaced item belongs to another compartment (e.g. a flask replacing a shield): route it to its own bag
        if (previousItem && compartmentOf(previousItem) !== compartmentOf(item)) {
            if (!this.canStore(previousItem)) return null;
            this.backpack[backpackIdx] = null;
            this.equipment[slot] = item;
            this.addToBackpack(previousItem);
            return { equipped: item, unequipped: previousItem, slot };
        }

        // Clean swap: equipped item gets new item, backpack slot gets previous item (or null)
        this.equipment[slot] = item;
        this.backpack[backpackIdx] = previousItem;

        return { equipped: item, unequipped: previousItem, slot };
    }

    unequipToBackpack(slot) {
        const item = this.equipment[slot];
        if (!item) return { success: false, reason: 'Slot is empty' };
        if (lockReason(item)) return { success: false, reason: lockReason(item) };
        if (!this.canStore(item)) return { success: false, reason: `Your ${COMPARTMENTS.find(c => c.id === compartmentOf(item)).label} bag is full` };
        this.addToBackpack(item);
        this.equipment[slot] = null;
        const backpackIdx = this.backpack.findIndex(s => s && (s === item || (PlayerCharacter.isStackable(item) && PlayerCharacter.stackKey(s) === PlayerCharacter.stackKey(item))));
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
        if (!ability.utility && !this.activeFeats.includes(abilityId)) return false; // utility spells need no slot
        if (ability.requiresShield && !hasShield(this)) return false;
        const cd = this.cooldowns[abilityId] || 0;
        return cd <= 0;
    }

    // Wizard Spell Charge: waited long enough without acting, so the next ability has no cooldown (see ClassPerks.js)
    get charged() {
        return this.characterClass?.id === 'wizard' && (this.waitStreak || 0) >= PERK.wizardChargeWaits && this.waitStreakTurn === this.turnCount;
    }

    triggerAbilityCooldown(abilityId) {
        const ability = this.characterClass.abilities.find(a => a.id === abilityId);
        if (!ability) return;
        if (this.charged && !ability.utility) {
            this.waitStreak = 0;
            this.perkNote = `🔮 Charged! ${ability.name} leaves no cooldown.`;
            return;
        }
        this.cooldowns[abilityId] = ability.cooldown;
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
