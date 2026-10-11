# Repeatfield Tessellate — Background Removal, Batch 1 UX Specification

Status: approved for production implementation. Batch 1 contains no image-segmentation model, remote service, or simulated AI result.

## Goal

Make the existing flat-color alpha removal understandable and reliable; retain uploaded PNG alpha; establish a clearly separate, truthful entry point for future on-device subject segmentation.

The user should never confuse a sampled-color remover with intelligent object selection.

## Naming and modes

Use a visible `BACKGROUND` section with an accessible single-choice control (native radios or buttons using `role="radiogroup"`, `role="radio"`, and `aria-checked`).

1. `Keep original`
   - Description: `Use the image’s existing transparency. Nothing is removed.`
   - This is the default when an uploaded source already has transparent pixels. It may also be selected for opaque sources.

2. `Quick remove`
   - Description: `Remove one sampled color. Best for flat or nearly flat backgrounds.`
   - This exposes the current color-key algorithm only.

3. `Smart remove · Beta`
   - Description: `Detect a main subject in a photo. Coming next — not available yet.`
   - Disabled/informational in Batch 1. Do not show it as a selectable active removal method and do not use a fake progress UI.

## User flow

### On image load

- Preserve the source’s original pixel alpha unmodified.
- Default to `Keep original`.
- If source alpha is present, show a passive status note: `This image already contains transparency.`
- If no source alpha is present, do not imply a background has been removed. Show no warning until Quick remove is selected.

### Quick remove

1. User selects `Quick remove`.
2. Copy explains the operation and limitation before controls:
   `Pick a background color, then tune how much of that color is removed.`
3. User samples a color directly from the image canvas; selection enables removal immediately.
4. Retain an editable color input and readable hex value for keyboard/precise correction.
5. Show controls in this order:
   - `Sampled color` (color input + hex value)
   - `Removal tolerance` (range; existing 0–100 range)
   - `Edge feather` (range; existing 0–50 range)
   - `Reset Quick remove` (restores default sampled color/tolerance/feather and returns to `Keep original`)
6. The canvas previews the generated transparency over a checkerboard, not a white panel alone.

### Smart remove · Beta

- Display a non-interactive info panel when users focus/activate its associated help affordance:
  `Smart Remove will identify a main subject locally in your browser. It is not included in this version.`
- Do not dispatch a removal-mode change to Smart remove.
- Do not claim no upload unless the eventual model implementation is verified browser-local.

## Visible limitations

Always show these only while `Quick remove` is active:

> Quick remove removes similar colors everywhere in the image. It works best when the subject contrasts with one flat background.

Include concise example guidance:

- `Works well: dark object on one white, blue, or solid-color backdrop.`
- `May need cleanup: shadows, gradients, patterns, reflections, or subject colors close to the background.`

Do not use vague wording such as `AI`, `magic`, `automatic`, or `smart` for Quick remove.

## States

### No image
- The background-removal controls are disabled.
- Helper: `Add a Primary or Infill image to remove its background.`

### Existing alpha
- Mode defaults to Keep original.
- Status: `This image already contains transparency.`

### Quick remove, no sampled color
- Not normally reachable because default color exists. If state is corrupt/missing, disable adjustment controls and display: `Choose a background color to begin.`

### Quick remove result is heavily transparent
- Do not silently alter parameters.
- Add a non-blocking warning if a safe heuristic identifies near-total removal: `Most of the image is transparent. Lower tolerance or choose another color.`

### Reset
- `Reset Quick remove` restores the default Quick-remove values and selects `Keep original`; it never destroys source pixels or original alpha.

## Accessibility requirements

- Use programmatic mode labels and selection state (`aria-checked`/native radios); do not rely on visual selected styling alone.
- `Quick remove` controls must be absent from tab order when the mode is not active.
- Color picker has accessible name `Background color`; its hex value is visible text, not color-only.
- Range controls retain exact accessible labels: `Removal tolerance` and `Edge feather`, with numeric values readable by assistive technology.
- Every status/warning note uses `role="status"` or `aria-live="polite"`; warnings must be text, not color alone.
- Disabled Smart Remove must disclose why it is unavailable in accessible text.
- Checkerboard canvas remains decorative (`aria-hidden="true"`) unless it has a separate accessible preview description.

## Acceptance criteria

1. Existing color-key math, quick-remove parameters, and final transparent export behavior stay unchanged.
2. No UI labels the existing color-key algorithm as smart or intelligent.
3. Quick remove is clearly named and its flat-background limitation is visible while active.
4. Original alpha/pixels remain recoverable through Keep original and Reset.
5. Smart remove is visually separate, labelled `Beta`, and cannot imply functional segmentation in Batch 1.
6. Full keyboard operation and screen-reader labels are present.
7. No production download or export claims change: output remains the current transparent PNG behavior.
