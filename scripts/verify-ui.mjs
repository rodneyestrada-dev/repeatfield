import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
await fs.mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });

async function inspectCrop(page, name) {
  await page.goto("http://127.0.0.1:4173/");
  await page.waitForSelector('[data-testid="crop-handle-0"]');
  await page.screenshot({ path: `artifacts/${name}-crop.png`, fullPage: true });
  return page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    },
    rootScrollWidth: document.querySelector("#root")?.scrollWidth,
    cropStage: document
      .querySelector(".crop-stage")
      ?.getBoundingClientRect()
      .toJSON(),
    handles: [
      ...document.querySelectorAll('[data-testid^="crop-handle-"]'),
    ].map((element) => element.getBoundingClientRect().toJSON()),
    activeMode: document.querySelector(
      '.crop-mode-toolbar button[aria-pressed="true"]',
    )?.textContent,
  }));
}

const desktop = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
});
const desktopCrop = await inspectCrop(desktop, "desktop");
await desktop.getByRole("button", { name: /REMOVE BACKGROUND/ }).click();
await desktop.screenshot({
  path: "artifacts/desktop-background-removal.png",
  fullPage: true,
});
await desktop.getByRole("tab", { name: /02 Repeat/ }).click();
await desktop.screenshot({
  path: "artifacts/desktop-repeat.png",
  fullPage: true,
});
const desktopRepeat = await desktop.evaluate(() => ({
  width: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  height: innerHeight,
  scrollHeight: document.documentElement.scrollHeight,
}));
await desktop.getByRole("tab", { name: /03 Preview/ }).click();
await desktop.getByLabel("Export width").fill("640");
await desktop.getByLabel("Export height").fill("480");
const event = desktop.waitForEvent("download");
await desktop.getByRole("button", { name: /Download PNG/ }).click();
const dl = await event;
await dl.saveAs("artifacts/repeatfield-export.png");

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const mobileCrop = await inspectCrop(mobile, "mobile");
await mobile
  .locator(".crop-stage")
  .screenshot({ path: "artifacts/mobile-crop-stage.png" });
await mobile.getByRole("tab", { name: /02 Repeat/ }).click();
await mobile.screenshot({
  path: "artifacts/mobile-repeat.png",
  fullPage: true,
});
const mobileRepeat = await mobile.evaluate(() => ({
  width: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  rootScrollWidth: document.querySelector("#root")?.scrollWidth,
  rootScrollHeight: document.querySelector("#root")?.scrollHeight,
  height: innerHeight,
  scrollHeight: document.documentElement.scrollHeight,
}));
console.log(
  JSON.stringify(
    {
      desktopCrop,
      desktopRepeat,
      mobileCrop,
      mobileRepeat,
      exportBytes: (await fs.stat("artifacts/repeatfield-export.png")).size,
    },
    null,
    2,
  ),
);
await browser.close();
