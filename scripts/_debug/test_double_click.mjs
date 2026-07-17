import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const reqs = [];
page.on('response', async (r) => {
  try { const t = await r.text(); reqs.push({ m: r.request().method(), u: r.url().slice(-45), s: r.status(), b: t.slice(0, 80) }); } catch(e) {}
});

const before = await page.evaluate(() => [...document.querySelectorAll('*')].find(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length === 0 && e.offsetParent !== null)?.textContent?.trim());
console.log('保存前:', before);

// 先 blur（点表单标题区域）
await page.locator('input[placeholder="名称不能为空"]:visible').last().click();
await page.keyboard.press('Tab');
await page.waitForTimeout(500);

// click 第1次
console.log('click #bar_save 第1次');
await page.locator('#bar_save:visible').click({ timeout: 10000 }).catch(e => console.log('click1失败:', e.message.slice(0, 50)));
await page.waitForTimeout(3000);

// click 第2次
console.log('click #bar_save 第2次');
await page.locator('#bar_save:visible').click({ timeout: 10000 }).catch(e => console.log('click2失败:', e.message.slice(0, 50)));
await page.waitForTimeout(10000);

console.log('\n请求:', reqs.length);
reqs.forEach((r, i) => console.log(`  [${i}] ${r.m} ${r.s} ${r.u} | ${r.b.replace(/\s+/g, ' ').slice(0, 70)}`));

const after = await page.evaluate(() => [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length === 0 && e.offsetParent !== null).map(e => e.textContent.trim()))]);
console.log('保存后:', after, '(变化?', after.some(c => c !== before), ')');

await page.screenshot({ path: 'screenshots/double_click.png' });
await browser.close();
