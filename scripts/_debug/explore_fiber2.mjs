import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const result = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.kd-cq-basedata')].find(x => x.offsetParent !== null && x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim().includes('关联故事'));
  if (!f) return { error: 'no field' };

  // 找 fiber key（React 15 用 __reactInternalInstance$）
  const fiberKey = Object.keys(f).find(k => k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber'));
  if (!fiberKey) return { error: 'no fiber' };

  let fiber = f[fiberKey];
  const methods = {};
  for (let i = 0; i < 20 && fiber; i++) {
    const inst = fiber.stateNode;
    // 收集 stateNode 的方法
    if (inst && typeof inst === 'object' && inst !== f && !(inst instanceof window.HTMLElement)) {
      const ctorName = inst.constructor?.name || '?';
      const names = new Set();
      let o = inst;
      for (let j = 0; j < 8 && o; j++) {
        try { Object.getOwnPropertyNames(o).forEach(n => names.add(n)); } catch(e) {}
        o = Object.getPrototypeOf(o);
      }
      const fns = [...names].filter(n => {
        try { return typeof inst[n] === 'function' && /BaseData|selectItem|onSelect|choose|setItem|select$|setBaseData|setValue|onBase/i.test(n); } catch(e) { return false; }
      });
      if (fns.length) methods[`L${i}_${ctorName}`] = fns;
    }
    // 也检查 memoizedProps 的函数
    const props = fiber.memoizedProps || {};
    Object.keys(props).forEach(k => {
      try { if (typeof props[k] === 'function' && /select|basedata|choose|item/i.test(k)) methods[`L${i}_prop_${k}`] = true; } catch(e) {}
    });
    fiber = fiber.return;
  }
  return { methods, fiberKey: true };
});

console.log('找到的方法:');
console.log(JSON.stringify(result, null, 2));

await browser.close();
