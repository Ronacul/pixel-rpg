// Pixel RPG Main Engine Orchestrator
// 200x200 Map | 25 Floors | Perception Fog | Monster Pursuit AI | Blood Stains | Zoom & Paperdoll

import { PRNG } from './core/RNG.js';
import { MAP_WIDTH, MAP_HEIGHT, TILES, VISIBILITY, DungeonManager } from './map/Dungeon.js';
import { generateFloor } from './map/Generator.js';
import { PlayerCharacter } from './entities/Character.js';
import { PerceptionSystem } from './systems/Perception.js';
import { CombatSystem } from './systems/Combat.js';
import { findPath } from './systems/Pathfinding.js';
import { ITEM_SLOTS } from './data/Items.js';

// Viewport Camera & Zoom Settings
const ZOOM_LEVELS = [
    { label: '1x', cols: 11, rows: 11, size: 32 },
    { label: '1.5x', cols: 17, rows: 17, size: 21 },
    { label: '2x', cols: 25, rows: 25, size: 15 }
];
let currentZoomIndex = 0;

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

let VIEW_COLS = ZOOM_LEVELS[0].cols;
let VIEW_ROWS = ZOOM_LEVELS[0].rows;
let TILE_SIZE = ZOOM_LEVELS[0].size;
canvas.width = VIEW_COLS * TILE_SIZE;
canvas.height = VIEW_ROWS * TILE_SIZE;

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

export function restartSameSeed() {
    startPlaythrough(dungeonManager.baseSeedString);
}

function loadFloor(floorNum, enterFromAbove = true) {
    dungeonManager.currentFloor = floorNum;

    if (!dungeonManager.hasFloor(floorNum)) {
        const newFloor = generateFloor(dungeonManager.baseSeedString, floorNum);
        dungeonManager.storeFloor(floorNum, newFloor);
    }

    currentFloorData = dungeonManager.getFloor(floorNum);

    if (enterFromAbove) {
        player.x = currentFloorData.stairsUpPos.x;
        player.y = currentFloorData.stairsUpPos.y;
    } else {
        player.x = currentFloorData.stairsDownPos.x;
        player.y = currentFloorData.stairsDownPos.y;
    }

    PerceptionSystem.updateVisibility(
        currentFloorData,
        player.x,
        player.y,
        player.per,
        player.perMod,
        (sx, sy) => postMessage(`👁️ Secret Door spotted at (${sx}, ${sy})!`, 'msg-loot')
    );

    postMessage(`Floor ${floorNum}: ${currentFloorData.biome.name}`, 'msg-info');
    updateHUD();
}

// ==========================================
// 2. ZOOM SYSTEM
// ==========================================
export function cycleZoom() {
    currentZoomIndex = (currentZoomIndex + 1) % ZOOM_LEVELS.length;
    const z = ZOOM_LEVELS[currentZoomIndex];
    VIEW_COLS = z.cols;
    VIEW_ROWS = z.rows;
    TILE_SIZE = z.size;
    canvas.width = VIEW_COLS * TILE_SIZE;
    canvas.height = VIEW_ROWS * TILE_SIZE;

    const azl = document.getElementById('action-zoom-label');
    if (azl) azl.innerText = z.label;
    const hz = document.getElementById('hud-zoom');
    if (hz) hz.innerText = z.label;
    postMessage(`🔍 Map Zoom set to ${z.label} (${VIEW_COLS}x${VIEW_ROWS} tiles view)`, 'msg-info');
    draw();
}

