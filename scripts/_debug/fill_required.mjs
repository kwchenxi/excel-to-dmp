// 补填发现阶段 + 探测模块路径真实值
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// ===== 探测模块路径真实选中值 =====
console.log('=== 模块路径探测 ===');
const moduleInfo = await page.evaluate(() => {
  // 找模块路径的 select 容器
  const allEls = [...document.querySelectorAll('*')];
  const labelEl = allEls.find(el => el.textContent?.trim() === '模块路径' && el.children.length <= 1);
  if (!labelEl) return { error: '找不到模块路径 label' };
  let container = labelEl;
  for (let i = 0; i < 5; i++) {
    container = container.parentElement;
    if (container?.querySelector('.ant-select, input[type="search"]')) break;
  }
  const selItem = container?.querySelector('.ant-select-selection-item, .ant-select-selection-selected-value, [class*="selected"]');
  const input = container?.querySelector('input');
  return {
    selectionItem: selItem?.textContent?.trim(),
    selectionClass: selItem?.className?.slice(0, 60),
    inputValue: input?.value,
    inputId: input?.id
  };
});
console.log('模块路径选中值:', moduleInfo.selectionItem || '(空)');
console.log('  input value:', moduleInfo.inputValue, 'id:', moduleInfo.inputId);

// ===== 填发现阶段 = 验收测试 =====
console.log('\n=== 填发现阶段 ===');
const stageField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
const stageInput = stageField.locator('input').first();
await stageInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
await stageInput.fill('验收测试');
await page.waitForTimeout(1000);
// 看下拉选项
const stageOptions = await page.locator('[class*="dropdown"] [class*="item"], .kd-cq-dropdown-item, .ant-select-item, [class*="popover"] [class*="item"]').allTextContents();
console.log('发现阶段下拉选项:', [...new Set(stageOptions)].slice(0, 10));
// 选择验收测试
try {
  const opt = page.locator('[class*="dropdown"] [class*="item"], .kd-cq-dropdown-item, .ant-select-item, [class*="popover"] [class*="item"]', { hasText: '验收测试' }).first();
  await opt.click({ timeout: 3000 });
  console.log('✅ 已选发现阶段');
} catch (e) {
  console.log('⚠️ 选择失败:', e.message.slice(0, 60));
  await page.keyboard.press('Enter');
}
await page.waitForTimeout(500);
console.log('发现阶段现为:', await stageInput.inputValue());

await page.screenshot({ path: 'screenshots/step_stage.png' });
await browser.close();
