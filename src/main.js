// Pixel RPG Main Engine Orchestrator
// 200x200 Map | 25 Floors | Perception Fog of War | Secret Doors | Surprise Advantage

import { PRNG } from './core/RNG.js';
import { MAP_WIDTH, MAP_HEIGHT, TILES, VISIBILITY, DungeonManager } from './map/Dungeon.js';
import { generateFloor } from './map/Generator.js';
import { PlayerCharacter } from './entities/Character.js';
import { PerceptionSystem } from './systems/Perception.js';
import { CombatSystem } from './systems/Combat.js';
import { findPath } from './systems/Pathfinding.js';
import { ITEM_SLOTS } from './data/Items.js';

// Setup Canvas Viewport (11x11 Camera Culling Window)
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const VIEW_COLS = 11;
const VIEW_ROWS = 11;
const TILE_SIZE = 32;
canvas.width = VIEW_COLS * TILE_SIZE; // 352
canvas.height = VIEW_ROWS * TILE_SIZE; // 352

let dungeonManager = null;
let currentFloorData = null;
let player = null;
let prng = null;
let targetCursor = null;
let walkTimer = null;

// ==========================================
// 1. GAME INITIALIZATION
// ==========================================
export function startPlaythrough(seedString) {
    if (walkTimer) clearTimeout(walkTimer);
    walkTimer = null;
    targetCursor = null;

    prng = new PRNG(seedString);
    dungeonManager = new DungeonManager(seedString);
    player = new PlayerCharacter();

    loadFloor(1, true);

    updateHUD();
    draw();
}

function loadFloor(floorNum, enterFromAbove = true) {
    dungeonManager.currentFloor = floorNum;

    // Check bi-directional floor cache
    if (!dungeonManager.hasFloor(floorNum)) {
        const newFloor = generateFloor(dungeonManager.baseSeedString, floorNum);
        dungeonManager.storeFloor(floorNum, newFloor);
    }

    currentFloorData = dungeonManager.getFloor(floorNum);

    // Place player at Stairs Up if entering from above, or Stairs Down if coming back up
    if (enterFromAbove) {
        player.x = currentFloorData.stairsUpPos.x;
        player.y = currentFloorData.stairsUpPos.y;
    } else {
        player.x = currentFloorData.stairsDownPos.x;
        player.y = currentFloorData.stairsDownPos.y;
    }

    // Refresh Perception Fog of War
    PerceptionSystem.updateVisibility(
        currentFloorData,
        player.x,
        player.y,
        player.per,
        player.perMod,
        (sx, sy) => {
            postMessage(`👁️ Secret Door spotted at (${sx}, ${sy})!`, 'msg-loot');
        }
    );

    postMessage(`Floor ${floorNum}: ${currentFloorData.biome.name}`, 'msg-info');
    updateHUD();
}

// ==========================================
// 2. HUD & UI MANAGEMENT
// ==========================================
function updateHUD() {
    document.getElementById('seed-display').innerText = dungeonManager.baseSeedString;
    document.getElementById('hud-floor').innerText = `F${dungeonManager.currentFloor}`;
    document.getElementById('hud-hp').innerText = player.hp;
    document.getElementById('hud-max-hp').innerText = player.maxHp;
    document.getElementById('hud-ac').innerText = player.ac;

    // Sync URL for easy sharing
    const url = new URL(window.location);
    url.searchParams.set('seed', dungeonManager.baseSeedString);
    window.history.replaceState({}, '', url);
}

function postMessage(text, className = '') {
    const bar = document.getElementById('message-bar');
    bar.className = className;
    bar.innerHTML = `> ${text}`;
}