// ==========================================
// 3. HUD & MESSAGING
// ==========================================
function updateHUD() {
    document.getElementById('seed-display').innerText = dungeonManager.baseSeedString;
    document.getElementById('hud-floor').innerText = `F${dungeonManager.currentFloor}`;
    document.getElementById('hud-hp').innerText = player.hp;
    document.getElementById('hud-max-hp').innerText = player.maxHp;
    document.getElementById('hud-ac').innerText = player.ac;

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
// 4. RENDERING LOOP (BLOOD POOLS & CULLING)
// ==========================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camX = player.x - Math.floor(VIEW_COLS / 2);
    const camY = player.y - Math.floor(VIEW_ROWS / 2);

    const { terrain, visibility, biome, monsters, chests, bloodStains } = currentFloorData;

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
                ctx.fillStyle = '#050608';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                continue;
            }

            const isDim = (vis === VISIBILITY.EXPLORED);

            // Terrain Base
            if (tile === TILES.WALL || tile === TILES.SECRET_DOOR) {
                ctx.fillStyle = isDim ? '#1d1f28' : biome.wallColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = isDim ? '#14151b' : biome.borderColor;
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            } else if (tile === TILES.DOOR_CLOSED) {
                ctx.fillStyle = isDim ? '#181922' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🚪', screenX, screenY, isDim ? 0.4 : 1.0);
            } else if (tile === TILES.DOOR_OPEN) {
                ctx.fillStyle = isDim ? '#181922' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#3e2e1e';
                ctx.strokeRect(screenX + 3, screenY + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            } else if (tile === TILES.STAIRS_DOWN) {
                ctx.fillStyle = isDim ? '#181922' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🪜', screenX, screenY, isDim ? 0.5 : 1.0);
            } else if (tile === TILES.STAIRS_UP) {
                ctx.fillStyle = isDim ? '#181922' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('⛺', screenX, screenY, isDim ? 0.5 : 1.0);
            } else if (tile === TILES.RUBBLE) {
                ctx.fillStyle = isDim ? '#181922' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🪨', screenX, screenY, isDim ? 0.4 : 1.0);
            } else {
                ctx.fillStyle = isDim ? '#0f1016' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = isDim ? '#090a0e' : '#1b1d28';
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            }

            // Blood Pool Decals on Floor
            const blood = bloodStains.find(b => b.x === worldX && b.y === worldY);
            if (blood) {
                ctx.fillStyle = isDim ? 'rgba(110, 15, 20, 0.4)' : 'rgba(180, 20, 30, 0.85)';
                ctx.beginPath();
                ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, Math.min(TILE_SIZE / 2 - 2, blood.size * (TILE_SIZE / 32)), 0, Math.PI * 2);
                ctx.fill();
            }

            // Chests
            const chest = chests.find(c => c.x === worldX && c.y === worldY);
            if (chest && (vis === VISIBILITY.VISIBLE || chest.opened)) {
                drawGlyph(chest.opened ? '📭' : '📦', screenX, screenY, isDim ? 0.5 : 1.0);
            }

            // Monsters (Only in active visibility)
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

    // Render Player at Viewport Center (if alive)
    if (player.alive) {
        const centerScreenX = Math.floor(VIEW_COLS / 2) * TILE_SIZE;
        const centerScreenY = Math.floor(VIEW_ROWS / 2) * TILE_SIZE;
        drawGlyph('🛡️', centerScreenX, centerScreenY, 1.0);
    }
}

function drawGlyph(glyph, x, y, opacity = 1.0) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.floor(TILE_SIZE * 0.65)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.fillText(glyph, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
    ctx.restore();
}

// Spawn blood pool on tile
function addBlood(x, y) {
    const { bloodStains } = currentFloorData;
    const existing = bloodStains.find(b => b.x === x && b.y === y);
    if (existing) {
        existing.size = Math.min(14, existing.size + 2);
    } else {
        bloodStains.push({ x, y, size: Math.random() * 3 + 6 });
    }
}

