// Repro harness: walk each workflow's stages headlessly, capture console/page
// errors and screenshots at every step. Answers: which edit surfaces error?
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:5173/";
const OUT = "qa-shots/repro";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`[console.error] ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`shot: ${name}`);
}

await page.goto(BASE, { waitUntil: "networkidle" });
await shot("0-entry");

// --- Workflow 1: Field Tile ---
await page.getByRole("button", { name: /Field Tile/ }).click();
await page.waitForTimeout(800);
await shot("1-field-crop");

await page.getByRole("button", { name: /Continue to Repeat/ }).click();
await page.waitForTimeout(800);
await shot("2-field-repeat");

await page.getByRole("button", { name: /Preview output/ }).click();
await page.waitForTimeout(1200);
await shot("3-field-preview");

// text content of the page at preview — error page?
const previewText = (await page.locator("body").innerText()).slice(0, 400);
console.log("FIELD PREVIEW TEXT >>>", JSON.stringify(previewText));

// --- Workflow 2: Tile Set ---
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: /Tile Set/ }).click();
await page.waitForTimeout(800);
await shot("4-tileset-roles");

// --- Workflow 3: Tessellate ---
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: /Tessellate/ }).click();
await page.waitForTimeout(800);
await shot("5-tessellate-shapes");

const tileSetText = (await page.locator("body").innerText()).slice(0, 300);
console.log("TILESET TEXT >>>", JSON.stringify(tileSetText));

await browser.close();

console.log("\n=== PROBLEMS CAPTURED ===");
if (problems.length === 0) console.log("(no console/page errors)");
for (const p of problems) console.log(p);
