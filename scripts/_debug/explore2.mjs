// 搜索下拉选项文本的 DOM 位置 + 点击发现阶段看变化
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 搜索"验收测试"和典型枚举值在 DOM 哪里
console.log('=== 搜索选项文本位置 ===');
const searchTexts = ['验收测试', '单元测试', '集成测试', '系统测试'];
const found = await page.evaluate((texts) => {
  const result = {};
  for (const t of texts) {
    const els = [...document.querySelectorAll('*')].filter(e => {
      const ct = e.textContent?.trim();
      // 叶子节点或包含少量子节点
      return ct && (ct === t || ct.startsWith(t)) && e.children.length <= 2;
    });
    result[t] = els.slice(0, 3).map(e => ({
      tag: e.tagName,
      class: e.className?.slice(0, 60),
      visible: e.offsetParent !== null,
      parentClass: e.parentElement?.className?.slice(0, 60),
      grandClass: e.parentElement?.parentElement?.className?.slice(0, 60)
    }));
  }
  return result;
}, searchTexts);
console.log(JSON.stringify(found, null, 2));

// 点击发现阶段 field 容器（不点 input）
console.log('\n=== 点击发现阶段容器 ===');
const stageContainer = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
await stageContainer.click();
await page.waitForTimeout(1500);

// 点击后再搜索"验收测试"
const afterClick = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => {
    const ct = e.textContent?.trim();
    return ct === '验收测试' && e.children.length === 0;
  });
  return els.map(e => ({
    tag: e.tagName,
    class: e.className?.slice(0, 60),
    visible: e.offsetParent !== null,
    rect: (() => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; })(),
    parentClass: e.parentElement?.className?.slice(0, 80)
  }));
});
console.log('点击后"验收测试"元素:', JSON.stringify(afterClick, null, 2));

await page.screenshot({ path: 'screenshots/explore_stage.png' });
await page.keyboard.press('Escape');
await browser.close();