// ==========================================
// 5. TURN CYCLE & MONSTER PURSUIT AI
// ==========================================
function endTurn() {
    if (!player.alive) return;

    // 1. Passive Regen Check
    const { healed } = player.advanceTurn();
    if (healed) {
        postMessage(`💖 Resting: Natural regeneration healed 1 HP! (${player.hp}/${player.maxHp})`, 'msg-loot');
        updateHUD();
    }

    // 2. Monster Pursuit AI Loop
    const { monsters, terrain } = currentFloorData;
    let pursuing = false;

    for (const m of monsters) {
        if (!m.alive) continue;

        // Wake up monster if in player's current line-of-sight
        const mIdx = m.y * MAP_WIDTH + m.x;
        if (currentFloorData.visibility[mIdx] === VISIBILITY.VISIBLE) {
            m.alert = true;
        }

        if (m.alert) {
            const dist = Math.hypot(player.x - m.x, player.y - m.y);

            // Adjacent -> Attack player!
            if (dist <= 1.5) {
                const roll = prng.nextInt(1, 20) + 1;
                if (roll >= player.ac) {
                    const dmg = prng.nextInt(1, m.dice || 4);
                    player.hp = Math.max(0, player.hp - dmg);
                    addBlood(player.x, player.y);
                    postMessage(`🩸 ${m.name} struck you for ${dmg} dmg! (${player.hp}/${player.maxHp} HP)`, 'msg-miss');
                    updateHUD();

                    if (player.hp <= 0) {
                        handlePlayerDeath(m.name);
                        return;
                    }
                } else {
                    postMessage(`🛡️ Blocked ${m.name}'s attack (Roll ${roll} vs AC ${player.ac}).`);
                }
            } else if (dist <= 12) {
                // Pursue player along open tiles
                const step = getStepTowards(m.x, m.y, player.x, player.y, terrain, monsters);
                if (step) {
                    m.x = step.x;
                    m.y = step.y;
                    pursuing = true;
                }
            }
        }
    }

    if (pursuing) {
        // Redraw to show moving monsters in sight
        draw();
    }
}

// BFS single-step direction for monster pursuit
function getStepTowards(sx, sy, tx, ty, terrain, monsters) {
    const queue = [[sx, sy]];
    const visited = new Set([`${sx},${sy}`]);
    const firstStep = new Map();

    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];

    while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        if (cx === tx && cy === ty) {
            return firstStep.get(`${cx},${cy}`);
        }

        for (const d of dirs) {
            const nx = cx + d.dx;
            const ny = cy + d.dy;
            const k = `${nx},${ny}`;

            if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
            if (visited.has(k)) continue;

            const t = terrain[ny * MAP_WIDTH + nx];
            // Monsters can walk through open floors and doors
            const passable = (t === TILES.FLOOR || t === TILES.DOOR_OPEN || (nx === tx && ny === ty));
            const occupied = monsters.some(m => m.alive && m.x === nx && m.y === ny);

            if (passable && !occupied) {
                visited.add(k);
                const step = (cx === sx && cy === sy) ? { x: nx, y: ny } : firstStep.get(`${cx},${cy}`);
                firstStep.set(k, step);
                queue.push([nx, ny]);
            }
        }
    }
    return null;
}

// ==========================================
// 6. PERMADEATH & GAME OVER
// ==========================================
function handlePlayerDeath(slainBy) {
    player.alive = false;
    cancelWalking();

    document.getElementById('death-floor').innerText = `Floor ${dungeonManager.currentFloor}`;
    document.getElementById('death-slain-by').innerText = `Slain by: ${slainBy}`;
    document.getElementById('death-turns').innerText = `Turns Survived: ${player.turnCount}`;
    document.getElementById('death-modal').classList.add('active');

    postMessage(`💀 YOU DIED on Floor ${dungeonManager.currentFloor}.`, 'msg-miss');
    draw();
}

// ==========================================
// 7. MOVEMENT & PATH STEPPING
// ==========================================
function cancelWalking() {
    if (walkTimer) {
        clearTimeout(walkTimer);
        walkTimer = null;
    }
    targetCursor = null;
}

