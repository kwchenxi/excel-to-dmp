// 深度遍历关联故事的 React fiber，找 onBaseDataSelectItem 等方法
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const apiInfo = await page.evaluate(() => {
  // 找关联故事的 field（优先有 input 的）
  const fields = [...document.querySelectorAll('.kd-cq-basedata')];
  let target = null;
  for (const f of fields) {
    const title = f.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim();
    if ((title === '关联故事' || title === '关联故事*') && f.querySelector('input')) { target = f; break; }
  }
  if (!target) return { error: 'no 关联故事 field with input' };

  const fiberKey = Object.keys(target).find(k => k.startsWith('__reactFiber'));
  if (!fiberKey) return { error: 'no fiber on field' };
  let fiber = target[fiberKey];

  const methods = new Set();
  const visited = new Set();
  const stack = [fiber];
  while (stack.length && visited.size < 500) {
    const f = stack.pop();
    if (!f || visited.has(f)) continue;
    visited.add(f);
    const inst = f.stateNode;
    if (inst && typeof inst === 'object' && inst !== target && inst !== window) {
      // 实例自身 + 原型链方法
      const tryNames = (obj) => {
        if (!obj) return;
        Object.getOwnPropertyNames(obj).forEach(n => {
          try { if (typeof obj[n] === 'function' && /BaseData|selectItem|onSelect|choose|setItem|select$/i.test(n)) methods.add(n + ':' + (obj.constructor?.name || '?')); } catch(e){}
        });
      };
      tryNames(inst);
      let p = inst;
      for (let i = 0; i < 4; i++) { p = Object.getPrototypeOf(p); if (!p) break; tryNames(p); }
    }
    const props = f.memoizedProps || {};
    Object.keys(props).forEach(k => { try { if (typeof props[k] === 'function' && /select|basedata|choose|item/i.test(k)) methods.add('prop:' + k); } catch(e){} });
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }
  return { methods: [...methods], visitedCount: visited.size };
});

console.log('找到的方法:', JSON.stringify(apiInfo.methods, null, 2));
console.log('遍历节点数:', apiInfo.visitedCount);

await browser.close();
