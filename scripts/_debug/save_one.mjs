// 填发现阶段=dev测试 + verify（传 --save 才真正保存）
import { chromium } from 'playwright';
import fs from 'fs';

const row = parseInt(process.argv[2] || '118');
const doSave = process.argv.includes('--save');
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 监听保存 API 响应
let saveResp = null;
if (doSave) {
  page.on('response', async (resp) => {
    const url = resp.url();
    const m = resp.request().method();
    if (m === 'POST' && (url.includes('defect') || url.includes('save') || url.includes('add') || url.includes('bizObject'))) {
      try { const t = await resp.text(); if (t && t.length < 8000) saveResp = { url: url.slice(-60), status: resp.status(), body: t.slice(0, 600) }; } catch(e) {}
    }
  });
}

// ===== 填发现阶段 = dev测试 =====
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const stageField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
const stageInput = stageField.locator('input').first();
await stageInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(300);
await stageInput.fill('dev');
await page.waitForTimeout(1200);
const devOpt = page.locator('.kd-cq-dropdown-menu-item', { hasText: 'dev测试' }).first();
await devOpt.click();
await page.waitForTimeout(600);
console.log('发现阶段:', await stageInput.inputValue());

// ===== verify 所有关键字段 =====
const v = await page.evaluate(() => {
  const get = (labelText) => {
    const fields = [...document.querySelectorAll('.kd-cq-field, .kd-cq-container.kd-cq-flexpanel')];
    for (const f of fields) {
      const title = f.querySelector('.kd-cq-field-title-wrap, .kd-cq-label')?.textContent?.trim();
      if (title === labelText || title === labelText + '*') {
        const inp = f.querySelector('input:not([type=hidden]):not([type=file])');
        const ta = f.querySelector('textarea');
        const sel = f.querySelector('.ant-select-selection-item, [class*="selected-value"]');
        return ta?.value || inp?.value || sel?.textContent?.trim() || '';
      }
    }
    return '(未找到)';
  };
  let desc = '';
  try { desc = (window.tinymce?.activeEditor?.getContent({format:'text'}) || '').slice(0, 40); } catch(e) {}
  return {
    标题: get('标题'),
    处理人: get('处理人'),
    发现阶段: get('发现阶段'),
    模块路径: get('模块路径'),
    项目名称: get('项目名称'),
    缺陷类型: get('缺陷类型'),
    优先级: get('优先级'),
    来源: get('来源'),
    测试环境: get('测试环境'),
    备注: get('备注'),
    描述: desc
  };
});
console.log('\n=== verify ===');
for (const [k, val] of Object.entries(v)) console.log(`  ${k}: ${val?.slice(0, 50) || '(空)'}`);

if (!doSave) {
  console.log('\n⏸️  未传 --save，未保存。请核对 verify 结果。');
  await page.screenshot({ path: 'screenshots/ready_to_save.png' });
  await browser.close();
  process.exit(0);
}

// ===== 保存 =====
console.log('\n=== 保存 ===');
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button,[role="button"],.ant-btn,.kd-btn,a')];
  const btn = btns.find(b => b.textContent?.trim() === '保存' && b.offsetParent !== null);
  if (btn) { btn.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true})); return 'clicked'; }
  return 'not found';
}).then(r => console.log('保存按钮:', r));

await page.waitForTimeout(6000);

// 获取编号 + 检查错误
const after = await page.evaluate(() => {
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0).map(e=>e.textContent.trim()))];
  // 错误提示
  const errs = [...document.querySelectorAll('[class*="error"],[class*="message"],.ant-message,[role="alert"]')].filter(e=>e.offsetParent!==null).map(e=>e.textContent?.trim().slice(0,80));
  return { codes, url: location.href, errors: [...new Set(errs)].slice(0,5) };
});
console.log('保存后编号:', after.codes);
console.log('URL:', after.url);
console.log('错误提示:', after.errors);
console.log('保存API:', saveResp ? `${saveResp.status} ${saveResp.body.slice(0,150)}` : '无捕获');

await page.screenshot({ path: 'screenshots/after_save.png' });

// 如果有编号，更新 json
if (after.codes.length > 0) {
  const code = after.codes[0];
  if (code !== 'BT-02372944') {  // 不是预览编号，说明保存成功分配了新编号
    defect.status = 'created';
    defect.devops_id = code;
    fs.writeFileSync('pending_defects.json', JSON.stringify(defects, null, 2));
    console.log(`\n✅ 创建成功: ${code}，已更新 pending_defects.json`);
  } else {
    console.log('\n⚠️  编号未变，保存可能失败');
  }
}

await browser.close();