function handleTap(targetWorldX, targetWorldY) {
    if (!player.alive) return;
    if (targetWorldX < 0 || targetWorldX >= MAP_WIDTH || targetWorldY < 0 || targetWorldY >= MAP_HEIGHT) return;

    // Tap on self = Wait / Rest 1 Turn
    if (player.x === targetWorldX && player.y === targetWorldY) {
        cancelWalking();
        endTurn();
        draw();
        return;
    }

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
    if (!player.alive || path.length === 0) {
        cancelWalking();
        draw();
        return;
    }

    const [nextX, nextY] = path.shift();
    const { terrain, monsters, chests } = currentFloorData;
    const targetIdx = nextY * MAP_WIDTH + nextX;
    const tile = terrain[targetIdx];

    // Door Breach
    if (tile === TILES.DOOR_CLOSED) {
        terrain[targetIdx] = TILES.DOOR_OPEN;
        cancelWalking();
        postMessage('🚪 Breached door! Checking room beyond...', 'msg-info');
        PerceptionSystem.updateVisibility(currentFloorData, player.x, player.y, player.per, player.perMod);
        endTurn();
        draw();
        return;
    }

    // Monster Attack
    const targetMonster = monsters.find(m => m.alive && m.x === nextX && m.y === nextY);
    if (targetMonster) {
        cancelWalking();
        resolveCombatTurn(targetMonster);
        endTurn();
        return;
    }

    // Step to tile
    player.x = nextX;
    player.y = nextY;

    // Fog update
    PerceptionSystem.updateVisibility(
        currentFloorData,
        player.x,
        player.y,
        player.per,
        player.perMod,
        (sx, sy) => postMessage(`👁️ Secret Door revealed at (${sx}, ${sy})!`, 'msg-loot')
    );

    // Loot Chest
    const chest = chests.find(c => !c.opened && c.x === nextX && c.y === nextY);
    if (chest) {
        chest.opened = true;
        player.equip(chest.item);
        postMessage(`🎁 Found & Equipped: ${chest.item.name}!`, 'msg-loot');
        updateHUD();
    }

    // Stairs
    if (tile === TILES.STAIRS_DOWN) {
        cancelWalking();
        if (dungeonManager.currentFloor < 25) {
            loadFloor(dungeonManager.currentFloor + 1, true);
        } else {
            postMessage('🏆 You reached the final 25th floor depths!', 'msg-victory');
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

    endTurn();
    draw();

    if (path.length > 0 && player.alive) {
        walkTimer = setTimeout(() => stepPath(path), 110);
    } else {
        cancelWalking();
        draw();
    }
}

// ==========================================
// 8. COMBAT RESOLUTION (WITH BLOOD SPLATTERS)
// ==========================================
function resolveCombatTurn(monster) {
    const isSurprise = monster.unaware === true;
    monster.unaware = false;
    monster.alert = true;

    const result = CombatSystem.resolvePlayerAttack(prng, player, monster, isSurprise);

    if (result.isHit) {
        addBlood(monster.x, monster.y);
        if (result.isSurprise) {
            postMessage(`⚡ SURPRISE STRIKE! Rolled 2d20(${result.roll1}, ${result.roll2}) -> ${result.d20}. Dealt ${result.damage} dmg!`, 'msg-victory');
        } else {
            postMessage(`💥 Hit ${monster.name} for ${result.damage} dmg! (${monster.hp}/${monster.maxHp} HP)`, 'msg-hit');
        }
    } else {
        postMessage(`🛡️ Missed ${monster.name} (Rolled ${result.attackTotal} vs AC ${result.targetAC}).`, 'msg-miss');
    }

    if (result.monsterDied) {
        postMessage(`🏆 Defeated ${monster.name}!`, 'msg-victory');
    } else if (result.monsterCounter?.isHit) {
        addBlood(player.x, player.y);
        setTimeout(() => {
            postMessage(`🩸 ${monster.name} bit back for ${result.monsterCounter.damage} dmg! (${player.hp}/${player.maxHp} HP)`, 'msg-miss');
            updateHUD();
            if (player.hp <= 0) handlePlayerDeath(monster.name);
        }, 300);
    }

    updateHUD();
    draw();
}

// ==========================================
// 9. QUERY & INSPECT
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
            desc: `Level ${player.level} • Floor ${dungeonManager.currentFloor}.`,
            details: `
                <strong>HP:</strong> ${player.hp} / ${player.maxHp}<br>
                <strong>AC:</strong> ${player.ac}<br>
                <strong>Perception:</strong> ${player.per} (+${player.perMod})<br>
                <strong>Regen:</strong> 1 HP every ${player.REGEN_RATE} turns
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
                <strong>AC:</strong> ${m.ac} (denied DEX if surprised)<br>
                <strong>Damage:</strong> 1d${m.dice}<br>
                <strong>State:</strong> ${m.alert ? 'Alert & Pursuing' : 'Unaware (Vulnerable)'}
            `
        };
    } else if (vis !== VISIBILITY.UNEXPLORED && chests.some(c => c.x === worldX && c.y === worldY)) {
        const c = chests.find(ch => ch.x === worldX && ch.y === worldY);
        data = {
            icon: c.opened ? '📭' : '📦',
            name: c.opened ? 'Opened Chest' : 'Ancient Chest',
            desc: c.opened ? 'Already looted.' : 'Contains floor equipment reward.',
            details: c.opened ? 'Empty' : `<strong>Item:</strong> ${c.item.name} (${c.item.desc})`
        };
    } else if (vis !== VISIBILITY.UNEXPLORED) {
        if (tile === TILES.DOOR_CLOSED) {
            data = { icon: '🚪', name: 'Closed Oak Door', desc: 'Blocks movement and sightlines.', details: 'Tap to breach open with surprise advantage.' };
        } else if (tile === TILES.DOOR_OPEN) {
            data = { icon: '🚪', name: 'Open Doorway', desc: 'Passable doorway.', details: 'Permits line of sight and traversal.' };
        } else if (tile === TILES.STAIRS_DOWN) {
            data = { icon: '🪜', name: 'Stairs Down', desc: `Descent to Floor ${dungeonManager.currentFloor + 1}.`, details: 'Tap to delve deeper.' };
        } else if (tile === TILES.STAIRS_UP) {
            data = { icon: '⛺', name: 'Stairs Up', desc: `Ascent to Floor ${dungeonManager.currentFloor - 1}.`, details: 'Tap to return to cleared upper floor.' };
        } else if (tile === TILES.RUBBLE) {
            data = { icon: '🪨', name: 'Stone Rubble', desc: 'Collapsed dungeon masonry.', details: 'Impassable barrier.' };
        } else if (tile === TILES.WALL) {
            data = { icon: '🧱', name: 'Dungeon Wall', desc: `${biome.name} granite bedrock.`, details: 'Impassable perimeter.' };
        } else {
            data = { icon: '▫️', name: 'Dungeon Floor', desc: biome.name, details: `World coordinates (${worldX}, ${worldY})` };
        }
    } else {
        data = { icon: '⬛', name: 'Darkness', desc: 'Unexplored territory.', details: 'Walk closer or increase Perception to illuminate.' };
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

// Screen to World Coords
function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenTileX = Math.floor(((clientX - rect.left) * scaleX) / TILE_SIZE);
    const screenTileY = Math.floor(((clientY - rect.top) * scaleY) / TILE_SIZE);

    const camX = player.x - Math.floor(VIEW_COLS / 2);
    const camY = player.y - Math.floor(VIEW_ROWS / 2);

    return {
        x: camX + screenTileX,
        y: camY + screenTileY
    };
}

