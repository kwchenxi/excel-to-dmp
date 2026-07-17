import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const STORY_NUMBER = 'PRJ-00761367';

// 找到关联故事组件实例的 setItemByNumber 并调用
const callResult = await page.evaluate((storyNum) => {
  const f = [...document.querySelectorAll('.kd-cq-basedata')].find(x => x.offsetParent !== null && x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim().includes('关联故事'));
  if (!f) return { error: 'no field' };
  const fiberKey = Object.keys(f).find(k => k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber'));
  if (!fiberKey) return { error: 'no fiber' };

  let fiber = f[fiberKey];
  const found = [];
  for (let i = 0; i < 20 && fiber; i++) {
    const inst = fiber.stateNode;
    if (inst && typeof inst === 'object' && !(inst instanceof window.HTMLElement)) {
      // 列出所有可用方法
      if (typeof inst.setItemByNumber === 'function') {
        found.push({ layer: i, ctor: inst.constructor?.name, hasSetItemByNumber: true });
        // dump setItemByNumber 签名
        const sig = inst.setItemByNumber.toString().slice(0, 200);
        found.push({ sig });
        // 调用
        try {
          const r = inst.setItemByNumber(storyNum);
          found.push({ called: true, returns: typeof r });
        } catch(e) {
          found.push({ callError: e.message });
        }
        break;
      }
    }
    fiber = fiber.return;
  }
  return found;
}, STORY_NUMBER);

console.log('setItemByNumber 调用结果:');
console.log(JSON.stringify(callResult, null, 2));

await page.waitForTimeout(3000);

// 检查关联故事值 + 校验
const check = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.kd-cq-basedata')].find(x => x.offsetParent !== null && x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim().includes('关联故事'));
  const inp = f?.querySelector('input');
  // 校验提示
  const tip = f?.querySelector('.kd-cq-field-valid-tip')?.textContent?.trim();
  return { value: inp?.value, tip: tip || '(无错误)' };
});
console.log('\n关联故事值:', check.value);
console.log('校验:', check.tip);

await browser.close();
