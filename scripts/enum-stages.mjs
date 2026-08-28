// Enumerate app-shell children + canvas visibility for EVERY stage of all 3 workflows.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:5173/";
const OUT = "qa-shots/repro";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`[console] ${m.text()}`); });

async function shellReport(label) {
  const r = await page.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    if (!shell) return { shell: false };
    const rows = getComputedStyle(shell).gridTemplateRows;
    const kids = [...shell.children].map((k) => {
      const b = k.getBoundingClientRect();
      return `${k.tagName}.${k.className.toString().split(" ")[0]} ${Math.round(b.width)}x${Math.round(b.height)}@y${Math.round(b.y)}`;
    });
    const canvases = [...document.querySelectorAll("canvas")].map((c) => {
      const b = c.getBoundingClientRect();
      return `${(c.className || "cv").toString().split(" ")[0] || "cv"} ${Math.round(b.width)}x${Math.round(b.height)}@y${Math.round(b.y)}`;
    });
    return { rows, kids, canvases };
  });
  const broken = [];
  for (const c of r.canvases) {
    const m = c.match(/(\d+)x(\d+)@y(\d+)/);
    if (m && (+m[1] < 40 || +m[2] < 40)) broken.push(c);
  }
  console.log(`\n### ${label}  rows=${r.rows}`);
  console.log("  kids:", r.kids.join(" | "));
  console.log("  canvases:", r.canvases.slice(0, 6).join(" | "));
  if (broken.length) console.log(`  >>> BROKEN (tiny/hidden canvas): ${broken.join(" | ")}`);
  await page.screenshot({ path: `${OUT}/${label}.png` });
}

async function fresh() {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
}

const A = "/tmp/rf-assets";

// ---- FIELD TILE ----
await fresh();
await page.getByRole("button", { name: /^Field Tile/ }).click();
await page.waitForTimeout(400);
await shellReport("field-crop");
await page.getByRole("button", { name: /Continue to Repeat/ }).click();
await page.waitForTimeout(400);
await shellReport("field-repeat");
await page.getByRole("button", { name: /Preview output/ }).click();
await page.waitForTimeout(600);
await shellReport("field-preview");

// ---- TILE SET ----
await fresh();
await page.getByRole("button", { name: /^Tile Set/ }).click();
await page.waitForTimeout(400);
await shellReport("tileset-roles");
const inputs = page.locator("input[type=file]");
const n = await inputs.count();
console.log(`tileset file inputs: ${n}`);
const files = [`${A}/red.png`, `${A}/green.png`, `${A}/blue.png`];
for (let i = 0; i < Math.min(n, 3); i++) {
  await inputs.nth(i).setInputFiles(files[i]);
  await page.waitForTimeout(400);
}
await shellReport("tileset-roles-uploaded");
// find continue/compose CTAs
for (const name of [/Compose Set/i, /Continue to Compose/i]) {
  const btn = page.getByRole("button", { name });
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(600); break; }
}
await shellReport("tileset-compose");
const prevBtn = page.getByRole("button", { name: /Preview|Export/i });
if (await prevBtn.count()) { await prevBtn.first().click(); await page.waitForTimeout(600); }
await shellReport("tileset-after-preview-cta");

// ---- TESSELLATE ----
await fresh();
await page.getByRole("button", { name: /^Tessellate/ }).click();
await page.waitForTimeout(400);
await shellReport("tess-shapes");
const tInputs = page.locator("input[type=file]");
const tn = await tInputs.count();
console.log(`tessellate file inputs: ${tn}`);
if (tn) {
  await tInputs.first().setInputFiles(`${A}/green.png`);
  await page.waitForTimeout(500);
}
await shellReport("tess-shapes-uploaded");
for (const name of [/Continue to Assemble/i, /Assemble/i]) {
  const btn = page.getByRole("button", { name });
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(600); break; }
}
await shellReport("tess-assemble");
const verify = page.getByRole("button", { name: /Verify/i });
if (await verify.count()) { await verify.first().click(); await page.waitForTimeout(600); }
await shellReport("tess-verify");

await browser.close();
console.log("\n=== PAGE/CONSOLE ERRORS ===");
console.log(problems.length ? problems.join("\n") : "(none)");
