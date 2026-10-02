# CellCounter

Expo SDK 57 / React Native live/dead hemocytometer counter (Android, iOS, web). Features and formulas: [README.md](README.md). Architecture and rationale: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); read the relevant section before changing that area.

## Commands

- `npm start` / `npm run web` / `npm run android` / `npm run ios`
- Check: `npx tsc --noEmit` (no tests, no linter)

## Rules

- Nearly all code is in `App.tsx`. `fonts.android.ts` is empty on purpose.
- Keep `Square`'s `events`, `live`/`dead` and `touched` in sync ("Data model").
- Count with `onPressIn` plus `noPressDelay`, and keep the zones' accessibility actions ("Counting path").
- Fonts: change `fonts.ts`, the `expo-font` list in `app.json` and `SHAPES` together.
- New setting: validate it on load and add it to the save effect's JSON and deps ("State and persistence").
- Keep render pure (no module writes or `ref.current` access) so the React Compiler compiles every component ("React Compiler").
- Web: `confirmDestructive`, not `Alert.alert`.
- Native config goes in `app.json`; `android/` and `ios/` are generated.
- Update `docs/ARCHITECTURE.md` when structure or behaviour changes, and the README for user-facing features.

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
