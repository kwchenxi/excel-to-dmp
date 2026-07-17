import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const reqs = [];
page.on('response', async (r) => {
  try { const t = await r.text(); reqs.push({ m: r.request().method(), u: r.url().slice(-45), s: r.status(), b: t.slice(0, 80) }); } catch(e) {}
});

const before = await page.evaluate(() => [...document.querySelectorAll('*')].find(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length === 0 && e.offsetParent !== null)?.textContent?.trim());

// 同步 React 状态：对所有填的字段触发 input + change
console.log('同步 React 状态...');
await page.evaluate(() => {
  const trigger = (el) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  };
  // 标题
  const title = document.querySelector('input[placeholder="名称不能为空"]');
  if (title) trigger(title);
  // 备注
  document.querySelectorAll('textarea').forEach(trigger);
  // 处理人/发现阶段/关联故事的可见 input
  document.querySelectorAll('.kd-cq-basedata input:not([type=hidden]):not([type=file])').forEach(el => {
    if (el.offsetParent !== null) trigger(el);
  });
});
await page.waitForTimeout(1000);

// 保存
console.log('click #bar_save...');
await page.locator('#bar_save:visible').click({ timeout: 10000 }).catch(e => console.log('click失败:', e.message.slice(0, 50)));
await page.waitForTimeout(12000);

console.log('\n请求:', reqs.length);
reqs.forEach((r, i) => console.log(`  [${i}] ${r.m} ${r.s} ${r.u} | ${r.b.replace(/\s+/g, ' ').slice(0, 70)}`));

const after = await page.evaluate(() => [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length === 0 && e.offsetParent !== null).map(e => e.textContent.trim()))]);
console.log('编号:', before, '->', after, '(变化?', after.some(c => c !== before), ')');

await browser.close();