// ==========================================
// 10. INPUT LISTENERS
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

export function waitTurn() {
    if (!player || !player.alive) return;
    endTurn();
    postMessage('⏳ You wait a turn to recover and observe surroundings.', 'msg-info');
    draw();
}

window.addEventListener('keydown', (e) => {
    // Escape closes modals
    if (e.key === 'Escape') {
        const sheet = document.getElementById('sheet-modal');
        const inspect = document.getElementById('inspect-modal');
        if (sheet && sheet.classList.contains('active')) sheet.classList.remove('active');
        if (inspect && inspect.classList.contains('active')) inspect.classList.remove('active');
        return;
    }

    // Hotkey: C or I toggles Character Sheet
    if (e.key === 'c' || e.key === 'C' || e.key === 'i' || e.key === 'I') {
        const sheet = document.getElementById('sheet-modal');
        if (sheet) {
            if (sheet.classList.contains('active')) {
                sheet.classList.remove('active');
            } else {
                populateSheet();
                sheet.classList.add('active');
            }
        }
        return;
    }

    // Hotkey: Z cycles Zoom
    if (e.key === 'z' || e.key === 'Z') {
        cycleZoom();
        return;
    }

    let dx = 0, dy = 0;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -1;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dy = 1;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;
    if (e.key === ' ' || e.key === 'Spacebar') {
        // Space = Wait / Rest Turn
        e.preventDefault();
        waitTurn();
        return;
    }
    if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        handleTap(player.x + dx, player.y + dy);
    }
});

