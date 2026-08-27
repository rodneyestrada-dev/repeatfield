import { chromium } from '@playwright/test';

const url = 'https://rodneyestrada-dev.github.io/repeatfield/?v=6f5ad6a';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('pageerror', error => errors.push(`page: ${error.message}`));
const response = await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const body = await page.locator('body').innerText();
const handleCount = await page.locator('[data-testid^="crop-handle-"]').count();
if (handleCount === 0) {
  console.log(JSON.stringify({ http: response?.status(), title: await page.title(), body: body.slice(0, 1000), errors, html: (await page.content()).slice(0, 1000) }, null, 2));
  await browser.close();
  process.exit(1);
}
const lasso = await page.getByRole('button', { name: /LASSO TILE/ }).isVisible();
const warp = await page.getByRole('button', { name: /WARP TO SQUARE/ }).isVisible();
await page.getByRole('button', { name: /REMOVE BACKGROUND/ }).click();
const tolerance = await page.getByText('Removal tolerance').isVisible();
const feather = await page.getByText('Edge feather').isVisible();
await page.getByRole('tab', { name: /02 Repeat/ }).click();
const undo = await page.getByRole('button', { name: /Undo Repeat change/i }).isVisible();
const redo = await page.getByRole('button', { name: /Redo Repeat change/i }).isVisible();
console.log(JSON.stringify({ status: await page.title(), handleCount, lasso, warp, tolerance, feather, undo, redo, width: await page.evaluate(() => innerWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) }, null, 2));
await browser.close();
