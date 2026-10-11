# Orna Raid Lab

Source transferred from published version 79, commit `8404947ee843563d4acc4e55d93daef0cb281ea0`.

Serve `dist/` using any static HTTP server, for example:

```sh
python3 -m http.server 8000 --directory dist
```

No build is required. HTML, styling and application JavaScript are in `dist/index.html`; equipment import support and the game catalog are adjacent files. The catalog generation script is included for reference; rebuilding may fetch newer catalog data.

Personal character, inventory, loadout, measurement and battle records have been removed from initial defaults and the embedded update feed. Personal snapshot migration fixtures and player fallback labels were sanitized. Game catalog and boss data remain. Source history, old archives, credentials and hosting identity are excluded.

Browser storage uses the original `ornaRaidLab_v02` key and state schema. Browser storage belongs to an origin: hosting this copy at another URL does not automatically access data saved at the existing site. Use the application's export/import controls to move data privately.

Verification details and file SHA-256 hashes are in `TRANSFER_VERIFICATION.json`. All application differences from version 79 are the approved personal-data redactions; the other transferred source files match exactly. Existing tests run with:

```sh
node tests/equipment-import.test.cjs
node tests/equipment-import-workflow.test.cjs
```

The existing published website was not modified or redeployed.
