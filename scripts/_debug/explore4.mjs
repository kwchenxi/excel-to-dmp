// 清空发现阶段，点击展开，用 DOM 前后对比定位下拉
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// 清空发现阶段 input
const stageField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
const stageInput = stageField.locator('input').first();
await stageInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(400);
console.log('清空后发现阶段:', await stageInput.inputValue());

// 记录点击前的 body 子元素数
const beforeCount = await page.evaluate(() => document.querySelectorAll('body *').length);
console.log('点击前 body 元素数:', beforeCount);

// 点击发现阶段 input 展开下拉
await stageInput.click();
await page.waitForTimeout(2000);

const afterCount = await page.evaluate(() => document.querySelectorAll('body *').length);
console.log('点击后 body 元素数:', afterCount, '(新增', afterCount - beforeCount, ')');

// dump body 末尾 20 个元素（portal 下拉通常加在 body 末尾）
const tail = await page.evaluate(() => {
  const all = [...document.querySelectorAll('body *')];
  return all.slice(-25).map(el => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      class: el.className?.slice(0, 70),
      text: el.textContent?.trim().slice(0, 60),
      visible: r.width > 0 && r.height > 0,
      x: Math.round(r.x), y: Math.round(r.y)
    };
  });
});
console.log('\nbody 末尾 25 个元素:');
tail.forEach((t, i) => console.log(`  ${t.visible?'👁':'  '} <${t.tag}> "${t.text.slice(0,30)}" class="${t.class?.slice(0,40)}" @(${t.x},${t.y})`));

// 找所有可见的、文本是已知选项的元素
const knownOpts = await page.evaluate(() => {
  const opts = ['release测试','dev测试','灰度发布','编码&自测','sit测试','发布完成'];
  const found = [];
  for (const o of opts) {
    const els = [...document.querySelectorAll('*')].filter(e => e.textContent?.trim() === o && e.offsetParent !== null);
    els.forEach(e => {
      const r = e.getBoundingClientRect();
      found.push({ text: o, tag: e.tagName, class: e.className?.slice(0,60), parent: e.parentElement?.className?.slice(0,60), x: Math.round(r.x), y: Math.round(r.y) });
    });
  }
  return found;
});
console.log('\n已知选项元素:', JSON.stringify(knownOpts, null, 2));

await page.screenshot({ path: 'screenshots/explore4_stage.png' });
await page.keyboard.press('Escape');
await browser.close();
