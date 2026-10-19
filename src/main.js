// Pixel RPG Main Engine Orchestrator
// 100x100 Map | 25 Floors | Perception Radar | Monster Pursuit AI | Blood Decals
// Diverse Combat: Melee, Ranged Projectiles, AoE Blasts, Lingering Hazard Zones, Status Effects
// Tactical Terrain: Pillars (Cover), Pits, Destructible Barrels, Ancient Altars, Flammable Foliage, Traps

import { PRNG } from './core/RNG.js';
import { MAP_WIDTH, MAP_HEIGHT, TILES, VISIBILITY, DungeonManager, MAP_SIZES, DEFAULT_MAP_SIZE, setMapSize, normalizeMapSize } from './map/Dungeon.js';
import { generateFloor } from './map/Generator.js';
import { generateTestFloor, isTestSeed, TEST_MIN_MAP_SIZE } from './map/TestLevel.js';
import { PlayerCharacter } from './entities/Character.js';
import { PerceptionSystem } from './systems/Perception.js';
import { CombatSystem } from './systems/Combat.js';
import { findPath } from './systems/Pathfinding.js';
import { ITEM_SLOTS, SLOT_LABELS, getCompatibleSlots, BASE_ITEMS, createItemFromBase, generateLootItem, EQUIPMENT_SETS, calculateEquippedSetBonuses, MUSHROOM_TYPES } from './data/Items.js';
import { CLASSES, SKILLS, ClassManager } from './data/Classes.js';
import { RaceManager, DEFAULT_RACE_ID } from './data/Races.js';
import { FeatManager, FEATS } from './data/Feats.js';
import { PROGRESSION, XP_TABLE, XP_REWARDS, MASTERIES, monsterXp } from './data/Progression.js';
import { EffectSystem, STATUS_TYPES, ZONE_TYPES, DELIVERY_TYPES } from './systems/Effects.js';

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
let levelUpQueue = [];
let currentLevelUpData = null;
let currentSheetTab = 'gear'; // 'gear' | 'stats'

// Targeting Mode State Machine
let targetingMode = false;
let targetingAction = null; // { name, delivery, range, radius, isPositive, isItem, backpackIdx, ... }
let hoverWorldPos = null;   // { x, y } currently targeted by cursor

// ---- Persistent settings (map size, class, race, debug tools) ----
const SETTINGS_KEY = 'pixel_rpg_settings_v1';
let settings = { mapSize: DEFAULT_MAP_SIZE, classId: 'warrior', raceId: DEFAULT_RACE_ID, debug: false };
let godMode = false;

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) settings = { ...settings, ...JSON.parse(raw) };
    } catch (e) {}
    settings.mapSize = normalizeMapSize(settings.mapSize);
    settings.classId = ClassManager.getClass(settings.classId).id;
    settings.raceId = RaceManager.getRace(settings.raceId).id;
}

function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}

export function getSettings() {
    return { ...settings };
}

export function isDebugEnabled() {
    return !!settings.debug || (dungeonManager && dungeonManager.testMode);
}

// ==========================================
// 1. GAME INITIALIZATION
// ==========================================
// opts: { mapSize, classId, raceId } override the saved settings for this run only.
export function startPlaythrough(seedString, opts = {}) {
    if (walkTimer) clearTimeout(walkTimer);
    walkTimer = null;
    targetCursor = null;
    levelUpQueue = [];
    currentLevelUpData = null;
    currentSheetTab = 'gear';
    selectedSlot = null;
    godMode = false;

    const testMode = isTestSeed(seedString);
    let mapSize = normalizeMapSize(opts.mapSize ?? settings.mapSize);
    if (testMode) mapSize = Math.max(mapSize, TEST_MIN_MAP_SIZE); // the test layout needs >= 100x100
    setMapSize(mapSize);

    prng = new PRNG(seedString);
    dungeonManager = new DungeonManager(seedString, { testMode });
    player = new PlayerCharacter(opts.classId ?? settings.classId, opts.raceId ?? settings.raceId);

    cancelTargeting();
    loadFloor(1, true);

    updateHUD();
    draw();
    initRemoteControl();
    refreshDebugPanel();
}

export function restartSameSeed() {
    startPlaythrough(dungeonManager.baseSeedString);
}

