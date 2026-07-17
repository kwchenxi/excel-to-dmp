import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 找平台相关的全局对象
const globals = await page.evaluate(() => {
  const keys = Object.keys(window).filter(k => /kd|bos|form|basedata|select|story/i.test(k));
  const result = {};
  keys.slice(0, 30).forEach(k => {
    const v = window[k];
    if (typeof v === 'object' && v !== null) {
      const methods = Object.getOwnPropertyNames(v).filter(n => typeof v[n] === 'function').slice(0, 10);
      result[k] = { type: v.constructor?.name, methods };
    } else if (typeof v === 'function') {
      result[k] = { type: 'function' };
    } else {
      result[k] = { type: typeof v };
    }
  });
  return result;
});
console.log('平台全局对象:');
Object.entries(globals).forEach(([k, v]) => console.log(`  ${k}: ${v.type} ${v.methods ? v.methods.join(', ') : ''}`));

// 找关联故事 field 上的组件引用
const compRef = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.kd-cq-basedata')].find(x => x.offsetParent !== null && x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim().includes('关联故事'));
  if (!f) return 'field not found';
  const props = {};
  Object.getOwnPropertyNames(f).filter(k => k.startsWith('__') || k.startsWith('_')).forEach(k => {
    props[k] = typeof f[k];
  });
  return props;
});
console.log('\n关联故事 field 组件引用:', JSON.stringify(compRef).slice(0, 500));

// 尝试找表单数据 store
const store = await page.evaluate(() => {
  const keys = Object.keys(window).filter(k => /store|model|state|data|form/i.test(k));
  return keys.slice(0, 20);
});
console.log('\n可能 store:', store.join(', '));

await browser.close();
