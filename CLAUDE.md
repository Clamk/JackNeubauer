# CellCounter

Expo SDK 57 / React Native live/dead hemocytometer counter (Android, iOS, web). It is meant to keep evolving through AI agents, and these docs are what the next session starts from: keep them true.

- [README.md](README.md): features, setup.
- [docs/CALCULATIONS.md](docs/CALCULATIONS.md): the chambers, the formulas, the dilution rules and the rounding. It is the reference for every number the app shows.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code works and why. Read the section for an area before changing it. "Changing the app" has the recipes, the identifiers with outside effects, the checks and the current limits.
- [LLM feed for visual/LLMfeed_VISUAL-IDENTITY.md](LLM%20feed%20for%20visual/LLMfeed_VISUAL-IDENTITY.md): the clamk-tools visual identity. Follow it for any UI change.

## Commands

- `npm start` / `npm run web` / `npm run android` / `npm run ios`
- Check: `npx tsc --noEmit` and `npm run check:calc` (no other tests, no linter), then the rest of "Checking a change"

## Workflow

1. Read the ARCHITECTURE section for the area. Find code by symbol name: the docs use the code's identifiers.
2. Make the change. Restructure freely when it makes the app better or easier to change (splitting `App.tsx`, a new library, a test framework); "Current limits" says what a split keeps.
3. Run the checks in "Checking a change". Say which you ran and which you could not, for example Android-only behaviour.
4. Update the docs in the same change ("Docs" below).

## Rules

- Nearly all code is in `App.tsx` today; the calculation is in `calc.ts`. `fonts.android.ts` is empty on purpose.
- Results are exact: compute in `calc.ts` with `Frac` (`BigInt`), never floating point, and round only in `formatSci` / `formatFixed`. A change to a chamber, formula or rounding changes `calc.ts`, CALCULATIONS.md and `scripts/check-calc.mjs` together ("Calculation").
- Keep `Square`'s `events`, `live`/`dead` and `touched` in sync ("Data model").
- Count with `onPressIn` plus `noPressDelay`, and keep the zones' accessibility actions ("Counting path").
- Fonts: change `fonts.ts`, the `expo-font` list in `app.json` and `FONTS` together.
- New setting: validate it on load and add it to the save effect's JSON and deps ("State and persistence").
- Keep render pure (no module writes or `ref.current` access) so the React Compiler compiles every component ("React Compiler").
- Web: `confirmDestructive`, not `Alert.alert`.
- Native config goes in `app.json`; `android/` and `ios/` are generated.
- Colours come from `THEMES` and styles from `makeStyles`: no colour literals in components ("Theming").
- Storage keys and field names, chamber and layout keys, formulas and factors, the Android package and `baseUrl` have effects outside the code. Change them when needed, handle the effect in the same change and say so ("Identifiers with outside effects").

## Docs

- One fact, one place: the README for what users see and how to run it, CALCULATIONS for the chambers and the numbers, ARCHITECTURE for how, why and how to change it, this file for rules and pointers.
- Update ARCHITECTURE when structure or behaviour changes, CALCULATIONS when a number or a rule behind one changes, the README for user-facing features, and this file when a rule changes.
- Name symbols and section titles, never line numbers. Delete what stops being true; history belongs in git.

## Privacy: publish nothing personal

This repo is public (`clamk-tools` org, GitHub Pages): everything committed is public, forever. Never let any of these reach a commit, a commit message, a PR, a log or a reply:
a personal email address, an absolute path on the owner's machine (a Windows drive path or a macOS home folder path),
the owner's OS user name or machine name, the name of a private project, a token or key.

- Identity: commits are authored **and** committed as `Clément R <64958567+Clamk@users.noreply.github.com>`.
- Paths: write relative paths, config or environment variables, never a path from this machine.
  Do not copy paths out of terminal output, stack traces, error messages or editor settings into files.
- Do not print the output of `git config user.email`, `git log` author fields, or a hook's findings beyond
  `file:line`. If a hook blocks something, say that it blocked and where, not what it found.
- Never use `git config --global`, `--no-verify`, or a force push to hide something that was already pushed.

At the start of a session, before any commit:
1. If `git config core.hooksPath` is empty, run `git config core.hooksPath .githooks`.
2. If `git config --local user.email` is not the noreply address above, set it (and `user.name`) locally.

The hooks in `.githooks/` (`check-privacy.sh`) block a commit or push that carries a non-noreply email, a
private path or a secret, in the identity, the message or the content. CI runs the same check before deploying.
Private terms (user name, machine name, private project names) go in `~/.git-privacy-terms` or
`.git/privacy-terms`, one per line, never in the repo.
Before a first push: `sh .githooks/check-privacy.sh --tree` and `sh .githooks/check-privacy.sh HEAD`.
If something is already in pushed history, tell the user instead of rewriting it.
