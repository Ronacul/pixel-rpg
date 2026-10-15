// Pixel RPG Starter Engine
// Zero-dependency HTML5 Canvas retro RPG with Web Audio & Mobile Touch Support

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hpVal = document.getElementById('hp-val');
const goldVal = document.getElementById('gold-val');
const dialogBox = document.getElementById('dialog-box');
const dialogSpeaker = document.getElementById('dialog-speaker');
const dialogText = document.getElementById('dialog-text');

// Game World Constants
const TILE_SIZE = 16;
const COLS = 30; // 480 / 16
const ROWS = 20; // 320 / 16

// Simple 8-bit Synthesizer using Web Audio API
class SoundFx {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playTone(freq, type = 'square', duration = 0.1, gain = 0.1) {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy catch
    }
  }

  step() {
    this.playTone(180, 'triangle', 0.04, 0.05);
  }

  blip() {
    this.playTone(440, 'square', 0.06, 0.08);
  }

  bump() {
    this.playTone(110, 'sawtooth', 0.08, 0.08);
  }

  chest() {
    this.init();
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'square', 0.15, 0.12);
      }, idx * 100);
    });
  }
}

const sfx = new SoundFx();

// Tiles
const TILES = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  TREE: 3,
  ROCK: 4
};

// Procedural Map Generation
const map = [];
for (let r = 0; r < ROWS; r++) {
  const row = [];
  for (let c = 0; c < COLS; c++) {
    // Water border on bottom-right pond
    if (r >= 13 && c >= 20 && (r - 16) ** 2 + (c - 24) ** 2 < 20) {
      row.push(TILES.WATER);
    } else if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
      // Tree borders
      row.push(TILES.TREE);
    } else if (r === 10 || (c === 15 && r > 4 && r < 16)) {
      // Dirt cross paths
      row.push(TILES.PATH);
    } else if (Math.random() < 0.08 && !(r === 10 || c === 15)) {
      // Random trees and rocks
      row.push(Math.random() < 0.6 ? TILES.TREE : TILES.ROCK);
    } else {
      row.push(TILES.GRASS);
    }
  }
  map.push(row);
}

// Game State
const state = {
  gold: 0,
  hp: 100,
  dialogActive: false,
  waterFrame: 0
};

// Player Entity
const player = {
  x: 10 * TILE_SIZE,
  y: 10 * TILE_SIZE,
  width: 14,
  height: 14,
  speed: 1.5,
  direction: 'down',
  isMoving: false,
  animTimer: 0,
  walkFrame: 0
};

// Entities
const entities = [
  {
    type: 'npc',
    id: 'elder',
    name: 'Elder Rowan',
    x: 12 * TILE_SIZE,
    y: 9 * TILE_SIZE,
    color: '#9b5de5',
    dialog: [
      "Welcome, young adventurer!",
      "The ancient chest to the north is said to contain royal treasure.",
      "Be careful around the pond—deep waters are impassable!"
    ],
    dialogIndex: 0
  },
  {
    type: 'chest',
    id: 'chest_1',
    x: 15 * TILE_SIZE,
    y: 3 * TILE_SIZE,
    opened: false,
    value: 50
  },
  {
    type: 'slime',
    id: 'slime_1',
    x: 6 * TILE_SIZE,
    y: 14 * TILE_SIZE,
    dx: 0.3,
    color: '#00f5d4'
  }
];

// Input Management
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  action: false
};

window.addEventListener('keydown', (e) => {
  sfx.init();
  if (['ArrowUp', 'KeyW'].includes(e.code)) keys.up = true;
  if (['ArrowDown', 'KeyS'].includes(e.code)) keys.down = true;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = true;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = true;
  if (['Space', 'Enter', 'KeyE'].includes(e.code)) {
    if (!keys.action) interact();
    keys.action = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (['ArrowUp', 'KeyW'].includes(e.code)) keys.up = false;
  if (['ArrowDown', 'KeyS'].includes(e.code)) keys.down = false;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = false;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = false;
  if (['Space', 'Enter', 'KeyE'].includes(e.code)) keys.action = false;
});

// Setup Touch Controls for Mobile
function bindTouch(elementId, key) {
  const btn = document.getElementById(elementId);
  if (!btn) return;

  const press = (e) => {
    e.preventDefault();
    sfx.init();
    btn.classList.add('active');
    if (key === 'action') {
      interact();
    } else {
      keys[key] = true;
    }
  };

  const release = (e) => {
    e.preventDefault();
    btn.classList.remove('active');
    if (key !== 'action') keys[key] = false;
  };

  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);
}

