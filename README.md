# Pixel RPG ⚔️

A 2D retro pixel RPG built with HTML5 Canvas, modern JavaScript, and 8-bit procedural Web Audio. Zero external asset dependencies required to run!

## Features

- **Retro Pixel Engine:** 16x16 tile-based graphics (animated water, forest paths, obstacles, procedural vegetation).
- **Player & Animations:** 4-directional player movement with walk animations.
- **Interactive Entities:**
  - **Elder Rowan (NPC):** Dialog system with multi-stage dialogue.
  - **Treasure Chest:** Openable chest with coin reward and fanfare audio.
  - **Bouncing Slime:** Wandering forest monster.
- **Synthesized 8-bit Audio:** Procedural Web Audio API sound effects (footsteps, collision bumps, dialog blips, treasure fanfare).
- **Mobile Playtest Ready:** On-screen virtual D-Pad and Action button automatically enabled for touch screens.

---

## 🎮 How to Play

### Desktop
- **Movement:** `W`, `A`, `S`, `D` or `Arrow Keys`
- **Interact:** `Space` or `Enter` (talk to NPC, open chest, advance dialog)

### Mobile / Phone
- **Movement:** On-screen D-Pad (▲, ◀, ▼, ▶)
- **Interact:** On-screen `[A]` button or tap the dialog box

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

