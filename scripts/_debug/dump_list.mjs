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
  console.log('  goto 未命中，UI 导航...');
  const clickText = async (t) => page.evaluate((text) => {
    const el = [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === text && e.offsetParent !== null && e.children.length === 0);
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, t);
  await clickText('应用'); await page.waitForTimeout(1500);
  await clickText('研发管理（DMP）'); await page.waitForTimeout(4000);
  if (await page.locator('#tblnew').count() > 0) return true;
  const coord = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')].filter(e => e.textContent?.trim() === '缺陷管理' && e.offsetParent !== null && e.children.length === 0);
    els.sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
    if (els[0]) { const r = els[0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    return null;
  });
  if (coord) await page.mouse.click(coord.x, coord.y);
  for (let i = 0; i < 12; i++) { if (await page.locator('#tblnew').count() > 0) return true; await page.waitForTimeout(800); }
  return false;
}

const ok = await goToList(page);
console.log('到列表:', ok);
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const visible = e => e.offsetParent !== null;
  const inputs = [...document.querySelectorAll('input')].filter(visible).slice(0, 25).map(e => ({ ph: e.placeholder || '', cls: (e.className || '').slice(0, 40) }));
  const headers = [...document.querySelectorAll('th,[role=columnheader]')].filter(visible).slice(0, 25).map(e => e.textContent.trim().slice(0, 12)).filter(Boolean);
  const searchBtns = [...document.querySelectorAll('button,[role=button],span,a,[class*=kdfont]')].filter(e => visible && (e.textContent || '').trim().length < 8 && /搜索|查询|筛选|搜索/.test(e.textContent || '')).slice(0, 8).map(e => e.textContent.trim());
  const rows = [...document.querySelectorAll('tr,[role=row]')].filter(visible);
  const firstRowText = rows[1] ? (rows[1].textContent || '').replace(/\s+/g, ' ').slice(0, 100) : '(无行)';
  return { inputCount: inputs.length, inputs, headers, rowCount: rows.length, searchBtns, firstRowText };
});
console.log(JSON.stringify(info, null, 2));
process.exit(0);
