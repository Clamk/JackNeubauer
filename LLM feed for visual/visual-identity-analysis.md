# Visual identity analysis: clamk-tools hub

> **For humans, not for an LLM.** This file is the background analysis and evidence. To give a tool's LLM the
> design rules, use `LLMfeed_VISUAL-IDENTITY.md` instead; it stands on its own and does not need this file.

**Method.** The live page (https://clamk-tools.github.io/, checked 2026-10-02) is byte-identical to the repo's
`index.html`. I rendered it headless in Edge at 1280, 768 and 375px wide, in light and dark, and captured hover
and keyboard-focus states. I also read the computed styles, the loaded font faces and the element geometry, and
calculated WCAG contrast for every colour pair. Screenshots are in `screens/` next to this file.

Tags: **[O]** observed, **[I]** inferred from several observations, **[U]** uncertain.

## Typography

- **[O]** There are two families. **Figtree** (sans, loaded weights 500/600/700) is used for all content.
  **IBM Plex Mono** (500 and 600 requested, only 600 actually used) is used for section labels, indexes and
  tags. Fallbacks: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` and `ui-monospace, monospace`.
- **[O]** No Figtree 400 face is loaded, so text set to "normal" (body, lead, descriptions, footer) renders with
  the **500** face. Regular text therefore looks slightly heavier than a typical 400 sans. This is part of the look.
- **[O]** Measured sizes at a 16px root:

  | Element | Size | Weight | Line height | Letter spacing |
  |---|---|---|---|---|
  | h1 | 27.2px (375w) to 36.8px (1280w), `clamp(1.7rem, 3.8vw, 2.3rem)` | 700 | 1.18 | −0.02em |
  | Tile monogram | 24px | 700 | 1 | −0.01em |
  | Brand | 16.8px | 700 | 1.5 | −0.01em |
  | Body / lead | 16px | 400 (renders as 500) | 1.5 | 0 |
  | GitHub link | 14.1px | ″ | 1.5 | 0 |
  | Footer | 13.6px | ″ | 1.5 | 0 |
  | Tile title | 13.1px | 600 | 1.5 | 0 |
  | Tile description | 11.8px | ″ | 1.35 | 0 |
  | Legend label | 11.5px | ″ | 1.5 | 0 |
  | Section label (mono) | 11.2px | 600 | 1 | +0.1em, uppercase |
  | Index / tag (mono) | 9.9 / 9.6px | 600 | normal | +0.04em |

- **[I]** The scale is small and compact: everything below the h1 is 16px or smaller, and tile content is
  10–13px. Hierarchy comes from weight, colour (`text` vs `muted`) and the change of family more than from size.
- **[I]** There is a deliberate **tracking contrast**: headings are tightened (−0.01 to −0.02em), and mono labels
  are opened up (+0.04 to +0.1em). The mono uppercase label with wide tracking is the most distinctive
  typographic signature.
- **[I]** Line lengths are kept short on purpose: the h1 has `max-width: 26ch` and the lead `42ch`.

## Colour

- **[O]** Neutrals and accent, set as CSS custom properties with light and dark sets:

  | Token | Light | HSL | Dark | HSL |
  |---|---|---|---|---|
  | bg | `#fbfcfc` | 180 14% 99% | `#15181a` | 204 11% 9% |
  | card | `#ffffff` | — | `#1d2124` | 206 11% 13% |
  | text | `#1b2226` | 202 17% 13% | `#eef1f2` | 195 13% 94% |
  | muted | `#6b747a` | 204 7% 45% | `#9aa3a8` | 201 7% 63% |
  | border | `#e1e5e8` | 206 13% 90% | `#2b3134` | 200 9% 19% |
  | rail | `#c7cdd2` | 207 11% 80% | `#3a4044` | 204 8% 25% |
  | accent | `#1f5fe0` | 220 76% 50% | `#6fa0ff` | 220 100% 72% |

- **[O]** Marker trio, as tile tint and ink. Light: blue `#eaf1fe`/`#1f5fe0`, green `#e9f7ef`/`#1f9d5e`, coral
  `#fdeee7`/`#d9521f`. Dark: `#16233d`/`#7fa8ff`, `#113625`/`#5cd99a`, `#3a2015`/`#ff9a66`. Tiles take the
  colours in turn by alphabetical position.
- **[I]** The neutrals are **cool** (hue 195–207°, saturation 7–17%) with a faint blue-green cast, which fits the
  "aluminium and whiteboard" idea. The accent shares the blue marker's hue (220°). The palette is one accent plus
  three markers, with the markers used only to tell items apart.
- **[I]** The dark theme is designed, not inverted. Surfaces get lighter as they rise (bg 9%, card 13% lightness),
  tints become deep and desaturated, and inks and the accent are brightened.
- **[O] Contrast:** text/bg 15.7:1 in both themes. Muted/bg 4.64:1 light, 6.95:1 dark. Accent/bg 5.42:1 light,
  6.92:1 dark. Light-mode inks on their tints: blue 4.91, **green 3.15, coral 3.59**. These pass only for large
  text, which is how the hub uses them (24px bold monograms). **Muted on light tints is about 4.2:1** and **tags
  at 0.8 opacity are about 3.0:1**, both below AA for small text. All dark-mode pairs pass AA.
- **[O]** Inconsistencies: the headline underline (`#1f5fe0`) and the three legend dots use hard-coded
  light-mode colours in dark mode too (the underline is 3.2:1 on the dark bg). The favicon fill is a teal,
  `#0f766e`, used nowhere else.
- **[U]** Whether the teal favicon is a deliberate secondary brand colour or a leftover. Treated as intentional
  but hub-only.
- **[O]** There are no semantic colours (error, warning, success) beyond plain muted status text.

## Layout

- **[O]** Body is a column flexbox with `min-height: 100vh`, so the footer is pushed to the bottom. One container,
  `.wrap`, is used everywhere: `max-width: 920px` with 20px side padding, giving an 880px content column.
- **[O]** Vertical rhythm, in px: rail 6, header padding 18/18 (header 61 tall), main top 10, h1 bottom margin 8,
  lead bottom margin 26, section label bottom margin 12, grid gap 10, legend tray margin 26 then 14 padding above
  a hairline, main bottom 44, footer 18/28.
- **[I]** The spacing scale is fine-grained and compact (2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14, 18, 20, 26, 28,
  44), not a strict 4 or 8px grid. Within groups gaps are 8–12px, between groups about 26px.
- **[O]** The grid is `repeat(auto-fill, minmax(min(100%, 150px), 1fr))` with a 10px gap: five tracks at 1280w
  (tiles 168×185), two at 768w (175px) and two at 375w (163px, min track 120px below 480px). With only two
  tools, the tiles stay small and leave empty tracks instead of stretching.
- **[O]** Responsive behaviour is fluid: the h1 uses `clamp()`, the grid auto-fills, and there is one breakpoint
  (480px). The header layout never changes.

## Structure

- **[O]** From top to bottom: a 6px gradient **rail** (`rail` to `border`, full width); a header with the brand
  (9px accent dot plus "Your tiny toolbox") on the left and a muted GitHub link on the right; the h1 with a
  hand-drawn SVG underline on "anywhere"; a muted lead line; a mono "TOOLS" section label with a hairline to
  the right; the tile grid; a hairline followed by a legend "tray" of three marker dots and "pick a colour, pick a
  tool"; the theme switch; and a footer with a top hairline and one muted sentence.
- **[I]** Groups are separated by **hairlines and labels, not boxes or background bands**. There is no coloured
  header, no hero background and no navigation bar.

## UI components

- **[O] Tile:** card or tint background, 1px border, 9px radius, 10×11px padding, min height 108px. Contents: a
  mono index `01`, an 8px ink dot top-right, a 24px bold ink monogram, a 600-weight title, a muted description,
  and a mono "Source" tag at the bottom. The title link's `::after` covers the whole tile, so the entire tile is
  one link target and the tag sits above it (z-index 1).
- **[O] Links:** accent colour, no underline, underlined on hover. The GitHub link is muted and turns `text` on
  hover with no underline. The brand link is never underlined.
- **[O] Theme switch:** 50×27 pill, 1px border, track = accent at 14% mixed into card; 21px knob holding a 12px
  sun or moon line icon in accent; slides 22px in 180ms. `role="switch"`. The choice is stored in
  `localStorage["clamk-tools:theme"]` and applied as `data-theme` before first paint. The system setting is the
  default.
- **[O] Loading:** three skeleton tiles, with bars in the border colour (5px radius) pulsing opacity 0.45 to 1 over
  1.2s. **Status:** a plain muted 0.9rem line ("No tools yet." or an error with a GitHub fallback link).
- **[O] Icons:** line icons on a 24-unit grid, 2px stroke, round caps, `currentColor`. The GitHub mark is filled,
  16px.
- **[U]** Buttons, inputs, menus, tabs, tables, dialogs and badges do not exist on the hub, so their styling cannot
  be observed and the brief derives it.

## Shapes and surfaces

- **[O]** Radii: 9px (tiles), 5px (skeleton bars), 4px (focus outline), 999px (switch), 50% (dots and knob),
  8/32 (favicon). Borders are always 1px solid `border`. **No box-shadows anywhere.** The rail is the only
  gradient.
- **[I]** The page is **flat with two surface levels** (bg and card) plus tints, and edges are drawn with
  hairlines. The whiteboard metaphor is carried by restraint, not by texture.

## Imagery and motifs

- **[O]** There are no photos or illustrations. The motifs are: the **aluminium rail**; **small filled dots** (brand
  dot 9px, tile dot 8px, legend dots 9px); a **hand-drawn marker underline** (wavy SVG path, 2.5px round stroke);
  **two-letter monograms** in marker ink; and a favicon showing a rounded square with a fine grid and dots, which
  reads like a hemocytometer counting grid.
- **[I]** The dots read as **marker caps**, and with the rail and the "pick a colour" legend they make the
  whiteboard metaphor consistent. The favicon ties the identity to lab microscopy.

## Interaction, states and motion

- **[O]** Tile hover: the border changes to the tile's ink colour over 120ms (green tile → `#1f9d5e` light,
  `#5cd99a` dark). There is no lift, scale or shadow. Switch hover: border becomes accent.
