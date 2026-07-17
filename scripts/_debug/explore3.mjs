// 点击发现阶段，定位下拉选项的真实 DOM 结构
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

await page.keyboard.press('Escape');
await page.waitForTimeout(500);

console.log('=== 点击发现阶段 ===');
const stageField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
await stageField.click();
await page.waitForTimeout(1500);

// 搜索含关键词的可见元素
const opts = await page.evaluate(() => {
  const keywords = ['dev', 'sit', 'release', '灰度', '自测', '发布完成', '测试'];
  const result = [];
  const all = document.querySelectorAll('*');
  for (const el of all) {
    if (el.children.length > 1) continue;  // 叶子或近叶子
    const ct = el.textContent?.trim();
    if (!ct || ct.length > 20) continue;
    if (el.offsetParent === null) continue;  // 不可见
    if (keywords.some(k => ct.includes(k))) {
      const r = el.getBoundingClientRect();
      // 排除表单本身的字段值（只看下拉区域的）
      result.push({
        text: ct,
        tag: el.tagName,
        class: el.className?.slice(0, 70),
        parentClass: el.parentElement?.className?.slice(0, 70),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }
      });
    }
  }
  // 去重（按 text+parent）
  const seen = new Set();
  return result.filter(r => {
    const k = r.text + r.parentClass;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
});
console.log('含关键词的可见元素:');
opts.forEach((o, i) => console.log(`  [${i+1}] "${o.text}" <${o.tag}> class="${o.class}" parent="${o.parentClass}" @(${o.rect.x},${o.rect.y})`));

// 额外：找最可能是下拉容器的元素（body 直接或深层子元素，position absolute）
const dropdownContainers = await page.evaluate(() => {
  const result = [];
  document.querySelectorAll('[class*="dropdown"],[class*="popover"],[class*="popup"],[class*="overlay"],[class*="select"][class*="option"],[role="listbox"],[role="option"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el.textContent?.trim()) {
      result.push({ class: el.className?.slice(0, 80), text: el.textContent?.trim().slice(0, 100), rect: { x: Math.round(r.x), y: Math.round(r.y) } });
    }
  });
  return result.slice(0, 10);
});
console.log('\n疑似下拉容器:');
dropdownContainers.forEach((d, i) => console.log(`  [${i+1}] class="${d.class}" text="${d.text}" @(${d.rect.x},${d.rect.y})`));

await page.screenshot({ path: 'screenshots/explore3_stage.png' });
await page.keyboard.press('Escape');
await browser.close();
