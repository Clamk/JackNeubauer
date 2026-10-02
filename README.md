# CellCounter

A one-handed hemocytometer cell counter for live/dead counting, built with Expo and React Native (Android, web).

Tap a zone to count a live or dead cell. The app keeps a running concentration and viability as you count.

## Features

- **Live / dead counting** with large tap zones. Counts register on touch-down, with haptic feedback and a distinct sound for each type (live is a higher tap, dead a lower one).
- **Multiple squares.** Each square has its own counts and a chip (SQ 1, SQ 2…) above the buttons; `+` adds one. Only squares you have started counting enter the mean, so a square counted down to zero still counts.
- **Undo** removes the last tap in the current square, whichever counter it went to. **Reset** clears the current square; **Reset all** (with confirmation) clears every square.
- **Chambers:** Neubauer Improved, Fuchs-Rosenthal and Malassez.
- **Dilution factor** field with −/+ steppers (whole-number steps, minimum 1). Accepts `,` or `.` as the decimal separator.
- **Layouts:** vertical, horizontal or diagonal split, with an option to swap the live/dead positions.
- **Themes:** Gridline and Cleanroom, each in light and dark.
- **Sound and haptics:** the speaker icon opens a volume slider and mute button; settings has mute and haptic feedback switches.
- **Info** shows the calculation step by step with your current numbers, and can copy the summary or send it through the share sheet.
- **Keyboard on web:** ← / ↑ count the left or top zone, → / ↓ the other.
- **Screen readers** get an "add one live/dead cell" action on every counting zone, including the diagonal layout.
- **Settings are remembered** between sessions. Counts are not: they're lost when the app closes.
- Keeps the screen awake while open.

## Calculations

```
factor        = 1 / volume of one counted square (mL)
mean          = Σ cells / N counted squares          (live and dead separately)
cells/mL      = mean × dilution × factor
total         = live + dead
viability (%) = live / (live + dead) × 100
```

| Chamber           | Factor  |
| ----------------- | ------- |
| Neubauer Improved | 1 × 10⁴ |
| Fuchs-Rosenthal   | 5 × 10³ |
| Malassez          | 1.25 × 10⁵ |

## Getting started

Requires Node.js and npm.

```bash
npm install
npm start          # Expo dev server
npm run web        # run in the browser
npm run android    # build and run on Android (needs the Android SDK)
npm run ios        # build and run on iOS (needs macOS and Xcode)
```

The app uses native modules (audio, haptics, fonts), so `android` and `ios` create a development build rather than running in Expo Go.

Type check with `npx tsc --noEmit`. There is no test suite or linter.

The web version is deployed to GitHub Pages by [.github/workflows/pages.yml](.github/workflows/pages.yml) on every push to `main`.

## Project layout

| Path | Purpose |
| ---- | ------- |
| [App.tsx](App.tsx) | The whole app: state, calculations, themes, UI and styles |
| [index.ts](index.ts) | Expo entry point |
| [fonts.ts](fonts.ts) | Runtime font loading for iOS and web |
| [fonts.android.ts](fonts.android.ts) | Android variant, empty because fonts are embedded at build time |
| [app.json](app.json) | Expo config, including the Android font embedding plugin |
| `assets/sounds/` | `live.wav` and `dead.wav` tap sounds |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code works and why: data model, counting path, persistence, theming, fonts, platform differences |

Typefaces: Gridline uses Bricolage Grotesque and JetBrains Mono, Cleanroom uses Manrope and IBM Plex Mono. Android package: `io.github.clamk.cellcounter`.

## Publishing safely

This repo is public, so nothing personal may reach it. `.githooks/check-privacy.sh` blocks a commit or push whose author, message or content carries a non-noreply email, a private local path, a token or a private key; CI runs the same check before every deploy. After cloning, run `git config core.hooksPath .githooks` and set a GitHub noreply address as `user.email`. Private terms (user name, machine name) go in `~/.git-privacy-terms`, never in the repo; a line that holds an invented example can carry the marker `privacy-ok`. Audit: `sh .githooks/check-privacy.sh --tree` (files now) and `sh .githooks/check-privacy.sh HEAD` (history).
