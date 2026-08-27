import { test, expect } from "@playwright/test";
import path from "node:path";

test("demo, local upload, all workspaces, pattern selection and PNG download", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Demo tile")).toBeVisible();
  await expect(page.getByTestId("pattern-canvas")).toBeVisible();
  await page
    .getByLabel("Upload image")
    .setInputFiles(path.resolve("design/source-tile.jpg"));
  await expect(page.getByText("source-tile.jpg")).toBeVisible();
  await page.getByRole("tab", { name: /02 Repeat/ }).click();
  await page.getByRole("button", { name: "Radial Kaleidoscope" }).click();
  await expect(
    page.getByRole("button", { name: "Radial Kaleidoscope" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: /03 Preview/ }).click();
  await expect(
    page.getByRole("heading", { name: "Preview field" }),
  ).toBeVisible();
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
  await expect(page.getByRole("tab", { name: /02 Repeat/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("dragging a crop corner rectifies every downstream canvas", async ({
  page,
}) => {
  await page.goto("/");
  const handle = page.getByTestId("crop-handle-0");
  await expect(handle).toBeVisible();
  const beforeSeam = await page
    .getByTestId("seam-check")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const box = await handle.boundingBox();
  if (!box) throw new Error("crop handle has no hit target");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 42,
    box.y + box.height / 2 + 28,
    { steps: 6 },
  );
  await page.mouse.up();
  const afterSeam = await page
    .getByTestId("seam-check")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(afterSeam).not.toBe(beforeSeam);
  await page.getByRole("button", { name: /Continue to Repeat/ }).click();
  const repeatAfter = await page
    .getByTestId("pattern-canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole("tab", { name: /01 Crop/ }).click();
  await page.getByRole("button", { name: "Reset crop" }).click();
  await page.getByRole("tab", { name: /02 Repeat/ }).click();
  const repeatReset = await page
    .getByTestId("pattern-canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(repeatAfter).not.toBe(repeatReset);
});

test("Repeat undo and redo work by buttons and keyboard while inputs are protected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /02 Repeat/ }).click();
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
  await page.getByText("Live pattern field").click();
  await page.keyboard.press("Control+Z");
  await expect(gap).toHaveValue("0");
  await page.keyboard.press("Control+Y");
  await expect(gap).toHaveValue("24");
});

test("eyedropper background removal changes seam output and exported PNG", async ({
  page,
}) => {
  const downloadBytes = async () => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download PNG/ }).click();
    const download = await pending;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  };
  await page.goto("/");
  await page.getByRole("tab", { name: /03 Preview/ }).click();
  await page.getByLabel("Export width").fill("256");
  await page.getByLabel("Export height").fill("256");
  const beforeExport = await downloadBytes();
  await page.getByRole("button", { name: "Back to edit" }).click();
  await page.getByRole("tab", { name: /01 Crop/ }).click();
  const beforeSeam = await page
    .getByTestId("seam-check")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole("button", { name: /REMOVE BACKGROUND/ }).click();
  const lasso = page.getByLabel("Perspective crop lasso");
  const box = await lasso.boundingBox();
  if (!box) throw new Error("crop lasso unavailable");
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByText(/Sampled color/)).toBeVisible();
  const afterSeam = await page
    .getByTestId("seam-check")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(afterSeam).not.toBe(beforeSeam);
  const minimumAlpha = await page
    .getByTestId("seam-check")
    .evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let minimum = 255;
      for (let index = 3; index < pixels.length; index += 4)
        minimum = Math.min(minimum, pixels[index]);
      return minimum;
    });
  expect(minimumAlpha).toBeLessThan(255);
  await page.getByRole("tab", { name: /03 Preview/ }).click();
  await page.getByLabel("Export width").fill("256");
  await page.getByLabel("Export height").fill("256");
  const afterExport = await downloadBytes();
  expect(afterExport.equals(beforeExport)).toBe(false);
});

test("mobile layout has no horizontal overflow and crop handles keep 44px targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.querySelector("#root")!.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const handles = await page
    .locator('[data-testid^="crop-handle-"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().toJSON()),
    );
  expect(handles).toHaveLength(4);
  expect(
    handles.every((handle) => handle.width >= 44 && handle.height >= 44),
  ).toBe(true);
  await page.getByRole("tab", { name: /02 Repeat/ }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.querySelector("#root")!.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
