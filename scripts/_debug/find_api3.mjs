// 沿 fiber.return 链找关联故事组件实例的方法
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const apiInfo = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.kd-cq-basedata')];
  let target = null;
  for (const f of fields) {
    const title = f.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim();
    if ((title === '关联故事' || title === '关联故事*') && f.querySelector('input')) { target = f; break; }
  }
  if (!target) return { error: 'no field' };
  const fk = Object.keys(target).find(k => k.startsWith('__reactFiber'));
  if (!fk) return { error: 'no fiber' };
  let fiber = target[fk];
  const methods = {};
  for (let i = 0; i < 15 && fiber; i++) {
    const inst = fiber.stateNode;
    if (inst && typeof inst === 'object' && inst !== target && !(inst instanceof window.HTMLElement) && inst !== window) {
      const names = new Set();
      let o = inst;
      for (let j = 0; j < 6 && o; j++) { try { Object.getOwnPropertyNames(o).forEach(n => names.add(n)); } catch(e){} o = Object.getPrototypeOf(o); }
      const fns = [...names].filter(n => { try { return typeof inst[n] === 'function' && /BaseData|selectItem|onSelect|choose|setItem|select|basedata/i.test(n); } catch(e){ return false; } });
      if (fns.length) methods['L' + i + '_' + (inst.constructor?.name || '?')] = fns;
    }
    fiber = fiber.return;
  }
  return methods;
});

console.log('组件方法:');
console.log(JSON.stringify(apiInfo, null, 2));

// 也检查 window 上是否有全局的 basedata 辅助
const globalApi = await page.evaluate(() => {
  const keys = Object.keys(window).filter(k => /basedata|defect|form/i.test(k));
  return keys.slice(0, 20);
});
console.log('\nwindow 相关:', globalApi);

await browser.close();
