import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const result = await page.evaluate(() => {
  const btn = document.querySelector('#bar_save');
  if (!btn) return 'no btn';
  const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber'));
  if (!fiberKey) return 'no fiber';
  let fiber = btn[fiberKey];
  const methods = {};
  for (let i = 0; i < 30 && fiber; i++) {
    const inst = fiber.stateNode;
    if (inst && typeof inst === 'object' && !(inst instanceof window.HTMLElement)) {
      const ctor = inst.constructor?.name || '?';
      const names = new Set();
      let o = inst;
      for (let j = 0; j < 8 && o; j++) { try { Object.getOwnPropertyNames(o).forEach(n => names.add(n)); } catch(e){} o = Object.getPrototypeOf(o); }
      const fns = [...names].filter(n => { try { return typeof inst[n] === 'function' && /save|submit|commit|persist|doSave|onSave|invoke/i.test(n); } catch(e){return false;} });
      if (fns.length) methods[`L${i}_${ctor}`] = fns;
    }
    fiber = fiber.return;
  }
  return methods;
});
console.log('表单相关方法:');
console.log(JSON.stringify(result, null, 2));

await browser.close();
