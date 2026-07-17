import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const reqs = [];
page.on('response', async (r) => {
  try { const t = await r.text(); reqs.push({ m: r.request().method(), u: r.url().slice(-45), s: r.status(), b: t.slice(0, 80) }); } catch(e) {}
});

const before = await page.evaluate(() => [...document.querySelectorAll('*')].find(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length === 0 && e.offsetParent !== null)?.textContent?.trim());

const result = await page.evaluate(() => {
  const btn = document.querySelector('#bar_save');
  const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber'));
  let fiber = btn[fiberKey];
  for (let i = 0; i < 30 && fiber; i++) {
    const inst = fiber.stateNode;
    if (inst && typeof inst.invokeControlMethods === 'function') {
      const sig = inst.invokeControlMethods.toString().slice(0, 200);
      const tries = [];
      try { inst.invokeControlMethods('save'); tries.push("('save') ok"); } catch(e) { tries.push("('save') err:" + e.message.slice(0, 40)); }
      return { layer: i, sig, tries };
    }
    fiber = fiber.return;
  }
  return 'not found';
});
console.log('invokeControlMethods:', JSON.stringify(result).slice(0, 400));

await page.waitForTimeout(10000);
console.log('\n请求:', reqs.length);
reqs.forEach((r, i) => console.log(`  [${i}] ${r.m} ${r.s} ${r.u} | ${r.b.replace(/\s+/g, ' ').slice(0, 70)}`));

const after = await page.evaluate(() => [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length === 0 && e.offsetParent !== null).map(e => e.textContent.trim()))]);
console.log('编号:', before, '->', after);

await browser.close();
