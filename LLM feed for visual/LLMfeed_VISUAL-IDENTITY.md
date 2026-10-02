# clamk-tools visual identity brief

Use this brief as a design constraint when you create or change the UI of a clamk-tools tool. It describes a
visual language, not a page layout. A tool should look like it belongs to the same family as the hub
(https://clamk-tools.github.io/). It does not need the hub's layout or content.

Priority labels used below:

- **P1, must:** core identity. Keep it in every tool unless doing so breaks usability.
- **P2, should:** strong convention. Follow it unless the tool has a concrete reason not to.
- **P3, may:** optional flavour. Use it where it fits.

Values marked *(derived)* do not appear on the hub. They were extended from it so that every tool extends it
the same way. Use them instead of inventing your own.

---

## 0. Context and intent

- **What clamk-tools is.** A collection of small, single-purpose lab tools, such as counting cells or extracting
  metadata from microscopy file names. They run in the browser with nothing to install, and they are free and
  open source. Each tool is its own repo and its own app.
- **Who uses them.** Mainly people working in a lab, often in the middle of a task: at the bench, at a microscope
  workstation, sometimes on a tablet. They want a result quickly and accurately, not an experience.
- **How the hub relates to the tools.** The hub (https://clamk-tools.github.io/) is the entry point. It lists the
  tools and links to each one. Every tool is a sibling at `https://clamk-tools.github.io/<repo>/`, on the same
  site as the hub, and people move back and forth between them. The hub sets the identity. Tools inherit its
  visual language, not its page structure.
- **Why the identity is shared.** So that someone landing on any tool recognises at a glance that it belongs to
  the same family, from the same maker, as the others. Familiar colours, type, labels and controls make each new
  tool feel trustworthy and quick to learn, and make moving between the hub and the tools seamless.
- **What it is not.** Not a uniform template. Tools differ in purpose and information architecture, and each
  should be laid out for its own task. Sameness is not the goal. Recognisability is.
- **Guiding rule.** When this brief does not cover a case, choose the option that (1) helps the user finish the
  task, then (2) looks like it was made by the same hand as the hub: quiet, compact, precise, flat, with blue for
  interaction and a few marker colours for meaning.

---

## 1. Character

The concept is a **lab whiteboard**. Picture a clean, cool-grey surface with a thin aluminium rail along the top,
and a few marker colours (blue, green, coral) used sparingly. It is a small, precise, practical instrument, not a
marketing site.

In concrete terms:

- **Flat and quiet.** Use 1px hairline borders and no shadows. There are only two surface levels (page and card)
  plus pale tinted surfaces. Colour is the exception, not the base.
- **Compact and dense.** Text is small, gaps are tight and radii are modest. Content sits close together and is
  grouped by hairlines and labels, not by big padding.
- **Cool neutrals plus one blue accent.** Every grey has a faint blue-green cast (hue about 200–207°, saturation
  under 17%). The accent is a confident mid-blue.
- **Two typefaces with distinct jobs.** Figtree, a friendly geometric sans, carries content and UI. IBM Plex Mono,
  in small uppercase or tracked text, carries labels, indexes and metadata. That mono label voice is a key
  recogniser.
- **Dots as the recurring mark.** Small filled circles (8–9px) act like marker caps. They mark the brand, an item's
  colour, or a legend entry.
- **Plain, short copy.** Use sentence case and few words: "No installation, click and go." Never use marketing
  superlatives.

If an element looks like a generic SaaS dashboard (big shadows, gradients on buttons, large rounded cards,
saturated colour fields), it is off-brand.

---

## 2. Design tokens

### 2.1 Colour: neutrals and accent (P1)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#fbfcfc` | `#15181a` | Page background |
| `surface` | `#ffffff` | `#1d2124` | Cards, panels, inputs, menus |
| `text` | `#1b2226` | `#eef1f2` | Primary text, headings |
| `muted` | `#6b747a` | `#9aa3a8` | Secondary text, labels, metadata, inactive icons |
| `border` | `#e1e5e8` | `#2b3134` | Hairlines, dividers, card borders, skeletons |
| `rail` | `#c7cdd2` | `#3a4044` | Top of the rail gradient; strong neutral |
| `accent` | `#1f5fe0` | `#6fa0ff` | Links, focus ring, primary action, selection, toggles |
| `on-accent` *(derived)* | `#ffffff` | `#15181a` | Text and icons on an `accent` fill |
| `accent-tint` | `#eaf1fe` | `#16233d` | Selected or active backgrounds; same as the blue marker tint |

Contrast, measured: `text`/`bg` is about 15.7:1 in both themes. `muted`/`bg` is 4.6:1 (light) and 7.0:1 (dark).
`accent`/`bg` is 5.4:1 (light) and 6.9:1 (dark). `on-accent` on `accent` is 5.6:1 (light) and 6.9:1 (dark).

### 2.2 Colour: marker trio (P1 as a set, used sparingly)

Each marker has a pale **tint** (a surface) and an **ink** (dots, large glyphs, borders, icons). In light mode the
green and coral inks are too light for small text, so use the **text** column for any text under 18.66px bold or
24px regular.

| Marker | Light tint | Light ink | Light text-safe *(derived)* | Dark tint | Dark ink (also text-safe) |
|---|---|---|---|---|---|
| Blue | `#eaf1fe` | `#1f5fe0` | `#1f5fe0` | `#16233d` | `#7fa8ff` |
| Green | `#e9f7ef` | `#1f9d5e` | `#197e4b` | `#113625` | `#5cd99a` |
| Coral | `#fdeee7` | `#d9521f` | `#bb461b` | `#3a2015` | `#ff9a66` |

Rules:

- Use markers to **distinguish items or categories**: the first three data series, item types, tags, or a
  per-item colour in a collection. Order them blue, green, coral.
- A tinted card is: tint background, 1px `border`, the ink for its dot, large glyph and hover border, and `text`
  for its body.
- Never use a marker colour as the *only* signal of meaning. Pair it with a label, an icon or position.
- Do not fill large areas (headers, full-width bars) with ink colours. Tints are fine for cards and table row
  highlights.
- The marker colour does **not** set a tool's accent. Interactive elements always use `accent` blue.

### 2.3 Colour: semantic states *(derived, P2)*

| State | Light text/ink | Light tint | Dark text/ink | Dark tint |
|---|---|---|---|---|
| Info | `#1f5fe0` | `#eaf1fe` | `#7fa8ff` | `#16233d` |
| Success | `#197e4b` | `#e9f7ef` | `#5cd99a` | `#113625` |
| Warning | `#a14a08` | `#fdf3e1` | `#f2b65a` | `#3a2c12` |
| Danger / error | `#bb461b` | `#fdeee7` | `#ff9a66` | `#3a2015` |

Show states as a tint background, a 1px border in the ink (or `border`), ink-coloured text or icon, and a short
label. Do not use saturated full-colour banners.

### 2.4 Typography (P1)

Fonts:

- **Sans:** `"Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Weights 500, 600 and 700 only.
- **Mono:** `"IBM Plex Mono", ui-monospace, monospace`. Weight 600 (500 is allowed).
- Load them from Google Fonts (`family=Figtree:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap`)
  or self-host the same files. With no network the stacks fall back to system fonts, which is acceptable.
- **Body text is Figtree 500.** The hub loads no 400 weight, so its regular text renders at 500. Set 500
  explicitly so it looks the same on every platform. Do not use weights below 500.

Scale (1rem = 16px):

| Role | Font | Size | Weight | Line height | Tracking | Colour |
|---|---|---|---|---|---|---|
| Display (landing or empty-state headline) | Sans | `clamp(1.7rem, 3.8vw, 2.3rem)` (27–37px) | 700 | 1.18 | −0.02em | `text` |
| Page / tool title *(derived)* | Sans | 1.5rem (24px) | 700 | 1.2 | −0.02em | `text` |
| Section heading *(derived)* | Sans | 1.125–1.25rem | 700 | 1.25 | −0.01em | `text` |
| Brand / app name in header | Sans | 1.05rem (16.8px) | 700 | 1.5 | −0.01em | `text` |
| Body | Sans | 1rem (16px) | 500 | 1.5 | 0 | `text` |
| Lead / intro | Sans | 1rem | 500 | 1.5 | 0 | `muted`, max 42ch |
| UI text (buttons, nav, small body) | Sans | 0.85–0.9rem (14px) | 500–600 | 1.45 | 0 | varies |
| Item title (card, list row) | Sans | 0.82rem (13px) or larger | 600 | 1.5 | 0 | `text` |
| Caption / description | Sans | 0.72–0.75rem (12px) | 500 | 1.35 | 0 | `muted` |
| **Section label** | **Mono** | **0.7rem (11.2px)** | **600** | **1** | **+0.1em, UPPERCASE** | `muted` |
| Meta / index / tag | Mono | 0.6–0.62rem (10px) | 600 | normal | +0.04em | `muted` |
| Big glyph / stat value | Sans | 1.5rem (24px) | 700 | 1 | −0.01em | marker ink or `accent` |

Rules:

- Headings use **negative tracking**. Uppercase mono labels use **wide positive tracking**. Never mix those up.
- Use sentence case everywhere except mono labels, which are uppercase (short ones) or lowercase/numeric
  (indexes, tags).
- Use mono for numbers, identifiers, file names, units, indexes, keyboard keys and column headers. Set numbers
  with `font-variant-numeric: tabular-nums`.
- Keep line lengths short: headlines at most about 26ch, intro text at most about 42ch, running prose at most
  about 70ch.
- The hub's very small sizes (10–12px) suit a short catalogue. **In content-heavy tools, keep body and form text
  at 14–16px**, and use 10px mono only for non-essential metadata.

### 2.5 Spacing (P2)

The hub uses a fine-grained, compact scale, not a strict 8px grid. Use these steps:

`2 · 4 · 6 · 8 · 10 · 12 · 14 · 18 · 20 · 26 · 44` (px)

| Use | Value |
|---|---|
| Gap between icon/dot and its label | 7–9px |
| Padding inside small cards and tiles | 10–12px |
| Gap between sibling cards or grid items | 10px |
| Section label to its content | 12px |
| Gap between groups or sections | 26px |
| Divider spacing (space above / below a hairline) | 26px above, 14px below |
| Page side gutter | 20px |
| Header vertical padding | 18px |
| Bottom of main content | 44px |
| Footer padding | 18px top, 28px bottom |

Density is part of the identity. If a layout feels airy, reduce the gaps before adding decoration.

### 2.6 Shape, borders and elevation (P1)

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 5px | Skeleton bars, chips, badges, small tags |
| `radius-control` *(derived)* | 7px | Buttons, inputs, selects, segmented controls |
| `radius-md` | 9px | Cards, tiles, panels, menus, dialogs |
| `radius-pill` | 999px | Switches, pill toggles, avatar or count bubbles |
| `radius-focus` | 4px | Default focus outline corner (or inherit the element's radius) |
| Dot | 50%, 8–9px | Brand mark, item colour dot, legend swatch |
| Border | 1px solid `border` | Every card, input, divider and table row |
| Shadow | **none** | Flat by default |

- Separate layers with **1px borders and the `bg` vs `surface` step**, not with shadows.
- **Only exception** *(derived)*: floating layers (dropdown menus, popovers, dialogs, toasts) may use one soft
  shadow so they read above the content: `0 8px 24px rgb(15 23 26 / 0.12)` (light) or
  `0 8px 24px rgb(0 0 0 / 0.45)` (dark). Always keep the 1px border too.
- Never use gradients on surfaces or buttons. The only gradient is the rail (section 3.1).

### 2.7 Iconography (P2)

- Use line icons on a 24-unit grid, 2px stroke, round caps and joins, `currentColor`, no fill.
- Render them at 12px (inside small controls), 16px (default) or 20px.
- Brand marks such as the GitHub logo may be solid, 16px, in `currentColor`.
- Default icon colour is `muted`; it turns to `text` on hover, or `accent` when active.

### 2.8 Motion (P2)

| What | Timing |
|---|---|
| Border or colour change on hover | 120ms ease |
| Small transforms (switch knob, chevron rotation) | 180ms ease |
| Skeleton pulse | opacity 0.45 to 1, 1.2s ease-in-out, infinite alternate |

- Motion is functional and brief. Do not use entrance animations, parallax, bouncing, or hover lift or scale.
- Respect `prefers-reduced-motion: reduce` by removing transitions and the pulse.

---

## 3. Page structure

### 3.1 Recurring frame

```
┌───────────────────────────────────────────────┐  ← rail: 6px, full bleed
│ ● Tool name                     [links] (◐ )  │  ← header: brand left, actions right
│                                               │
│  TOOL CONTROLS ───────────────────────────    │  ← mono section label + hairline
│  …tool content…                               │
│                                               │
├───────────────────────────────────────────────┤  ← 1px border-top
│ short muted footer line                       │  ← footer
└───────────────────────────────────────────────┘
```

- **Rail (P1):** a full-width 6px strip at the very top, `linear-gradient(180deg, rail, border)`. No other top
  bar or coloured header. Where gradients are unavailable, use solid `rail`.
- **Header (P1):** the same container as the content, 18px vertical padding, `display: flex; justify-content:
  space-between; align-items: center`.
  - Left: the brand pattern, which is a 9px `accent` dot, a 9px gap, then the tool name in Figtree 700
    1.05rem −0.01em `text`. It links to the tool's start view and is not underlined on hover.
  - Right: secondary links in `muted` 0.88rem, which turn `text` on hover with no underline, then the theme switch.
    Put tool-level global actions here only if they are few and compact.
  - No background, no bottom border, no shadow. The header is not sticky by default. Make it sticky only if the
    tool really needs persistent actions, and then give it a `bg` background and a bottom hairline.
- **Main:** fills the remaining height (body is a column flexbox with `min-height: 100vh`), so the footer sits at the
  bottom on short pages.
- **Footer (P2):** 1px `border` top, `muted` text at 0.85rem, 18px/28px padding, one short line. It holds the
  project link, source link or version, and nothing else.

### 3.2 Width and grid

- **Document-like tools** (forms, results, settings): centred container, `max-width: 920px` including 20px
  gutters (880px content). This is the hub's width.
- **Workbench tools** (canvas, image viewer, large tables, side-by-side panes): the container may widen to
  1280px or full width. Keep the 20px gutters, keep header and footer aligned to the same container, and keep
  the rail.
- Card collections use an auto-fill grid with a minimum track (`repeat(auto-fill, minmax(min(100%, 150px), 1fr))`
  on the hub, 120px below 480px) and a 10px gap. Choose the minimum track for the content. Tiles stay small and
  do not stretch to fill a row.
- **Responsive:** design fluid layouts first. Use `clamp()` for display type and as few breakpoints as possible
  (the hub has one, at 480px). At narrow widths, stack panes vertically and let controls wrap.

### 3.3 Hierarchy within content

1. One page or tool title (or a display headline on a landing or empty view).
2. Groups introduced by a **mono uppercase section label with a hairline running to the right edge** (P1
   pattern): `display:flex; align-items:center; gap:9px`, label in mono 600 0.7rem +0.1em uppercase `muted`,
   followed by a 1px `border` line with `flex:1`. Use this instead of large bold H2s for UI groups such as
   "INPUT", "SETTINGS", "RESULTS" or "TOOLS".
3. Items in each group: cards, rows or fields, 10–12px apart.
4. Groups separated by 26px, or by a full-width hairline with 26px above and 14px below.

---

## 4. Components

When a component is not listed, build it from the same parts: `surface` + 1px `border` + `radius-control` or
`radius-md` + Figtree text + a mono label for metadata + `accent` for interaction. Keep it flat, small and tight.

### 4.1 Links

- Colour `accent`, no underline. Underline on hover.
- "Quiet" links (header, secondary navigation): `muted`, turning `text` on hover, no underline.

### 4.2 Buttons *(derived; the hub has no buttons)*

| Variant | Rest | Hover | Notes |
|---|---|---|---|
| Primary | `accent` fill, `on-accent` text, no border | fill 8–10% darker (light) or lighter (dark) | One per view or region |
| Secondary (default) | `surface` fill, 1px `border`, `text` | border becomes `accent` | Mirrors the hub card hover |
| Quiet / ghost | transparent, `muted` text | text becomes `text`, optional `accent-tint` fill | Toolbars, inline actions |
| Danger | `surface`, 1px `border`, danger text | border becomes danger ink | Use a filled danger button only for a confirmation step |

- Size: 32px tall by default (28px compact, 36px prominent), padding 0 12–14px, `radius-control` 7px,
  Figtree 600 0.875rem, 6–8px gap to an icon.
- Active (pressed): no scale, no shadow; use `accent-tint` fill on secondary and quiet variants.
- Disabled: 0.5 opacity, `cursor: not-allowed`, no hover change.
- Icon-only buttons: square 32px, quiet style, and they must have an accessible label.

### 4.3 Inputs, selects and text areas *(derived)*

- `surface` background, 1px `border`, `radius-control`, height 32–36px, padding 0 10px, Figtree 500, 0.9rem on
  desktop and **16px on touch screens** (this prevents mobile zoom).
- Placeholder `muted`. Hover: border darkens to `rail`. Focus: border becomes `accent` plus the standard focus
  ring.
- Field label: Figtree 600 0.82rem `text`, 6px above the field. Help text: 0.75rem `muted`, 4px below.
  Error: danger text-safe colour with a short message, and the border set to the danger ink.
- Numeric and code inputs (counts, regexes, file patterns): IBM Plex Mono 500–600.
- Checkbox, radio, slider and range controls: tint them with `accent` (`accent-color` or the equivalent).

### 4.4 Switch and theme toggle (P1 behaviour on web)

- Pill track 50×27px, `radius-pill`, 1px `border`, background `accent` at 14% mixed into `surface`
  (about `#e0e9fb` light, `#283343` dark). Knob 21px circle, `surface` with a 1px `border`, inset 2px, moving
  22px in 180ms.
- Hover: track border becomes `accent`. Semantics: `role="switch"` and `aria-checked`.
- The **theme toggle** is this switch, with a 12px sun or moon line icon in `accent` inside the knob. Put it on the
  right of the header.
- **Theme behaviour (web tools on `clamk-tools.github.io`):** follow the system setting until the user picks a
  theme. Store the choice in `localStorage` under the key **`clamk-tools:theme`**, value `"light"` or
  `"dark"`. Apply it as `data-theme` on `<html>` before first paint. All tools share the hub's origin, so the same
  key keeps the user's choice consistent across the hub and every tool. Native or non-web builds: follow the system
  setting and provide an equivalent in-app toggle.

### 4.5 Cards and tiles

- `surface` (or a marker tint), 1px `border`, `radius-md` 9px, padding 10–12px (compact) up to 14–18px (content
  cards). No shadow.
- Optional anatomy, top to bottom: mono index or meta (10px, `muted`), a dot in the top-right corner (8px,
  marker ink, 9px from the edges), a big glyph or value (24px 700 ink), a title (600), a description (caption,
  `muted`), and a mono tag or link at the bottom.
- On a **light-mode marker tint**, `muted` reaches only about 4.2:1. For descriptions there, use `#5f686e`
  *(derived, about 5:1 on all three tints)* or `text`. Dark-mode tints are fine with `muted`.
- Hover, when clickable: the border turns the card's ink, or `accent`, over 120ms. No lift. If the whole card is
  clickable, use one real link whose hit area covers the card. Show the focus ring around the whole card.
- Selected: `accent-tint` background with an `accent` border.

### 4.6 Badges, tags and chips *(derived)*

- Mono 600 0.62–0.7rem, +0.04em, padding 2px 6px, `radius-sm`, marker or semantic tint background with
  text-safe ink text. Neutral version: `bg` or `surface` with a 1px `border` and `muted` text.
- Removable chips: add a 12px quiet × icon button.

### 4.7 Lists and tables *(derived)*

- Rows are separated by 1px `border` hairlines, with no zebra stripes (use a tint only to highlight a row).
- Header row: mono uppercase section-label style (0.7rem, +0.1em, `muted`), left-aligned, with numbers
  right-aligned.
- Cells: Figtree 500 0.875rem. Numbers, IDs and file names in mono with tabular numerals. Row padding 8–10px
  vertical.
- Hover on interactive rows: an `accent-tint` background, or a `bg` background if the table sits on `surface`.

### 4.8 Navigation, tabs and segmented controls *(derived)*

- Tabs: Figtree 600 0.875rem `muted`. The active tab is `text` with a 2px `accent` underline. A hairline runs
  under the tab row.
- Segmented control: a `surface` track with 1px `border` and `radius-control`. The active segment has an
  `accent-tint` fill and `accent` text.
- Side navigation (if needed): quiet links. The active item gets `accent-tint` and `accent` text, plus an
  optional 8px dot.

### 4.9 Menus, popovers and dialogs *(derived)*

- `surface`, 1px `border`, `radius-md`, padding 6px (menus) or 18–20px (dialogs), with the single allowed soft
  shadow.
- Menu items are 32px tall with `radius-control` 7px corners, and turn `accent-tint` on hover.
- Dialog title: Figtree 700 1.125rem. Actions are bottom-right, with the primary action last.
- Backdrop: `rgb(15 23 26 / 0.4)` in light mode, `rgb(0 0 0 / 0.6)` in dark mode.

### 4.10 Feedback: loading, empty, error, progress

- **Loading:** skeleton blocks in `border` colour with `radius-sm` and the 1.2s opacity pulse, shaped like the
  content they replace. Spinners are allowed for short waits. Keep them small, 2px stroke, in `accent`.
- **Empty and status messages:** a single plain `muted` line at about 0.9rem, with a link to the next step if
  there is one. Example: "No tools yet." or "Couldn't load the list. Browse them on GitHub." Do not add
  illustrations.
- **Errors and warnings:** use the semantic tint pattern (2.3), placed near the cause.
- **Progress bars:** 6px tall, `border` track, `accent` fill, `radius-pill`.

### 4.11 Focus and accessibility (P1)

- Every focusable element uses `:focus-visible { outline: 2px solid accent; outline-offset: 2px; }` with a 4px
  radius, or the element's own radius for cards. Never remove focus without replacing it.
- Text contrast is at least 4.5:1, and 3:1 for large text and UI boundaries. Use the text-safe marker variants.
  **Do not lower the opacity of `muted` text.**
- Hit areas are at least 32×32px with a pointer and 44×44px on touch. Reach 44px by adding padding around a
  visually smaller control.
- Use real semantic elements (button, link, label, switch roles), plus `aria-busy` while loading and
  `role="status"` for status lines.

### 4.12 Data visualisation *(derived)*

- Categorical series: blue, green, coral inks first, then amber `#a14a08` / `#f2b65a`, then `muted` grey.
- Axes and gridlines: `border` hairlines. Axis labels in mono 0.62–0.7rem `muted`. No chart backgrounds, no 3D,
  no shadows.
- Sequential scales run from a marker tint to its ink.

### 4.13 Favicon and app icon (P3)

The hub icon is a 32×32 rounded square (corner radius 8) holding a fine white grid (two vertical and two horizontal
lines at 50% opacity, 1.5px stroke) and a few small white dots, like a counting-chamber grid. Tools may reuse this
construction with their own glyph. Fill it with the tool's chosen marker ink (light value) so tabs stay
distinguishable. The hub's own fill is a deep teal, `#0f766e`, which is reserved for the hub.

### 4.14 Optional flourishes (P3, at most once per screen)

- **Hand-drawn marker underline** under one key word of a display headline: an SVG wavy path
  (`M2 7 Q50 2 100 6 T198 5` in a 200×10 box, stretched to the word), 2.5px stroke, round caps, `accent` colour
  (use the dark `accent` in dark theme). Use it only on landing or empty states, never in working UI.
- **Colour legend of marker dots**: 9px dots, 7px apart, followed by a 0.72rem `muted` label. Use it when it
  explains real colour coding, not as decoration.

---

## 5. Adapting to a tool

### 5.1 What must stay consistent

1. The neutral palette and the single blue `accent` in both themes, with the same light and dark values.
2. Figtree for content and UI, and IBM Plex Mono for labels and metadata, with their tracking rules.
3. A flat construction: 1px hairlines, `bg`/`surface` layering, 9px and 7px radii, no decorative shadows or
   gradients.
4. The top rail, and the header brand pattern (dot plus name).
5. Mono uppercase section labels with a trailing hairline for grouping.
6. Compact density (section 2.5).
7. Focus ring, contrast and the theme behaviour.

### 5.2 What may vary

- Layout and information architecture: single column, two panes, workbench, wizard, and so on.
- Content width (920px for document-like tools, wider for workbenches).
- Which marker colours appear and what they mean in this tool.
- Type sizes, which may go *up* (never below the minimums) where content is dense or will be read at length.
- Components the hub does not have. Build them by the rule at the top of section 4.
- Whether the footer exists, if the tool is a full-screen workspace. Keep the rail and header.

### 5.3 What not to copy from the hub

These belong to the hub's job of listing tools:

- The hero headline "Small lab tools that run anywhere." and the "No installation, click and go." lead.
- The tool-tile grid itself: two-letter monograms, `01`/`02` numbering, "Source" tags, colours cycled by
  alphabetical position. Do not lay out a tool's own UI as tiles unless it really lists items.
- The "pick a colour, pick a tool" legend tray.
- The theme switch placed below the content. In tools, put it in the header.
- The "Your tiny toolbox" name and the GitHub link as the only header item.
- **Hub inconsistencies not to reproduce:** the headline underline and legend dots keep their light-mode colours
  in dark mode (use theme-aware colours), the tags at 0.8 opacity fall below contrast requirements, and the footer
  hairline runs 20px wider than the content column.
- A tool's position or colour on the hub. Hub tile colours shift when tools are added, so they are not a stable
  per-tool colour.

Linking back to the hub has not been decided. Keep whatever link the tool already has (the tool template has a
"← All tools" link) and style it as a quiet `muted` link.

---

## 6. When identity and usability conflict

Usability wins. Change the identity as little as possible:

| Conflict | Resolution |
|---|---|
| Hub sizes too small for real content | Raise sizes (body 16px, UI 14px). Keep the families, weights and tracking. |
| A marker ink fails contrast for text | Use the text-safe variant, or `text` colour with a marker dot beside it. |
| A complex tool needs more visual separation | Add hairlines, section labels and `surface` panels before shadows or colour fills. |
| Floating layers get lost | Use the single allowed soft shadow (2.6). |
| A wide workspace is needed | Widen the container. Keep gutters, rail and header. |
| A state needs more than the palette offers | Derive from the semantic table (2.3). If you must add a colour, give it a pale tint and an AA-safe ink at a similar saturation, and add it to the tool's tokens. |
| Touch targets would be too small at hub density | Add padding to reach 44px. Keep the visual size compact. |
| A framework or platform cannot express a property | Keep priorities in this order: accent and neutrals, then fonts, then flat hairline construction and radii, then mono section labels, then rail, then the rest. |

Do not trade away readability, keyboard access, contrast or clear affordances to look more like the hub.

---

## 7. Reference token block

Translate this to whatever the platform uses: a theme object, Tailwind config, React Native StyleSheet,
Streamlit theme, and so on.

```css
:root {
  --bg: #fbfcfc; --surface: #ffffff; --text: #1b2226; --muted: #6b747a;
  --border: #e1e5e8; --rail: #c7cdd2; --accent: #1f5fe0; --on-accent: #ffffff; --accent-tint: #eaf1fe;
  --blue-tint: #eaf1fe;  --blue-ink: #1f5fe0;  --blue-text: #1f5fe0;
  --green-tint: #e9f7ef; --green-ink: #1f9d5e; --green-text: #197e4b;
  --coral-tint: #fdeee7; --coral-ink: #d9521f; --coral-text: #bb461b;
  --amber-tint: #fdf3e1; --amber-ink: #a14a08; --amber-text: #a14a08;
  --font-sans: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --radius-sm: 5px; --radius-control: 7px; --radius-md: 9px; --radius-pill: 999px;
  --shadow-float: 0 8px 24px rgb(15 23 26 / 0.12);
  --container: 920px; --gutter: 20px; --rail-height: 6px;
}
/* Dark values: apply under @media (prefers-color-scheme: dark) for :root:not([data-theme="light"]),
   and again under :root[data-theme="dark"]. */
:root[data-theme="dark"] {
  --bg: #15181a; --surface: #1d2124; --text: #eef1f2; --muted: #9aa3a8;
  --border: #2b3134; --rail: #3a4044; --accent: #6fa0ff; --on-accent: #15181a; --accent-tint: #16233d;
  --blue-tint: #16233d;  --blue-ink: #7fa8ff;  --blue-text: #7fa8ff;
  --green-tint: #113625; --green-ink: #5cd99a; --green-text: #5cd99a;
  --coral-tint: #3a2015; --coral-ink: #ff9a66; --coral-text: #ff9a66;
  --amber-tint: #3a2c12; --amber-ink: #f2b65a; --amber-text: #f2b65a;
  --shadow-float: 0 8px 24px rgb(0 0 0 / 0.45);
}
body { background: var(--bg); color: var(--text); font: 500 16px/1.5 var(--font-sans); -webkit-font-smoothing: antialiased; }
.rail { height: var(--rail-height); background: linear-gradient(180deg, var(--rail), var(--border)); }
.section-label { display: flex; align-items: center; gap: 9px; font: 600 0.7rem/1 var(--font-mono);
  letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.section-label::after { content: ""; flex: 1; height: 1px; background: var(--border); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
```

Theme before first paint (web), as on the hub:

```html
<script>
  try { var t = localStorage.getItem("clamk-tools:theme");
        if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch {}
</script>
```

## 8. Final checklist

- [ ] Rail at the top; header with dot plus tool name on the left and the theme switch on the right.
- [ ] Only the listed neutrals and `accent`; markers used sparingly and with meaning; both themes work.
- [ ] Figtree 500/600/700 and IBM Plex Mono 600; negative tracking on headings, +0.1em uppercase on mono labels.
- [ ] Groups introduced by mono section labels with a trailing hairline.
- [ ] 1px borders, 9px cards, 7px controls, no decorative shadows or gradients.
- [ ] Compact spacing (10px item gaps, 26px between groups, 20px gutters).
- [ ] 2px `accent` focus ring with 2px offset; AA contrast; adequate hit areas; reduced-motion respected.
- [ ] Nothing hub-specific copied (hero line, tool tiles, monograms, colour tray).
