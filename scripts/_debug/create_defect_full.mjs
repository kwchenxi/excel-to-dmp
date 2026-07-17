// 完整创建一条缺陷：填所有字段 + 保存 + 取编号 + 更新 json
// 用法: node scripts/create_defect_full.mjs <row> [--save] [--story-name <名称>]
import { chromium } from 'playwright';
import fs from 'fs';

const row = parseInt(process.argv[2] || '118');
const doSave = process.argv.includes('--save');
const storyNameIdx = process.argv.indexOf('--story-name');
const storyName = storyNameIdx > -1 ? process.argv[storyNameIdx + 1] : null;
const STORY_ID = '2508756100443247625';

const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);
if (!defect) { console.error('找不到 row', row); process.exit(1); }

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 找到"真表单"容器：含"项目名称*=灵基AIOS项目"的字段
const formScope = page.locator('.kd-cq-basedata', { hasText: '灵基AIOS项目' }).first();
// 真表单的根容器（往上找包含所有字段的 form）
const rootForm = formScope.locator('xpath=ancestor::*[contains(@class,"kd-cq-formpanel") or contains(@class,"page-content") or contains(@class,"form-container")][1]').first();

// helper: 在真表单范围内按 label 找 field
const findField = (label) => rootForm.locator('.kd-cq-field', { hasText: label }).first();
const findFieldInput = async (label) => {
  const f = findField(label);
  const inp = f.locator('input:not([type=hidden]):not([type=file])').first();
  await inp.waitFor({ state: 'visible', timeout: 5000 });
  return inp;
};

// ===== 1. 标题 =====
console.log('[1] 标题');
const titleInput = page.locator('input[placeholder="名称不能为空"]').last();
await titleInput.click();
await titleInput.fill(defect.title);

// ===== 2. 描述 (TinyMCE) =====
console.log('[2] 描述');
const descHtml = '<p>' + defect.desc.replace(/\n/g, '</p><p>') + '</p>';
await page.evaluate((html) => {
  const ed = window.tinymce?.activeEditor || Object.values(window.tinymce?.editors || {})[0];
  if (ed) ed.setContent(html);
}, descHtml);

// ===== 3. 处理人 =====
console.log('[3] 处理人:', defect.handler_name);
const handlerInput = await findFieldInput('处理人');
await handlerInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
await handlerInput.fill(defect.handler_name);
await page.waitForTimeout(1200);
await page.locator('.kd-cq-dropdown-menu-item', { hasText: defect.handler_name }).first().click();
await page.waitForTimeout(500);

// ===== 4. 发现阶段 = dev测试 =====
console.log('[4] 发阶段: dev测试');
const stageInput = await findFieldInput('发现阶段');
await stageInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
await stageInput.fill('dev');
await page.waitForTimeout(1200);
await page.locator('.kd-cq-dropdown-menu-item', { hasText: 'dev测试' }).first().click();
await page.waitForTimeout(500);

// ===== 5. 备注 =====
console.log('[5] 备注');
const noteField = rootForm.locator('.kd-cq-textarea', { hasText: '备注' }).first();
await noteField.locator('textarea').first().fill(defect.note);

// ===== 6. 关联故事 =====
console.log('[6] 关联故事:', storyName || STORY_ID);
const storyInput = await findFieldInput('关联故事');
await storyInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
const storyKeyword = storyName || STORY_ID;
await storyInput.fill(storyKeyword);
await page.waitForTimeout(2000);
const storyOpts = await page.locator('.kd-cq-dropdown-menu-item').allTextContents();
console.log('  故事下拉:', [...new Set(storyOpts)].slice(0, 4));
try {
  const pick = storyName
    ? page.locator('.kd-cq-dropdown-menu-item', { hasText: storyName }).first()
    : page.locator('.kd-cq-dropdown-menu-item').filter({ hasNotText: '新增' }).first();
  await pick.click({ timeout: 3000 });
  console.log('  已选关联故事');
} catch (e) { console.log('  ⚠️ 选故事失败:', e.message.slice(0, 50)); }
await page.waitForTimeout(600);

// ===== verify =====
const v = await page.evaluate(() => {
  const get = (lt) => {
    const f = [...document.querySelectorAll('.kd-cq-field')].find(x => {
      const t = x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim();
      return t === lt || t === lt + '*';
    });
    if (!f) return '(无)';
    return f.querySelector('input')?.value || f.querySelector('textarea')?.value || '(空)';
  };
  return { 标题: get('标题'), 处理人: get('处理人'), 发阶段: get('发现阶段'), 关联故事: get('关联故事') };
});
console.log('verify:', v);

if (!doSave) { console.log('\n⏸️ 未 --save，不保存。'); await page.screenshot({ path: 'screenshots/full_ready.png' }); await browser.close(); process.exit(0); }

// ===== 保存 =====
console.log('\n[7] 保存');
const responses = [];
page.on('response', async (r) => { if (r.request().method()==='POST') { try { const t=await r.text(); responses.push({url:r.url().slice(-70),status:r.status(),body:t?.slice(0,400)}); } catch(e){} } });
await page.evaluate(() => document.querySelector('#bar_save')?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
await page.waitForTimeout(8000);

const after = await page.evaluate(() => {
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e=>/^BT-\d+$/.test(e.textContent?.trim()||'')&&e.children.length===0).map(e=>e.textContent.trim()))];
  const errs = [...new Set([...document.querySelectorAll('[class*="valid-tip"],[role="alert"]')].filter(e=>e.offsetParent!==null&&e.textContent?.trim()).map(e=>e.textContent.trim().slice(0,50)))];
  return { codes, errs };
});
console.log('编号:', after.codes, '错误:', after.errs);
const saveApi = responses.find(r => r.body && /BT-|billno|success/i.test(r.body));
console.log('保存API:', saveApi?.body?.replace(/\s+/g,' ').slice(0,200) || '未明确');
await page.screenshot({ path: 'screenshots/full_saved.png' });

const emptyErr = after.errs.some(e => e.includes('不能为空'));
if (!emptyErr) {
  const code = after.codes.find(c => c !== 'BT-02372944') || after.codes[0];
  defect.status = 'created'; defect.devops_id = code;
  fs.writeFileSync('pending_defects.json', JSON.stringify(defects, null, 2));
  console.log(`\n✅ 成功: ${code}`);
} else { console.log('\n❌ 仍有必填空'); }
await browser.close();