// ==========================================
// 11. CHARACTER SHEET VISUAL PAPERDOLL (25 SLOTS)
// ==========================================
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

    // Visual Paperdoll Body Slots: 10 categorized equipment positions
    const eq = player.equipment;
    const slotCard = (slotName, item, iconPlaceholder) => `
        <div class="paperdoll-slot ${item ? 'equipped' : ''}" title="${slotName}: ${item ? item.name : 'Empty'}">
            <div class="slot-label">${slotName}</div>
            <div class="slot-icon">${item ? item.icon : iconPlaceholder}</div>
            <div class="slot-name">
                ${item ? item.name : '<span style="color:#4a5068">Empty</span>'}
            </div>
            <div class="slot-stat">
                ${item && item.desc ? item.desc : ''}
            </div>
        </div>
    `;

    document.getElementById('paperdoll-body').innerHTML = `
        <div style="display: flex; justify-content: center; gap: 8px;">
            ${slotCard('Helm', eq[ITEM_SLOTS.HELM], '🪖')}
            ${slotCard('Amulet', eq[ITEM_SLOTS.AMULET], '📿')}
        </div>
        <div style="display: flex; justify-content: space-between; gap: 6px; margin: 6px 0;">
            ${slotCard('Main Hand', eq[ITEM_SLOTS.MAIN_HAND], '⚔️')}
            ${slotCard('Armor', eq[ITEM_SLOTS.ARMOR], '🦺')}
            ${slotCard('Off Hand', eq[ITEM_SLOTS.OFF_HAND], '🛡️')}
        </div>
        <div style="display: flex; justify-content: space-between; gap: 6px;">
            ${slotCard('Left Ring', eq[ITEM_SLOTS.RING_LEFT], '💍')}
            ${slotCard('Cloak', eq[ITEM_SLOTS.CLOAK], '🧥')}
            ${slotCard('Right Ring', eq[ITEM_SLOTS.RING_RIGHT], '💍')}
        </div>
        <div style="display: flex; justify-content: center; gap: 8px; margin-top: 6px;">
            ${slotCard('Gauntlets', eq[ITEM_SLOTS.GAUNTLETS], '🧤')}
            ${slotCard('Boots', eq[ITEM_SLOTS.BOOTS], '🥾')}
        </div>
    `;

    // 15 Backpack slots (10 equipped + 15 backpack = 25 total slots)
    const bagHtml = player.backpack.map((item, idx) => `
        <div class="backpack-slot ${item ? 'equipped' : ''}">
            ${item ? `${item.icon} <span style="color:#ddd">${item.name}</span>` : `<span style="color:#444">Slot ${idx+1}</span>`}
        </div>
    `).join('');
    document.getElementById('backpack-grid').innerHTML = bagHtml;
}

// Initial launch
const urlParams = new URLSearchParams(window.location.search);
const initSeed = urlParams.get('seed') || PRNG.generateRandomSeed();
startPlaythrough(initSeed);
