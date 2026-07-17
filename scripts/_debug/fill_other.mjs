// 填除关联故事外的所有字段（row 参数），verify，不保存
import { chromium } from 'playwright';
import fs from 'fs';

const row = parseInt(process.argv[2] || '118');
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 1. 标题
console.log('[1] 标题');
const titleInput = page.locator('input[placeholder="名称不能为空"]').last();
await titleInput.click();
await titleInput.fill(defect.title);

// 2. 描述
console.log('[2] 描述');
const descHtml = '<p>' + defect.desc.replace(/\n/g, '</p><p>') + '</p>';
await page.evaluate((html) => {
  const ed = window.tinymce?.activeEditor || Object.values(window.tinymce?.editors || {})[0];
  if (ed) ed.setContent(html);
}, descHtml);

// 3. 处理人
console.log('[3] 处理人:', defect.handler_name);
const handlerField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '处理人' }).first();
const handlerInput = handlerField.locator('input').first();
await handlerInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
await handlerInput.fill(defect.handler_name);
await page.waitForTimeout(1200);
await page.locator('.kd-cq-dropdown-menu-item', { hasText: defect.handler_name }).first().click();
await page.waitForTimeout(500);

// 4. 发现阶段
console.log('[4] 发阶段: dev测试');
const stageField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
const stageInput = stageField.locator('input').first();
await stageInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
await stageInput.fill('dev');
await page.waitForTimeout(1200);
await page.locator('.kd-cq-dropdown-menu-item', { hasText: 'dev测试' }).first().click();
await page.waitForTimeout(500);

// 5. 备注
console.log('[5] 备注');
const noteField = page.locator('.kd-cq-field.kd-cq-textarea', { hasText: '备注' }).first();
await noteField.locator('textarea').first().fill(defect.note);

// verify
const v = await page.evaluate(() => {
  const get = (lt) => {
    const f = [...document.querySelectorAll('.kd-cq-field')].find(x => {
      const t = x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim();
      return t === lt || t === lt + '*';
    });
    if (!f) return '(无)';
    return f.querySelector('input')?.value || f.querySelector('textarea')?.value || '(空)';
  };
  return { 标题: get('标题'), 处理人: get('处理人'), 发阶段: get('发现阶段'), 关联故事: get('关联故事'), 备注: get('备注') };
});
console.log('\nverify:', v);
console.log('\n⏸️ 除关联故事外已填。请手动选关联故事，或告诉我故事编码。');

await page.screenshot({ path: 'screenshots/filled_no_story.png' });
await browser.close();