// ==========================================
// 3. CAMERA & RENDERING (VIEWPORT CULLING)
// ==========================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camX = player.x - Math.floor(VIEW_COLS / 2);
    const camY = player.y - Math.floor(VIEW_ROWS / 2);

    const { terrain, visibility, biome, monsters, chests } = currentFloorData;

    for (let ry = 0; ry < VIEW_ROWS; ry++) {
        for (let rx = 0; rx < VIEW_COLS; rx++) {
            const worldX = camX + rx;
            const worldY = camY + ry;
            const screenX = rx * TILE_SIZE;
            const screenY = ry * TILE_SIZE;

            if (worldX < 0 || worldX >= MAP_WIDTH || worldY < 0 || worldY >= MAP_HEIGHT) {
                ctx.fillStyle = '#050508';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                continue;
            }

            const idx = worldY * MAP_WIDTH + worldX;
            const vis = visibility[idx];
            const tile = terrain[idx];

            if (vis === VISIBILITY.UNEXPLORED) {
                // Pitch black
                ctx.fillStyle = '#06070a';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                continue;
            }

            const isDim = (vis === VISIBILITY.EXPLORED);

            // Render Base Terrain
            if (tile === TILES.WALL || tile === TILES.SECRET_DOOR) {
                ctx.fillStyle = isDim ? '#1d1f28' : biome.wallColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = isDim ? '#14151b' : biome.borderColor;
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            } else if (tile === TILES.DOOR_CLOSED) {
                ctx.fillStyle = isDim ? '#1a1b24' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🚪', screenX, screenY, isDim ? 0.4 : 1.0);
            } else if (tile === TILES.DOOR_OPEN) {
                ctx.fillStyle = isDim ? '#1a1b24' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#3e2e1e';
                ctx.strokeRect(screenX + 4, screenY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            } else if (tile === TILES.STAIRS_DOWN) {
                ctx.fillStyle = isDim ? '#1a1b24' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🪜', screenX, screenY, isDim ? 0.5 : 1.0);
            } else if (tile === TILES.STAIRS_UP) {
                ctx.fillStyle = isDim ? '#1a1b24' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('⛺', screenX, screenY, isDim ? 0.5 : 1.0);
            } else if (tile === TILES.RUBBLE) {
                ctx.fillStyle = isDim ? '#1a1b24' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🪨', screenX, screenY, isDim ? 0.4 : 1.0);
            } else {
                // Open Floor
                ctx.fillStyle = isDim ? '#101117' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = isDim ? '#0b0c10' : '#1d1f2b';
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            }

            // Render Chests (visible or remembered if opened)
            const chest = chests.find(c => c.x === worldX && c.y === worldY);
            if (chest && (vis === VISIBILITY.VISIBLE || chest.opened)) {
                drawGlyph(chest.opened ? '📭' : '📦', screenX, screenY, isDim ? 0.5 : 1.0);
            }

            // Render Monsters (ONLY in active VISIBILITY.VISIBLE!)
            if (vis === VISIBILITY.VISIBLE) {
                const monster = monsters.find(m => m.alive && m.x === worldX && m.y === worldY);
                if (monster) {
                    drawGlyph(monster.icon, screenX, screenY, 1.0);
                }
            }

            // Target Reticle
            if (targetCursor && targetCursor.x === worldX && targetCursor.y === worldY) {
                ctx.strokeStyle = '#64d8cb';
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.lineWidth = 1;
            }
        }
    }

    // Render Player at Viewport Center
    const centerScreenX = Math.floor(VIEW_COLS / 2) * TILE_SIZE;
    const centerScreenY = Math.floor(VIEW_ROWS / 2) * TILE_SIZE;
    drawGlyph('🛡️', centerScreenX, centerScreenY, 1.0);
}

function drawGlyph(glyph, x, y, opacity = 1.0) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '20px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.fillText(glyph, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
    ctx.restore();
}

// ==========================================
// 4. MOVEMENT & PATHFINDING
// ==========================================
function cancelWalking() {
    if (walkTimer) {
        clearTimeout(walkTimer);
        walkTimer = null;
    }
    targetCursor = null;
}

function handleTap(targetWorldX, targetWorldY) {
    if (targetWorldX < 0 || targetWorldX >= MAP_WIDTH || targetWorldY < 0 || targetWorldY >= MAP_HEIGHT) return;

    cancelWalking();
    targetCursor = { x: targetWorldX, y: targetWorldY };
    draw();

    const { terrain, monsters } = currentFloorData;
    const path = findPath(player.x, player.y, targetWorldX, targetWorldY, terrain, monsters);

    if (path.length > 0) {
        stepPath(path);
    } else {
        cancelWalking();
        draw();
    }
}