function loadFloor(floorNum, enterFromAbove = true) {
    dungeonManager.currentFloor = floorNum;

    if (!dungeonManager.hasFloor(floorNum)) {
        const newFloor = dungeonManager.testMode
            ? generateTestFloor(dungeonManager.baseSeedString, floorNum)
            : generateFloor(dungeonManager.baseSeedString, floorNum);
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

    runPerceptionRadar();

    postMessage(`Floor ${floorNum}: ${currentFloorData.biome.name}`, 'msg-info');
    updateHUD();
}

function runPerceptionRadar() {
    PerceptionSystem.updateVisibility(
        currentFloorData,
        player.x,
        player.y,
        player.per,
        player.perMod,
        (sx, sy) => {
            postMessage(`👁️ Secret Door spotted at (${sx}, ${sy})! +${XP_REWARDS.secretDoor} XP`, 'msg-loot');
            const levelUps = player.gainXp(XP_REWARDS.secretDoor);
            if (levelUps.length > 0) handleLevelUps(levelUps);
            updateHUD();
        },
        (tx, ty, trapTile) => {
            const trapName = (trapTile === TILES.TRAP_SPIKE) ? 'Spike Trap' : (trapTile === TILES.TRAP_FIRE ? 'Fire Plate' : 'Gas Spores');
            postMessage(`⚠️ TRAP SPOTTED! ${trapName} detected at (${tx}, ${ty})! +${XP_REWARDS.trap} XP`, 'msg-loot');
            const levelUps = player.gainXp(XP_REWARDS.trap);
            if (levelUps.length > 0) handleLevelUps(levelUps);
            updateHUD();
        }
    );
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

    const hr = document.getElementById('hud-rations');
    if (hr) hr.innerText = player.rations !== undefined ? player.rations : 5;

    // Status effect badges on HUD
    const hudStatuses = document.getElementById('hud-statuses');
    if (hudStatuses) {
        if (player.statuses && player.statuses.length > 0) {
            hudStatuses.innerHTML = player.statuses
                .map(s => `<span title="${s.name} (${s.duration}t)">${s.icon}</span>`)
                .join(' ');
        } else {
            hudStatuses.innerHTML = '';
        }
    }

    // Aim button label
    const targetLabel = document.getElementById('action-target-label');
    if (targetLabel) {
        targetLabel.innerText = targetingMode ? 'Aiming...' : 'Aim';
    }

    // Spells button
    const pAbil = player.getAvailableAbilities();
    const readyAbilCount = pAbil.filter(a => player.canUseAbility(a.id)).length;
    const spellsName = document.getElementById('action-spells-name');
    if (spellsName) {
        spellsName.innerText = `Spells (${readyAbilCount})`;
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
// 4. RENDERING LOOP (BLOOD, HAZARD ZONES, COVER, TARGETING)
// ==========================================
function draw() {
    if (!player || !currentFloorData) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic Hallucination Canvas Filter (psychedelic fungal spores)
    if (EffectSystem.hasStatus(player, 'HALLUCINATING')) {
        canvas.style.filter = 'hue-rotate(160deg) saturate(2.2) contrast(1.15)';
    } else {
        canvas.style.filter = 'none';
    }

    const camX = player.x - Math.floor(VIEW_COLS / 2);
    const camY = player.y - Math.floor(VIEW_ROWS / 2);

    const { terrain, visibility, biome, monsters, chests, mushrooms, corpses, bloodStains, hazardZones, trapsRevealed } = currentFloorData;

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

            // Terrain Rendering
            if (tile === TILES.WALL || tile === TILES.SECRET_DOOR) {
                ctx.fillStyle = isDim ? '#1d1f28' : biome.wallColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = isDim ? '#14151b' : biome.borderColor;
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            } else if (tile === TILES.PILLAR) {
                ctx.fillStyle = isDim ? '#181b22' : '#2b3040';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = isDim ? '#12141a' : '#4f5872';
                ctx.strokeRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                drawGlyph('🏛️', screenX, screenY, isDim ? 0.45 : 1.0);
            } else if (tile === TILES.PIT) {
                ctx.fillStyle = '#020204';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#1b1420';
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🕳️', screenX, screenY, isDim ? 0.4 : 0.95);
            } else if (tile === TILES.BARREL) {
                ctx.fillStyle = isDim ? '#14151c' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🛢️', screenX, screenY, isDim ? 0.5 : 1.0);
            } else if (tile === TILES.ALTAR) {
                ctx.fillStyle = isDim ? '#1a1912' : '#282414';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#ffd700';
                ctx.strokeRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                drawGlyph('⛪', screenX, screenY, isDim ? 0.6 : 1.0);
            } else if (tile === TILES.ALTAR_INERT) {
                ctx.fillStyle = isDim ? '#121214' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🗿', screenX, screenY, isDim ? 0.4 : 0.8);
            } else if (tile === TILES.FOLIAGE) {
                ctx.fillStyle = isDim ? '#0d1810' : '#142718';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#1b3820';
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                drawGlyph('🌿', screenX, screenY, isDim ? 0.45 : 0.9);
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
            } else if (tile === TILES.TRAP_SPIKE || tile === TILES.TRAP_FIRE || tile === TILES.TRAP_GAS) {
                // Trap renders as normal floor unless spotted by Perception
                ctx.fillStyle = isDim ? '#0f1016' : biome.floorColor;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = isDim ? '#090a0e' : '#1b1d28';
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

                const isSpotted = trapsRevealed && trapsRevealed.has(idx);
                if (isSpotted) {
                    const trapGlyph = (tile === TILES.TRAP_SPIKE) ? '⚙️' : (tile === TILES.TRAP_FIRE ? '🔥' : '☁️');
                    drawGlyph(trapGlyph, screenX, screenY, isDim ? 0.5 : 1.0);
                    ctx.strokeStyle = '#ff4455';
                    ctx.strokeRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                }
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

            // Lingering Hazard Zones (Fire, Poison Gas, Consecration, etc.)
            const zone = hazardZones?.find(z => z.x === worldX && z.y === worldY);
            if (zone && vis !== VISIBILITY.UNEXPLORED) {
                const zDef = ZONE_TYPES[zone.type];
                if (zDef) {
                    ctx.fillStyle = zDef.color;
                    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = zDef.borderColor;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    drawGlyph(zDef.icon, screenX, screenY, isDim ? 0.4 : 0.75);
                }
            }

            // Chests
            const chest = chests.find(c => c.x === worldX && c.y === worldY);
            if (chest && (vis === VISIBILITY.VISIBLE || chest.opened)) {
                drawGlyph(chest.opened ? '📭' : '📦', screenX, screenY, isDim ? 0.5 : 1.0);
            }

            // Forageable Mushrooms
            const shroom = mushrooms?.find(m => m.x === worldX && m.y === worldY);
            if (shroom && vis !== VISIBILITY.UNEXPLORED) {
                drawGlyph('🍄', screenX, screenY, isDim ? 0.45 : 1.0);
            }

            // Slain Monster Carcasses / Corpses
            const corpse = corpses?.find(c => !c.harvested && c.x === worldX && c.y === worldY);
            if (corpse && vis !== VISIBILITY.UNEXPLORED) {
                drawGlyph('🥩', screenX, screenY, isDim ? 0.4 : 0.85);
            }

            // Monsters (Only in active visibility)
            if (vis === VISIBILITY.VISIBLE) {
                const monster = monsters.find(m => m.alive && m.x === worldX && m.y === worldY);
                if (monster) {
                    drawGlyph(monster.icon, screenX, screenY, 1.0);

                    // Active status badge icons above monster
                    if (monster.statuses && monster.statuses.length > 0) {
                        const statusIcons = monster.statuses.map(s => s.icon).join('');
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.font = `${Math.floor(TILE_SIZE * 0.32)}px sans-serif`;
                        ctx.fillText(statusIcons, screenX + TILE_SIZE / 2, screenY + 5);
                        ctx.restore();
                    }

                    // Tactical cover indicator if adjacent to pillar
                    const cover = EffectSystem.calculateTacticalCover(monster.x, monster.y, player.x, player.y, terrain);
                    if (cover.hasCover) {
                        ctx.save();
                        ctx.font = `${Math.floor(TILE_SIZE * 0.3)}px sans-serif`;
                        ctx.fillText('🛡️', screenX + 5, screenY + TILE_SIZE - 2);
                        ctx.restore();
                    }
                }
            }

            // Target Reticle (during normal pathing)
            if (targetCursor && targetCursor.x === worldX && targetCursor.y === worldY && !targetingMode) {
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

        // Player status effect badge icons
        if (player.statuses && player.statuses.length > 0) {
            const pIcons = player.statuses.map(s => s.icon).join('');
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = `${Math.floor(TILE_SIZE * 0.35)}px sans-serif`;
            ctx.fillText(pIcons, centerScreenX + TILE_SIZE / 2, centerScreenY + 6);
            ctx.restore();
        }
    }

    // ==========================================
    // TARGETING MODE OVERLAYS (RAYCAST & AOE PREVIEW)
    // ==========================================
    if (targetingMode && targetingAction && hoverWorldPos) {
        const dist = Math.hypot(hoverWorldPos.x - player.x, hoverWorldPos.y - player.y);
        const maxRange = targetingAction.range || 6;
        const inRange = dist <= maxRange;

        // Line-of-sight raycast check
        const ray = EffectSystem.bresenhamRaycast(player.x, player.y, hoverWorldPos.x, hoverWorldPos.y, terrain);

        // Draw projectile tracer line
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = (inRange && ray.clear) ? 'rgba(100, 255, 120, 0.85)' : 'rgba(255, 70, 70, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        const startScreenX = Math.floor(VIEW_COLS / 2) * TILE_SIZE + TILE_SIZE / 2;
        const startScreenY = Math.floor(VIEW_ROWS / 2) * TILE_SIZE + TILE_SIZE / 2;
        ctx.moveTo(startScreenX, startScreenY);

        const endScreenX = (hoverWorldPos.x - camX) * TILE_SIZE + TILE_SIZE / 2;
        const endScreenY = (hoverWorldPos.y - camY) * TILE_SIZE + TILE_SIZE / 2;
        ctx.lineTo(endScreenX, endScreenY);
        ctx.stroke();
        ctx.restore();

        // Shaded AoE Blast Area preview
        if (targetingAction.radius && targetingAction.radius >= 1) {
            const aoeTiles = EffectSystem.getAoETiles(hoverWorldPos.x, hoverWorldPos.y, targetingAction.radius);
            for (const at of aoeTiles) {
                const asx = (at.x - camX) * TILE_SIZE;
                const asy = (at.y - camY) * TILE_SIZE;
                if (asx >= 0 && asx < canvas.width && asy >= 0 && asy < canvas.height) {
                    ctx.fillStyle = targetingAction.isPositive ? 'rgba(100, 216, 203, 0.28)' : 'rgba(255, 100, 50, 0.32)';
                    ctx.fillRect(asx, asy, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = targetingAction.isPositive ? '#64d8cb' : '#ff6633';
                    ctx.strokeRect(asx + 1, asy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                }
            }
        }

        // Draw crosshair on target
        const hsX = (hoverWorldPos.x - camX) * TILE_SIZE;
        const hsY = (hoverWorldPos.y - camY) * TILE_SIZE;
        if (hsX >= 0 && hsX < canvas.width && hsY >= 0 && hsY < canvas.height) {
            ctx.strokeStyle = inRange && ray.clear ? '#ffcc00' : '#ff4444';
            ctx.lineWidth = 2;
            ctx.strokeRect(hsX + 2, hsY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            drawGlyph('🎯', hsX, hsY, 0.95);
        }
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

function addBlood(x, y) {
    const { bloodStains } = currentFloorData;
    const existing = bloodStains.find(b => b.x === x && b.y === y);
    if (existing) {
        existing.size = Math.min(14, existing.size + 2);
    } else {
        bloodStains.push({ x, y, size: Math.random() * 3 + 6 });
    }
}

function addCorpse(monster) {
    if (!currentFloorData.corpses) currentFloorData.corpses = [];
    const mName = monster.name;
    const isVenomous = mName.toLowerCase().includes('spider') || mName.toLowerCase().includes('viper') || mName.toLowerCase().includes('crawler') || mName.toLowerCase().includes('snake');
    currentFloorData.corpses.push({
        id: `corpse_${monster.id || Date.now()}`,
        x: monster.x,
        y: monster.y,
        name: `${monster.name} Carcass`,
        monsterName: monster.name,
        icon: '🥩',
        isVenomous,
        harvested: false
    });
}

// Single-step direction for terrified monster fleeing away from player
function getStepAwayFrom(sx, sy, px, py, terrain, monsters) {
    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: 1 }
    ];
    let bestStep = null;
    let maxDist = Math.hypot(sx - px, sy - py);

    for (const d of dirs) {
        const nx = sx + d.dx;
        const ny = sy + d.dy;
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
        const t = terrain[ny * MAP_WIDTH + nx];
        const isImpassable = (t === TILES.WALL || t === TILES.PILLAR || t === TILES.PIT || t === TILES.RUBBLE || t === TILES.DOOR_CLOSED || t === TILES.BARREL);
        const occupied = monsters.some(other => other.alive && other.x === nx && other.y === ny);
        const isPlayerTile = (nx === px && ny === py);
        if (!isImpassable && !occupied && !isPlayerTile) {
            const dist = Math.hypot(nx - px, ny - py);
            if (dist > maxDist) {
                maxDist = dist;
                bestStep = { x: nx, y: ny };
            }
        }
    }
    return bestStep;
}

// ==========================================
// 5. TURN CYCLE & LINGERING HAZARDS / STATUS TICKS
// ==========================================
function endTurn() {
    if (!player.alive) return;

    // Check if player is stunned: skip player's next turn
    const playerMods = EffectSystem.getStatusModifiers(player);
    if (playerMods.isStunned) {
        postMessage('⚡ You are STUNNED and incapacitated this turn!', 'msg-miss');
    }

    // 1. Natural turn advance (passive regen, hunger consumption, cooldowns, buffs)
    const { healed, hungerMsg } = player.advanceTurn();
    if (hungerMsg === 'ration_consumed') {
        postMessage('🍖 Sustenance: Hearty ration consumed to stave off hunger.', 'msg-info');
    } else if (hungerMsg === 'starving') {
        postMessage('🥀 Extreme Hunger! You are STARVING (-2 Attack, HP regen halted)! Camp or eat now!', 'msg-miss');
    } else if (healed) {
        postMessage(`💖 Resting: Natural regeneration healed 1 HP! (${player.hp}/${player.maxHp})`, 'msg-loot');
    }

    // 2. Tick Player Lingering Statuses (Bleed, Poison, Burn, Regen)
    EffectSystem.tickEntityStatuses(player, true, prng, {
        onDamage: (ent, isP, status, dmg, dmgType) => {
            postMessage(`${status.icon} ${status.name} drained ${dmg} ${dmgType} dmg! (${player.hp}/${player.maxHp} HP)`, 'msg-miss');
        },
        onHeal: (ent, isP, status, heal) => {
            postMessage(`${status.icon} ${status.name} restored ${heal} HP! (${player.hp}/${player.maxHp})`, 'msg-loot');
        },
        onBlood: (x, y) => addBlood(x, y)
    });

    if (player.hp <= 0) {
        handlePlayerDeath('Lingering Affliction');
        return;
    }

    // 3. King of Kings 3pc Sovereign Fear Aura Pulse
    if (player.setBonuses?.fearAura) {
        const fearRadius = player.setBonuses.fearRadius || 3;
        for (const m of currentFloorData.monsters) {
            if (!m.alive) continue;
            const mIdx = m.y * MAP_WIDTH + m.x;
            if (currentFloorData.visibility[mIdx] === VISIBILITY.VISIBLE) {
                const dist = Math.hypot(m.x - player.x, m.y - player.y);
                if (dist <= fearRadius && !EffectSystem.hasStatus(m, 'TERRIFIED')) {
                    const mSave = prng.nextInt(1, 20) + (m.wisMod || 0);
                    const fearDC = 10 + (player.chaMod || 0) + (player.setBonuses.fearDC ? 2 : 0);
                    if (mSave < fearDC) {
                        EffectSystem.applyStatus(m, 'TERRIFIED', 3, 1, 'King of Kings Aura');
                        postMessage(`👑 Sovereign Majesty! ${m.name} was overwhelmed with dread and is TERRIFIED!`, 'msg-loot');
                    }
                }
            }
        }
    }

    // 4. Tick Floor Hazard Zones (Fire, Poison Gas, Consecration, Acid, Web)
    EffectSystem.tickFloorZones(currentFloorData, player, prng, {
        onPlayerDamage: (dmg, zoneName) => {
            postMessage(`⚠️ Caught in ${zoneName} taking ${dmg} dmg! (${player.hp}/${player.maxHp} HP)`, 'msg-miss');
        },
        onPlayerHeal: (heal) => {
            postMessage(`✨ Consecrated Ground healed you for +${heal} HP!`, 'msg-loot');
        },
        onMonsterDamage: (m, dmg, zoneType) => {
            if (m.hp <= 0) {
                m.alive = false;
                addCorpse(m);
                const xp = monsterXp(m, currentFloorData.floorLevel);
                const lvs = player.gainXp(xp);
                postMessage(`💀 ${m.name} perished in ${zoneType}! +${xp} XP`, 'msg-victory');
                if (lvs.length > 0) handleLevelUps(lvs);
            }
        }
    });

    if (player.hp <= 0) {
        handlePlayerDeath('Hazard Zone');
        return;
    }

    // 5. Tick Living Monster Statuses
    const { monsters, terrain } = currentFloorData;
    for (const m of monsters) {
        if (!m.alive) continue;
        EffectSystem.tickEntityStatuses(m, false, prng, {
            onBlood: (x, y) => addBlood(x, y)
        });
        if (m.hp <= 0) {
            m.alive = false;
            addCorpse(m);
            const xp = monsterXp(m, currentFloorData.floorLevel);
            const lvs = player.gainXp(xp);
            postMessage(`💀 ${m.name} succumbed to lingering affliction! +${xp} XP`, 'msg-victory');
            if (lvs.length > 0) handleLevelUps(lvs);
        }
    }

    // 6. Monster Pursuit & Fear Fleeing AI Loop
    let pursuing = false;
    for (const m of monsters) {
        if (!m.alive) continue;

        // Wake up monster if in player's current line-of-sight
        const mIdx = m.y * MAP_WIDTH + m.x;
        if (currentFloorData.visibility[mIdx] === VISIBILITY.VISIBLE) {
            m.alert = true;
        }

        if (m.alert) {
            const mMods = EffectSystem.getStatusModifiers(m);

            // Terrified Monsters panic and flee away from player, cannot attack
            if (mMods.isTerrified) {
                const fleeStep = getStepAwayFrom(m.x, m.y, player.x, player.y, terrain, monsters);
                if (fleeStep) {
                    m.x = fleeStep.x;
                    m.y = fleeStep.y;
                }
                continue;
            }

            const dist = Math.hypot(player.x - m.x, player.y - m.y);

            // Adjacent -> Attack player!
            if (dist <= 1.5) {
                const attackRes = CombatSystem.resolveMonsterAttack(prng, m, player, terrain);
                if (attackRes.skipped) {
                    postMessage(`⚡ ${m.name} is incapacitated and unable to attack.`);
                } else if (attackRes.isHit) {
                    addBlood(player.x, player.y);
                    let hitMsg = `🩸 ${m.name} struck you for ${attackRes.damage} dmg! (${player.hp}/${player.maxHp} HP)`;
                    if (attackRes.appliedStatus) {
                        hitMsg += ` [Inflicted ${attackRes.appliedStatus}!]`;
                    }
                    postMessage(hitMsg, 'msg-miss');
                    if (player.hp <= 0) {
                        handlePlayerDeath(m.name);
                        return;
                    }
                } else {
                    const coverNote = attackRes.hasCover ? ' (Protected by Pillar Cover!)' : '';
                    postMessage(`🛡️ Blocked ${m.name}'s strike${coverNote}.`);
                }
            } else if (dist <= 12) {
                // Monsters cannot move if stunned
                if (!mMods.isStunned) {
                    const step = getStepTowards(m.x, m.y, player.x, player.y, terrain, monsters);
                    if (step) {
                        m.x = step.x;
                        m.y = step.y;
                        pursuing = true;
                    }
                }
            }
        }
    }

    updateHUD();
    draw();
}

// BFS single-step direction for monster pursuit (avoiding walls, pillars, pits, barrels)
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

    // Bounded: monsters only chase within ~12 tiles, so cap the flood so large maps never stall a turn
    let expansions = 0;
    while (queue.length > 0 && expansions++ < 900) {
        const [cx, cy] = queue.shift();
        if (cx === tx && cy === ty) {
            return firstStep.get(`${cx},${cy}`);
        }
        if (Math.abs(cx - sx) + Math.abs(cy - sy) > 24) continue;

        for (const d of dirs) {
            const nx = cx + d.dx;
            const ny = cy + d.dy;
            const k = `${nx},${ny}`;

            if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
            if (visited.has(k)) continue;

            const t = terrain[ny * MAP_WIDTH + nx];
            const isImpassable = (t === TILES.WALL || t === TILES.PILLAR || t === TILES.PIT || t === TILES.RUBBLE || t === TILES.DOOR_CLOSED || t === TILES.BARREL);
            const occupied = monsters.some(m => m.alive && m.x === nx && m.y === ny);

            if ((!isImpassable || (nx === tx && ny === ty)) && !occupied) {
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
    if (godMode) { // debug: refuse to die
        player.hp = player.maxHp;
        updateHUD();
        draw();
        return;
    }
    player.alive = false;
    cancelWalking();
    cancelTargeting();

    document.getElementById('death-floor').innerText = `Floor ${dungeonManager.currentFloor}`;
    document.getElementById('death-slain-by').innerText = `Slain by: ${slainBy}`;
    document.getElementById('death-turns').innerText = `Turns Survived: ${player.turnCount}`;
    document.getElementById('death-modal').classList.add('active');

    postMessage(`💀 YOU DIED on Floor ${dungeonManager.currentFloor}.`, 'msg-miss');
    draw();
}

// ==========================================
// 7. MOVEMENT & INTERACTIVE TILE STEPPING
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

    // IF IN TARGETING MODE: fire attack at target tile!
    if (targetingMode) {
        fireTargetedAction(targetWorldX, targetWorldY);
        return;
    }

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

    // 1. Closed Door Breach
    if (tile === TILES.DOOR_CLOSED) {
        terrain[targetIdx] = TILES.DOOR_OPEN;
        cancelWalking();
        postMessage('🚪 Breached door! Checking room beyond...', 'msg-info');
        runPerceptionRadar();
        endTurn();
        draw();
        return;
    }

    // 2. Adjacent Monster Attack
    const targetMonster = monsters.find(m => m.alive && m.x === nextX && m.y === nextY);
    if (targetMonster) {
        cancelWalking();
        resolveCombatTurn(targetMonster);
        endTurn();
        return;
    }

    // 3. Destructible Barrel Smash
    if (tile === TILES.BARREL) {
        cancelWalking();
        terrain[targetIdx] = TILES.FLOOR;
        if (prng.chance(0.28)) {
            postMessage('💥 POWDER KEG DETONATED! Exploded into flames!', 'msg-miss');
            CombatSystem.resolveAoE(prng, player, nextX, nextY, { radius: 1, dice: 6, diceCount: 2, zoneEffect: { type: 'FIRE', duration: 4 } }, currentFloorData, { onBlood: addBlood });
        } else {
            const loot = generateLootItem(prng, currentFloorData.floorLevel);
            const added = player.addToBackpack(loot);
            postMessage(`🛢️ Smashed barrel! Uncovered: ${loot.name}! ${added ? 'Added to bag.' : '(Bag full)'}`, 'msg-loot');
        }
        endTurn();
        draw();
        return;
    }

    // 4. Sacred Ancient Altar Interaction
    if (tile === TILES.ALTAR) {
        cancelWalking();
        terrain[targetIdx] = TILES.ALTAR_INERT;
        // Cleanse all harmful curses & poisons
        if (player.statuses) {
            player.statuses = player.statuses.filter(s => !STATUS_TYPES[s.id]?.isHarmful);
        }
        const prevHp = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + 20);
        EffectSystem.applyStatus(player, 'BLESSED', 20, 1, 'Sacred Altar');
        postMessage(`✨ Ancient Altar cleansed all curses, restored ${player.hp - prevHp} HP, and granted Blessed divine favor!`, 'msg-loot');
        endTurn();
        draw();
        return;
    }

    // 5. Impassable Hazards (Pits, Pillars)
    if (tile === TILES.PIT || tile === TILES.PILLAR) {
        cancelWalking();
        postMessage('🚫 Impassable obstacle.', 'msg-miss');
        draw();
        return;
    }

    // Step player to tile
    player.x = nextX;
    player.y = nextY;

    // 6. Hidden / Revealed Trap Triggering
    if (tile === TILES.TRAP_SPIKE || tile === TILES.TRAP_FIRE || tile === TILES.TRAP_GAS) {
        currentFloorData.trapsRevealed.add(targetIdx);
        cancelWalking();

        if (tile === TILES.TRAP_SPIKE) {
            const dmg = prng.nextInt(2, 8);
            player.hp = Math.max(0, player.hp - dmg);
            EffectSystem.applyStatus(player, 'BLEEDING', 4, 1, 'Floor Spikes');
            addBlood(player.x, player.y);
            postMessage(`⚡ FLOOR SPIKES SPRUNG! Took ${dmg} piercing damage and bleeding!`, 'msg-miss');
        } else if (tile === TILES.TRAP_FIRE) {
            EffectSystem.addAoEZones(currentFloorData, nextX, nextY, 1, 'FIRE', 4, 1);
            const dmg = prng.nextInt(3, 10);
            player.hp = Math.max(0, player.hp - dmg);
            EffectSystem.applyStatus(player, 'BURNING', 3, 1, 'Fire Trap');
            postMessage(`🔥 FIRE TRAP DETONATED! Took ${dmg} fire damage and caught burning!`, 'msg-miss');
        } else if (tile === TILES.TRAP_GAS) {
            EffectSystem.addAoEZones(currentFloorData, nextX, nextY, 1, 'POISON_GAS', 5, 1);
            EffectSystem.applyStatus(player, 'POISONED', 5, 1, 'Gas Trap');
            postMessage(`☁️ SPORE TRAP BURST! Inhaled choking poison fumes!`, 'msg-miss');
        }

        if (player.hp <= 0) {
            handlePlayerDeath('Dungeon Trap');
            return;
        }
    }

    // 7. Dense Foliage Slowdown
    if (tile === TILES.FOLIAGE) {
        postMessage('🌿 Pushing through dense briars...', 'msg-info');
    }

    // Update visibility & fog
    runPerceptionRadar();

    // Loot Chest
    const chest = chests.find(c => !c.opened && c.x === nextX && c.y === nextY);
    if (chest) {
        chest.opened = true;
        const xpReward = XP_REWARDS.chestPerFloor * currentFloorData.floorLevel;
        const levelUps = player.gainXp(xpReward);
        const added = player.addToBackpack(chest.item);
        if (added) {
            postMessage(`🎁 Looted: ${chest.item.name}! Added to Backpack (+${xpReward} XP)`, 'msg-loot');
        } else {
            postMessage(`🎁 Found ${chest.item.name}, but Backpack is full! (+${xpReward} XP)`, 'msg-loot');
        }
        if (levelUps.length > 0) handleLevelUps(levelUps);
        updateHUD();
    }

    // Forage Mushrooms
    const shroomIdx = currentFloorData.mushrooms?.findIndex(m => m.x === nextX && m.y === nextY);
    if (shroomIdx !== undefined && shroomIdx !== -1) {
        const shroom = currentFloorData.mushrooms.splice(shroomIdx, 1)[0];
        const mushroomItem = {
            name: shroom.name,
            icon: shroom.icon,
            isConsumable: true,
            isMushroom: true,
            mushroomType: shroom.type,
            rations: shroom.rations,
            healPotency: shroom.heal,
            desc: shroom.desc
        };

        const added = player.addToBackpack(mushroomItem);
        if (added) {
            postMessage(`🍄 Foraged ${shroom.name}! Stowed in backpack (+${XP_REWARDS.forage} XP).`, 'msg-loot');
        } else {
            let effectNote = '';
            if (shroom.rations) player.rations += shroom.rations;
            if (shroom.heal) {
                player.hp = Math.min(player.maxHp, player.hp + shroom.heal);
                effectNote += ` Healed +${shroom.heal} HP.`;
            }
            if (shroom.status) {
                EffectSystem.applyStatus(player, shroom.status, shroom.duration || 20, 1, shroom.name);
                effectNote += ` Gained ${shroom.status}!`;
            }
            postMessage(`🍄 Bag full! Consumed ${shroom.name} on the spot!${effectNote} (+${XP_REWARDS.forage} XP)`, 'msg-loot');
        }
        const levelUps = player.gainXp(XP_REWARDS.forage);
        if (levelUps.length > 0) handleLevelUps(levelUps);
        updateHUD();
    }

    // Harvest Monster Carcass / Corpse
    const corpse = currentFloorData.corpses?.find(c => !c.harvested && c.x === nextX && c.y === nextY);
    if (corpse) {
        corpse.harvested = true;
        const harvestItem = corpse.isVenomous ? {
            name: 'Spider Venom Sac',
            icon: '🧪',
            isConsumable: true,
            statusOnHit: 'POISONED',
            statusDuration: 5,
            desc: 'Harvested venom gland. Coat weapon or throw: inflicts Poison.'
        } : {
            name: 'Fresh Beast Meat',
            icon: '🥩',
            isConsumable: true,
            rations: 1,
            healPotency: 8,
            desc: `Freshly carved meat from ${corpse.monsterName || 'beast'}. Restores 1 Ration and 8 HP.`
        };

        const added = player.addToBackpack(harvestItem);
        if (added) {
            postMessage(`🥩 Harvested ${harvestItem.name} from carcass! Stowed in bag (+${XP_REWARDS.harvest} XP).`, 'msg-loot');
        } else {
            if (harvestItem.rations) player.rations += harvestItem.rations;
            if (harvestItem.healPotency) player.hp = Math.min(player.maxHp, player.hp + harvestItem.healPotency);
            postMessage(`🥩 Bag full! Ate fresh meat on spot (+1 Ration, +8 HP, +${XP_REWARDS.harvest} XP)!`, 'msg-loot');
        }
        const levelUps = player.gainXp(XP_REWARDS.harvest);
        if (levelUps.length > 0) handleLevelUps(levelUps);
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
// 8. COMBAT RESOLUTION (ADJACENT MELEE)
// ==========================================
function resolveCombatTurn(monster, attackSource = null) {
    const isSurprise = monster.unaware === true;
    monster.unaware = false;
    monster.alert = true;

    const { terrain } = currentFloorData;
    const result = CombatSystem.resolvePlayerAttack(prng, player, monster, isSurprise, terrain, attackSource);

    if (result.isHit) {
        addBlood(monster.x, monster.y);
        let msg = result.isSurprise 
            ? `⚡ SURPRISE STRIKE! Dealt ${result.damage} dmg!`
            : `💥 Hit ${monster.name} for ${result.damage} dmg! (${monster.hp}/${monster.maxHp} HP)`;
        if (result.appliedStatus) msg += ` [Inflicted ${result.appliedStatus}!]`;
        postMessage(msg, result.isSurprise ? 'msg-victory' : 'msg-hit');
    } else {
        const coverNote = result.hasCover ? ' (Monster protected by Pillar Cover!)' : '';
        postMessage(`🛡️ Missed ${monster.name}${coverNote} (Rolled ${result.attackTotal} vs AC ${result.targetAC}).`, 'msg-miss');
    }

    if (result.monsterDied) {
        addCorpse(monster);
        const xpReward = monsterXp(monster, currentFloorData.floorLevel);
        const levelUps = player.gainXp(xpReward);
        postMessage(`🏆 Defeated ${monster.name}! +${xpReward} XP`, 'msg-victory');
        if (levelUps.length > 0) handleLevelUps(levelUps);
    } else if (result.monsterCounter?.isHit) {
        addBlood(player.x, player.y);
        setTimeout(() => {
            postMessage(`🩸 ${monster.name} bit back for ${result.monsterCounter.damage} dmg! (${player.hp}/${player.maxHp} HP)`, 'msg-miss');
            updateHUD();
            if (player.hp <= 0) handlePlayerDeath(monster.name);
        }, 250);
    }

    updateHUD();
    draw();
}

// ==========================================
// 9. AUTO-TARGET & MANUAL AIMING MODES
// ==========================================
export function autoTargetAndAttack() {
    if (!player || !player.alive) return;
    if (targetingMode) {
        cancelTargeting();
    }

    const { monsters, terrain, visibility } = currentFloorData;
    const visibleMonsters = monsters.filter(m => m.alive && visibility[m.y * MAP_WIDTH + m.x] === VISIBILITY.VISIBLE);

    if (visibleMonsters.length === 0) {
        postMessage('👁️ No visible foes in sight to auto-target.', 'msg-miss');
        return;
    }

    // Sort visible monsters by distance to player
    visibleMonsters.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));

    // Determine equipped weapon reach & range
    const weapon = player.weapon;
    let weaponRange = 1.5;
    if (weapon.isReach) {
        weaponRange = 2.1; // Reach weapons (Spear, Halberd, Pike) reach 2 tiles
    } else if (weapon.delivery === 'RANGED') {
        weaponRange = weapon.range || 6;
    } else if (weapon.delivery === 'AOE') {
        weaponRange = weapon.range || 5;
    }

    // Find closest visible monster with unblocked line of sight
    let target = null;
    let targetDist = Infinity;
    for (const m of visibleMonsters) {
        const d = Math.hypot(m.x - player.x, m.y - player.y);
        const ray = EffectSystem.bresenhamRaycast(player.x, player.y, m.x, m.y, terrain);
        if (ray.clear) {
            target = m;
            targetDist = d;
            break;
        }
    }

    if (!target) {
        postMessage('🚫 Visible foes are behind solid walls or stone pillars!', 'msg-miss');
        return;
    }

    // If within equipped weapon reach/range: strike immediately!
    if (targetDist <= weaponRange) {
        if (targetDist <= 1.5) {
            resolveCombatTurn(target, weapon);
            endTurn();
        } else {
            const res = CombatSystem.resolvePlayerAttack(prng, player, target, false, terrain, weapon);
            if (res.isHit) {
                addBlood(target.x, target.y);
                const coverText = res.hasCover ? ' (Pillar Cover applied)' : '';
                let hitText = `🎯 Auto-Strike! ${weapon.name} hit ${target.name} for ${res.damage} dmg!${coverText}`;
                if (res.appliedStatus) hitText += ` [Inflicted ${res.appliedStatus}!]`;
                postMessage(hitText, 'msg-victory');

                if (res.monsterDied) {
                    addCorpse(target);
                    const xp = monsterXp(target, currentFloorData.floorLevel);
                    const lvs = player.gainXp(xp);
                    postMessage(`🏆 Defeated ${target.name}! +${xp} XP`, 'msg-victory');
                    if (lvs.length > 0) handleLevelUps(lvs);
                }
            } else {
                const coverText = res.hasCover ? ' (Protected by Pillar Cover!)' : '';
                postMessage(`🛡️ Auto-Strike missed ${target.name}${coverText}. (Rolled ${res.attackTotal} vs AC ${res.targetAC})`, 'msg-miss');
            }
            endTurn();
        }
        updateHUD();
        draw();
        return;
    }

    // If weapon is melee/short and target is further, check if player has a ready ranged ability
    const readyRangedAbil = player.getAvailableAbilities().find(a => 
        (a.delivery === 'RANGED' || a.delivery === 'AOE' || a.delivery === 'ZONE') && 
        player.canUseAbility(a.id) && 
        (a.range || 6) >= targetDist
    );

    if (readyRangedAbil) {
        startTargeting(readyRangedAbil);
        fireTargetedAction(target.x, target.y);
        return;
    }

    // Otherwise inform player of distance, weapon reach, and highlight foe
    const reachDesc = weapon.isReach ? '2 tiles (Reach)' : (weapon.delivery === 'RANGED' ? `${weapon.range} tiles` : '1 tile (Melee)');
    postMessage(`🎯 Closest foe (${target.name}) is ${targetDist.toFixed(1)}t away (Your ${weapon.name} reach: ${reachDesc}). Step closer or equip a bow!`, 'msg-info');
    targetCursor = { x: target.x, y: target.y };
    draw();
    setTimeout(() => {
        if (targetCursor && targetCursor.x === target.x && targetCursor.y === target.y) {
            targetCursor = null;
            draw();
        }
    }, 1200);
}

export function triggerAimMode() {
    if (targetingMode) {
        cancelTargeting();
        return;
    }

    // 1. Check equipped main_hand weapon
    const weapon = player.weapon;
    if (weapon.delivery === 'RANGED' || weapon.delivery === 'AOE') {
        startTargeting(weapon);
        return;
    }

    // 2. Check backpack for ranged weapon or throw flasks
    const rangedItemIdx = player.backpack.findIndex(item => item && (item.delivery === 'RANGED' || item.delivery === 'AOE'));
    if (rangedItemIdx !== -1) {
        const item = player.backpack[rangedItemIdx];
        startTargeting({ ...item, isItem: true, backpackIdx: rangedItemIdx });
        return;
    }

    // 3. Check unlocked class ranged abilities
    const rangedAbility = player.getAvailableAbilities().find(a => (a.delivery === 'RANGED' || a.delivery === 'AOE' || a.delivery === 'ZONE') && player.canUseAbility(a.id));
    if (rangedAbility) {
        startTargeting(rangedAbility);
        return;
    }

    postMessage(`⚠️ Wielding melee weapon (${weapon.name}). Equip a bow/flask or open Spells & Feats (⚡) to target at range!`, 'msg-miss');
}

export function startTargeting(action) {
    if (!action) return;
    if (action.delivery === 'SELF') {
        executeSelfAction(action);
        return;
    }

    targetingMode = true;
    targetingAction = action;
    hoverWorldPos = { x: player.x, y: player.y };

    const maxRange = action.range || 6;
    const tb = document.getElementById('targeting-banner');
    const an = document.getElementById('targeting-action-name');
    const rt = document.getElementById('targeting-range-text');
    if (tb) tb.style.display = 'flex';
    if (an) an.innerText = action.name;
    if (rt) rt.innerText = `Range ${maxRange}t`;

    const targetLabel = document.getElementById('action-target-label');
    if (targetLabel) targetLabel.innerText = 'Aiming...';

    postMessage(`🎯 TARGETING: ${action.name} (Range ${maxRange}t). Tap visible target tile to fire | Esc to cancel.`, 'msg-info');
    draw();
}

export function cancelTargeting() {
    targetingMode = false;
    targetingAction = null;
    hoverWorldPos = null;

    const tb = document.getElementById('targeting-banner');
    if (tb) tb.style.display = 'none';

    const targetLabel = document.getElementById('action-target-label');
    if (targetLabel) targetLabel.innerText = 'Aim';

    if (player && currentFloorData) {
        draw();
    }
}

function fireTargetedAction(targetX, targetY) {
    if (!targetingMode || !targetingAction) return;

    const dist = Math.hypot(targetX - player.x, targetY - player.y);
    const maxRange = targetingAction.range || 6;

    if (dist > maxRange) {
        postMessage(`⚠️ Target is out of range! (${dist.toFixed(1)} > max ${maxRange} tiles)`, 'msg-miss');
        return;
    }

    const { terrain, monsters } = currentFloorData;
    const ray = EffectSystem.bresenhamRaycast(player.x, player.y, targetX, targetY, terrain);

    if (!ray.clear) {
        postMessage('🚫 Line-of-sight blocked by solid wall or stone pillar!', 'msg-miss');
        return;
    }

    const action = targetingAction;

    // Ranged Single-Target Delivery
    if (action.delivery === 'RANGED') {
        const monster = monsters.find(m => m.alive && m.x === targetX && m.y === targetY);
        if (monster) {
            const res = CombatSystem.resolvePlayerAttack(prng, player, monster, false, terrain, action);
            if (res.isHit) {
                addBlood(monster.x, monster.y);
                const coverText = res.hasCover ? ' (Pillar Cover applied)' : '';
                let hitText = `🎯 ${action.name} struck ${monster.name} for ${res.damage} dmg!${coverText}`;
                if (res.appliedStatus) hitText += ` [Inflicted ${res.appliedStatus}!]`;
                postMessage(hitText, 'msg-victory');

                if (res.monsterDied) {
                    addCorpse(monster);
                    const xp = monsterXp(monster, currentFloorData.floorLevel);
                    const lvs = player.gainXp(xp);
                    postMessage(`🏆 Defeated ${monster.name}! +${xp} XP`, 'msg-victory');
                    if (lvs.length > 0) handleLevelUps(lvs);
                }
            } else {
                const coverText = res.hasCover ? ' (Protected by Pillar Cover!)' : '';
                postMessage(`🛡️ Missed ${monster.name}${coverText}. (Rolled ${res.attackTotal} vs AC ${res.targetAC})`, 'msg-miss');
            }
        } else {
            // Shatter barrel at distance
            const targetIdx = targetY * MAP_WIDTH + targetX;
            if (terrain[targetIdx] === TILES.BARREL) {
                terrain[targetIdx] = TILES.FLOOR;
                if (prng.chance(0.28)) {
                    postMessage('💥 Ranged shot detonated explosive powder barrel!', 'msg-loot');
                    EffectSystem.addAoEZones(currentFloorData, targetX, targetY, 1, 'FIRE', 4, 1);
                } else {
                    const loot = generateLootItem(prng, currentFloorData.floorLevel);
                    player.addToBackpack(loot);
                    postMessage(`🎯 Shattered barrel! Uncovered: ${loot.name}!`, 'msg-loot');
                }
            } else {
                postMessage(`🏹 ${action.name} struck the floor at (${targetX}, ${targetY}).`);
            }
        }
    } 
    // AoE Blast or Lingering Hazard Zone Delivery
    else if (action.delivery === 'AOE' || action.delivery === 'ZONE') {
        const aoeRes = CombatSystem.resolveAoE(prng, player, targetX, targetY, action, currentFloorData, { onBlood: addBlood });

        if (action.isPositive && aoeRes.totalHeal > 0) {
            postMessage(`✨ ${action.name} restored ${aoeRes.totalHeal} HP to hero!`, 'msg-victory');
        }

        if (aoeRes.hits.length > 0) {
            let deadCount = 0;
            for (const h of aoeRes.hits) {
                if (h.died) {
                    deadCount++;
                    addCorpse(h.monster);
                    const xp = monsterXp(h.monster, currentFloorData.floorLevel);
                    const lvs = player.gainXp(xp);
                    if (lvs.length > 0) handleLevelUps(lvs);
                }
            }
            postMessage(`💥 ${action.name} blast hit ${aoeRes.hits.length} foe(s) for ${aoeRes.totalDamage} total dmg! ${deadCount > 0 ? `(${deadCount} slain!)` : ''}`, 'msg-victory');
        } else if (!action.isPositive) {
            postMessage(`💥 ${action.name} detonated at (${targetX}, ${targetY})!`, 'msg-info');
        }

        if (action.zoneEffect || action.zoneType) {
            postMessage(`🔥 Lingering hazard field created in area!`, 'msg-loot');
        }
    }

    // Consumable backpack item deduction
    if (action.isItem && action.backpackIdx !== undefined) {
        player.removeFromBackpack(action.backpackIdx);
    }

    // Cooldown trigger
    if (action.id && !action.isItem) {
        player.triggerAbilityCooldown(action.id);
    }

    cancelTargeting();
    endTurn();
    updateHUD();
    draw();
}

export function throwItemFromBackpack(backpackIdx) {
    if (backpackIdx < 0 || backpackIdx >= player.backpack.length) return;
    const item = player.backpack[backpackIdx];
    if (!item) return;

    const sheet = document.getElementById('sheet-modal');
    if (sheet) sheet.classList.remove('active');

    startTargeting({ ...item, isItem: true, backpackIdx });
}

// ==========================================
// 10. CLASS SPELLS & FEATS MODAL & EXECUTION
// ==========================================
export function openSpellsModal() {
    if (!player || !player.alive) return;
    const modal = document.getElementById('spells-modal');
    const list = document.getElementById('spells-list');
    if (!modal || !list) return;

    const allClasses = ClassManager.getAllClasses();
    const classSelectorHtml = `
        <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid #23283c;">
            ${allClasses.map(c => {
                const isActive = player.characterClass.id === c.id;
                return `
                    <button class="modal-btn" style="flex: 1; padding: 4px 6px; font-size: 10px; white-space: nowrap; ${isActive ? 'background: #2b2814; border-color: #ffcc00; color: #ffcc00;' : 'opacity: 0.7;'}" onclick="window.switchClass('${c.id}')">
                        ${c.icon} ${c.name}
                    </button>
                `;
            }).join('')}
        </div>
    `;

    const activeFeatCount = player.activeFeats.length;
    const featBannerHtml = `
        <div style="background: #111422; border: 1px solid #2a344d; border-radius: 6px; padding: 6px; margin-bottom: 6px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="color: #64d8cb; font-weight: bold;">Class Build:</span>
                <span style="color: #fff; margin-left: 4px;">${activeFeatCount}/4 Feats Slotted</span>
            </div>
            <span style="font-size: 9px; color: #888ea6;">Tap [Equip/Unequip] to toggle active build</span>
        </div>
    `;

    const abilities = player.characterClass.abilities || [];
    const abilitiesHtml = abilities.map(a => {
        const isUnlocked = a.level <= player.level;
        const isEquipped = player.isFeatActive(a.id);
        const cd = player.cooldowns[a.id] || 0;
        const onCd = cd > 0;
        const deliveryTag = a.delivery === 'SELF' ? 'SELF' : (a.delivery === 'AOE' ? `AOE (${a.radius}r, ${a.range || 0}t)` : (a.delivery === 'ZONE' ? `ZONE (${a.range}t)` : (a.delivery === 'RANGED' ? `RANGED (${a.range}t)` : 'ADJACENT')));

        if (!isUnlocked) {
            return `
                <div style="background: #0a0b10; border: 1px solid #1a1c26; border-radius: 6px; padding: 6px 8px; opacity: 0.5;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #666; font-weight: bold;">${a.icon} ${a.name}</span>
                        <span style="font-size: 9px; color: #ff5577;">🔒 Unlocks Lv. ${a.level}</span>
                    </div>
                    <div style="font-size: 10px; color: #555; margin-top: 2px;">${a.desc}</div>
                </div>
            `;
        }

        const statusHtml = !isEquipped
            ? `<span style="color:#777; font-size:9px;">[Not Slotted]</span>`
            : (onCd ? `<span style="color:#ff6666; font-size:9px;">[CD: ${cd}t]</span>` : `<span style="color:#55ff77; font-size:9px;">[Ready]</span>`);

        const toggleBtn = `
            <button class="btn-action-small" style="padding: 2px 7px; font-size: 9px; ${isEquipped ? 'background: #193822; border-color: #55ff77; color: #aaffaa;' : 'background: #252838; border-color: #556688; color: #ccc;'}" onclick="window.toggleFeat('${a.id}')">
                ${isEquipped ? '⭐ Slotted (Active)' : '+ Slot Feat'}
            </button>
        `;

        let actionBtn = '';
        if (isEquipped) {
            if (onCd) {
                actionBtn = `<button class="btn-action-small" disabled style="opacity:0.5; font-size:10px;">Cooldown (${cd}t)</button>`;
            } else if (a.delivery === 'SELF') {
                actionBtn = `<button class="btn-action-small" style="background:#1a2e22; border-color:#55ff77; color:#55ff77; font-size:10px;" onclick="window.useAbilityById('${a.id}')">Cast Now</button>`;
            } else if (a.delivery === 'RANGED' || a.delivery === 'AOE' || a.delivery === 'ZONE') {
                actionBtn = `<button class="btn-action-small" style="background:#2b2210; border-color:#ffcc00; color:#ffcc00; font-size:10px;" onclick="window.useAbilityById('${a.id}')">🎯 Aim & Cast</button>`;
            } else {
                actionBtn = `<button class="btn-action-small" style="background:#2a1b1b; border-color:#ff7788; color:#ff7788; font-size:10px;" onclick="window.useAbilityById('${a.id}')">Execute Strike</button>`;
            }
        }

        return `
            <div style="background: ${isEquipped ? '#0f111a' : '#0a0b12'}; border: 1px solid ${isEquipped ? '#282c3f' : '#191b26'}; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: ${isEquipped ? '#ffcc00' : '#888'};">${a.icon} ${a.name}</span>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <span style="background: #192030; color: #64d8cb; border: 1px solid #364460; border-radius: 4px; padding: 1px 5px; font-size: 9px;">${deliveryTag}</span>
                        ${statusHtml}
                    </div>
                </div>
                <div style="font-size: 11px; color: ${isEquipped ? '#bbb' : '#777'}; line-height: 1.3;">${a.desc}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    ${toggleBtn}
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');

    list.innerHTML = classSelectorHtml + featBannerHtml + abilitiesHtml;
    modal.classList.add('active');
}

export function switchClass(classId) {
    if (!player || !player.alive) return;
    if (player.changeClass(classId)) {
        postMessage(`⚔️ Class switched to ${player.characterClass.name} (${player.characterClass.title})!`, 'msg-victory');
        updateHUD();
        populateSheet();
        openSpellsModal();
        draw();
    }
}

export function toggleFeat(featId) {
    if (!player || !player.alive) return;
    const res = player.toggleFeat(featId);
    if (res.success) {
        postMessage(`${res.active ? '⭐ Slotted' : '🎒 Removed'} feat: ${res.name}!`, 'msg-info');
        updateHUD();
        openSpellsModal();
    } else {
        postMessage(`⚠️ ${res.reason}`, 'msg-miss');
    }
}

export function closeSpellsModal() {
    const modal = document.getElementById('spells-modal');
    if (modal) modal.classList.remove('active');
}

export function useAbilityById(abilityId) {
    closeSpellsModal();
    const ability = player.characterClass.abilities.find(a => a.id === abilityId);
    if (!ability) return;

    if (!player.canUseAbility(ability.id)) {
        const cd = player.cooldowns[ability.id] || 0;
        if (cd <= 0) {
            postMessage(`⚠️ ${ability.name} isn't slotted. Open Spells & Feats (F) and slot it first.`, 'msg-miss');
            return;
        }
        postMessage(`⏳ ${ability.name} is on cooldown (${cd}t remaining).`, 'msg-miss');
        return;
    }

    if (ability.delivery === 'SELF') {
        executeSelfAction(ability);
    } else if (ability.delivery === 'ADJACENT') {
        const { monsters } = currentFloorData;
        const adjacentMonster = monsters.find(m => m.alive && Math.hypot(m.x - player.x, m.y - player.y) <= 1.5);
        if (adjacentMonster) {
            resolveCombatTurn(adjacentMonster, ability);
            player.triggerAbilityCooldown(ability.id);
            endTurn();
        } else {
            postMessage(`⚠️ No monster adjacent to strike with ${ability.name}!`, 'msg-miss');
        }
    } else {
        startTargeting(ability);
    }
}

function executeSelfAction(action) {
    if (action.type === 'heal') {
        let healAmt = 0;
        if (action.healPercent) {
            healAmt = Math.max(6, Math.floor(player.maxHp * action.healPercent));
        } else if (action.dice) {
            const count = action.diceCount || 2;
            for (let d = 0; d < count; d++) healAmt += prng.nextInt(1, action.dice);
            healAmt += (player.wisMod || 0);
        }
        const prevHp = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        postMessage(`${action.icon} ${action.name} restored ${player.hp - prevHp} HP! (${player.hp}/${player.maxHp})`, 'msg-victory');
    } else if (action.type === 'buff_attack') {
        player.activeBuffs.push({ id: action.id, name: action.name, stat: 'bonus_dmg', value: 8, turnsLeft: 6 });
        postMessage(`${action.icon} ${action.name} activated! Next melee strike deals crushing bonus damage.`, 'msg-victory');
    } else if (action.type === 'buff_all') {
        if (action.statusEffect) {
            EffectSystem.applyStatus(player, action.statusEffect.type, action.statusEffect.duration, 1, action.name);
        } else {
            player.activeBuffs.push({ id: action.id, name: action.name, stat: 'ac', value: 2, turnsLeft: 15 });
            player.activeBuffs.push({ id: action.id, name: action.name, stat: 'attack', value: 2, turnsLeft: 15 });
        }
        postMessage(`${action.icon} ${action.name} performed! Blessed aura protects for ${action.statusEffect?.duration || 15} turns.`, 'msg-victory');
    } else if (action.type === 'heal_over_time') {
        if (action.statusEffect) {
            EffectSystem.applyStatus(player, action.statusEffect.type, action.statusEffect.duration, 1, action.name);
        }
        postMessage(`${action.icon} ${action.name} sung! Rapid cell regeneration active (+3 HP/turn).`, 'msg-victory');
    } else if (action.statusEffect) {
        // Generic self-buff (e.g. buff_def: Shield Wall, Mana Shield, Barkskin): apply its status effect
        EffectSystem.applyStatus(player, action.statusEffect.type, action.statusEffect.duration, 1, action.name);
        postMessage(`${action.icon} ${action.name} active for ${action.statusEffect.duration} turns!`, 'msg-victory');
    }

    if (action.id) player.triggerAbilityCooldown(action.id);
    endTurn();
    updateHUD();
    draw();
}

// ==========================================
// 11. TILE QUERY & INSPECT MODAL
// ==========================================
export function inspectTileAt(worldX, worldY) {
    if (worldX < 0 || worldX >= MAP_WIDTH || worldY < 0 || worldY >= MAP_HEIGHT) return;

    const { terrain, visibility, monsters, chests, biome, hazardZones, trapsRevealed } = currentFloorData;
    const idx = worldY * MAP_WIDTH + worldX;
    const vis = visibility[idx];
    const tile = terrain[idx];

    let data = null;

    if (player.x === worldX && player.y === worldY) {
        const statusesText = player.statuses?.map(s => `• <strong>${s.icon} ${s.name}:</strong> ${s.duration}t remaining`).join('<br>') || 'None (Healthy)';
        data = {
            icon: '🛡️',
            name: `Hero (${player.characterClass.name})`,
            desc: `Level ${player.level} • Floor ${dungeonManager.currentFloor}.`,
            details: `
                <strong>HP:</strong> ${player.hp} / ${player.maxHp}<br>
                <strong>AC:</strong> ${player.ac}<br>
                <strong>Perception:</strong> ${player.per} (+${player.perMod})<br>
                <strong>Regen:</strong> 1 HP every ${player.regenRate} turns<br>
                <strong>Active Statuses:</strong><br>${statusesText}
            `
        };
    } else if (vis === VISIBILITY.VISIBLE && monsters.some(m => m.alive && m.x === worldX && m.y === worldY)) {
        const m = monsters.find(mon => mon.alive && mon.x === worldX && mon.y === worldY);
        const cover = EffectSystem.calculateTacticalCover(m.x, m.y, player.x, player.y, terrain);
        const mStatuses = m.statuses?.map(s => `• <strong>${s.icon} ${s.name}:</strong> ${s.duration}t`).join('<br>') || 'None';
        data = {
            icon: m.icon,
            name: m.name,
            desc: m.desc,
            details: `
                <strong>HP:</strong> ${m.hp} / ${m.maxHp}<br>
                <strong>AC:</strong> ${m.ac} ${cover.hasCover ? '<span style="color:#64d8cb">(+2 Pillar Cover)</span>' : ''}<br>
                <strong>Damage:</strong> 1d${m.dice}<br>
                <strong>State:</strong> ${m.alert ? 'Alert & Pursuing' : 'Unaware (Vulnerable)'}<br>
                <strong>Statuses:</strong><br>${mStatuses}
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
    } else if (vis !== VISIBILITY.UNEXPLORED && currentFloorData.mushrooms?.some(m => m.x === worldX && m.y === worldY)) {
        const shroom = currentFloorData.mushrooms.find(m => m.x === worldX && m.y === worldY);
        data = {
            icon: '🍄',
            name: shroom.name,
            desc: shroom.desc,
            details: `Forageable dungeon fungi. Step onto tile to harvest or consume.<br><strong>Rations:</strong> +${shroom.rations} • <strong>Healing:</strong> +${shroom.heal} HP${shroom.status ? `<br><strong>Status Inflicted:</strong> ${shroom.status}` : ''}`
        };
    } else if (vis !== VISIBILITY.UNEXPLORED && currentFloorData.corpses?.some(c => !c.harvested && c.x === worldX && c.y === worldY)) {
        const corpse = currentFloorData.corpses.find(c => !c.harvested && c.x === worldX && c.y === worldY);
        data = {
            icon: '🥩',
            name: corpse.name,
            desc: 'Slain monster carcass.',
            details: 'Unharvested remains. Step onto tile to harvest fresh meat, venom, or sustenance rations!'
        };
    } else if (vis !== VISIBILITY.UNEXPLORED) {
        // Check for hazard zone first
        const zone = hazardZones?.find(z => z.x === worldX && z.y === worldY);
        let zoneInfo = '';
        if (zone) {
            const zDef = ZONE_TYPES[zone.type];
            zoneInfo = `<div style="color: #ff9944; margin-top: 4px;"><strong>Active Hazard:</strong> ${zDef.icon} ${zDef.name} (${zone.duration} turns left)<br>${zDef.desc}</div>`;
        }

        if (tile === TILES.PILLAR) {
            data = { icon: '🏛️', name: 'Marble Stone Pillar', desc: 'Solid architectural column.', details: `Impassable structure. Blocks projectiles and provides +2 Tactical Cover AC to adjacent combatants against ranged attacks.${zoneInfo}` };
        } else if (tile === TILES.PIT) {
            data = { icon: '🕳️', name: 'Bottomless Chasm', desc: 'Deep abyssal drop into the unknown.', details: `Impassable terrain hazard. Falling into it causes fatal fall damage.${zoneInfo}` };
        } else if (tile === TILES.BARREL) {
            data = { icon: '🛢️', name: 'Dungeon Barrel', desc: 'Destructible container.', details: `Bump in melee or shoot from a distance to break. Contains loot items or explosive powder!${zoneInfo}` };
        } else if (tile === TILES.ALTAR) {
            data = { icon: '⛪', name: 'Ancient Sacred Altar', desc: 'Sanctified divine monument.', details: `Step onto or interact to pray: cleanses all poisons and bleeding, restores 20 HP, and grants Blessed aura for 20 turns!${zoneInfo}` };
        } else if (tile === TILES.ALTAR_INERT) {
            data = { icon: '🗿', name: 'Depleted Shrine', desc: 'Stone altar whose divine essence was received.', details: `Inert stone monument.${zoneInfo}` };
        } else if (tile === TILES.FOLIAGE) {
            data = { icon: '🌿', name: 'Dense Briars / Foliage', desc: 'Thorny overgrown brush.', details: `Passable terrain, but slows traversal. Flammable: ignites into a fire field if touched by fire!${zoneInfo}` };
        } else if (tile === TILES.TRAP_SPIKE) {
            data = { icon: '⚙️', name: 'Spike Trap Plate', desc: 'Mechanical spring-loaded floor spikes.', details: `Triggers on traversal: deals 1d8 piercing damage and inflicts Bleeding DoT.${zoneInfo}` };
        } else if (tile === TILES.TRAP_FIRE) {
            data = { icon: '🔥', name: 'Flame Jet Plate', desc: 'Hidden pressure vent.', details: `Triggers on traversal: detonates 3x3 blast, deals 2d6 fire damage, inflicts Burning, and creates a Fire field.${zoneInfo}` };
        } else if (tile === TILES.TRAP_GAS) {
            data = { icon: '☁️', name: 'Poison Spore Vent', desc: 'Noxious toxic gas emitter.', details: `Triggers on traversal: emits a 3x3 poison gas cloud and inflicts Poisoned status.${zoneInfo}` };
        } else if (tile === TILES.DOOR_CLOSED) {
            data = { icon: '🚪', name: 'Closed Oak Door', desc: 'Blocks movement and sightlines.', details: `Tap to breach open with surprise advantage.${zoneInfo}` };
        } else if (tile === TILES.DOOR_OPEN) {
            data = { icon: '🚪', name: 'Open Doorway', desc: 'Passable doorway.', details: `Permits line-of-sight and passage.${zoneInfo}` };
        } else if (tile === TILES.STAIRS_DOWN) {
            data = { icon: '🪜', name: 'Stairs Down', desc: `Descent to Floor ${dungeonManager.currentFloor + 1}.`, details: `Tap to delve deeper.${zoneInfo}` };
        } else if (tile === TILES.STAIRS_UP) {
            data = { icon: '⛺', name: 'Stairs Up', desc: `Ascent to Floor ${dungeonManager.currentFloor - 1}.`, details: `Tap to return to upper floor.${zoneInfo}` };
        } else if (tile === TILES.RUBBLE) {
            data = { icon: '🪨', name: 'Stone Rubble', desc: 'Collapsed dungeon masonry.', details: `Impassable barrier.${zoneInfo}` };
        } else if (tile === TILES.WALL) {
            data = { icon: '🧱', name: 'Dungeon Wall', desc: `${biome.name} granite bedrock.`, details: `Impassable perimeter.${zoneInfo}` };
        } else {
            data = { icon: '▫️', name: 'Dungeon Floor', desc: biome.name, details: `World coordinates (${worldX}, ${worldY})${zoneInfo}` };
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
// 12. INPUT LISTENERS
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
    hoverWorldPos = world;
    if (targetingMode) draw();

    holdTimer = setTimeout(() => {
        holdTriggered = true;
        if (navigator.vibrate) navigator.vibrate(35);
        inspectTileAt(world.x, world.y);
    }, 400);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (holdTimer && Math.hypot(touch.clientX - startPos.x, touch.clientY - startPos.y) > 8) {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
    if (targetingMode) {
        hoverWorldPos = screenToWorld(touch.clientX, touch.clientY);
        draw();
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

canvas.addEventListener('mousemove', (e) => {
    if (targetingMode) {
        hoverWorldPos = screenToWorld(e.clientX, e.clientY);
        draw();
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) return;
    startPos = { x: e.clientX, y: e.clientY };
    holdTriggered = false;
    const world = screenToWorld(e.clientX, e.clientY);
    hoverWorldPos = world;

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
    cancelWalking();
    cancelTargeting();
    endTurn();
    postMessage('⏳ You wait a turn to recover and observe surroundings.', 'msg-info');
    draw();
}

// ==========================================
// 13. LEVEL UP & PROGRESSION ADVANCEMENT
// ==========================================

export function handleLevelUps(levelUps) {
    if (!levelUps || levelUps.length === 0) return;
    levelUpQueue.push(...levelUps);
    if (!currentLevelUpData) {
        showNextLevelUp();
    }
}

function showNextLevelUp() {
    if (levelUpQueue.length === 0) {
        currentLevelUpData = null;
        return;
    }
    currentLevelUpData = levelUpQueue[0];
    // Resolve choices one grant at a time (feat -> attribute -> mastery -> skill, per PROGRESSION.grantOrder)
    currentLevelUpData.pendingGrants = [...(currentLevelUpData.grants || [])];
    currentLevelUpData.choices = [];

    const { level, hpGain, unlockedAbilities } = currentLevelUpData;
    const modal = document.getElementById('levelup-modal');
    if (modal) {
        document.getElementById('levelup-subtitle').innerText = `${player.race.name} ${player.characterClass.name} reached Level ${level}!`;
        document.getElementById('levelup-hp-gain').innerText = `+${hpGain} Max HP (Full HP Restored!)`;

        const featSec = document.getElementById('levelup-feat-section');
        if (unlockedAbilities && unlockedAbilities.length > 0) {
            featSec.style.display = 'block';
            document.getElementById('levelup-feat-desc').innerHTML = unlockedAbilities
                .map(a => `<strong>${a.icon} ${a.name}:</strong> ${a.desc}`)
                .join('<br>');
        } else {
            featSec.style.display = 'none';
        }

        renderLevelUpChoices();
        modal.classList.add('active');
    }
    updateHUD();
}

function renderLevelUpChoices() {
    const box = document.getElementById('levelup-choices');
    if (!box || !currentLevelUpData) return;
    const pending = currentLevelUpData.pendingGrants;
    if (pending.length === 0) {
        box.innerHTML = '';
        return;
    }

    const grantId = pending[0];
    const grantDef = PROGRESSION.grants[grantId];
    const stepText = `Choice ${currentLevelUpData.grants.length - pending.length + 1} of ${currentLevelUpData.grants.length}`;
    const btn = (type, id, html) => `<button class="modal-btn levelup-choice" data-type="${type}" data-id="${id}" onclick="window.chooseLevelUpAdvancement('${type}', '${id}')">${html}</button>`;

    let options = '';
    if (grantId === 'skill') {
        options = Object.values(SKILLS).map(s => btn('skill', s.id,
            `<span>${s.icon} <strong>${s.name}</strong> <span style="color:#888ea6;">(Rank ${player.skills[s.id] || 0})</span></span><span style="color:#ffcc00; font-size: 9px;">${s.desc}</span>`)).join('');
    } else if (grantId === 'attribute') {
        const labels = { str: 'STR (Melee)', dex: 'DEX (Range/AC)', con: 'CON (HP)', int: 'INT (Spells)', wis: 'WIS (Healing)', cha: 'CHA (Buffs)' };
        options = `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 4px;">` +
            Object.entries(labels).map(([k, label]) => btn('attribute', k, `+1 ${label}`)).join('') + `</div>`;
    } else if (grantId === 'feat') {
        const feats = FeatManager.getAvailableFeats(player);
        options = feats.length
            ? feats.map(f => btn('feat', f.id, `<span>${f.icon} <strong>${f.name}</strong></span><span style="color:#ffcc00; font-size: 9px;">${f.desc}</span>`)).join('')
            : `<div style="color:#888;">No feats left to learn.</div>`;
    } else if (grantId === 'mastery') {
        options = Object.values(MASTERIES).filter(m => !player.masteries.includes(m.id))
            .map(m => btn('mastery', m.id, `<span>${m.icon} <strong>${m.name}</strong></span><span style="color:#ff99aa; font-size: 9px;">${m.desc}</span>`)).join('');
    }

    const stackStyle = grantId === 'attribute' ? '' : 'display:flex; flex-direction:column; gap:4px;';
    box.innerHTML = `
        <div style="border-top: 1px solid #252a3d; padding-top: 8px; margin-top: 8px;">
            <div style="color:#ffcc00; font-weight:bold; font-size:12px;">🌟 ${grantDef.label.toUpperCase()} <span style="color:#888ea6; font-weight:normal; font-size:10px;">(${stepText})</span></div>
            <div style="font-size:10px; color:#888ea6; margin: 2px 0 6px 0;">${grantDef.desc}</div>
            <div style="${stackStyle}">${options}</div>
        </div>`;
}

// Resolves the CURRENT grant of the current level-up; advances to the next grant / level when done.
export function chooseLevelUpAdvancement(type, id) {
    if (!currentLevelUpData) {
        const modal = document.getElementById('levelup-modal');
        if (modal) modal.classList.remove('active');
        return;
    }
    const cur = currentLevelUpData;
    const expected = cur.pendingGrants[0];
    if (expected && expected !== type) return; // stale click

    const { level } = cur;
    let label = '';

    if (type === 'attribute') {
        const statName = id.toUpperCase();
        player.boostAttribute(id);
        label = `+1 ${statName}`;
        postMessage(`⭐ Level ${level}: Increased ${statName} by +1!`, 'msg-victory');
    } else if (type === 'skill') {
        if (!player.boostSkill(id)) return;
        const skillName = id.charAt(0).toUpperCase() + id.slice(1);
        label = `${skillName} Rank ${player.skills[id]}`;
        postMessage(`⭐ Level ${level}: Trained ${skillName} to Rank ${player.skills[id]}!`, 'msg-victory');
    } else if (type === 'feat') {
        const feat = player.learnFeat(id);
        if (!feat) return;
        label = `Feat: ${feat.name}`;
        postMessage(`⭐ Level ${level}: Learned feat ${feat.icon} ${feat.name}!`, 'msg-victory');
    } else if (type === 'mastery') {
        const m = player.chooseMastery(id);
        if (!m) return;
        label = `Mastery: ${m.name}`;
        postMessage(`⭐ Level ${level}: Gained ${m.icon} ${m.name}!`, 'msg-victory');
    } else {
        return;
    }

    cur.choices.push({ type, label });
    cur.pendingGrants.shift();

    if (cur.pendingGrants.length > 0) {
        renderLevelUpChoices();
    } else {
        // Level fully resolved: log it, then move on to the next queued level (if any)
        player.recordProgression(cur.level, cur.hpGain, cur.choices, cur.unlockedAbilities || []);
        levelUpQueue.shift();
        if (levelUpQueue.length > 0) {
            showNextLevelUp();
        } else {
            currentLevelUpData = null;
            const modal = document.getElementById('levelup-modal');
            if (modal) modal.classList.remove('active');
        }
    }

    updateHUD();
    populateSheet();
    draw();
}

export function boostStat(stat) {
    if (player.attributePoints <= 0) return;
    if (player.boostAttribute(stat)) {
        player.attributePoints--;
        postMessage(`⭐ Attribute Boost! ${stat.toUpperCase()} increased by +1!`, 'msg-victory');
        updateHUD();
        populateSheet();
    }
}

// ==========================================
// 14. INTERACTIVE PAPERDOLL SELECTION & ACTIONS
// ==========================================
let selectedSlot = null; // { type: 'body'|'backpack', id: string|number }

export function selectSlot(type, id) {
    selectedSlot = { type, id };
    populateSheet();
}

// Equip the selected backpack item. `targetSlot` (optional) picks a specific slot, e.g. the 2nd ring slot.
export function equipSelectedBackpackItem(targetSlot = null) {
    if (!selectedSlot || selectedSlot.type !== 'backpack') return;
    const res = player.equipFromBackpack(selectedSlot.id, targetSlot);
    if (res) {
        postMessage(`⚔️ Equipped ${res.equipped.name} into ${SLOT_LABELS[res.slot] || res.slot}!`, 'msg-loot');
        selectedSlot = { type: 'body', id: res.slot };
        updateHUD();
        populateSheet();
        draw();
    }
}

// ---- Equipment slot picker: click a paperdoll slot -> choose from every owned item that fits ----
let pickerSlot = null;

export function openSlotPicker(slotKey) {
    if (!player) return;
    pickerSlot = slotKey;
    selectedSlot = { type: 'body', id: slotKey };
    populateSheet();
    renderSlotPicker();
    const modal = document.getElementById('slot-picker-modal');
    if (modal) modal.classList.add('active');
}

export function closeSlotPicker() {
    pickerSlot = null;
    const modal = document.getElementById('slot-picker-modal');
    if (modal) modal.classList.remove('active');
}

function renderSlotPicker() {
    if (!pickerSlot) return;
    const title = document.getElementById('slot-picker-title');
    const body = document.getElementById('slot-picker-list');
    if (!title || !body) return;

    const label = SLOT_LABELS[pickerSlot] || pickerSlot;
    const equipped = player.equipment[pickerSlot];
    const candidates = player.getEquipCandidates(pickerSlot);
    title.innerText = `${label.toUpperCase()}`;

    const equippedHtml = equipped ? `
        <div class="picker-row picker-current">
            <div style="flex:1; min-width:0;">
                <div style="color:#64d8cb; font-weight:bold;">${equipped.icon} ${equipped.name} <span style="color:#888ea6; font-weight:normal;">(equipped)</span></div>
                <div style="color:#ffcc00; font-size:10px;">${equipped.desc || ''}</div>
            </div>
            <button class="btn-action-small" style="flex:none;" onclick="window.pickerUnequip()">🎒 Unequip</button>
        </div>` : `<div class="picker-row" style="color:#888;">Nothing equipped in this slot.</div>`;

    const listHtml = candidates.length ? candidates.map(({ idx, item }) => `
        <div class="picker-row" data-bag-idx="${idx}">
            <div style="flex:1; min-width:0;">
                <div style="color:#e0e0f0; font-weight:bold;">${item.icon} ${item.name} <span style="color:#666; font-weight:normal;">(bag slot ${idx + 1})</span></div>
                <div style="color:#ffcc00; font-size:10px;">${item.desc || ''}</div>
            </div>
            <button class="btn-action-small" style="flex:none; background:#193826; border-color:#55ff77; color:#aaffaa;" onclick="window.pickerEquip(${idx})">⚔️ Equip</button>
        </div>`).join('') : `<div class="picker-row" style="color:#888;">No other owned items fit this slot.</div>`;

    body.innerHTML = equippedHtml + `<div style="font-size:10px; color:#888ea6; margin:6px 0 2px 0;">OWNED ITEMS THAT FIT (${candidates.length}):</div>` + listHtml;
}

export function pickerEquip(backpackIdx) {
    if (!pickerSlot) return;
    const res = player.equipFromBackpack(backpackIdx, pickerSlot);
    if (res) {
        postMessage(`⚔️ Equipped ${res.equipped.name} into ${SLOT_LABELS[res.slot] || res.slot}!`, 'msg-loot');
        selectedSlot = { type: 'body', id: res.slot };
        updateHUD();
        populateSheet();
        draw();
    }
    closeSlotPicker();
}

export function pickerUnequip() {
    if (!pickerSlot) return;
    const res = player.unequipToBackpack(pickerSlot);
    if (res.success) {
        postMessage(`🎒 Unequipped ${res.item.name} to backpack slot ${res.backpackIdx + 1}.`, 'msg-info');
        updateHUD();
        populateSheet();
        draw();
        renderSlotPicker();
    } else {
        postMessage(`⚠️ ${res.reason}`, 'msg-miss');
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
    // Escape closes modals or cancels targeting
    if (e.key === 'Escape') {
        if (targetingMode) {
            cancelTargeting();
            return;
        }
        const sheet = document.getElementById('sheet-modal');
        const inspect = document.getElementById('inspect-modal');
        const levelup = document.getElementById('levelup-modal');
        const spells = document.getElementById('spells-modal');
        const picker = document.getElementById('slot-picker-modal');
        const settingsM = document.getElementById('settings-modal');
        if (picker && picker.classList.contains('active')) { picker.classList.remove('active'); return; }
        if (settingsM && settingsM.classList.contains('active')) { settingsM.classList.remove('active'); return; }
        if (sheet && sheet.classList.contains('active')) sheet.classList.remove('active');
        if (inspect && inspect.classList.contains('active')) inspect.classList.remove('active');
        if (levelup && levelup.classList.contains('active')) levelup.classList.remove('active');
        if (spells && spells.classList.contains('active')) spells.classList.remove('active');
        return;
    }

    // Hotkey: T toggles Aiming / Targeting Mode
    if (e.key === 't' || e.key === 'T') {
        triggerAimMode();
        return;
    }

    // Hotkey: F opens Spells & Feats modal
    if (e.key === 'f' || e.key === 'F') {
        openSpellsModal();
        return;
    }

    // Hotkey: R triggers Camp Rest
    if (e.key === 'r' || e.key === 'R') {
        campRest();
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

    // Hotkey: Tab or Q triggers Auto-Target & Attack on closest visible foe
    if (e.key === 'Tab' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        autoTargetAndAttack();
        return;
    }

    let dx = 0, dy = 0;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -1;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dy = 1;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;
    if (e.key === ' ' || e.key === 'Spacebar') {
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
// REMOTE CONTROL (VIRTUAL D-PAD & GAMEPAD)
// ==========================================
export function moveRelative(dx, dy) {
    if (!player || !player.alive) return;
    if (dx === 0 && dy === 0) {
        waitTurn();
        return;
    }
    handleTap(player.x + dx, player.y + dy);
}

export function toggleRemoteControl(forceState) {
    const pad = document.getElementById('remote-control-pad');
    const btn = document.getElementById('btn-remote-toggle');
    if (!pad) return;

    const isCurrentlyVisible = pad.style.display !== 'none';
    const newState = (typeof forceState === 'boolean') ? forceState : !isCurrentlyVisible;

    pad.style.display = newState ? 'flex' : 'none';
    if (btn) {
        if (newState) {
            btn.classList.add('active-remote');
        } else {
            btn.classList.remove('active-remote');
        }
    }
    try {
        localStorage.setItem('pixel_rpg_remote_control', newState ? '1' : '0');
    } catch (e) {}
}

export function initRemoteControl() {
    let saved = null;
    try {
        saved = localStorage.getItem('pixel_rpg_remote_control');
    } catch (e) {}

    // Default to true on touch/mobile devices or if user explicitly enabled it
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);
    const shouldEnable = (saved !== null) ? (saved === '1') : isTouch;
    toggleRemoteControl(shouldEnable);
}

// ==========================================
// 15. CHARACTER SHEET & PAPERDOLL RENDERER
// ==========================================
export function populateSheet() {
    const formatMod = (m) => m >= 0 ? `+${m}` : `${m}`;
    const pClass = player.characterClass;

    // Header info & XP Progress
    const titleEl = document.getElementById('sheet-title');
    if (titleEl) titleEl.innerText = `${pClass.icon} ${player.race.name.toUpperCase()} ${pClass.name.toUpperCase()} (LV. ${player.level})`;

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

    const rEl = document.getElementById('sheet-rations');
    if (rEl) rEl.innerText = player.rations !== undefined ? player.rations : 5;

    // Render Equipped Modular Set Bonuses
    const setSummary = calculateEquippedSetBonuses(player);
    const setBonusesEl = document.getElementById('sheet-set-bonuses');
    if (setBonusesEl) {
        if (setSummary.activeSets.length > 0) {
            setBonusesEl.style.display = 'block';
            setBonusesEl.innerHTML = `
                <div style="font-size: 11px; font-weight: bold; color: #ffcc00; margin-bottom: 4px;">👑 EQUIPPED SET BONUSES:</div>
                ${setSummary.activeSets.map(s => {
                    const isFullyActive = s.tier > 0;
                    const statusColor = isFullyActive ? '#55ff77' : '#ffcc00';
                    return `
                        <div style="background: #111422; border: 1px solid ${isFullyActive ? '#337744' : '#443322'}; border-radius: 4px; padding: 4px 6px; margin-bottom: 4px; font-size: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                                <strong style="color: ${statusColor};">${s.icon} ${s.name} (${s.count} pc)</strong>
                                <span style="color: ${statusColor}; font-weight: bold;">${s.title}</span>
                            </div>
                            <div style="color: #ccc; font-size: 9px; margin-top: 1px;">${s.desc}</div>
                        </div>
                    `;
                }).join('')}
            `;
        } else {
            setBonusesEl.style.display = 'none';
        }
    }

    // Visual Paperdoll Body Slots (10 slots)
    const eq = player.equipment;
    const isBodySelected = (slot) => selectedSlot?.type === 'body' && selectedSlot?.id === slot;

    const slotCard = (slotName, slotKey, iconPlaceholder) => {
        const item = eq[slotKey];
        const isSel = isBodySelected(slotKey);
        const isEquipped = !!item;
        return `
            <div class="paperdoll-slot ${isEquipped ? 'equipped' : 'unequipped'} ${isSel ? 'selected' : ''}" 
                 onclick="window.openSlotPicker('${slotKey}')"
                 title="${slotName}: ${isEquipped ? item.name : 'Unequipped (Tap to inspect)'}">
                <div class="slot-label">${slotName}</div>
                <div class="slot-icon">${isEquipped ? item.icon : iconPlaceholder}</div>
                ${isEquipped ? `
                    <div class="slot-name">${item.name}</div>
                    <div class="slot-stat">${item.desc || ''}</div>
                ` : `
                    <div class="slot-stat" style="color: #4a5068; font-size: 8px;">-</div>
                `}
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

                let extraAimBtn = '';
                if (item.delivery === 'RANGED' || item.delivery === 'AOE') {
                    extraAimBtn = `<button class="btn-action-small" style="background:#2b2210; border-color:#ffcc00; color:#ffcc00;" onclick="window.closeSheetModal(); window.triggerAimMode();">🎯 Aim Weapon</button>`;
                }

                cardActions.innerHTML = `
                    <button class="btn-action-small" onclick="window.unequipSelectedBodyItem()">🎒 Unequip</button>
                    ${extraAimBtn}
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
                cardSlot.innerText = `Slot: ${item.slot ? item.slot.replace('_', ' ') : 'Consumable'}`;
                cardDesc.innerText = item.desc || 'Standard item';

                let throwAimBtn = '';
                if (item.delivery === 'RANGED' || item.delivery === 'AOE') {
                    throwAimBtn = `<button class="btn-action-small" style="background: #1b2e2d; border-color: #64d8cb; color: #64d8cb;" onclick="window.throwItemFromBackpack(${selectedSlot.id})">🎯 Aim & Throw / Fire</button>`;
                }

                // One Equip button per compatible slot (rings get "Left Ring" / "Right Ring")
                const compatSlots = getCompatibleSlots(item);
                const equipButtonsHtml = compatSlots.length > 1
                    ? compatSlots.map(sl => `<button class="btn-action-small" style="background: #193826; border-color: #55ff77; color: #aaffaa;" onclick="window.equipSelectedBackpackItem('${sl}')">⚔️ ${SLOT_LABELS[sl]}</button>`).join('')
                    : (item.slot ? `<button class="btn-action-small" style="background: #193826; border-color: #55ff77; color: #aaffaa;" onclick="window.equipSelectedBackpackItem()">⚔️ Equip</button>` : '');

                let consumeBtn = '';
                if (item.isConsumable) {
                    consumeBtn = `<button class="btn-action-small" style="background: #2a3a19; border-color: #77cc33; color: #ccff77;" onclick="window.consumeBackpackItem(${selectedSlot.id})">🍴 Eat / Consume</button>`;
                }

                cardActions.innerHTML = `
                    ${equipButtonsHtml}
                    ${consumeBtn}
                    ${throwAimBtn}
                    <button class="btn-action-small" style="background: #381919; border-color: #ff6666; color: #ffaaaa;" onclick="window.dropSelectedBackpackItem()">🗑️ Drop</button>
                `;
            } else {
                cardContent.style.display = 'none';
                cardTitle.innerText = `Backpack Slot ${selectedSlot.id + 1} is empty.`;
            }
        }
    } else {
        cardTitle.innerText = 'Tap an item in your backpack to equip/throw, or tap equipped gear to unequip:';
        cardContent.style.display = 'none';
    }

    // Race traits, learned feats and heroic masteries
    const traitsEl = document.getElementById('sheet-traits');
    if (traitsEl) {
        const rows = [];
        rows.push(`<div><strong style="color:#ffcc00;">${player.race.icon} ${player.race.name}:</strong> ${player.race.traits.map(t => `${t.name} (${t.desc})`).join('; ')}</div>`);
        player.generalFeats.forEach(id => { const f = FEATS[id]; if (f) rows.push(`<div>${f.icon} <strong>${f.name}:</strong> ${f.desc}</div>`); });
        player.masteries.forEach(id => { const m = MASTERIES[id]; if (m) rows.push(`<div>${m.icon} <strong>${m.name}:</strong> ${m.desc}</div>`); });
        if (player.generalFeats.length === 0 && player.masteries.length === 0) rows.push(`<div style="color:#666;">No feats yet (first feat at level 2, then every 3 levels).</div>`);
        traitsEl.innerHTML = rows.join('');
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

    // Render Modular Skills Specializations
    const skillsListEl = document.getElementById('sheet-skills-list');
    if (skillsListEl && player.skills) {
        skillsListEl.innerHTML = Object.entries(SKILLS).map(([key, s]) => {
            const rank = player.skills[s.id] || 0;
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #111420; padding: 4px 6px; border-radius: 4px; border: 1px solid #252b3d;">
                    <div>
                        <strong style="color: #ffcc00;">${s.icon} ${s.name}</strong>
                        <div style="color: #888ea6; font-size: 9px;">${s.desc}</div>
                    </div>
                    <div style="font-weight: bold; color: ${rank > 0 ? '#64d8cb' : '#555'}; font-size: 11px;">
                        Rank ${rank}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render Level-by-Level Progression History Timeline
    const historyEl = document.getElementById('sheet-progression-history');
    if (historyEl && player.progressionHistory) {
        historyEl.innerHTML = player.progressionHistory.map(h => {
            const featsUnlocked = h.unlockedAbilities?.length > 0 ? ` • Unlocked: ${h.unlockedAbilities.join(', ')}` : '';
            return `
                <div style="padding: 4px 6px; border-bottom: 1px solid #1c2132; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #64d8cb;">Level ${h.level}:</strong>
                        <span style="color: #ddd;">${h.choiceLabel}</span>
                        ${h.hpGain ? `<span style="color: #ff5577;"> (+${h.hpGain} HP)</span>` : ''}
                        <div style="color: #888; font-size: 9px;">${featsUnlocked}</div>
                    </div>
                    ${h.totalHp ? `<span style="color: #888ea6; font-size: 9px;">HP ${h.totalHp} | AC ${h.ac}</span>` : ''}
                </div>
            `;
        }).join('');
    }
}

export function consumeBackpackItem(idx) {
    if (!player || !player.alive) return;
    const res = player.consumeItem(idx);
    if (res) {
        let msg = `🍴 Consumed ${res.item.name}!`;
        if (res.rationsGained) msg += ` (+${res.rationsGained} Rations: ${player.rations} total)`;
        if (res.healAmt) msg += ` (Healed +${res.healAmt} HP: ${player.hp}/${player.maxHp})`;
        if (res.statusApplied) msg += ` [Gained ${res.statusApplied}!]`;
        postMessage(msg, 'msg-loot');
        selectedSlot = null;
        updateHUD();
        populateSheet();
        draw();
    }
}

export function campRest() {
    if (!player || !player.alive) return;
    const { monsters, visibility } = currentFloorData;
    const visibleFoes = monsters.filter(m => m.alive && visibility[m.y * MAP_WIDTH + m.x] === VISIBILITY.VISIBLE);
    if (visibleFoes.length > 0) {
        postMessage('⚠️ Cannot camp! Hostile foes are in your line of sight!', 'msg-miss');
        return;
    }

    const res = player.campRest();
    if (res.success) {
        for (let i = 0; i < 5; i++) {
            player.advanceTurn();
        }
        postMessage(`🏕️ Made camp and cooked a hearty meal! Restored +${res.healed} HP, cooldowns reset, Well-Fed vigor (+1 AC, +1 Atk)! (${res.rationsLeft} rations left)`, 'msg-victory');
        updateHUD();
        populateSheet();
        draw();
    } else {
        postMessage(`⚠️ ${res.reason}`, 'msg-miss');
    }
}

export function switchSheetTab(tabId) {
    currentSheetTab = tabId;
    const gearBtn = document.getElementById('tab-btn-gear');
    const statsBtn = document.getElementById('tab-btn-stats');
    const gearPane = document.getElementById('sheet-gear-pane');
    const statsPane = document.getElementById('sheet-stats-pane');

    if (gearBtn) gearBtn.className = `modal-tab ${tabId === 'gear' ? 'active' : ''}`;
    if (statsBtn) statsBtn.className = `modal-tab ${tabId === 'stats' ? 'active' : ''}`;

    if (gearPane) gearPane.style.display = tabId === 'gear' ? 'block' : 'none';
    if (statsPane) statsPane.style.display = tabId === 'stats' ? 'flex' : 'none';

    populateSheet();
}

// ==========================================
// 16. SETTINGS SCREEN (map size, class, race, debug tools)
// ==========================================
function fillSelect(id, options, selectedValue) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = options.map(o => `<option value="${o.value}" ${String(o.value) === String(selectedValue) ? 'selected' : ''}>${o.label}</option>`).join('');
}

export function updateSettingsPreview() {
    const cls = ClassManager.getClass(document.getElementById('set-class')?.value);
    const race = RaceManager.getRace(document.getElementById('set-race')?.value);
    const el = document.getElementById('set-preview');
    if (!el) return;
    const a = cls.attributes;
    const fmt = (k) => Math.max(3, a[k] + (race.attrs[k] || 0));
    const gear = Object.values(cls.startingGear || {}).join(', ') || 'Bare hands';
    el.innerHTML = `
        <div><strong>${cls.icon} ${cls.name}</strong> — ${cls.title}. ${cls.desc}</div>
        <div style="margin-top:3px;"><strong>${race.icon} ${race.name}:</strong> ${race.traits.map(t => `${t.name} (${t.desc})`).join('; ')}</div>
        <div style="margin-top:3px;">Hit die d${cls.hitDie} • Base HP ${cls.baseHp} • STR ${fmt('str')} DEX ${fmt('dex')} CON ${fmt('con')} INT ${fmt('int')} WIS ${fmt('wis')} CHA ${fmt('cha')}</div>
        <div style="margin-top:3px; color:#888ea6;">Starting kit: ${gear}</div>`;
}

export function openSettings(newGame = false) {
    const title = document.getElementById("settings-title");
    if (title) title.innerText = newGame === true ? "🧙 NEW GAME: CREATE YOUR CHARACTER" : "⚙️ SETTINGS & NEW RUN";
    fillSelect('set-map-size', MAP_SIZES.map(s => ({ value: s.size, label: s.label })), settings.mapSize);
    fillSelect('set-class', ClassManager.getSelectableClasses().map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })), settings.classId);
    fillSelect('set-race', RaceManager.getAllRaces().map(r => ({ value: r.id, label: `${r.icon} ${r.name}` })), settings.raceId);
    const dbg = document.getElementById('set-debug');
    if (dbg) dbg.checked = !!settings.debug;
    updateSettingsPreview();
    refreshDebugPanel();
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('active');
}

export function closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
}

function readSettingsFromModal() {
    settings.mapSize = normalizeMapSize(document.getElementById('set-map-size')?.value);
    settings.classId = ClassManager.getClass(document.getElementById('set-class')?.value).id;
    settings.raceId = RaceManager.getRace(document.getElementById('set-race')?.value).id;
    settings.debug = !!document.getElementById('set-debug')?.checked;
    saveSettings();
}

// Settings that change the world (map size / class / race) take effect on a NEW run.
export function applySettings(newSeed = true) {
    readSettingsFromModal();
    closeSettings();
    const seed = newSeed ? PRNG.generateRandomSeed() : dungeonManager.baseSeedString;
    startPlaythrough(seed);
    postMessage(`⚙️ New run: ${player.race.name} ${player.characterClass.name} on a ${MAP_WIDTH}x${MAP_HEIGHT} map.`, 'msg-info');
}

export function saveSettingsOnly() {
    readSettingsFromModal();
    refreshDebugPanel();
    postMessage('⚙️ Settings saved (map size / class / race apply to the next run).', 'msg-info');
}

// ==========================================
// 17. DEBUG / TEST TOOLS (hidden: settings toggle, ?debug=1, or any TEST* seed)
// ==========================================
function refreshDebugPanel() {
    const panel = document.getElementById('debug-panel');
    if (panel) panel.style.display = isDebugEnabled() ? 'block' : 'none';
    const info = document.getElementById('debug-info');
    if (info && player && currentFloorData && isDebugEnabled()) {
        const f = currentFloorData;
        info.innerText = `Seed ${dungeonManager.baseSeedString} | Map ${MAP_WIDTH}x${MAP_HEIGHT} | F${dungeonManager.currentFloor} | Lv${player.level} | ${f.monsters.filter(m => m.alive).length} foes, ${f.chests.length} chests | god:${godMode ? 'on' : 'off'}`;
    }
}

function afterDebugChange(msg) {
    if (msg) postMessage(`🛠️ ${msg}`, 'msg-info');
    runPerceptionRadar();
    updateHUD();
    populateSheet();
    refreshDebugPanel();
    draw();
}

export const pixelDebug = {
    startRun(seed, opts = {}) { startPlaythrough(seed, opts); return this.state(); },
    jumpToFloor(n) {
        n = Math.max(1, Math.min(25, parseInt(n, 10) || 1));
        cancelWalking();
        cancelTargeting();
        loadFloor(n, true);
        afterDebugChange(`Jumped to floor ${n}.`);
        return n;
    },
    // Raises the hero to `level` (queues the real level-up choices so the UI can be exercised)
    setLevel(level) {
        level = Math.max(1, Math.min(PROGRESSION.maxLevel, parseInt(level, 10) || 1));
        if (level <= player.level) return player.level;
        const lvs = player.gainXp(XP_TABLE[level - 1] - player.xp);
        handleLevelUps(lvs);
        afterDebugChange(`Granted XP up to level ${level}.`);
        return player.level;
    },
    addLevels(n = 1) { return this.setLevel(Math.min(PROGRESSION.maxLevel, player.level + n)); },
    addXp(n = 100) {
        const lvs = player.gainXp(n);
        if (lvs.length) handleLevelUps(lvs);
        afterDebugChange(`+${n} XP.`);
    },
    heal() { player.hp = player.maxHp; afterDebugChange('Fully healed.'); },
    addRations(n = 5) { player.rations += n; afterDebugChange(`+${n} rations.`); },
    toggleGod() { godMode = !godMode; afterDebugChange(`God mode ${godMode ? 'ON' : 'OFF'}.`); return godMode; },
    // One distinct item per equipment slot (2 spare rings so both ring slots + a swap can be tested) into the bag
    grantSlotItems() {
        const equippedNames = new Set(player.getEquippedItems().map(i => i.name));
        const pickFor = (slot, count = 1) => BASE_ITEMS.filter(b => b.slot === slot && !b.isConsumable && !equippedNames.has(b.name)).slice(0, count);
        const bases = [];
        for (const slot of Object.values(ITEM_SLOTS)) {
            const count = (slot === ITEM_SLOTS.RING_LEFT || slot === ITEM_SLOTS.RING_RIGHT) ? 2 : 1;
            bases.push(...pickFor(slot, count));
        }
        let added = 0;
        for (const b of bases) { if (player.addToBackpack(createItemFromBase(b))) added++; }
        afterDebugChange(`Added ${added} slot items to the bag.`);
        return added;
    },
    clearBag() { player.backpack.fill(null); afterDebugChange('Bag emptied.'); },
    revealMap() {
        currentFloorData.visibility.fill(VISIBILITY.EXPLORED);
        afterDebugChange('Whole floor revealed.');
    },
    teleportToStairs(down = true) {
        const p = down ? currentFloorData.stairsDownPos : currentFloorData.stairsUpPos;
        player.x = p.x; player.y = p.y;
        afterDebugChange(`Teleported to stairs ${down ? 'down' : 'up'}.`);
    },
    teleport(x, y) {
        player.x = x; player.y = y;
        afterDebugChange(`Teleported to (${x}, ${y}).`);
    },
    loadTestSeed() {
        closeSettings();
        startPlaythrough('TEST-0001');
        postMessage('🛠️ Test level loaded: the spine corridor east of spawn leads to every feature room and the item vault.', 'msg-info');
    },
    killAllVisible() {
        const { monsters, visibility } = currentFloorData;
        let n = 0;
        for (const m of monsters) {
            if (m.alive && visibility[m.y * MAP_WIDTH + m.x] === VISIBILITY.VISIBLE) { m.hp = 0; m.alive = false; addCorpse(m); n++; }
        }
        afterDebugChange(`Removed ${n} visible foes.`);
    },
    // Snapshot for automated verification
    state() {
        const f = currentFloorData;
        const tileCounts = {};
        for (let i = 0; i < f.terrain.length; i++) tileCounts[f.terrain[i]] = (tileCounts[f.terrain[i]] || 0) + 1;
        return {
            seed: dungeonManager.baseSeedString, floor: dungeonManager.currentFloor, mapW: MAP_WIDTH, mapH: MAP_HEIGHT,
            terrainLen: f.terrain.length, visLen: f.visibility.length, tileCounts,
            rooms: f.rooms.length, monsters: f.monsters.length, chests: f.chests.length, mushrooms: f.mushrooms.length,
            stairsUp: f.stairsUpPos, stairsDown: f.stairsDownPos, player: { x: player.x, y: player.y },
            level: player.level, xp: player.xp, hp: player.hp, maxHp: player.maxHp, ac: player.ac, per: player.per,
            cls: player.characterClass.id, race: player.race.id,
            attrs: { str: player.str, dex: player.dex, con: player.con, int: player.int, wis: player.wis, cha: player.cha },
            equipment: Object.fromEntries(Object.entries(player.equipment).map(([k, v]) => [k, v ? v.name : null])),
            backpack: player.backpack.map(i => i ? i.name : null),
            feats: [...player.generalFeats], masteries: [...player.masteries], statuses: (player.statuses || []).map(s => s.id + ':' + s.duration),
            pendingLevelUps: levelUpQueue.length
        };
    },
    // Reachability check: flood fill over non-solid tiles (doors, secret doors and barrels count as passable) from stairs up
    reachableStairsDown() {
        const f = currentFloorData;
        const W = MAP_WIDTH, H = MAP_HEIGHT;
        const seen = new Uint8Array(W * H);
        const q = [f.stairsUpPos.y * W + f.stairsUpPos.x];
        seen[q[0]] = 1;
        const blocked = new Set([TILES.WALL, TILES.PILLAR, TILES.PIT, TILES.RUBBLE]);
        for (let h = 0; h < q.length; h++) {
            const i = q[h], x = i % W, y = (i - x) / W;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                const ni = ny * W + nx;
                if (seen[ni] || blocked.has(f.terrain[ni])) continue;
                seen[ni] = 1; q.push(ni);
            }
        }
        const d = f.stairsDownPos;
        return { reachable: !!seen[d.y * W + d.x], tilesReached: q.length };
    },
    // Samples reachable-looking floor tiles within `radius` of the hero and times A* to each
    pathBench(radius = 30, samples = 60) {
        const f = currentFloorData;
        const W = MAP_WIDTH;
        let tried = 0, found = 0, maxMs = 0, totalLen = 0;
        for (let n = 0; n < samples * 20 && tried < samples; n++) {
            const x = player.x + Math.floor((Math.random() * 2 - 1) * radius);
            const y = player.y + Math.floor((Math.random() * 2 - 1) * radius);
            if (x < 0 || y < 0 || x >= W || y >= MAP_HEIGHT || f.terrain[y * W + x] !== TILES.FLOOR) continue;
            tried++;
            const t0 = performance.now();
            const path = findPath(player.x, player.y, x, y, f.terrain, f.monsters);
            maxMs = Math.max(maxMs, performance.now() - t0);
            if (path.length) { found++; totalLen += path.length; }
        }
        return { tried, found, maxMs: +maxMs.toFixed(2), avgLen: found ? +(totalLen / found).toFixed(1) : 0 };
    },
    pathTest(x, y) {
        const t0 = performance.now();
        const path = findPath(player.x, player.y, x, y, currentFloorData.terrain, currentFloorData.monsters);
        return { len: path.length, ms: +(performance.now() - t0).toFixed(2) };
    }
};

// ==========================================
// Initial launch: URL params ?seed= ?map= ?class= ?race= ?debug=1 ?floor= ?level=
// ==========================================
loadSettings();
const urlParams = new URLSearchParams(window.location.search);
const initSeed = urlParams.get('seed') || PRNG.generateRandomSeed();
if (urlParams.get('debug') === '1') settings.debug = true;
startPlaythrough(initSeed, {
    mapSize: urlParams.get('map') ?? undefined,
    classId: urlParams.get('class') ?? undefined,
    raceId: urlParams.get('race') ?? undefined
});
if (urlParams.get('floor')) pixelDebug.jumpToFloor(urlParams.get('floor'));
if (urlParams.get('level')) pixelDebug.setLevel(urlParams.get('level'));
window.pixelDebug = pixelDebug;

// A fresh visit (no seed / class / race in the URL) opens on character creation
if (!urlParams.get("seed") && !urlParams.get("class") && !urlParams.get("race")) openSettings(true);
