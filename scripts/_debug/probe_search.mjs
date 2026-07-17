import { chromium } from 'playwright';
import fs from 'fs';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();
const LIST_URL = fs.readFileSync('.defect-list-url.txt', 'utf-8').trim();
async function goToList(page) {
  if (await page.locator('#tblnew').count() > 0) return true;
  try { await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 15000 }); } catch {}
  for (let i = 0; i < 10; i++) { if (await page.locator('#tblnew').count() > 0) break; await page.waitForTimeout(800); }
  if (await page.locator('#tblnew').count() > 0) return true;
  const ct = async (t) => page.evaluate((text) => { const el = [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === text && e.offsetParent !== null && e.children.length === 0); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, t);
  await ct('应用'); await page.waitForTimeout(1500); await ct('研发管理（DMP）'); await page.waitForTimeout(4000);
  if (await page.locator('#tblnew').count() > 0) return true;
  const c = await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.textContent?.trim() === '缺陷管理' && e.offsetParent !== null && e.children.length === 0); els.sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y); if (els[0]) { const r = els[0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; } return null; });
  if (c) await page.mouse.click(c.x, c.y);
  for (let i = 0; i < 12; i++) { if (await page.locator('#tblnew').count() > 0) return true; await page.waitForTimeout(800); }
  return false;
}
await goToList(page);
await page.waitForTimeout(1500);
const before = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.search-label,[class*=filter-tag],[class*=FilterTag]')].filter(e => e.offsetParent !== null).slice(0, 10).map(e => e.textContent.trim().slice(0, 25));
  const clears = [...document.querySelectorAll('.kdfont-qingkong2,[class*=qingkong]')].filter(e => e.offsetParent !== null).length;
  return { filterLabels: labels, clearIconCount: clears };
});
console.log('搜索前过滤:', JSON.stringify(before));
const search = page.locator('input[placeholder*="搜索缺陷"]').first();
await search.click({ clickCount: 3 }); await page.keyboard.press('Backspace');
await search.fill('进行中的定位的点');
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);
const after = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr,[role=row]')].filter(e => e.offsetParent !== null);
  return { rowCount: rows.length, firstData: rows[1] ? (rows[1].textContent || '').replace(/\s+/g, ' ').slice(0, 100) : '(无)', searchVal: document.querySelector('input[placeholder*="搜索缺陷"]')?.value };
});
console.log('搜索后:', JSON.stringify(after));
process.exit(0);