function stepPath(path) {
    if (path.length === 0) {
        cancelWalking();
        draw();
        return;
    }

    const [nextX, nextY] = path.shift();
    const { terrain, monsters, chests } = currentFloorData;
    const targetIdx = nextY * MAP_WIDTH + nextX;
    const tile = terrain[targetIdx];

    // 1. Check Door interaction
    if (tile === TILES.DOOR_CLOSED) {
        terrain[targetIdx] = TILES.DOOR_OPEN;
        cancelWalking();
        postMessage('🚪 Opened door. Checking room beyond...', 'msg-info');

        // Check if monster was right behind door -> surprise advantage opportunity!
        PerceptionSystem.updateVisibility(currentFloorData, player.x, player.y, player.per, player.perMod);
        draw();
        return;
    }

    // 2. Check Monster combat
    const targetMonster = monsters.find(m => m.alive && m.x === nextX && m.y === nextY);
    if (targetMonster) {
        cancelWalking();
        resolveCombatTurn(targetMonster);
        return;
    }

    // 3. Move player
    player.x = nextX;
    player.y = nextY;

    // 4. Update Fog of War
    PerceptionSystem.updateVisibility(
        currentFloorData,
        player.x,
        player.y,
        player.per,
        player.perMod,
        (sx, sy) => postMessage(`👁️ Perception Check: Secret Door revealed at (${sx}, ${sy})!`, 'msg-loot')
    );

    // 5. Check Chest Loot
    const chest = chests.find(c => !c.opened && c.x === nextX && c.y === nextY);
    if (chest) {
        chest.opened = true;
        const item = chest.item;
        player.equip(item);
        postMessage(`🎁 Found & Equipped: ${item.name} (${item.desc})!`, 'msg-loot');
        updateHUD();
    }

    // 6. Check Stairs
    if (tile === TILES.STAIRS_DOWN) {
        cancelWalking();
        if (dungeonManager.currentFloor < 25) {
            loadFloor(dungeonManager.currentFloor + 1, true);
        } else {
            postMessage('🏆 You have reached the final depths of Floor 25!', 'msg-victory');
        }
        draw();
        return;
    }

    if (tile === TILES.STAIRS_UP && dungeonManager.currentFloor > 1) {
        cancelWalking();
        loadFloor(dungeonManager.currentFloor - 1, false);
        draw();
        return;
    }

    draw();

    if (path.length > 0) {
        walkTimer = setTimeout(() => stepPath(path), 110);
    } else {
        cancelWalking();
        draw();
    }
}

// ==========================================
// 5. COMBAT (WITH SURPRISE ADVANTAGE)
// ==========================================
function resolveCombatTurn(monster) {
    // Check surprise condition: monster is unaware (e.g. attacked from behind door / blindspot)
    const isSurprise = monster.unaware === true;
    monster.unaware = false; // loses unaware state after first strike

    const result = CombatSystem.resolvePlayerAttack(prng, player, monster, isSurprise);

    if (result.isSurprise) {
        postMessage(`⚡ SURPRISE ATTACK! Rolled 2d20(${result.roll1}, ${result.roll2}) -> ${result.d20}. Target denied DEX AC! Dealt ${result.damage} dmg!`, 'msg-victory');
    } else if (result.isHit) {
        postMessage(`💥 Hit ${monster.name} for ${result.damage} dmg! (${monster.hp}/${monster.maxHp} HP left)`, 'msg-hit');
    } else {
        postMessage(`🛡️ Missed ${monster.name} (Rolled ${result.attackTotal} vs AC ${result.targetAC}).`, 'msg-miss');
    }

    if (result.monsterDied) {
        postMessage(`🏆 Defeated ${monster.name}!`, 'msg-victory');
    } else if (result.monsterCounter?.isHit) {
        setTimeout(() => {
            postMessage(`🩸 ${monster.name} counter-attacked for ${result.monsterCounter.damage} dmg! (${player.hp}/${player.maxHp} HP)`, 'msg-miss');
            updateHUD();
        }, 350);
    }

    updateHUD();
    draw();
}

