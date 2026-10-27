// Click-driven item scenarios: gems, fusion, sockets, curses, identify, holy water, shatter and fountains, all through the
// Gear sheet buttons the player uses (items are handed to the hero with a debug helper; every action is a real click).
//   const I = await import('/src/devtools/ItemScenarios.js');  const results = await I.runAll();

import { createViaUI } from './PlaytestHarness.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);
const pd = () => window.pixelDebug;
const res = (name, pass, detail) => ({ name, pass, detail });
const last = (n = 3) => pd().log(n).join(' | ');

async function mods() {
    const [G, I, C] = await Promise.all([import('/src/data/Gems.js'), import('/src/data/Items.js'), import('/src/data/Curses.js')]);
    return { G, I, C };
}

async function openBags(tabIndex = 0) {
    window.openSheetModal(); await sleep(30);
    $('tab-btn-bags').click(); await sleep(30);
    const tabs = [...document.querySelectorAll('#bag-tabs button')];
    if (tabs[tabIndex]) tabs[tabIndex].click();
    await sleep(30);
}

async function pickSlotByName(name) {
    const el = [...document.querySelectorAll('#backpack-grid .backpack-slot')].find(e => (e.getAttribute('title') || '').includes(name));
    if (!el) return false;
    el.click(); await sleep(40);
    return true;
}

const cardBtn = (re) => [...document.querySelectorAll('#item-card-actions button')].find(b => re.test(b.innerText));

async function click(re) {
    const b = cardBtn(re);
    if (!b) return false;
    b.click(); await sleep(60);
    return true;
}

export async function gemStackAndFuse() {
    await createViaUI('warrior');
    const { G } = await mods();
    for (let i = 0; i < 3; i++) pd().give(G.createGem('ruby', 1));
    await openBags(1);
    const slots = [...document.querySelectorAll('#backpack-grid .backpack-slot')].filter(e => /Ruby/.test(e.getAttribute('title') || ''));
    const stacked = slots.length === 1 && /x3/.test(slots[0].innerText);
    await pickSlotByName('Chipped Ruby');
    const fused = await click(/Fuse/);
    const bag = pd().player().backpack.filter(i => i && i.isGem).map(i => `${i.name} x${i.count || 1}`);
    window.closeSheetModal();
    return res('gem stack + same-colour fuse', stacked && fused && bag.length === 1 && /Flawed Ruby/.test(bag[0]), `stacked into one slot: ${stacked}; after fuse: ${bag.join(', ')}`);
}

export async function rainbowFuse() {
    await createViaUI('warrior');
    const { G } = await mods();
    for (const t of ['ruby', 'sapphire', 'emerald']) pd().give(G.createGem(t, 1));
    await openBags(1);
    await pickSlotByName('Chipped Ruby');
    const ok = await click(/Rainbow/);
    const bag = pd().player().backpack.filter(i => i && i.isGem).map(i => `${i.name} x${i.count || 1}`);
    window.closeSheetModal();
    return res('rainbow fuse', ok && bag.length === 1 && /Flawed/.test(bag[0]), `button ${ok}; result ${bag.join(', ')}`);
}

