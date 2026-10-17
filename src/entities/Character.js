// Player Character Model with 6 Core Attributes, Perception Metric, and 25-Slot Paperdoll System

import { ITEM_SLOTS } from '../data/Items.js';

export class PlayerCharacter {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.level = 1;
        this.turnCount = 0;
        this.alive = true;

        // Tunable Passive Health Regen Rate (Heal 1 HP every REGEN_RATE turns)
        this.REGEN_RATE = 12;

        // Six Core RPG Attributes
        this.baseStr = 12;
        this.baseDex = 10;
        this.baseCon = 12;
        this.baseInt = 10;
        this.baseWis = 10;
        this.baseCha = 10;

        // Categorized Equipment Slots (10 Active Paperdoll Slots)
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

        // Backpack (15 slots) -> 10 equipped + 15 bag = 25 total slots
        this.backpack = [];
        for (let i = 0; i < 15; i++) {
            this.backpack.push(null);
        }

        this.hp = this.maxHp;
    }

    // Dynamic Attribute Getters (Base + Equipment bonuses)
    getEquippedItems() {
        return Object.values(this.equipment).filter(Boolean);
    }

    get str() {
        return this.baseStr + this.getEquippedItems().reduce((sum, item) => sum + (item.str || 0), 0);
    }

    get dex() {
        return this.baseDex + this.getEquippedItems().reduce((sum, item) => sum + (item.dex || 0), 0);
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

    // Perception Metric: (DEX + INT + WIS) / 3
    get per() {
        return Math.floor((this.dex + this.int + this.wis) / 3);
    }
    get perMod() {
        return Math.floor((this.per - 10) / 2);
    }

    // CON Hooked directly into Max HP
    get maxHp() {
        return 20 + (this.conMod * 8);
    }

    // Armor Class: 10 + Equipment AC + DEX Mod
    get ac() {
        const equipAc = this.getEquippedItems().reduce((sum, item) => sum + (item.ac || 0), 0);
        return 10 + equipAc + this.dexMod;
    }

    get weapon() {
        return this.equipment[ITEM_SLOTS.MAIN_HAND] || { name: 'Fists', dice: 3, desc: '1d3 Unarmed' };
    }

    equip(item) {
        if (!item || !item.slot) return;
        const old = this.equipment[item.slot];
        this.equipment[item.slot] = item;
        return old;
    }

    // Time & Turn Progression with Passive Regen
    advanceTurn() {
        this.turnCount++;
        let healed = false;
        if (this.turnCount % this.REGEN_RATE === 0) {
            if (this.hp < this.maxHp) {
                this.hp = Math.min(this.maxHp, this.hp + 1);
                healed = true;
            }
        }
        return { turn: this.turnCount, healed };
    }
}
