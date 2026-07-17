// 发阶段是搜索型 basedata：输入"dev"看下拉选项
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

const stageField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
const stageInput = stageField.locator('input').first();

// 清空
await stageInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(400);

// 输入 dev
console.log('=== 输入 "dev" ===');
await stageInput.fill('dev');
await page.waitForTimeout(1500);

const opts1 = await page.locator('[class*="dropdown"] [class*="item"], [class*="popover"] [class*="item"]').allTextContents();
console.log('下拉选项:', JSON.stringify([...new Set(opts1)]));

// dump 选项元素的精确 class
const optInfo = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[class*="dropdown"] [class*="item"], [class*="popover"] [class*="item"]')].filter(e => e.offsetParent !== null);
  return els.slice(0, 5).map(e => ({ text: e.textContent?.trim().slice(0, 40), tag: e.tagName, class: e.className?.slice(0, 80) }));
});
console.log('选项元素详情:', JSON.stringify(optInfo, null, 2));

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// 再试 "测试"
console.log('\n=== 输入 "测试" ===');
await stageInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await stageInput.fill('测试');
await page.waitForTimeout(1500);
const opts2 = await page.locator('[class*="dropdown"] [class*="item"], [class*="popover"] [class*="item"]').allTextContents();
console.log('下拉选项:', JSON.stringify([...new Set(opts2)]));

await page.keyboard.press('Escape');
await browser.close();
