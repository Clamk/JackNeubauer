# CellCounter

A one-handed hemocytometer cell counter for live/dead counting, built with Expo and React Native (Android, web).

Tap a zone to count a live or dead cell. The app keeps a running concentration and viability as you count.

## Features

- **Live / dead counting** with large tap zones. Counts register on touch-down, with haptic feedback and a distinct sound for each type (live is a higher tap, dead a lower one).
- **Multiple squares.** Each square has its own counts and a chip (SQ 1, SQ 2…) above the buttons; `+` adds one. Only squares you have started counting enter the mean, so a square counted down to zero still counts.
- **Undo** removes the last tap in the current square, whichever counter it went to. **Reset** clears the current square; **Reset all** (with confirmation) clears every square.
- **Chambers:** Neubauer Improved, Fuchs-Rosenthal and Malassez. One square in the app is one large square of the grid (one rectangle on a Malassez).
- **Dilution factor** field with −/+ steppers (whole-number steps, minimum 1). Accepts `,` or `.` as the decimal separator; anything that isn't a positive number gives no concentration.
- **Exact results:** concentrations, means and viability are computed without floating-point error and rounded once, halves up.
- **Layouts:** vertical, horizontal or diagonal split, with an option to swap the live/dead positions.
- **Light and dark:** follows your system setting until you flip the switch in the header. On the web the choice is shared with the [clamk-tools hub](https://clamk-tools.github.io/) and the other tools.
- **Sound and haptics:** the speaker icon opens a volume slider and mute button; settings has mute and haptic feedback switches.
- **Data** lists your current numbers: the inputs (square volume, factor, dilution, squares counted), the mean per square and the results. It can copy the summary or send it through the share sheet.
- **Info** (the ⓘ icon in the header) is the one-screen reference: what one square is in each chamber, the formulas, the counting rules and the precision.
- **Keyboard on web:** ← / ↑ count the left or top zone, → / ↓ the other. On a computer, each zone shows its keys faintly in a corner.
- **Screen readers** get an "add one live/dead cell" action on every counting zone, including the diagonal layout.
- **Settings are remembered** between sessions. Counts are not: they're lost when the app closes.
- Keeps the screen awake while open.

## Calculations

[docs/CALCULATIONS.md](docs/CALCULATIONS.md) is the reference: the dimensions of each chamber and the unit that is counted, the counting rules, the formulas, how the dilution field is read, how results are rounded, a worked example, and what the result does not include.

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

Type check with `npx tsc --noEmit`, and check the calculation with `npm run check:calc` (Node 22.18 or later). There is no other test suite and no linter.

The web version is deployed to GitHub Pages by [.github/workflows/pages.yml](.github/workflows/pages.yml) on every push to `main`.

## Project layout

| Path | Purpose |
| ---- | ------- |
| [App.tsx](App.tsx) | The app: state, themes, UI and styles |
| [calc.ts](calc.ts) | The calculation: chambers, dilution, results and rounding |
| [scripts/check-calc.mjs](scripts/check-calc.mjs) | Checks the calculation against the reference document |
| [index.ts](index.ts) | Expo entry point |
| [fonts.ts](fonts.ts) | Runtime font loading for iOS and web |
| [fonts.android.ts](fonts.android.ts) | Android variant, empty because fonts are embedded at build time |
| [app.json](app.json) | Expo config, including the Android font embedding plugin |
| [public/index.html](public/index.html) | Web page template, which applies the light or dark theme before the app loads |
| `assets/sounds/` | `live.wav` and `dead.wav` tap sounds |
| [docs/CALCULATIONS.md](docs/CALCULATIONS.md) | Hemocytometers and calculations: every number the app shows |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code works and why: data model, counting path, persistence, theming, fonts, platform differences, and how to change it |
| [CLAUDE.md](CLAUDE.md) | Rules for AI coding agents; [AGENTS.md](AGENTS.md) points to it |

Typefaces: Figtree and IBM Plex Mono, as on the clamk-tools hub. Android package: `io.github.clamk.cellcounter`.

## Changing the app

The app is developed with AI coding agents, and the same guidance serves people. [CLAUDE.md](CLAUDE.md) holds the rules. ["Changing the app"](docs/ARCHITECTURE.md#changing-the-app) in the architecture document lists what each kind of change touches, which identifiers have effects outside the code, how to check a change without a test suite, and what the code doesn't do yet.

## Publishing safely

This repo is public, so nothing personal may reach it. `.githooks/check-privacy.sh` blocks a commit or push whose author, message or content carries a non-noreply email, a private local path, a token or a private key; CI runs the same check before every deploy. After cloning, run `git config core.hooksPath .githooks` and set a GitHub noreply address as `user.email`. Private terms (user name, machine name) go in `~/.git-privacy-terms`, never in the repo; a line that holds an invented example can carry the marker `privacy-ok`. Audit: `sh .githooks/check-privacy.sh --tree` (files now) and `sh .githooks/check-privacy.sh HEAD` (history).
