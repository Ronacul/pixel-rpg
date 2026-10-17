# Pixel RPG ⚔️

A 2D retro RPG engine sandbox prototype built with HTML5 Canvas and vanilla JavaScript. Features a d20 combat resolution system, base RPG attributes, tile-based grid collision, and an interactive combat log.

## Features

- **RPG Engine Sandbox v0.3 (Seeded Runs):**
  - **🌱 Deterministic Seed Engine:** 8-character Base-32 alphanumeric seeds (`XXXX-XXXX`, ~1.1 trillion permutations) powered by Mulberry32 PRNG.
  - **🗺️ Procedural Map Generation:** Seed-governed stone pillar and obstacle placement inside the 10x10 dungeon matrix.
  - **⚔️ Seeded Combat & d20 Pipeline:** Deterministic d20 attack rolls, damage calculations (`1d(dice) + STR mod`), and monster retaliation.
  - **🎁 Dynamic Loot & Equipment System:** Seeded ancient chests and monster drops (`Weapon` and `Armor` with affixes like *Hardened*, *Swift*, *Brawny*, *Champion's*) that directly modify dynamic player attributes (STR, DEX, AC, HP).
  - **🔄 Replay & Share:** Replay the exact same seed to test alternative combat tactics, or share any run using URL parameters (`?seed=XXXX-XXXX`).
  - **📱 Touch & Mobile Ready:** Responsive D-Pad and full mobile layout for playtesting directly on phones.

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

