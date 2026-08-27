# Repeatfield Neo-Brutalist Design Direction

## Design thesis

Repeatfield should feel like a **digital printmaking tool packaged as an art object**.

The product remains precise and usable, but its visual identity should be bold, tactile, slightly irreverent, and immediately recognizable. The neo-brutalist treatment belongs in the packaging, navigation, controls, framing, copy, and interaction feedback—not inside the user’s artwork.

```text
FORMAL DESIGN TOOL  →  PLAYFUL PATTERN INSTRUMENT
soft hierarchy         visible structure
subtle borders         assertive black rules
quiet panels           labeled work zones
soft shadows           hard offset shadows
neutral buttons        color-block actions
corporate labels       print-shop language
```

The artwork remains the hero.

---

## Surface model

The three-stage workflow remains unchanged:

```text
[ 01 CUT IT ]  →  [ 02 REPEAT IT ]  →  [ 03 SHOW IT ]
```

Public-facing labels may use:

- **CUT IT** — crop and prepare the source tile
- **REPEAT IT** — construct the field
- **SHOW IT** — clean output and contextual previews

Technical helper text remains available beneath these labels so personality never replaces clarity.

---

## Visual system

### Core palette

```css
:root {
  --ink: #17151a;
  --paper: #fffdf5;
  --lavender: #d8c5ff;
  --purple: #7a4cff;
  --acid: #e7ff57;
  --coral: #ff6b57;
  --sky: #8ed8ff;
  --muted-paper: #eee8f3;
}
```

Rules:

- Use lavender as the environmental/background color.
- Use purple for selected states and primary workflow progress.
- Use acid yellow-green for “continue,” “export,” and active creative actions.
- Use coral only for replace/delete/reset warnings.
- Let uploaded artwork supply all additional color.
- Never apply gradients to interface chrome.

### Borders

- Default structure: `2px solid var(--ink)`
- Major workspace boundaries: `3px solid var(--ink)`
- Small controls may use 2px borders.
- Avoid low-opacity hairlines.
- Section boundaries should be deliberately visible.

### Shadows

Use hard offset shadows only:

```css
--shadow-sm: 3px 3px 0 var(--ink);
--shadow-md: 5px 5px 0 var(--ink);
--shadow-lg: 8px 8px 0 var(--ink);
```

No blur, glassmorphism, ambient glow, or polished enterprise elevation.

Interactive behavior:

```css
.button:hover { transform: translate(-1px, -1px); }
.button:active {
  transform: translate(3px, 3px);
  box-shadow: 0 0 0 var(--ink);
}
```

This should make controls feel printed, stacked, and physically pressable.

### Corner language

- Default radius: `0px`
- Small practical radius allowed: `2–4px`
- Avoid pill buttons except where the object is literally a toggle or segment selector.
- Thumbnails may use square corners and uneven label tabs.

### Typography

- Display and large control labels: **Bricolage Grotesque**, weight 600–700
- Interface and descriptions: **Instrument Sans**, weight 500–600
- Coordinates, dimensions, states, and technical metadata: **IBM Plex Mono**

Typography should be larger and less timid than the first concept:

- Workspace title: 24–32px
- Stage navigation: 14–16px bold uppercase
- Primary button: 13–15px bold uppercase
- Control labels: minimum 11–12px
- Technical metadata: minimum 9–10px mono

Avoid ultra-small gray labels as the primary hierarchy mechanism.

---

## Composition principles

### 1. Visible scaffolding

Do not hide the application’s structure. Crop, Repeat, and Preview should feel like three labeled stations in a print studio.

### 2. Controlled asymmetry

Use deliberate offsets, label tabs, rotated stickers, and unequal panel proportions. The workspace itself must remain aligned enough for accurate editing.

### 3. Color blocks, not decorative cards

Color communicates function:

- lavender = product environment;
- paper = editable work surface;
- purple = selected/system state;
- acid = forward/export action;
- coral = destructive or replace action.

### 4. Artwork-first brutality

Thick framing should make the pattern feel more valuable, like a print mounted on a wall. It must not reduce the canvas to a small card among UI boxes.

### 5. Precision inside play

Crop handles, sliders, values, and exports must remain mathematically clear. Neo-brutalism changes the expression—not the accuracy.

---

## Global header

Replace the quiet software toolbar with an assertive workflow strip:

```text
┌────────────────────────────────────────────────────────────────────┐
│ REPEAT/FIELD™   [01 CUT IT] [02 REPEAT IT] [03 SHOW IT]   EXPORT! │
└────────────────────────────────────────────────────────────────────┘
```

Treatment:

- 3px black bottom rule
- Wordmark in black on lavender or paper
- Each stage is a bordered block
- Current stage uses purple background and white text
- Completed stage receives an acid check/stamp
- Export is acid with a black hard shadow
- Local-only status appears as a small print-registration stamp, not a corporate status dot

---

## Workspace 01 — CUT IT

### Composition

