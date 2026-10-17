# Pixel RPG ⚔️

A 2D retro RPG engine sandbox prototype built with HTML5 Canvas and vanilla JavaScript. Features a d20 combat resolution system, base RPG attributes, tile-based grid collision, and an interactive combat log.

## Features

- **RPG Engine Sandbox v0.2:**
  - **10x10 Tile Grid Matrix:** Perimeter solid walls with open dungeon floor grid.
  - **Hero (Human Warrior):** Tracked core attributes (STR 12 (+1), DEX 10 (+0), CON 12 (+1), INT 10 (+0), WIS 10 (+0), CHA 10 (+0)), HP (28/28), and Armor Class (AC 12).
  - **Target (Sewer Rat):** Interactive monster entity with HP (6/6), AC 10, and counter-attack behavior.
  - **d20 Combat Engine:**
    - Player attack roll: `d20 + BAB (+1)` vs Target AC.
    - Damage pipeline: `d6 + STR Modifier (+1)` physical damage.
    - Enemy retaliation attack roll & damage resolution on turn.
  - **Combat Resolution Log:** Live combat feed with color-coded hits, misses, and victory states.
  - **Controls:** Arrow keys for desktop movement; on-screen directional D-Pad for mouse and mobile touch controls.

---

## 🎮 How to Play

### Desktop
- **Movement:** `Arrow Keys` or click on-screen D-Pad
- **Combat:** Walk directly into the Sewer Rat (R) to engage combat turns

### Mobile / Phone
- **Movement:** Tap the on-screen D-Pad buttons (▲, ◀, ▼, ▶)

---

## 📱 How to Playtest on Your Phone

### Option 1: Over Your Local Wi-Fi (Instant, No Internet Required)
1. In PowerShell, navigate to this folder and run:
   ```powershell
   .\serve.ps1
   ```
2. Look at the output for your local network URL (for example: `http://192.168.86.209:8080`).
3. Make sure your phone is connected to the same Wi-Fi network, open Safari or Chrome on your phone, and navigate to that address.

### Option 2: Free Cloud Hosting (Play from Anywhere)
Even with a **Private GitHub repository**, you can connect free hosting services to your GitHub account:
- **Cloudflare Pages**, **Vercel**, or **Netlify**:
  1. Log in with your GitHub account (`Ronacul`).
  2. Select your private `pixel-rpg` repository.
  3. Deploy! You'll get an `https://...` link that you and anyone else can open anywhere on mobile.

---

## 📚 Engine Architecture & Design Docs

- [Master Plan (Phases 1-4)](file:///C:/Users/The%20One/.gemini/antigravity/scratch/pixel-rpg/MASTER_PLAN.md): Core attributes, derived mechanics, modular registry, and monster behavior.
- [System Modification Maps](file:///C:/Users/The%20One/.gemini/antigravity/scratch/pixel-rpg/SYSTEM_MODIFICATIONS.md): d20 combat formulas and perception radar scan matrix.
