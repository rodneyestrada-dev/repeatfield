import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const FIXTURE = path.resolve("design/source-tile.jpg");

async function freshStart(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test("entry screen offers exactly three workflows and each opens its own editor", async ({
  page,
}) => {
  await freshStart(page);
  await expect(
    page.getByRole("heading", { name: /what are you making/i }),
  ).toBeVisible();
  const cards = page.locator(".workflow-card");
  await expect(cards).toHaveCount(3);

  await page.getByRole("button", { name: /Field Tile/ }).click();
  await expect(page.getByTestId("workflow-name")).toHaveText("Field Tile");
  await expect(page.getByRole("tab", { name: "Crop" })).toBeVisible();
  await page.getByRole("button", { name: /Workflows/ }).click();

  await page.getByRole("button", { name: /Tile Set/ }).click();
  await expect(page.getByTestId("workflow-name")).toHaveText("Tile Set");
  await expect(
    page.getByRole("group", { name: "Tile Set roles" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Workflows/ }).click();

  await page.getByRole("button", { name: /Tessellate/ }).click();
  await expect(page.getByTestId("workflow-name")).toHaveText("Tessellate");
  await expect(page.getByRole("group", { name: "Shapes" })).toBeVisible();
});

test("workflow isolation: no cross-workflow controls leak", async ({ page }) => {
  await freshStart(page);
  // Field Tile: no Edge/Corner/Primary/Infill/coverage
  await page.getByRole("button", { name: /Field Tile/ }).click();
  await page.getByRole("tab", { name: "Repeat" }).click();
  await expect(page.getByText("Tile Turn")).toBeVisible();
  await expect(page.getByText(/Edge Run/i)).toHaveCount(0);
  await expect(page.getByText(/Corner Join/i)).toHaveCount(0);
  await expect(page.getByText(/Infill/i)).toHaveCount(0);
  await expect(page.getByText(/Coverage/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Workflows/ }).click();

  // Tile Set: no Tile Turn / Primary / coverage heatmap
  await page.getByRole("button", { name: /Tile Set/ }).click();
  await expect(page.getByText("Tile Turn")).toHaveCount(0);
  await expect(page.getByText(/Primary/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Workflows/ }).click();

  // Tessellate: no Tile Turn / Field Layout / Brick / Half-Drop
  await page.getByRole("button", { name: /Tessellate/ }).click();
  await page.getByRole("tab", { name: "Assemble" }).click();
  await expect(page.getByText("Tile Turn")).toHaveCount(0);
  await expect(page.getByText("Field Layout")).toHaveCount(0);
  await expect(page.getByText(/Brick/)).toHaveCount(0);
  await expect(page.getByText(/Half-Drop/)).toHaveCount(0);
});

test("reload restores the chosen workflow from browser-local persistence", async ({
  page,
}) => {
  await freshStart(page);
  await page.getByRole("button", { name: /Tile Set/ }).click();
  await expect(page.getByTestId("workflow-name")).toHaveText("Tile Set");
  await page.reload();
  await expect(page.getByTestId("workflow-name")).toHaveText("Tile Set");
});

test("field tile full flow: crop, tile turn, layout, preview, export", async ({
  page,
}) => {
  await freshStart(page);
  await page.getByRole("button", { name: /Field Tile/ }).click();
  await expect(page.getByText("Demo tile")).toBeVisible();
  await expect(page.getByTestId("pattern-canvas")).toBeVisible();

  // crop: drag a corner and confirm the seam preview changes
  const handle = page.getByTestId("crop-handle-0");
  await expect(handle).toBeVisible();
  const beforeSeam = await page
    .getByTestId("seam-check")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const box = await handle.boundingBox();
  if (!box) throw new Error("crop handle has no hit target");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 42, box.y + box.height / 2 + 28, {
    steps: 6,
  });
  await page.mouse.up();
  const afterSeam = await page
    .getByTestId("seam-check")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(afterSeam).not.toBe(beforeSeam);

  // continue to repeat: rotate one tile turn cell, change layout
  await page.getByRole("button", { name: /Continue to Repeat/ }).click();
  const fieldBefore = await page
    .getByTestId("pattern-canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole("button", { name: /Top right tile — 0°/ }).click();
  await expect(
    page.getByRole("button", { name: /Top right tile — 90°/ }),
  ).toBeVisible();
  const fieldAfterTurn = await page
    .getByTestId("pattern-canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(fieldAfterTurn).not.toBe(fieldBefore);
  await page.getByRole("button", { name: "Brick" }).click();
  await expect(page.getByRole("button", { name: "Brick" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // cells unchanged by layout change
  await expect(
    page.getByRole("button", { name: /Top right tile — 90°/ }),
  ).toBeVisible();

  // preview + export
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Preview field" })).toBeVisible();
  await page.getByLabel("Export width").fill("640");
  await page.getByLabel("Export height").fill("480");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download PNG/ }).click();
  const download = await dl;
  const file = await download.createReadStream();
  let bytes = 0;
  for await (const chunk of file!) bytes += chunk.length;
  expect(bytes).toBeGreaterThan(1000);
  await page.getByRole("button", { name: "Back to edit" }).click();
  await expect(page.getByRole("tab", { name: "Repeat" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("crop tools: unnumbered dock, persistent continue, whole-selection drag, keyboard nudge, live warp", async ({
  page,
}) => {
  await freshStart(page);
  await page.getByRole("button", { name: /Field Tile/ }).click();
  const dock = page.getByRole("toolbar", { name: "Crop tools" });
  await expect(dock).toBeVisible();
  const labels = await dock.locator("button").evaluateAll((buttons) =>
    buttons.map((b) => b.getAttribute("aria-label") ?? ""),
  );
  expect(labels.length).toBeGreaterThanOrEqual(7);
  for (const label of labels) expect(label).not.toMatch(/^\d/);
  // dock hit targets ≥44px
  const sizes = await dock.locator("button").evaluateAll((buttons) =>
    buttons.map((b) => b.getBoundingClientRect().toJSON()),
  );
  expect(sizes.every((s) => s.width >= 44 && s.height >= 44)).toBe(true);

  // Continue stays visible for every modal tool
  for (const tool of ["Select tile", "Warp to square", "Remove background"]) {
    await page.getByRole("button", { name: tool }).click();
    await expect(
      page.getByRole("button", { name: /Continue to Repeat/ }),
    ).toBeVisible();
    await expect(page.getByTestId("pattern-canvas")).toBeVisible();
  }

  // whole-selection drag: all four handles move by the same delta
  await page.getByRole("button", { name: "Select tile" }).click();
  const positions = async () =>
    Promise.all(
      [0, 1, 2, 3].map(async (index) => {
        const b = await page.getByTestId(`crop-handle-${index}`).boundingBox();
        return { x: b!.x, y: b!.y };
      }),
    );
  const before = await positions();
  const selection = page.getByTestId("crop-selection");
  const selectionBox = await selection.boundingBox();
  if (!selectionBox) throw new Error("selection not visible");
  const cx = selectionBox.x + selectionBox.width / 2;
  const cy = selectionBox.y + selectionBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 30, cy - 20, { steps: 5 });
  await page.mouse.up();
  const after = await positions();
  const dx = after[0].x - before[0].x;
  const dy = after[0].y - before[0].y;
  expect(Math.abs(dx + 30)).toBeLessThan(6);
  expect(Math.abs(dy + 20)).toBeLessThan(6);
  for (let index = 1; index < 4; index++) {
    expect(Math.abs(after[index].x - before[index].x - dx)).toBeLessThan(2);
    expect(Math.abs(after[index].y - before[index].y - dy)).toBeLessThan(2);
  }

  // keyboard nudge: focus the polygon, arrow right, all handles shift
  await selection.focus();
  const beforeKeys = await positions();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const afterKeys = await positions();
  expect(afterKeys[0].x).toBeGreaterThan(beforeKeys[0].x);
  expect(afterKeys[0].y - beforeKeys[0].y).toBeGreaterThan(
    afterKeys[0].x - beforeKeys[0].x,
  );

  // warp: pins are visible, dragging one changes the rectified inset but
  // leaves the selection handles untouched
  await page.getByRole("button", { name: "Warp to square" }).click();
  await expect(page.getByTestId("warp-inset")).toBeVisible();
  const insetBefore = await page
    .getByTestId("rectified-preview")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const pin = page.getByTestId("warp-pin-0");
  const pinBox = await pin.boundingBox();
  if (!pinBox) throw new Error("warp pin missing");
  await page.mouse.move(pinBox.x + pinBox.width / 2, pinBox.y + pinBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    pinBox.x + pinBox.width / 2 + 34,
    pinBox.y + pinBox.height / 2 + 22,
    { steps: 5 },
  );
  await page.mouse.up();
  const insetAfter = await page
    .getByTestId("rectified-preview")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(insetAfter).not.toBe(insetBefore);
  // switch back to select: selection handles are where the drag/nudge left them
  await page.getByRole("button", { name: "Select tile" }).click();
  const afterWarp = await positions();
  for (let index = 0; index < 4; index++) {
    expect(Math.abs(afterWarp[index].x - afterKeys[index].x)).toBeLessThan(3);
    expect(Math.abs(afterWarp[index].y - afterKeys[index].y)).toBeLessThan(3);
  }
});

test("tile set: role uploads are independent, switching preserves state, and compose renders", async ({
  page,
}) => {
  await freshStart(page);
  await page.getByRole("button", { name: /Tile Set/ }).click();
  // Field role: empty upload-only state (no bundled demo)
  await expect(page.getByTestId("role-empty-state")).toBeVisible();
  await page.getByLabel("Upload Field image").setInputFiles(FIXTURE);
  await expect(page.getByTestId("pattern-canvas")).toBeVisible();
  // adjust Field selection corner
  const handle = page.getByTestId("crop-handle-0");
  const box = await handle.boundingBox();
  if (!box) throw new Error("field crop handle missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, {
    steps: 4,
  });
  await page.mouse.up();
  const fieldHandle = await page.getByTestId("crop-handle-0").boundingBox();

  // switch to Edge role: empty; upload separately
  await page.getByRole("button", { name: /Edge/ }).click();
  await expect(page.getByTestId("role-empty-state")).toBeVisible();
  await page.getByLabel("Upload Edge image").setInputFiles(FIXTURE);
  await expect(page.getByTestId("pattern-canvas")).toBeVisible();
  // Edge selection is at defaults (independent of Field edits)
  // switch back to Field: geometry preserved
  await page.getByRole("button", { name: /^Field/ }).click();
  const fieldHandleAfter = await page.getByTestId("crop-handle-0").boundingBox();
  expect(Math.abs(fieldHandleAfter!.x - fieldHandle!.x)).toBeLessThan(3);
  expect(Math.abs(fieldHandleAfter!.y - fieldHandle!.y)).toBeLessThan(3);

  // role status persists across reload
  await page.reload();
  await expect(page.getByTestId("workflow-name")).toHaveText("Tile Set");
  await expect(page.getByRole("button", { name: /Edge/ })).toContainText(
    "Ready",
  );

  // compose stage renders with placeholders and edge/corner controls
  await page.getByRole("tab", { name: "Compose Set" }).click();
  await expect(page.getByRole("heading", { name: "Edge Run" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corner Join" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Set Look" })).toBeVisible();
  await expect(page.getByTestId("pattern-canvas")).toBeVisible();
});

test("tessellate: upload, place shapes, coverage diagnostics stay honest, transparent export", async ({
  page,
}) => {
  await freshStart(page);
  await page.getByRole("button", { name: /Tessellate/ }).click();
  await expect(page.getByTestId("shape-empty-state")).toBeVisible();
  await page.getByLabel("Upload Primary image").setInputFiles(FIXTURE);
  await expect(page.getByTestId("pattern-canvas")).toBeVisible();
  await page.getByRole("button", { name: /Continue to Assemble/ }).click();

  // honest empty coverage
  await expect(page.getByTestId("coverage-status")).toContainText(
    /place at least one shape/i,
  );
  // add a primary instance
  await page.getByRole("button", { name: "+ Add Primary" }).click();
  await expect(page.getByTestId("coverage-status")).not.toContainText(
    /place at least one shape/i,
  );
  const status = await page.getByTestId("coverage-status").textContent();
  expect([
    "Gap-free",
    "Near fit — inspect edges",
    "Gaps detected",
    "Overlaps detected",
    "Decorative packing",
  ]).toContain(status?.trim());
  await expect(page.getByTestId("coverage-gap")).toBeVisible();
  await expect(page.getByTestId("coverage-overlap")).toBeVisible();

  // selected-shape transforms exist
  await expect(page.getByRole("button", { name: "Rotate selected shape" })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate selected shape" }).click();

  // verify stage shows heatmap overlay canvas (same canvas, verify tab active)
  await page.getByRole("button", { name: "Verify coverage" }).click();
  await expect(page.getByRole("tab", { name: "Verify" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // medallion output and transparent export
  await page.getByRole("group", { name: "Output mode" }).getByRole("button", { name: "Medallion" }).click();
  await page.getByLabel("Export width").fill("256");
  await page.getByLabel("Export height").fill("256");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download transparent PNG/ }).click();
  const download = await dl;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.length).toBeGreaterThan(100);
  // PNG color type must support alpha (RGBA=6): byte 25 of a PNG is color type
  expect(png[25]).toBe(6);
});

test("undo and redo are scoped to the active workflow", async ({ page }) => {
  await freshStart(page);
  await page.getByRole("button", { name: /Field Tile/ }).click();
  await page.getByRole("tab", { name: "Repeat" }).click();
  const undo = page.getByRole("button", { name: /Undo Repeat change/ });
  const redo = page.getByRole("button", { name: /Redo Repeat change/ });
  await expect(undo).toBeDisabled();
  const gap = page.getByRole("slider", { name: "Gap" });
  await gap.fill("24");
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(gap).toHaveValue("0");
  await redo.click();
  await expect(gap).toHaveValue("24");
  await page.keyboard.press("Control+Z");
  await expect(gap).toHaveValue("0");
  await page.keyboard.press("Control+Shift+Z");
  await expect(gap).toHaveValue("24");
  await gap.focus();
  await page.keyboard.press("Control+Z");
  await expect(gap).toHaveValue("24");
});

test("mobile layouts have no horizontal overflow in all three workflows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStart(page);
  const overflow = async () =>
    page.evaluate(() => document.documentElement.scrollWidth);
  expect(await overflow()).toBeLessThanOrEqual(390);

  await page.getByRole("button", { name: /Field Tile/ }).click();
  expect(await overflow()).toBeLessThanOrEqual(390);
  const handles = await page
    .locator('[data-testid^="crop-handle-"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().toJSON()),
    );
  expect(handles).toHaveLength(4);
  expect(handles.every((h) => h.width >= 44 && h.height >= 44)).toBe(true);
  await page.getByRole("tab", { name: "Repeat" }).click();
  expect(await overflow()).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: /Workflows/ }).click();

  await page.getByRole("button", { name: /Tile Set/ }).click();
  expect(await overflow()).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: /Workflows/ }).click();

  await page.getByRole("button", { name: /Tessellate/ }).click();
  expect(await overflow()).toBeLessThanOrEqual(390);
  await page.getByRole("tab", { name: "Assemble" }).click();
  expect(await overflow()).toBeLessThanOrEqual(390);
});

test("desktop 1440 layout keeps the canvas dominant with no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await freshStart(page);
  await page.getByRole("button", { name: /Field Tile/ }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1440);
  const stage = await page.locator(".crop-stage").boundingBox();
  expect(stage!.width).toBeGreaterThan(700);
});