// ==========================================
// 6. QUERY & INSPECT SYSTEM
// ==========================================
export function inspectTileAt(worldX, worldY) {
    if (worldX < 0 || worldX >= MAP_WIDTH || worldY < 0 || worldY >= MAP_HEIGHT) return;

    const { terrain, visibility, monsters, chests, biome } = currentFloorData;
    const idx = worldY * MAP_WIDTH + worldX;
    const vis = visibility[idx];
    const tile = terrain[idx];

    let data = null;

    if (player.x === worldX && player.y === worldY) {
        data = {
            icon: '🛡️',
            name: 'Hero (Human Warrior)',
            desc: `Floor ${dungeonManager.currentFloor} Adventurer.`,
            details: `
                <strong>HP:</strong> ${player.hp} / ${player.maxHp}<br>
                <strong>AC:</strong> ${player.ac}<br>
                <strong>Perception:</strong> ${player.per} (+${player.perMod})<br>
                <strong>Stats:</strong> STR ${player.str} | DEX ${player.dex} | CON ${player.con}
            `
        };
    } else if (vis === VISIBILITY.VISIBLE && monsters.some(m => m.alive && m.x === worldX && m.y === worldY)) {
        const m = monsters.find(mon => mon.alive && mon.x === worldX && mon.y === worldY);
        data = {
            icon: m.icon,
            name: m.name,
            desc: m.desc,
            details: `
                <strong>HP:</strong> ${m.hp} / ${m.maxHp}<br>
                <strong>AC:</strong> ${m.ac} (Denies DEX if surprised)<br>
                <strong>Attack:</strong> 1d${m.dice} Damage<br>
                <strong>Alertness:</strong> ${m.unaware ? 'Unaware (Vulnerable to Surprise!)' : 'Alert'}
            `
        };
    } else if (vis !== VISIBILITY.UNEXPLORED && chests.some(c => c.x === worldX && c.y === worldY)) {
        const c = chests.find(ch => ch.x === worldX && ch.y === worldY);
        data = {
            icon: c.opened ? '📭' : '📦',
            name: c.opened ? 'Opened Chest' : 'Ancient Chest',
            desc: c.opened ? 'Already looted.' : 'Contains floor equipment reward.',
            details: c.opened ? 'Empty' : `<strong>Contents:</strong> ${c.item.name} (${c.item.desc})`
        };
    } else if (vis !== VISIBILITY.UNEXPLORED) {
        if (tile === TILES.DOOR_CLOSED) {
            data = { icon: '🚪', name: 'Closed Oak Door', desc: 'Wooden door blocking line-of-sight.', details: 'Tap to open and surprise enemies behind it.' };
        } else if (tile === TILES.DOOR_OPEN) {
            data = { icon: '🚪', name: 'Open Doorway', desc: 'Passable doorway.', details: 'Allows movement and sight lines.' };
        } else if (tile === TILES.STAIRS_DOWN) {
            data = { icon: '🪜', name: 'Stairs Down', desc: `Descent to Floor ${dungeonManager.currentFloor + 1}.`, details: 'Tap to venture deeper into the dungeon.' };
        } else if (tile === TILES.STAIRS_UP) {
            data = { icon: '⛺', name: 'Stairs Up', desc: `Ascent to Floor ${dungeonManager.currentFloor - 1}.`, details: 'Return to previous explored floor.' };
        } else if (tile === TILES.RUBBLE) {
            data = { icon: '🪨', name: 'Stone Rubble', desc: 'Impassable collapsed masonry.', details: 'Provides cover against line-of-sight.' };
        } else if (tile === TILES.WALL) {
            data = { icon: '🧱', name: 'Dungeon Wall', desc: `${biome.name} granite bedrock.`, details: 'Blocks all movement and vision.' };
        } else {
            data = { icon: '▫️', name: 'Dungeon Floor', desc: biome.name, details: `Coordinates: (${worldX}, ${worldY})` };
        }
    } else {
        data = { icon: '⬛', name: 'Unexplored Darkness', desc: 'Pitch black darkness beyond your line-of-sight.', details: 'Increase Perception or walk closer to reveal.' };
    }

    if (data) {
        document.getElementById('inspect-icon').innerText = data.icon;
        document.getElementById('inspect-name').innerText = data.name;
        document.getElementById('inspect-desc').innerText = data.desc;
        document.getElementById('inspect-details').innerHTML = data.details;
        document.getElementById('inspect-modal').classList.add('active');
        postMessage(`🔍 Inspected ${data.name}`, 'msg-inspect');
    }
}

