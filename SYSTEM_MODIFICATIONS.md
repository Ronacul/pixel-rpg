# 🛠️ SYSTEM MODIFICATION MAPS

## 🎲 THE d20 COMBAT ENGINES
- Player Attack Roll = d20 + DEX Modifier + Base Attack Bonus (+1 at Lvl 1)
- Target Armor Class = 10 + Equipment Base Defense + Min(DEX Mod, Armor Max DEX Allowance)
- Physical Damage Pipeline = Weapon Damage Die Roll + STR Modifier

## 🔬 PERCEPTION RADAR VISUAL SCALING MATRIX

| Effective PER Score | Scan Radius | Survey Tiles Checked | Success Coefficient |
| :--- | :--- | :--- | :--- |
| 0 - 13 | 1 Tile | 9 Tiles (3x3 Grid) | PER * 5% Base Check |
| 14 - 17 | 2 Tiles | 25 Tiles (5x5 Grid) | PER * 5% Base Check |
| 18+ | 3 Tiles | 49 Tiles (7x7 Grid) | PER * 5% Base Check |

---

## 🌱 DETERMINISTIC SEED & MODIFIER ENGINE

- **Seed Format:** 8-character Base-32 alphanumeric string formatted as `XXXX-XXXX` (e.g. `K9X2-M4P7`).
- **Charset:** 32 unambiguous characters (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, omitting `O`, `0`, `I`, `1` to avoid transcription errors).
- **Entropy & State Space:** $32^8 = 1,099,511,627,776$ (~1.1 Trillion) distinct playthrough configurations.
- **PRNG Algorithm:** 32-bit FNV-1a String Hash $\to$ Mulberry32 Pseudo-Random Number Generator.
- **Governed Subsystems:**
  1. **Map Generation:** Interior rubble and pillar placement (4-6 seeded obstacles outside spawn corridors).
  2. **Entity Generation:** Monster variant prefix (`Vile`, `Giant`, `Rabid`, `Sewer`, `Plagued`), bonus HP/AC, and spawn coordinates.
  3. **Loot & Equipment Drops:** Seeded weapon/armor selection and prefix affix rolls (`Hardened`, `Swift`, `Brawny`, `Stalwart`, `Champion's`).
  4. **Combat Rolls:** Deterministic d20 attack rolls, weapon damage dice, and monster retaliation checks.
  5. **Shareability:** Deep linking via `?seed=XXXX-XXXX` query parameter for exact run reproduction across devices.
