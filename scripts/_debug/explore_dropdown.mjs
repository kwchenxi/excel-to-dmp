// 探测发现阶段和模块路径的下拉结构
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// ===== 清空发现阶段当前输入，重新点击展开 =====
console.log('=== 发现阶段下拉探测 ===');
const stageField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
const stageInput = stageField.locator('input').first();
// 先 ESC/点击别处关闭当前下拉
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// 清空
await stageInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(300);
// 点击展开（只点击，不输入）
await stageInput.click();
await page.waitForTimeout(1000);

// dump 所有可见的下拉/弹出层
const stageDropdown = await page.evaluate(() => {
  const popups = document.querySelectorAll('[class*="dropdown"], [class*="popover"], [class*="popup"], [class*="overlay"], [role="listbox"], [role="menu"], [class*="kd-cq-popover"]');
  const visible = [];
  popups.forEach(p => {
    const r = p.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && p.textContent?.trim()) {
      visible.push({
        class: p.className?.slice(0, 80),
        text: p.textContent?.trim().slice(0, 200),
        tag: p.tagName
      });
    }
  });
  return visible;
});
console.log('发现阶段展开后可见弹出层:');
stageDropdown.forEach((d, i) => console.log(`  [${i+1}] ${d.tag} class="${d.class}"\n      text: ${d.text.slice(0, 120)}`));

await page.keyboard.press('Escape');

// ===== 模块路径下拉探测 =====
console.log('\n=== 模块路径下拉探测 ===');
// 定位模块路径 select
const moduleLabel = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')];
  const el = els.find(e => e.textContent?.trim() === '模块路径' && e.children.length <= 1);
  return el ? true : false;
});
console.log('模块路径 label 存在:', moduleLabel);

// 点击模块路径（通过它的容器）
const moduleContainer = page.locator('text=模块路径').locator('xpath=ancestor::*[contains(@class,"kd-cq-container")][1]');
await moduleContainer.click();
await page.waitForTimeout(1000);

const moduleDropdown = await page.evaluate(() => {
  const popups = document.querySelectorAll('[class*="dropdown"], [class*="popover"], [class*="popup"], [class*="overlay"], [role="listbox"], [role="menu"], .kd-cq-select-dropdown');
  const visible = [];
  popups.forEach(p => {
    const r = p.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && p.textContent?.trim()) {
      visible.push({
        class: p.className?.slice(0, 80),
        text: p.textContent?.trim().slice(0, 300),
        tag: p.tagName
      });
    }
  });
  return visible;
});
console.log('模块路径展开后可见弹出层:');
moduleDropdown.forEach((d, i) => console.log(`  [${i+1}] ${d.tag} class="${d.class}"\n      text: ${d.text.slice(0, 150)}`));

await page.keyboard.press('Escape');
await browser.close();