export async function socketCursedGemFlow() {
    await createViaUI('warrior');
    const { G, I } = await mods();
    const sword = I.createItemFromBase(I.findBaseItem('Shortsword')); sword.sockets = 2; sword.name = 'Test Shortsword'; sword.baseName = 'Shortsword';
    pd().give(sword);
    const cursed = G.createGem('ruby', 2, { cursed: true }); G.identifyGem(cursed); // known cursed gem: shadowed icon
    pd().give(cursed);
    pd().give(G.createGem('sapphire', 2));
    const out = {};
    // equip the sword first so the cursed gem locks it
    await openBags(0);
    await pickSlotByName('Test Shortsword'); out.equip = await click(/Equip/);
    // now the sword is worn: select it in the paperdoll via the Worn tab and open the gem picker
    $('tab-btn-worn').click(); await sleep(40);
    const worn = document.querySelector('#paperdoll-body .paperdoll-slot.equipped[title*="Main Hand"]'); worn?.click(); await sleep(50);
    $('slot-picker-modal')?.classList.remove('active');
    window.selectSlot('body', 'main_hand'); await sleep(40);
    out.socketBtn = await click(/Socket Gem/);
    const rows = [...document.querySelectorAll('#gem-picker-list .picker-row')];
    const cursedRow = rows.find(r => /Shadowed/.test(r.innerText));
    cursedRow?.querySelector('button')?.click(); await sleep(60);
    out.cursedMsg = last(2);
    const sword2 = pd().player().equipment.main_hand;
    out.gems = (sword2.gems || []).map(g => `${g.name}${g.cursed ? '*' : ''}`);
    out.attackPenalty = sword2.mods?.attack;
    $('gem-picker-modal')?.classList.remove('active');
    // unequip should be refused
    window.selectSlot('body', 'main_hand'); await sleep(30);
    const unequip = cardBtn(/Unequip/); unequip?.click(); await sleep(50);
    out.unequipMsg = last(1);
    out.stillWorn = !!pd().player().equipment.main_hand;
    // shatter on a cursed gem is refused
    const shat = [...document.querySelectorAll('#item-card-gems .shat-btn')][0]; shat?.click(); await sleep(50);
    out.shatterMsg = last(1);
    out.gemsAfterShatterTry = (pd().player().equipment.main_hand.gems || []).length;
    // holy water, then shatter works and the sword comes off
    const { I: I2 } = await mods();
    pd().give(I2.createItemFromBase(I2.findBaseItem('Holy Water Vial')));
    window.selectSlot('body', 'main_hand'); await sleep(40);
    out.holy = await click(/Holy Water/);
    out.holyMsg = last(1);
    const shat2 = [...document.querySelectorAll('#item-card-gems .shat-btn')][0]; shat2?.click(); await sleep(60);
    out.shatterAfter = last(1);
    window.selectSlot('body', 'main_hand'); await sleep(30);
    cardBtn(/Unequip/)?.click(); await sleep(50);
    out.unequippedAfter = !pd().player().equipment.main_hand;
    window.closeSheetModal();
    const pass = out.equip && out.socketBtn && /CURSED|darkens/i.test(out.cursedMsg) && out.stillWorn && /cursed|will not come off/i.test(out.unequipMsg) && out.gemsAfterShatterTry === 1 && /cannot|will not|Purify/i.test(out.shatterMsg) && out.holy && out.unequippedAfter;
    return res('socket cursed gem, lock, refuse shatter, holy water, shatter, unequip', !!pass, JSON.stringify(out).slice(0, 700));
}

export async function curseLockAndIdentify() {
    await createViaUI('warrior');
    const { I, C } = await mods();
    const helm = I.createItemFromBase(I.findBaseItem('Iron Coif'));
    helm.unid = true; helm.trueName = 'Test Iron Coif of Doom'; helm.name = 'Iron Coif (?)'; helm.pristine = { ac: 1, powers: [] };
    C.attachCurse(helm, 'weakness', false);
    helm.desc = I.buildUnknownDesc(helm);
    pd().give(helm);
    pd().give(I.createItemFromBase(I.findBaseItem('Scroll of Identify')));
    const out = {};
    await openBags(0);
    await pickSlotByName('Iron Coif (?)'); out.badge = !!document.querySelector('#backpack-grid .adv-unk');
    out.compare = /Unidentified/.test($('item-card-compare').innerText);
    out.identifyBtn = !!cardBtn(/Identify/);
    await click(/Equip/);
    out.equipMsg = last(2);
    window.selectSlot('body', 'helm'); await sleep(40);
    cardBtn(/Unequip/)?.click(); await sleep(50);
    out.unequipMsg = last(1);
    out.locked = !!pd().player().equipment.helm;
    // identify with the scroll
    window.selectSlot('body', 'helm'); await sleep(40);
    out.scroll = await click(/Identify/);
    out.identMsg = last(1);
    out.nowNamed = pd().player().equipment.helm?.name;
    window.closeSheetModal();
    const pass = out.badge && out.compare && out.identifyBtn && /CURSED/.test(out.equipMsg) && out.locked && out.scroll && /Doom|Iron Coif/.test(out.nowNamed || '');
    return res('unidentified cursed helm: equip reveals curse, locks, scroll identifies', !!pass, JSON.stringify(out).slice(0, 600));
}

export async function fountainBump() {
    await createViaUI('warrior');
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
        pd().placeTile(1, 0, 'FOUNTAIN');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
        await sleep(50);
        seen.add((pd().log(2).find(t => /water|Visions|spring|Coins|Black|stagnant|vial|curse/i.test(t)) || '').slice(0, 40));
        const p = pd().player(); if (!p.alive) break;
        p.hp = p.maxHp; p.statuses = [];
    }
    const kinds = [...seen].filter(Boolean);
    return res('fountain bump via arrow key', kinds.length >= 3, `${kinds.length} distinct outcomes: ${kinds.join(' / ')}`);
}

export async function runAll() {
    const out = [];
    for (const fn of [gemStackAndFuse, rainbowFuse, socketCursedGemFlow, curseLockAndIdentify, fountainBump]) {
        try { out.push(await fn()); } catch (e) { out.push(res(fn.name, false, 'exception: ' + (e.stack || e).toString().slice(0, 240))); }
    }
    window.__itemResults = out;
    return out;
}