bindTouch('btn-up', 'up');
bindTouch('btn-down', 'down');
bindTouch('btn-left', 'left');
bindTouch('btn-right', 'right');
bindTouch('btn-action', 'action');

// Tap to dismiss dialog
dialogBox.addEventListener('click', () => {
  if (state.dialogActive) advanceDialog();
});

// Collision Helper
function isSolid(x, y) {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  const tile = map[row][col];
  if (tile === TILES.WATER || tile === TILES.TREE || tile === TILES.ROCK) return true;

  // Solid Entities check
  for (const ent of entities) {
    if (ent.type === 'npc' || (ent.type === 'chest' && !ent.opened)) {
      if (Math.abs(ent.x - x) < 12 && Math.abs(ent.y - y) < 12) return true;
    }
  }
  return false;
}

// Interaction Handler
function interact() {
  if (state.dialogActive) {
    advanceDialog();
    return;
  }

  // Find entity in front of player
  let checkX = player.x + 7;
  let checkY = player.y + 7;
  if (player.direction === 'up') checkY -= 16;
  if (player.direction === 'down') checkY += 16;
  if (player.direction === 'left') checkX -= 16;
  if (player.direction === 'right') checkX += 16;

  for (const ent of entities) {
    const dist = Math.hypot((ent.x + 8) - checkX, (ent.y + 8) - checkY);
    if (dist < 18) {
      if (ent.type === 'npc') {
        startDialog(ent.name, ent.dialog[ent.dialogIndex]);
        ent.dialogIndex = (ent.dialogIndex + 1) % ent.dialog.length;
        sfx.blip();
        return;
      }
      if (ent.type === 'chest') {
        if (!ent.opened) {
          ent.opened = true;
          state.gold += ent.value;
          goldVal.innerText = state.gold;
          sfx.chest();
          startDialog("Chest Opened", `You found ${ent.value} Gold coins!`);
        } else {
          startDialog("Empty Chest", "The chest is empty.");
        }
        return;
      }
    }
  }
}

function startDialog(speaker, text) {
  state.dialogActive = true;
  dialogSpeaker.innerText = speaker;
  dialogText.innerText = text;
  dialogBox.classList.remove('hidden');
}

function advanceDialog() {
  state.dialogActive = false;
  dialogBox.classList.add('hidden');
}

// Update Loop
function update() {
  if (state.dialogActive) return;

  let moveX = 0;
  let moveY = 0;

  if (keys.up) { moveY -= player.speed; player.direction = 'up'; }
  if (keys.down) { moveY += player.speed; player.direction = 'down'; }
  if (keys.left) { moveX -= player.speed; player.direction = 'left'; }
  if (keys.right) { moveX += player.speed; player.direction = 'right'; }

  player.isMoving = (moveX !== 0 || moveY !== 0);

  if (player.isMoving) {
    player.animTimer++;
    if (player.animTimer % 12 === 0) {
      player.walkFrame = (player.walkFrame + 1) % 4;
      sfx.step();
    }

    // X collision
    const nextX = player.x + moveX;
    if (!isSolid(nextX, player.y) && !isSolid(nextX + player.width, player.y) &&
        !isSolid(nextX, player.y + player.height) && !isSolid(nextX + player.width, player.y + player.height)) {
      player.x = nextX;
    } else {
      sfx.bump();
    }

    // Y collision
    const nextY = player.y + moveY;
    if (!isSolid(player.x, nextY) && !isSolid(player.x + player.width, nextY) &&
        !isSolid(player.x, nextY + player.height) && !isSolid(player.x + player.width, nextY + player.height)) {
      player.y = nextY;
    } else {
      sfx.bump();
    }
  } else {
    player.walkFrame = 0;
  }

  // Update Slime wander
  const slime = entities.find(e => e.type === 'slime');
  if (slime) {
    slime.x += slime.dx;
    if (slime.x > 8 * TILE_SIZE || slime.x < 4 * TILE_SIZE) {
      slime.dx *= -1;
    }
  }

  state.waterFrame += 0.05;
}