- **[O]** Focus: `2px solid accent`, 2px offset, 4px radius. On a tile, the ring wraps the whole tile, drawn via
  `:has(h3 a:focus-visible)`. This was verified with keyboard Tab.
- **[O]** `prefers-reduced-motion` disables the tile transition, the knob slide and the skeleton pulse.
- **[U]** There are no observable disabled, selected, expanded or active states.
- **[I]** Motion is minimal and purely functional (100–200ms colour and position changes).

## Content presentation

- **[O]** Copy is short and plain, in sentence case, with British spelling ("colour") and a lowercase legend label.
  Metadata (index, "Source", the language tag) is in mono. Tool names come from the repo names; descriptions
  come from the repo descriptions.
- **[I]** The tone is understated and friendly-practical ("click and go"), with one moment of personality (the
  underline) and no marketing language.

## Overall character

- **[I]** A **clean lab whiteboard**: cool grey, flat, compact, precise, lightly playful. What sets it apart from a
  generic interface is (1) the mono uppercase tracked labels with trailing hairlines, (2) the rail, (3) the blue,
  green and coral marker colours with matching tints, used sparingly, (4) the small dots, (5) Figtree's
  rounded-geometric shapes at medium weight, and (6) density with no shadows.

## What defines the identity

**Core (preserve everywhere):** the cool neutral palette plus the blue accent in both themes; Figtree plus IBM
Plex Mono and their tracking contrast; mono section labels with hairlines; the flat construction (1px borders,
no shadows, 9px radius); compact density; the top rail; the brand pattern (dot plus name); focus ring and theme
behaviour (including the shared `clamk-tools:theme` key, which works across tools because all tools share the
hub's origin).

**Supporting (adopt where appropriate):** the marker trio for categories and series; tinted cards with ink
dots and ink hover borders; skeleton pulse and plain status lines; line-icon style; the switch component; the
footer pattern; the auto-fill tile grid; the favicon construction; the marker underline (rare).

**Hub-specific (do not copy):** the hero copy and underline placement; the tool-tile anatomy (monogram, `01`
index, "Source" tag) and the colours cycled by alphabetical position (unstable as tools are added); the legend
tray; the theme switch placed below the content; the GitHub-only header; the 920px width as a hard limit (tools
with workspaces need more); the very small text sizes (fine for a catalogue, too small for working UIs).
The inconsistencies noted above (hard-coded light colours in dark mode, the faded tags, the footer hairline 20px
wider than the content) should not be copied either.
