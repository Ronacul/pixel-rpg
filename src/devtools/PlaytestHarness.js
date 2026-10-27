// Helpers for driving the game through its real UI: character creation via the start screen, and multi-class runs.
//   const H = await import('/src/devtools/PlaytestHarness.js');
//   await H.createViaUI('ranger', 'elf', 'sunken_reaches', 50);
//   const results = await H.runClasses(['warrior', 'wizard'], { maxFloor: 5 });

import { PlaytestBot } from './PlaytestBot.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);

// If the death screen is (or is about to be) showing, click its real "New Character" button
export async function dismissDeath() {
    const pd = window.pixelDebug;
    if (!pd.player().alive) {
        for (let i = 0; i < 30 && !$('death-modal').classList.contains('active'); i++) await sleep(50);
    }
    if ($('death-modal').classList.contains('active')) { $('btn-death-reroll').click(); await sleep(80); }
}

export async function createViaUI(classId, raceId = 'human', moduleId = 'deep_dungeons', mapSize = 50) {
    await dismissDeath();
    window.openStart('home');
    await sleep(40);
    [...document.querySelectorAll('#start-home .start-big')].find(b => /New character/.test(b.innerText)).click();
    await sleep(40);
    const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('set-race', raceId);
    set('set-class', classId);
    await sleep(30);
    const preview = $('set-preview').innerText;
    [...document.querySelectorAll('#create-step1 .start-big')].find(b => /Choose adventure/.test(b.innerText)).click();
    await sleep(40);
    const card = [...document.querySelectorAll('#create-modules .pick-card')].find(b => b.getAttribute('onclick').includes(`'${moduleId}'`));
    if (card) card.click();
    await sleep(30);
    set('set-map-size', String(mapSize));
    [...document.querySelectorAll('#create-step2 .start-big')].find(b => /Begin/.test(b.innerText)).click();
    await sleep(150);
    const p = window.pixelDebug.player();
    return { cls: p.characterClass.id, race: p.race.id, preview: preview.slice(0, 100) };
}

export async function runClasses(classes, opts = {}) {
    const { raceId = 'human', moduleId = 'deep_dungeons', mapSize = 50, walkDelay = 4, ...botOpts } = opts;
    const results = [];
    for (const c of classes) {
        const info = await createViaUI(c, raceId, moduleId, mapSize);
        window.pixelDebug.setWalkDelay(walkDelay);
        const bot = new PlaytestBot({ maxIterations: 3500, ...botOpts });
        const r = await bot.run();
        r.createInfo = info;
        r.heapMB = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
        results.push(r);
        window.__results = results;
        try { localStorage.setItem('__playtest_results', JSON.stringify(results)); } catch (e) { /* ignore */ }
    }
    window.__allDone = true;
    return results;
}