// Pixel Art Rendering Routines
function drawTile(tile, x, y) {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  switch (tile) {
    case TILES.GRASS:
      ctx.fillStyle = '#38b000';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#007200';
      ctx.fillRect(px + 4, py + 4, 2, 2);
      ctx.fillRect(px + 10, py + 12, 2, 2);
      break;

    case TILES.PATH:
      ctx.fillStyle = '#d4a373';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#bc6c25';
      ctx.fillRect(px + 2, py + 8, 3, 2);
      ctx.fillRect(px + 11, py + 3, 2, 3);
      break;

    case TILES.WATER:
      const wave = Math.sin(state.waterFrame + x) * 2;
      ctx.fillStyle = '#0077b6';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#90e0ef';
      ctx.fillRect(px + 2, py + 6 + wave, 12, 2);
      break;

    case TILES.TREE:
      // Base grass
      ctx.fillStyle = '#38b000';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Trunk
      ctx.fillStyle = '#582f0e';
      ctx.fillRect(px + 6, py + 10, 4, 6);
      // Leaves canopy
      ctx.fillStyle = '#004b23';
      ctx.fillRect(px + 2, py + 2, 12, 10);
      ctx.fillStyle = '#007200';
      ctx.fillRect(px + 4, py + 3, 8, 7);
      break;

    case TILES.ROCK:
      ctx.fillStyle = '#38b000';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#6c757d';
      ctx.fillRect(px + 3, py + 5, 10, 8);
      ctx.fillStyle = '#adb5bd';
      ctx.fillRect(px + 4, py + 6, 4, 3);
      break;
  }
}

function drawPlayer() {
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  const bob = (player.walkFrame % 2 === 1) ? 1 : 0;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(px + 7, py + 14, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tunic / Body
  ctx.fillStyle = '#e63946'; // Red adventurer tunic
  ctx.fillRect(px + 3, py + 6 - bob, 8, 8);

  // Head
  ctx.fillStyle = '#ffb703'; // Blond hair
  ctx.fillRect(px + 3, py + 1 - bob, 8, 4);
  ctx.fillStyle = '#ffe0b2'; // Face
  ctx.fillRect(px + 4, py + 3 - bob, 6, 3);

  // Eyes based on direction
  ctx.fillStyle = '#1d3557';
  if (player.direction === 'down') {
    ctx.fillRect(px + 5, py + 4 - bob, 1, 1);
    ctx.fillRect(px + 8, py + 4 - bob, 1, 1);
  } else if (player.direction === 'left') {
    ctx.fillRect(px + 4, py + 4 - bob, 1, 1);
  } else if (player.direction === 'right') {
    ctx.fillRect(px + 9, py + 4 - bob, 1, 1);
  }

  // Sword / Belt
  ctx.fillStyle = '#a8dadc';
  if (player.direction === 'right') {
    ctx.fillRect(px + 11, py + 7 - bob, 4, 2);
  } else if (player.direction === 'left') {
    ctx.fillRect(px - 1, py + 7 - bob, 4, 2);
  }
}

function drawEntities() {
  for (const ent of entities) {
    if (ent.type === 'npc') {
      // NPC Elder Wizard
      ctx.fillStyle = ent.color;
      ctx.fillRect(ent.x + 3, ent.y + 4, 10, 11);
      // Hat
      ctx.fillStyle = '#7209b7';
      ctx.fillRect(ent.x + 4, ent.y, 8, 4);
      // Beard
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ent.x + 5, ent.y + 7, 6, 6);
    } else if (ent.type === 'chest') {
      // Treasure Chest
      ctx.fillStyle = ent.opened ? '#adb5bd' : '#ffb703';
      ctx.fillRect(ent.x + 2, ent.y + 4, 12, 10);
      ctx.fillStyle = '#6f4e37';
      ctx.fillRect(ent.x + 3, ent.y + 5, 10, ent.opened ? 4 : 8);
      // Keyhole
      ctx.fillStyle = '#000000';
      ctx.fillRect(ent.x + 7, ent.y + 9, 2, 2);
    } else if (ent.type === 'slime') {
      // Bouncing Slime
      const bounce = Math.abs(Math.sin(state.waterFrame * 2)) * 2;
      ctx.fillStyle = ent.color;
      ctx.beginPath();
      ctx.arc(ent.x + 8, ent.y + 9 - bounce, 6, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#03045e';
      ctx.fillRect(ent.x + 6, ent.y + 7 - bounce, 2, 2);
      ctx.fillRect(ent.x + 10, ent.y + 7 - bounce, 2, 2);
    }
  }
}

// Main Game Loop
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Render Map
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      drawTile(map[r][c], c, r);
    }
  }

  // Render Entities
  drawEntities();

  // Render Player
  drawPlayer();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// Start Game
requestAnimationFrame(gameLoop);