- Large paper-colored source canvas on lavender background
- 3px black frame around the canvas
- Crop quadrilateral has high-contrast black/white or purple handles
- Tool strip resembles a print-shop ruler
- 2×2 seam checker appears as a pinned proof sheet

### Labels

- `SOURCE SHEET`
- `CUT WINDOW`
- `EDGE CHECK`
- `TURN 90°`
- `FLIP IT`
- Primary action: `USE THIS CUT →`

### Personality detail

Show dimensions like a production stamp:

```text
CUT: 1024 × 1024 PX
RATIO: 1 : 1
EDGE CHECK: ON
```

---

## Workspace 02 — REPEAT IT

### Composition

- Pattern field remains the largest surface
- Presets become bold printed specimens with names on attached label strips
- Active preset has a purple frame and an offset black shadow
- Inspector sections are stacked paper blocks with visible black rules
- Sliders use thick tracks and square handles

### Pattern labels

Use accessible names with personality:

- `STRAIGHT UP` — Straight Repeat
- `HALF STEP` — Half-Drop
- `BRICK SHIFT` — Brick
- `TURN TURN` — Checker Rotate
- `MIRROR CLUB` — Mirror Grid
- `ROSETTE 4×` — Quarter-Turn Rosette
- `TRIANGLE FOLD` — Triangle Kaleidoscope
- `KALEIDO 8×` — Radial Kaleidoscope

Technical names remain in smaller helper text or accessible labels.

### Primary actions

- `BACK TO CUT`
- `SHOW THE FIELD →`

---

## Workspace 03 — SHOW IT

### Clean preview

The clean output should become even more minimal than the current concept:

- Full-bleed field
- Thick black frame only when “Poster frame” is enabled
- Floating controls appear as hard-shadowed paper tags
- No permanent sidebars
- Purple/lavender background visible only around non-fullscreen output

### Preview modes

```text
[ CLEAN ] [ POSTER ] [ WALL ] [ BUS STOP ]
```

For product phasing:

- CLEAN ships in MVP
- POSTER ships first after MVP
- WALL and BUS STOP follow as context templates

### Actions

- `EDIT THE REPEAT`
- `FULL SCREEN`
- `SAVE THE FIELD ↓`
- Context export: `SAVE THE SCENE ↓`

---

## Brand and packaging language

### Wordmark

Preferred lockup:

```text
REPEAT/
FIELD™
```

The slash can act as a crop edge, seam, or folding axis.

Alternative horizontal lockup:

```text
REPEAT/FIELD™ — ONE TILE, INFINITE FIELDS.
```

### Tone

Short, direct, playful:

- `DROP A TILE. SEE WHAT IT BECOMES.`
- `FIND THE FIELD INSIDE THE IMAGE.`
- `CUT IT CLEAN.`
- `TURN IT. FLIP IT. REPEAT IT.`
- `NO UPLOAD. NO ACCOUNT. JUST PATTERNS.`
- `YOUR TILE NEVER LEAVES THIS TAB.`

Avoid vague creative-software copy such as “Unlock limitless creativity” or “Bring your vision to life.”

### Graphic motifs

- registration marks
- crop corners
- numbered specimen labels
- overprint-like color blocks
- checkerboards
- black arrows
- edition stamps
- slightly rotated non-critical labels

Do not rotate input fields, sliders, canvases, or anything used for precision.

---

## Interaction personality

- Buttons visibly depress by consuming their offset shadow.
- Changing a repeat preset may briefly stamp its name over the canvas, then disappear.
- Moving from one workspace to the next uses a quick horizontal sheet-slide, not a soft corporate fade.
- Crop confirmation can produce a short registration-mark snap.
- Export confirmation can show `FIELD SAVED!` as a temporary acid-colored print label.
- Respect `prefers-reduced-motion`.

---

## Guardrails

Neo-brutalism must not become visual noise.

Do:

- keep one large focal canvas;
- use no more than three interface colors in one workspace;
- preserve obvious hierarchy;
- maintain keyboard/focus accessibility;
- use consistent border thickness;
- reserve playful rotation for labels and stamps.

Do not:

- outline every tiny piece of text;
- use random colors on every control;
- stack multiple hard shadows on nested panels;
- shrink the artwork to make room for decoration;
- use intentionally bad alignment in precision areas;
- turn the interface into a meme or children’s app.

The target is **art-school confidence with production-tool discipline**.

---

## Revision of the first concepts

Keep:

- the artwork-first central field;
- preset rail;
- contextual inspector;
- nearby outcome strip;
- local-only posture;
- three-stage workflow.

Replace:

- near-black formal chrome;
- subtle low-opacity borders;
- tiny subdued labels;
- soft shadows and glass overlays;
- restrained enterprise-style buttons.

With:

- light lavender environment;
- paper panels;
- black 2–3px structural borders;
- purple, acid, and occasional coral blocks;
- hard offset shadows;
- louder stage labels and direct product language.
