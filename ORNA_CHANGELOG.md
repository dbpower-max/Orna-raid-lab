# ORNA_CHANGELOG

## 2026-10-16 — Pumpkinhead follow-up screenshot

- Advanced `dist/index.html` feed from revision 32 to 33 for existing boss `b_pumpkinhead`.
- Completed the screenshot-verified list of 20 status immunities (added Petrified, DEF ↓, DEF ↓↓, RES ↓↓, RES ↓, Starstruck, Doom, Confused).
- Verified the 12 previously recorded boss skills; no changes to skill mechanics.
- Added visible drop metadata: Skeleton Key, Currency, Famed, ★3. Drops are stored in the boss record but not yet given a dedicated display UI.
- **Disputed:** Screenshot calls Blast III non-elemental; older boss model labels it Arcane. Left skill element unchanged pending a decision.
- Verification **passed**: read back remote code, parsed feed, checked 20 immunities, skill preservation, custom edits preservation and unchanged `ornaRaidLab_v02` browser-storage key. Full runtime/browser regression **not run**.
- GitHub mirror updated; live published website **not modified**.

## 2026-10-16 — Pumpkinhead raid boss screenshot

- Updated `dist/index.html` data feed to revision 32 for the existing `b_pumpkinhead` record, without adding a duplicate boss.
- Confirmed screenshot values: Tier 8, level 200, HP 7,650,000, world and kingdom raid, The Hallowed, required level 3.
- Added the twelve visibly confirmed status immunities. Marked that the screenshot crops further rows; no other immunities inferred.
- Left existing attack skills, unverified combat stats, elemental affinities, and unknown penetration unchanged.
- Verification **passed**: parsed feed, verified revision and boss uniqueness, tested legacy boss merge and preservation of user-modified HP, confirmed original skills and browser storage key. Full browser/runtime regression test **not run**.
- Updated GitHub repository mirror only. Published site was **not modified**.
