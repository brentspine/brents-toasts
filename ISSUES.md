# Issues vor dem ersten npm publish

## P0 — Blocker

### 1. `dist/index.d.ts` fehlt
`package.json` zeigt `"types": "dist/index.d.ts"`, aber Rollup kopiert die `.d.ts`-Datei nicht.
`.npmignore` schließt `src/` aus. TypeScript-Nutzer kriegen keine Types.
**Fix:** Build-Script um Node-Kopierschritt erweitern.

### 2. `src/index.d.ts` hat kaputten Import
Zeile 1 importiert `ToastColor` aus `./ToastColor` — die Datei existiert nicht als `.d.ts`.
Darunter wird `ToastColor` nochmal deklariert. Führt zu TS-Fehler beim Auflösen.
**Fix:** Import-Zeile löschen.

### 3. `exports`-Map hat kein `"types"`-Feld
TypeScript mit `moduleResolution: bundler` oder `node16` findet die Types nicht.
**Fix:** `"types": "./dist/index.d.ts"` in den `"."` Export-Eintrag.

---

## P1 — Wichtig

### 4. `toasts.js` wird mitveröffentlicht
Alte Legacy-Datei im Root. Nicht in `.npmignore`, kein `files`-Whitelist.
Verwirrend für Nutzer, bläht das Package auf.
**Fix:** In `.npmignore` aufnehmen.

### 5. `aria-live` / `role="alert"` Konflikt
`role="alert"` impliziert `aria-live="assertive"`, aber es ist immer `polite` gesetzt.
Screenreader kündigen Errors/Warnings nicht sofort an.
**Fix:** `aria-live="assertive"` für ERROR und WARNING setzen.

---

## P2 — Minor

### 6. `substr` ist deprecated
`Math.random().toString(36).substr(2, 9)` — `substr` ist veraltet.
**Fix:** `slice(2, 11)`.

### 7. CSS-Klassennamen kollidieren mit Bootstrap
`.toast` und `.toast-container` sind identische Bootstrap-Klassen.
Bei gemischtem Einsatz überschreiben sich die Styles.
**Fix:** Alle internen Klassen mit `bt-` prefixen.

### 8. `.gitignore` ignoriert `.dist/` statt `dist/`
Tippfehler: `.dist/` (mit Punkt) statt `dist/`. Der Build-Ordner wird getrackt.
**Fix:** `.dist/` → `dist/`.
