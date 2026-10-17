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
import { CLASSES, XP_TABLE, isAttributeMilestone } from './data/Classes.js';

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
        (sx, sy) => {
            postMessage(`👁️ Secret Door spotted at (${sx}, ${sy})! +25 XP`, 'msg-loot');
            const levelUps = player.gainXp(25);
            if (levelUps.length > 0) handleLevelUps(levelUps);
            updateHUD();
        }
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
    const hl = document.getElementById('hud-level');
    if (hl) hl.innerText = `Lv.${player.level}`;
    document.getElementById('hud-hp').innerText = player.hp;
    document.getElementById('hud-max-hp').innerText = player.maxHp;
    document.getElementById('hud-ac').innerText = player.ac;

    // Feat button status in Action Bar
    const abilities = player.getAvailableAbilities();
    const primaryFeat = abilities[0];
    if (primaryFeat) {
        const featIcon = document.getElementById('action-feat-icon');
        const featName = document.getElementById('action-feat-name');
        if (featIcon) featIcon.innerText = primaryFeat.icon;
        const cd = player.cooldowns[primaryFeat.id] || 0;
        if (featName) {
            featName.innerText = cd > 0 ? `${primaryFeat.name} (${cd}t)` : `${primaryFeat.name}`;
            featName.style.color = cd > 0 ? '#888' : '#ffcc00';
        }
    }

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
        (sx, sy) => {
            postMessage(`👁️ Secret Door revealed at (${sx}, ${sy})! +25 XP`, 'msg-loot');
            const levelUps = player.gainXp(25);
            if (levelUps.length > 0) handleLevelUps(levelUps);
            updateHUD();
        }
    );

    // Loot Chest
    const chest = chests.find(c => !c.opened && c.x === nextX && c.y === nextY);
    if (chest) {
        chest.opened = true;
        const xpReward = 20 * currentFloorData.floorLevel;
        const levelUps = player.gainXp(xpReward);
        const added = player.addToBackpack(chest.item);
        if (added) {
            postMessage(`🎁 Looted: ${chest.item.name}! Added to Backpack (+${xpReward} XP)`, 'msg-loot');
        } else {
            postMessage(`🎁 Found ${chest.item.name}, but Backpack is full! (+${xpReward} XP)`, 'msg-loot');
        }
        if (levelUps.length > 0) {
            handleLevelUps(levelUps);
        }
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
        const xpReward = 15 * currentFloorData.floorLevel + Math.max(10, monster.maxHp * 2);
        const levelUps = player.gainXp(xpReward);
        postMessage(`🏆 Defeated ${monster.name}! +${xpReward} XP`, 'msg-victory');
        if (levelUps.length > 0) {
            handleLevelUps(levelUps);
        }
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

// ==========================================
// 11. CLASS FEATS & ABILITIES EXECUTION
// ==========================================
export function usePrimaryFeat() {
    if (!player || !player.alive) return;
    const abilities = player.getAvailableAbilities();
    if (abilities.length === 0) {
        postMessage('No class abilities unlocked yet.', 'msg-miss');
        return;
    }

    const ability = abilities[0];
    if (!player.canUseAbility(ability.id)) {
        const cd = player.cooldowns[ability.id] || 0;
        postMessage(`⏳ ${ability.name} is on cooldown (${cd} turns remaining).`, 'msg-miss');
        return;
    }

    if (ability.type === 'heal') {
        const healAmt = Math.max(6, Math.floor(player.maxHp * 0.35));
        const prevHp = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        const actualHeal = player.hp - prevHp;
        player.triggerAbilityCooldown(ability.id);
        postMessage(`${ability.icon} ${ability.name} used! Restored ${actualHeal} HP.`, 'msg-victory');
        endTurn();
        updateHUD();
        draw();
    } else if (ability.type === 'buff_attack') {
        player.activeBuffs.push({ id: ability.id, name: ability.name, stat: 'bonus_dmg', value: 8, turnsLeft: 6 });
        player.triggerAbilityCooldown(ability.id);
        postMessage(`${ability.icon} ${ability.name} activated! Next melee strike deals crushing bonus damage.`, 'msg-victory');
        endTurn();
        updateHUD();
        draw();
    } else if (ability.type === 'buff_all') {
        player.activeBuffs.push({ id: ability.id, name: ability.name, stat: 'ac', value: 2, turnsLeft: 15 });
        player.activeBuffs.push({ id: ability.id, name: ability.name, stat: 'attack', value: 2, turnsLeft: 15 });
        player.triggerAbilityCooldown(ability.id);
        postMessage(`${ability.icon} ${ability.name} performed! +2 AC and +2 Attack for 15 turns.`, 'msg-victory');
        endTurn();
        updateHUD();
        draw();
    } else if (ability.type === 'ranged_damage') {
        const { monsters, visibility } = currentFloorData;
        const visibleMonsters = monsters.filter(m => m.alive && visibility[m.y * MAP_WIDTH + m.x] === VISIBILITY.VISIBLE);
        if (visibleMonsters.length === 0) {
            postMessage(`⚠️ No monsters visible to target with ${ability.name}!`, 'msg-miss');
            return;
        }
        visibleMonsters.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
        const target = visibleMonsters[0];
        const dmg = prng.nextInt(4, 10);
        target.hp = Math.max(0, target.hp - dmg);
        addBlood(target.x, target.y);
        player.triggerAbilityCooldown(ability.id);
        postMessage(`✨ Magic Missile struck ${target.name} for ${dmg} damage!`, 'msg-victory');
        if (target.hp <= 0) {
            target.alive = false;
            const xp = 15 * currentFloorData.floorLevel + Math.max(10, target.maxHp * 2);
            const levelUps = player.gainXp(xp);
            postMessage(`🏆 Defeated ${target.name}! +${xp} XP`, 'msg-victory');
            if (levelUps.length > 0) handleLevelUps(levelUps);
        }
        endTurn();
        updateHUD();
        draw();
    }
}

// ==========================================
// 12. LEVEL UP & MILESTONES
// ==========================================
export function handleLevelUps(levelUps) {
    if (!levelUps || levelUps.length === 0) return;
    const latest = levelUps[levelUps.length - 1];
    const totalHpGain = levelUps.reduce((sum, l) => sum + l.hpGain, 0);

    const modal = document.getElementById('levelup-modal');
    if (modal) {
        document.getElementById('levelup-subtitle').innerText = `You reached Level ${latest.level} (${player.characterClass.title})!`;
        document.getElementById('levelup-hp-gain').innerText = `+${totalHpGain} Max HP (Full HP Restored!)`;

        const featSec = document.getElementById('levelup-feat-section');
        const allUnlocked = levelUps.flatMap(l => l.unlockedAbilities);
        if (allUnlocked.length > 0) {
            featSec.style.display = 'block';
            document.getElementById('levelup-feat-desc').innerHTML = allUnlocked
                .map(a => `<strong>${a.icon} ${a.name}:</strong> ${a.desc}`)
                .join('<br>');
        } else {
            featSec.style.display = 'none';
        }

        const msSec = document.getElementById('levelup-milestone-section');
        if (player.attributePoints > 0) {
            msSec.style.display = 'block';
        } else {
            msSec.style.display = 'none';
        }

        modal.classList.add('active');
    }
    updateHUD();
}

export function boostStat(stat) {
    if (player.boostAttribute(stat)) {
        postMessage(`⭐ Milestone Attribute Boost! ${stat.toUpperCase()} increased by +1!`, 'msg-victory');
        updateHUD();
        populateSheet();
        const modal = document.getElementById('levelup-modal');
        if (modal && player.attributePoints === 0) {
            const msSec = document.getElementById('levelup-milestone-section');
            if (msSec) msSec.style.display = 'none';
        }
    }
}

// ==========================================
// 13. INTERACTIVE PAPERDOLL SELECTION & ACTIONS
// ==========================================
let selectedSlot = null; // { type: 'body'|'backpack', id: string|number }

export function selectSlot(type, id) {
    selectedSlot = { type, id };
    populateSheet();
}

export function equipSelectedBackpackItem() {
    if (!selectedSlot || selectedSlot.type !== 'backpack') return;
    const res = player.equipFromBackpack(selectedSlot.id);
    if (res) {
        postMessage(`⚔️ Equipped ${res.equipped.name} into ${res.slot.replace('_', ' ')}!`, 'msg-loot');
        selectedSlot = { type: 'body', id: res.slot };
        updateHUD();
        populateSheet();
    }
}

export function unequipSelectedBodyItem() {
    if (!selectedSlot || selectedSlot.type !== 'body') return;
    const res = player.unequipToBackpack(selectedSlot.id);
    if (res.success) {
        postMessage(`🎒 Unequipped ${res.item.name} to backpack slot ${res.backpackIdx + 1}.`, 'msg-info');
        selectedSlot = { type: 'backpack', id: res.backpackIdx };
        updateHUD();
        populateSheet();
    } else {
        postMessage(`⚠️ ${res.reason}`, 'msg-miss');
    }
}

export function dropSelectedBackpackItem() {
    if (!selectedSlot || selectedSlot.type !== 'backpack') return;
    const dropped = player.removeFromBackpack(selectedSlot.id);
    if (dropped) {
        postMessage(`🗑️ Dropped ${dropped.name}.`, 'msg-info');
        selectedSlot = null;
        updateHUD();
        populateSheet();
    }
}

window.addEventListener('keydown', (e) => {
    // Escape closes modals
    if (e.key === 'Escape') {
        const sheet = document.getElementById('sheet-modal');
        const inspect = document.getElementById('inspect-modal');
        const levelup = document.getElementById('levelup-modal');
        if (sheet && sheet.classList.contains('active')) sheet.classList.remove('active');
        if (inspect && inspect.classList.contains('active')) inspect.classList.remove('active');
        if (levelup && levelup.classList.contains('active')) levelup.classList.remove('active');
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

    // Hotkey: F triggers primary class feat
    if (e.key === 'f' || e.key === 'F') {
        usePrimaryFeat();
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
// 14. CHARACTER SHEET & PAPERDOLL RENDERER
// ==========================================
export function populateSheet() {
    const formatMod = (m) => m >= 0 ? `+${m}` : `${m}`;
    const pClass = player.characterClass;

    // Header info & XP Progress
    const titleEl = document.getElementById('sheet-title');
    if (titleEl) titleEl.innerText = `${pClass.icon} ${pClass.name.toUpperCase()} (LV. ${player.level})`;

    const xpText = document.getElementById('sheet-xp-text');
    if (xpText) xpText.innerText = `XP: ${player.xp} / ${player.getNextLevelXp()} • ${pClass.title}`;

    const xpBar = document.getElementById('sheet-xp-bar');
    if (xpBar) {
        const pct = Math.min(100, Math.floor((player.xp / player.getNextLevelXp()) * 100));
        xpBar.style.width = `${pct}%`;
    }

    // Milestone Banner & Boost Buttons
    const mb = document.getElementById('milestone-banner');
    const mbc = document.getElementById('milestone-points-count');
    const hasMilestones = player.attributePoints > 0;
    if (mb) mb.style.display = hasMilestones ? 'block' : 'none';
    if (mbc) mbc.innerText = player.attributePoints;

    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
        const btn = document.getElementById(`btn-boost-${stat}`);
        if (btn) btn.style.display = hasMilestones ? 'inline-block' : 'none';
    });

    // Attributes
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

    // Visual Paperdoll Body Slots (10 slots)
    const eq = player.equipment;
    const isBodySelected = (slot) => selectedSlot?.type === 'body' && selectedSlot?.id === slot;

    const slotCard = (slotName, slotKey, iconPlaceholder) => {
        const item = eq[slotKey];
        const isSel = isBodySelected(slotKey);
        return `
            <div class="paperdoll-slot ${item ? 'equipped' : ''} ${isSel ? 'selected' : ''}" 
                 onclick="window.selectSlot('body', '${slotKey}')"
                 title="${slotName}: ${item ? item.name : 'Empty'}">
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
    };

    document.getElementById('paperdoll-body').innerHTML = `
        <div style="display: flex; justify-content: center; gap: 8px;">
            ${slotCard('Helm', ITEM_SLOTS.HELM, '🪖')}
            ${slotCard('Amulet', ITEM_SLOTS.AMULET, '📿')}
        </div>
        <div style="display: flex; justify-content: space-between; gap: 6px; margin: 6px 0;">
            ${slotCard('Main Hand', ITEM_SLOTS.MAIN_HAND, '⚔️')}
            ${slotCard('Armor', ITEM_SLOTS.ARMOR, '🦺')}
            ${slotCard('Off Hand', ITEM_SLOTS.OFF_HAND, '🛡️')}
        </div>
        <div style="display: flex; justify-content: space-between; gap: 6px;">
            ${slotCard('Left Ring', ITEM_SLOTS.RING_LEFT, '💍')}
            ${slotCard('Cloak', ITEM_SLOTS.CLOAK, '🧥')}
            ${slotCard('Right Ring', ITEM_SLOTS.RING_RIGHT, '💍')}
        </div>
        <div style="display: flex; justify-content: center; gap: 8px; margin-top: 6px;">
            ${slotCard('Gauntlets', ITEM_SLOTS.GAUNTLETS, '🧤')}
            ${slotCard('Boots', ITEM_SLOTS.BOOTS, '🥾')}
        </div>
    `;

    // 15 Backpack slots
    const isBagSelected = (idx) => selectedSlot?.type === 'backpack' && selectedSlot?.id === idx;
    const bagHtml = player.backpack.map((item, idx) => {
        const isSel = isBagSelected(idx);
        return `
            <div class="backpack-slot ${item ? 'equipped' : ''} ${isSel ? 'selected' : ''}"
                 onclick="window.selectSlot('backpack', ${idx})"
                 title="Slot ${idx + 1}: ${item ? item.name : 'Empty'}">
                ${item ? `${item.icon} <span style="color:#ddd">${item.name}</span>` : `<span style="color:#444">Slot ${idx+1}</span>`}
            </div>
        `;
    }).join('');
    document.getElementById('backpack-grid').innerHTML = bagHtml;

    // Item Action Drawer
    const cardTitle = document.getElementById('item-card-title');
    const cardContent = document.getElementById('item-card-content');
    const cardName = document.getElementById('item-card-name');
    const cardSlot = document.getElementById('item-card-slot');
    const cardDesc = document.getElementById('item-card-desc');
    const cardActions = document.getElementById('item-card-actions');

    if (selectedSlot) {
        if (selectedSlot.type === 'body') {
            const item = player.equipment[selectedSlot.id];
            cardTitle.innerText = `Selected Body Slot: ${selectedSlot.id.replace('_', ' ').toUpperCase()}`;
            if (item) {
                cardContent.style.display = 'block';
                cardName.innerText = `${item.icon} ${item.name}`;
                cardSlot.innerText = `Equipped (${item.slot})`;
                cardDesc.innerText = item.desc || 'Equipped gear';
                cardActions.innerHTML = `
                    <button class="btn-action-small" onclick="window.unequipSelectedBodyItem()">🎒 Unequip to Backpack</button>
                `;
            } else {
                cardContent.style.display = 'none';
                cardTitle.innerText = `Empty ${selectedSlot.id.replace('_', ' ')} slot. Select an item in your backpack to equip.`;
            }
        } else if (selectedSlot.type === 'backpack') {
            const item = player.backpack[selectedSlot.id];
            if (item) {
                cardTitle.innerText = `Selected Backpack Item (Slot ${selectedSlot.id + 1}):`;
                cardContent.style.display = 'block';
                cardName.innerText = `${item.icon} ${item.name}`;
                cardSlot.innerText = `Slot: ${item.slot.replace('_', ' ')}`;
                cardDesc.innerText = item.desc || 'Standard item';
                cardActions.innerHTML = `
                    <button class="btn-action-small" style="background: #193826; border-color: #55ff77; color: #aaffaa;" onclick="window.equipSelectedBackpackItem()">⚔️ Equip to ${item.slot.replace('_', ' ')}</button>
                    <button class="btn-action-small" style="background: #381919; border-color: #ff6666; color: #ffaaaa;" onclick="window.dropSelectedBackpackItem()">🗑️ Drop Item</button>
                `;
            } else {
                cardContent.style.display = 'none';
                cardTitle.innerText = `Backpack Slot ${selectedSlot.id + 1} is empty.`;
            }
        }
    } else {
        cardTitle.innerText = 'Tap an item in your backpack to equip, or tap equipped gear to unequip:';
        cardContent.style.display = 'none';
    }

    // Proficiencies & Abilities
    const profEl = document.getElementById('sheet-proficiencies');
    if (profEl) {
        profEl.innerText = `Armor: ${pClass.proficiencies.armor.join(', ')} • Weapons: ${pClass.proficiencies.weapons.join(', ')} • Skills: ${pClass.proficiencies.skills.join(', ')}`;
    }

    const abilEl = document.getElementById('sheet-abilities');
    if (abilEl) {
        abilEl.innerHTML = pClass.abilities.map(a => {
            const unlocked = player.level >= a.level;
            const cd = player.cooldowns[a.id] || 0;
            const status = !unlocked ? `<span style="color:#666">[Unlocks at Lv. ${a.level}]</span>` : (cd > 0 ? `<span style="color:#ff6666">[CD: ${cd}t]</span>` : `<span style="color:#55ff77">[Ready]</span>`);
            return `<div>${a.icon} <strong>${a.name}</strong> ${status}: ${a.desc}</div>`;
        }).join('');
    }
}

// Initial launch
const urlParams = new URLSearchParams(window.location.search);
const initSeed = urlParams.get('seed') || PRNG.generateRandomSeed();
startPlaythrough(initSeed);
