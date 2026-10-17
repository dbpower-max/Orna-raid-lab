# ORNA_CHANGELOG

## 2026-10-16 — Complete Pumpkinhead UI and Codex spell integration

- **Profile display:** Added expandable item-drop table (11 confirmed drops, names/types/qualities/tiers), Pumpkin Spider minion, raid types, required level and event; falls back gracefully when other bosses lack loot data.
- **Status guide:** Raid profile and prevention table now read boss-specific verified statuses directly, including Blast III's MAG ↓ (10%) and ATT ↓ (10%), without needing the catalog first. Structured effects override stale generic text for that particular move. No probabilistic status is automatically treated as active.
- **General spell catalog:** Corrected the canonical `dist/orna-catalogs.json` Blast III entry: non-elemental, resistance penetration 2.0, warm-up 1, mana 120, 2 turns, two 10% debuffs. Application import, automatic-class spells, source attribution, and custom spell-edit preservation now consume these verified fields.
- **Verification:** The inline JavaScript parses; unit checks cover loot rendering, safe escaping, direct status effects, saved-record preservation, and verified spell model. Added `tests/pumpkinhead-integration.test.cjs`. Fixed a preexisting test that incorrectly assumed feed revision 31. GitHub Actions run **38989388152 succeeded** (all tests and GitHub Pages publish). No full interactive-browser regression was run.
- **Publishing:** GitHub Pages pipeline republished the updated `dist/` site. The separate `https://orna-raid-lab.dbpower.chatgpt.site/` site was **not** changed.

## 2026-10-16 — Pumpkinhead complete drop list and Blast III calibration

- Revision 34: added screenshot-confirmed 11 drops with item type, quality and tier; recorded Pumpkin Spider as the ★8 Hallowed minion and The Hallowed event description. Recorded both raid types and required level 3.
- Corrected existing Pumpkinhead Blast III to **non-elemental** (MAG), M1/resistance penetration **2.0**, Tier 7, 120 mana, warm-up 1 turn / total cast 2 turns, effects **MAG ↓ (10%)** and **ATT ↓ (10%)**, single opponent. Existing other skill properties left unchanged.
- Extended `bossMoveCorrection` to fill newly verified optional skill fields only when absent, preserving player-customized fields. Updated elemental-protection label for explicit non-elemental moves.
- **Verified:** GitHub read-back; feed revision 34 parses; Pumpkinhead has 20 status immunities, 11 drops, one recorded minion, 12 original skills; Blast III migration and preservation of customized HP, drops, element, M1, mana; unchanged browser storage key. **Full browser/runtime regression not run.**
- GitHub source only; **live published website not modified**.

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
