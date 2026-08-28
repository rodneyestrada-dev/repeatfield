// Phase 1 evidence: probe the live Preview DOM geometry + img state.
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:5173/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Field Tile/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Continue to Repeat/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Preview output/ }).click();
await page.waitForTimeout(1000);

const probe = await page.evaluate(() => {
  const canvas = document.querySelector(".preview-canvas");
  const main = document.querySelector("main.preview");
  const root = document.getElementById("root");
  const out = { canvasFound: !!canvas, mainFound: !!main };
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    const cs = getComputedStyle(canvas);
    out.canvas = {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      cssW: cs.width, cssH: cs.height, display: cs.display,
      bitmapW: canvas.width, bitmapH: canvas.height,
    };
  }
  if (main) {
    const r = main.getBoundingClientRect();
    out.main = {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      bg: getComputedStyle(main).background,
      display: getComputedStyle(main).display,
      childCount: main.children.length,
    };
    // walk up the parent chain with heights
    out.chain = [];
    let el = main.parentElement;
    while (el && out.chain.length < 6) {
      const cr = el.getBoundingClientRect();
      const cs2 = getComputedStyle(el);
      out.chain.push({
        tag: el.tagName, cls: el.className?.toString?.().slice(0, 40),
        h: cr.height, display: cs2.display, gridRows: cs2.gridTemplateRows,
      });
      el = el.parentElement;
    }
  }
  if (root) {
    const r = root.getBoundingClientRect();
    out.root = { w: r.width, h: r.height };
  }
  return out;
});
console.log(JSON.stringify(probe, null, 2));

// is the demo image loaded? check the repeat stage canvas drew pixels earlier —
// sample preview canvas actual pixels
const pixels = await page.evaluate(() => {
  const c = document.querySelector(".preview-canvas");
  if (!c) return null;
  try {
    const x = c.getContext("2d");
    const d = x.getImageData(0, 0, Math.min(50, c.width), Math.min(50, c.height)).data;
    let nonZero = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) nonZero++;
    return { sampled: d.length / 4, nonZeroAlpha: nonZero };
  } catch (e) {
    return { error: String(e) };
  }
});
console.log("preview canvas pixels:", JSON.stringify(pixels));

await browser.close();
