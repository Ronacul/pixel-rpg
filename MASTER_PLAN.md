# 🗺️ RPG ENGINE DEVELOPMENT MASTER PLAN

## 🧱 PHASE 1: CORE ARCHITECTURE & BASE ATTRIBUTES
- [x] Establish Six Core RPG Attributes in Player Character Model
  - Stats Tracked: STR, DEX, INT, WIS, CON, CHA
- [x] Configure Base vs. Effective Dynamic Getters
- [x] Hook Constitution (CON) directly into Player Max HP Calculations
- [ ] Refactor Equipment System to feed Stat Modifiers into Player Getters

## 🧠 PHASE 2: DERIVED MECHANICS & CALCULATED STEPS
- [ ] Define the Perception (PER) Derived Metric: (DEX + INT + WIS) / 3
- [ ] Write the 2D Grid Passive Radial Radar Sweep Loop
- [ ] Integrate Agility/Dexterity modifiers into Attack Frame Delays

## 🎭 PHASE 3: MODULAR ARCHITECTURE (DATA-DRIVEN REGISTRY)
- [ ] Implement Abstract JSON Parsers for Race, Class, and Monster objects
- [ ] Create Central Registry Systems to deprecate hardcoded Enums
- [ ] Setup Dynamic Character Sheet interface to pull configuration arrays

## 🐾 PHASE 4: MONSTER BEHAVIOR & THE TAMING PIPELINE
- [ ] Refactor Mob.java to accept dynamic Status Conditions (Charmed, Sleep)
- [ ] Code Charisma-based check vs Target Level / Health Pools
- [ ] Implement Pet AI companion tracking modules
