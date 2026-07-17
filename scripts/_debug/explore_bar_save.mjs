import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 监听所有请求
const reqs = [];
page.on('response', async (r) => {
  try { const t = await r.text(); reqs.push({ m: r.request().method(), u: r.url().slice(-50), s: r.status(), b: t.slice(0, 100) }); } catch(e) {}
});

// 找 #bar_save 的 React onClick 并调用
const result = await page.evaluate(() => {
  const btn = document.querySelector('#bar_save');
  if (!btn) return 'no btn';
  const handlerKey = Object.keys(btn).find(k => k.startsWith('__reactEventHandlers'));
  if (!handlerKey) return 'no handler key';
  const handlers = btn[handlerKey];
  const onClick = handlers?.onClick;
  if (typeof onClick !== 'function') return 'no onClick func';
  const sig = onClick.toString().slice(0, 200);
  try {
    const fakeEvent = { target: btn, currentTarget: btn, preventDefault(){}, stopPropagation(){}, nativeEvent: new MouseEvent('click', { bubbles: true }), type: 'click' };
    onClick(fakeEvent);
    return { sig, called: true };
  } catch (e) { return { sig, error: e.message }; }
});
console.log('onClick 调用:', JSON.stringify(result).slice(0, 400));

await page.waitForTimeout(10000);
console.log('\n请求:', reqs.length);
reqs.forEach((r, i) => console.log(`  [${i}] ${r.m} ${r.s} ${r.u} | ${r.b.replace(/\s+/g, ' ').slice(0, 80)}`));

// 检查编号变化
const codes = await page.evaluate(() => [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length === 0 && e.offsetParent !== null).map(e => e.textContent.trim()))]);
console.log('当前编号:', codes);

await browser.close();
