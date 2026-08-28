// Render-verify the plan HTML sample: loads, images resolve, no layout errors.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("file:///Users/rodneyestrada/repeatfield/design/proposals/repeatfield-build-fixes-plan.html", { waitUntil: "load" });
await page.waitForTimeout(600);

const imgs = await page.evaluate(() =>
  [...document.images].map((i) => ({ src: i.src.slice(0, 30), ok: i.complete && i.naturalWidth > 0 }))
);
console.log("images:", imgs.length, "all ok:", imgs.every((i) => i.ok));
console.log("page errors:", errors.length ? errors : "(none)");
await page.screenshot({ path: "/Users/rodneyestrada/repeatfield/design/proposals/plan-render-check.png", fullPage: true });
await browser.close();