// Convert screen tap coordinates to 200x200 World Coordinates
function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    const screenTileX = Math.floor(canvasX / TILE_SIZE);
    const screenTileY = Math.floor(canvasY / TILE_SIZE);

    const camX = player.x - Math.floor(VIEW_COLS / 2);
    const camY = player.y - Math.floor(VIEW_ROWS / 2);

    return {
        x: camX + screenTileX,
        y: camY + screenTileY
    };
}

// ==========================================
// 7. INPUT LISTENERS (TOUCH LONG-PRESS vs TAP)
// ==========================================
let holdTimer = null;
let holdTriggered = false;
let startPos = { x: 0, y: 0 };

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    startPos = { x: touch.clientX, y: touch.clientY };
    holdTriggered = false;

    const world = screenToWorld(touch.clientX, touch.clientY);

    holdTimer = setTimeout(() => {
        holdTriggered = true;
        if (navigator.vibrate) navigator.vibrate(35);
        inspectTileAt(world.x, world.y);
    }, 400);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (!holdTimer) return;
    const touch = e.touches[0];
    if (Math.hypot(touch.clientX - startPos.x, touch.clientY - startPos.y) > 8) {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
    if (!holdTriggered) {
        const touch = e.changedTouches[0];
        const world = screenToWorld(touch.clientX, touch.clientY);
        handleTap(world.x, world.y);
    }
    holdTriggered = false;
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) return;
    startPos = { x: e.clientX, y: e.clientY };
    holdTriggered = false;
    const world = screenToWorld(e.clientX, e.clientY);

    holdTimer = setTimeout(() => {
        holdTriggered = true;
        inspectTileAt(world.x, world.y);
    }, 400);
});

canvas.addEventListener('mouseup', (e) => {
    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
    if (e.button === 0 && !holdTriggered) {
        const world = screenToWorld(e.clientX, e.clientY);
        handleTap(world.x, world.y);
    }
    holdTriggered = false;
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const world = screenToWorld(e.clientX, e.clientY);
    inspectTileAt(world.x, world.y);
});

// Arrow Keys / WASD Support
window.addEventListener('keydown', (e) => {
    let dx = 0, dy = 0;
    if (e.key === 'ArrowUp' || e.key === 'w') dy = -1;
    if (e.key === 'ArrowDown' || e.key === 's') dy = 1;
    if (e.key === 'ArrowLeft' || e.key === 'a') dx = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') dx = 1;
    if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        handleTap(player.x + dx, player.y + dy);
    }
});

// Export character sheet modal populator
export function populateSheet() {
    const formatMod = (m) => m >= 0 ? `+${m}` : `${m}`;
    document.getElementById('sheet-str').innerText = `STR: ${player.str}`;
    document.getElementById('mod-str').innerText = formatMod(player.strMod);
    document.getElementById('sheet-dex').innerText = `DEX: ${player.dex}`;
    document.getElementById('mod-dex').innerText = formatMod(player.dexMod);
    document.getElementById('sheet-con').innerText = `CON: ${player.con}`;
    document.getElementById('mod-con').innerText = formatMod(player.conMod);
    document.getElementById('sheet-int').innerText = `INT: ${player.int}`;
    document.getElementById('mod-int').innerText = formatMod(player.intMod);
    document.getElementById('sheet-wis').innerText = `WIS: ${player.wis}`;
    document.getElementById('mod-wis').innerText = formatMod(player.wisMod);
    document.getElementById('sheet-cha').innerText = `CHA: ${player.cha}`;
    document.getElementById('mod-cha').innerText = formatMod(player.chaMod);

    document.getElementById('sheet-per').innerText = `PER: ${player.per} (${formatMod(player.perMod)})`;
    document.getElementById('sheet-hp').innerText = `${player.hp} / ${player.maxHp}`;
    document.getElementById('sheet-ac').innerText = player.ac;

    // Render 10 equipped slots + 15 backpack slots
    const equipHtml = Object.entries(player.equipment).map(([slot, item]) => {
        return `<div><strong>${slot.toUpperCase()}:</strong> ${item ? `${item.icon} ${item.name} (${item.desc})` : '<span style="color:#555">Empty</span>'}</div>`;
    }).join('');
    document.getElementById('sheet-equip').innerHTML = equipHtml;
}

// Start from URL seed or fresh seed
const urlParams = new URLSearchParams(window.location.search);
const initSeed = urlParams.get('seed') || PRNG.generateRandomSeed();
startPlaythrough(initSeed);
