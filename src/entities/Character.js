// Player Character Model with 6 Core Attributes, Perception Metric, and Dynamic Getters

import { ITEM_SLOTS } from '../data/Items.js';

export class PlayerCharacter {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.level = 1;

        // Six Core RPG Attributes
        this.baseStr = 12;
        this.baseDex = 10;
        this.baseCon = 12;
        this.baseInt = 10;
        this.baseWis = 10;
        this.baseCha = 10;

        // Categorized Equipment Slots (10 active slots)
        this.equipment = {
            [ITEM_SLOTS.MAIN_HAND]: { name: 'Iron Blade', slot: ITEM_SLOTS.MAIN_HAND, dice: 6, str: 0, dex: 0, icon: '⚔️', desc: '1d6 Dmg' },
            [ITEM_SLOTS.OFF_HAND]: null,
            [ITEM_SLOTS.ARMOR]: { name: 'Padded Vest', slot: ITEM_SLOTS.ARMOR, ac: 1, icon: '🦺', desc: '+1 AC' },
            [ITEM_SLOTS.HELM]: null,
            [ITEM_SLOTS.GAUNTLETS]: null,
            [ITEM_SLOTS.BOOTS]: null,
            [ITEM_SLOTS.RING_LEFT]: null,
            [ITEM_SLOTS.RING_RIGHT]: null,
            [ITEM_SLOTS.AMULET]: null,
            [ITEM_SLOTS.CLOAK]: null
        };

        // Backpack (15 slots) -> 10 + 15 = 25 total slots
        this.backpack = [];

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

    // Stat Modifiers (D&D 5e / d20 standard)
    get strMod() { return Math.floor((this.str - 10) / 2); }
    get dexMod() { return Math.floor((this.dex - 10) / 2); }
    get conMod() { return Math.floor((this.con - 10) / 2); }
    get intMod() { return Math.floor((this.int - 10) / 2); }
    get wisMod() { return Math.floor((this.wis - 10) / 2); }
    get chaMod() { return Math.floor((this.cha - 10) / 2); }

    // Phase 2 Perception Metric: (DEX + INT + WIS) / 3
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
}
