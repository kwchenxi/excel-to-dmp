import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const STORY_NUM = 'PRJ-00761367';

// 1. 搜索 PRJ-00761367（下拉打开）
console.log('搜索 PRJ-00761367...');
const field = page.locator('.kd-cq-field.kd-cq-basedata:visible', { hasText: '关联故事' }).first();
const inp = field.locator('input:visible').first();
await inp.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
await inp.fill(STORY_NUM);
await page.waitForTimeout(3000);

// 2. 调用 setItemByNumber
console.log('调用 setItemByNumber...');
const result = await page.evaluate((num) => {
  const f = [...document.querySelectorAll('.kd-cq-basedata')].find(x => x.offsetParent !== null && x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim().includes('关联故事'));
  if (!f) return { error: 'no field' };
  const fiberKey = Object.keys(f).find(k => k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber'));
  if (!fiberKey) return { error: 'no fiber' };
  let fiber = f[fiberKey];
  for (let i = 0; i < 20 && fiber; i++) {
    const inst = fiber.stateNode;
    if (inst && typeof inst === 'object' && typeof inst.setItemByNumber === 'function') {
      const r = inst.setItemByNumber(num);
      return { layer: i, ctor: inst.constructor?.name, returns: typeof r };
    }
    fiber = fiber.return;
  }
  return { error: 'method not found' };
}, STORY_NUM);

console.log('调用结果:', JSON.stringify(result));
await page.waitForTimeout(3000);

// 3. 检查
const check = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.kd-cq-basedata')].find(x => x.offsetParent !== null && x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim().includes('关联故事'));
  const tip = f?.querySelector('.kd-cq-field-valid-tip')?.textContent?.trim();
  return { value: f?.querySelector('input')?.value?.slice(0,20), tip: tip || '(无错误)' };
});
console.log('关联故事值:', check.value);
console.log('校验:', check.tip);

await page.keyboard.press('Escape');
await browser.close();
