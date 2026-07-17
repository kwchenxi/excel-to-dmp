// 填关联故事 = 2508756100443247625（必填），然后重新保存
import { chromium } from 'playwright';
import fs from 'fs';

const STORY_ID = '2508756100443247625';
const row = parseInt(process.argv[2] || '118');
const doSave = process.argv.includes('--save');
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const responses = [];
if (doSave) {
  page.on('response', async (resp) => {
    if (resp.request().method() === 'POST') {
      try { const t = await resp.text(); responses.push({ url: resp.url().slice(-90), status: resp.status(), body: t?.slice(0,400) }); } catch(e) {}
    }
  });
}

// ===== 填关联故事 =====
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
console.log('=== 填关联故事 ===');
const storyField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '关联故事' }).first();
const storyInput = storyField.locator('input').first();
await storyInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(300);
await storyInput.fill(STORY_ID);
await page.waitForTimeout(1500);

// 看下拉选项
const storyOpts = await page.locator('.kd-cq-dropdown-menu-item').allTextContents();
console.log('关联故事下拉选项:', JSON.stringify([...new Set(storyOpts)].slice(0, 5)));

// 选第一个匹配（跳过"新增"）
try {
  const opt = page.locator('.kd-cq-dropdown-menu-item').filter({ hasNotText: '新增' }).first();
  const optText = await opt.textContent();
  await opt.click({ timeout: 3000 });
  console.log('✅ 已选关联故事:', optText?.trim().slice(0, 60));
} catch (e) {
  console.log('⚠️ 选择失败:', e.message.slice(0, 60));
  await page.keyboard.press('Enter');
}
await page.waitForTimeout(800);

// verify 关联故事 + 发阶段
const v = await page.evaluate(() => {
  const get = (labelText) => {
    const fields = [...document.querySelectorAll('.kd-cq-field')];
    for (const f of fields) {
      const title = f.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim();
      if (title === labelText || title === labelText + '*') {
        const inp = f.querySelector('input:not([type=hidden]):not([type=file])');
        const sel = f.querySelector('.ant-select-selection-item');
        return inp?.value || sel?.textContent?.trim() || '(空)';
      }
    }
    return '(未找到)';
  };
  return { 关联故事: get('关联故事'), 发现阶段: get('发现阶段'), 处理人: get('处理人') };
});
console.log('verify:', v);

if (!doSave) {
  console.log('\n⏸️  未传 --save。请确认关联故事已填。');
  await browser.close();
  process.exit(0);
}

// ===== 保存 =====
console.log('\n=== 保存 ===');
await page.evaluate(() => {
  const btn = document.querySelector('#bar_save');
  if (btn) btn.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
});
await page.waitForTimeout(8000);

const after = await page.evaluate(() => {
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0).map(e=>e.textContent.trim()))];
  const errs = [...document.querySelectorAll('[class*="valid-tip"],[class*="error"],[role="alert"]')].filter(e=>e.offsetParent!==null && e.textContent?.trim()).map(e=>e.textContent?.trim().slice(0,60));
  return { codes, url: location.href, errors: [...new Set(errs)].slice(0,5) };
});
console.log('编号:', after.codes);
console.log('URL:', after.url);
console.log('错误:', after.errors);
console.log('POST数:', responses.length);
responses.slice(-8).forEach((r,i) => console.log(`  [${i}] ${r.status} ${r.url.slice(-60)} body: ${r.body?.replace(/\s+/g,' ').slice(0,120)}`));

await page.screenshot({ path: 'screenshots/after_save_story.png' });

// 判断成功：编号出现且无"值不能为空"错误
const hasEmptyErr = after.errors.some(e => e.includes('不能为空') || e.includes('必填'));
if (!hasEmptyErr && after.codes.length > 0) {
  // 找保存 API 返回的编号
  const saveResp = responses.find(r => r.body && (r.body.includes('BT-') || r.body.includes('billno') || r.body.includes('number')));
  console.log('\n保存响应:', saveResp?.body?.replace(/\s+/g,' ').slice(0, 250) || '未明确');
  // 用页面编号（非 BT-02372944 预览）
  const realCode = after.codes.find(c => c !== 'BT-02372944') || after.codes[0];
  defect.status = 'created';
  defect.devops_id = realCode;
  fs.writeFileSync('pending_defects.json', JSON.stringify(defects, null, 2));
  console.log(`\n✅ 创建成功: ${realCode}`);
} else {
  console.log('\n❌ 保存失败，有必填校验错误');
}

await browser.close();
