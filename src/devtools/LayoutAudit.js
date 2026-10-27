// Opens every screen and reports elements that spill outside the viewport horizontally, plus page-level horizontal scroll.
// Meant for phone-width checks: resize the pane to a phone first.
//   const A = await import('/src/devtools/LayoutAudit.js');  const report = await A.auditAll();

import { createViaUI } from './PlaytestHarness.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);
const pd = () => window.pixelDebug;

function describe(el) {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
}

// Elements (inside `root`) wider than the viewport allows. Elements in a scrollable container are judged by that container.
function overflowing(root, vw) {
    const bad = [];
    for (const el of root.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.right > vw + 1 || r.left < -1) {
            // ignore children of a horizontally scrollable strip
            let p = el.parentElement, scrolls = false;
            while (p && p !== root) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') { scrolls = true; break; } p = p.parentElement; }
            if (!scrolls) bad.push(`${describe(el)} (${Math.round(r.left)}..${Math.round(r.right)})`);
        }
    }
    return bad.slice(0, 4);
}

function textProblems(root) {
    const t = root.innerText || '';
    const m = t.match(/\bNaN\b|undefined|\[object|Infinity/);
    return m ? [`text contains "${m[0]}"`] : [];
}

async function screen(label, show, rootId, report) {
    try { await show(); } catch (e) { report.push({ screen: label, problems: ['could not open: ' + e] }); return; }
    await sleep(80);
    const root = rootId ? $(rootId) : document.body;
    const vw = window.innerWidth;
    const problems = [...overflowing(root, vw), ...textProblems(root)];
    if (document.documentElement.scrollWidth > vw + 1) problems.push(`page scrolls horizontally (${document.documentElement.scrollWidth} > ${vw})`);
    report.push({ screen: label, problems });
}

const closeAll = () => document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));

export async function auditAll() {
    const report = [];
    const { Heroes } = await import('/src/data/Heroes.js');
    await createViaUI('wizard');
    const p = pd().player();
    pd().grantSlotItems(); pd().grantGems(); pd().grantPowerItems();
    Heroes.save(p, 'deep_dungeons', 'cleared'); // gives the story screen something to show

    await screen('map + HUD + status strip', async () => { closeAll(); }, null, report);
    await screen('start: home', async () => { closeAll(); window.openStart('home'); }, 'start-modal', report);
    await screen('start: continue story', async () => window.startShow('story'), 'start-modal', report);
    await screen('start: create step 1', async () => { window.startShow('create'); }, 'start-modal', report);
    await screen('start: create step 2', async () => { window.createNext(); }, 'start-modal', report);
    await screen('start: legacy', async () => window.startShow('legacy'), 'start-modal', report);
    closeAll();
    await screen('menu: actions', async () => { window.openSettings(); window.switchMenuTab('actions'); }, 'settings-modal', report);
    await screen('menu: keys', async () => window.switchMenuTab('keys'), 'settings-modal', report);
    closeAll();
    for (const t of ['worn', 'bags', 'stats', 'log']) await screen(`sheet: ${t}`, async () => { window.openSheetModal(); window.switchSheetTab(t); }, 'sheet-modal', report);
    closeAll();
    await screen('sheet: bags + selected item card', async () => { window.openSheetModal(); window.switchSheetTab('bags'); window.selectSlot('backpack', 0); }, 'sheet-modal', report);
    closeAll();
    await screen('spells & feats', async () => window.openSpellsModal(), 'spells-modal', report);
    closeAll();
    await screen('status panel', async () => window.openStatus(), 'status-modal', report);
    closeAll();
    await screen('message history', async () => window.openLog(), 'log-modal', report);
    closeAll();
    await screen('map message bar expanded', async () => { window.toggleMsgExpand(); }, null, report);
    window.toggleMsgExpand();
    await screen('d-pad open', async () => { window.toggleRemoteControl(true); window.togglePadCollapsed?.(); }, null, report);
    window.togglePadCollapsed?.();
    // merchant: place one next to the hero and open the shop
    await screen('merchant shop', async () => {
        const f = pd().floor();
        f.merchant = { x: p.x + 1, y: p.y, name: 'Wandering Merchant', icon: '🧙', stock: (await import('/src/data/Economy.js')).buildMerchantStock({ nextInt: (a, b) => a + ((b - a) >> 1), chance: () => true, choice: a => a[0], next: () => 0.5 }, 3) };
        window.openShop();
    }, 'shop-modal', report);
    closeAll();
    await screen('death screen', async () => { pd().killPlayer(); await sleep(400); }, 'death-modal', report);
    closeAll();
    return report;
}
