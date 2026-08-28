// Probe the Tessellate Shapes stage collapse (crop-canvas 28px wide).
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:5173/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Tessellate/ }).click();
await page.waitForTimeout(400);
await page.locator("input[type=file]").first().setInputFiles("/tmp/rf-assets/green.png");
await page.waitForTimeout(700);

const r = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: Math.round(b.width), h: Math.round(b.height), display: cs.display, gridCols: cs.gridTemplateColumns, flex: cs.flex, minW: cs.minWidth };
  };
  return {
    workspace: pick("main.workspace"),
    cropShell: pick(".crop-shell"),
    cropBody: pick(".crop-body.tessellate-shape-body"),
    cropStage: pick(".crop-stage"),
    canvasWrap: pick(".crop-canvas-wrap"),
    canvas: pick(".crop-canvas-wrap canvas, canvas.crop-canvas, .crop-canvas-wrap > *"),
  };
});
console.log(JSON.stringify(r, null, 2));
await page.screenshot({ path: "qa-shots/repro/tess-shapes-collapse.png" });
await browser.close();
