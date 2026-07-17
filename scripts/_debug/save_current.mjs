// 直接保存当前表单，测试关联故事是否真的必填
import { chromium } from 'playwright';
import fs from 'fs';

const row = parseInt(process.argv[2] || '118');
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 保存前的编码（预览编号）
const beforeCode = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0 && e.offsetParent!==null);
  return el?.textContent?.trim() || '';
});
console.log('保存前编码:', beforeCode);

// 先检查当前哪些必填字段空
const required = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.kd-cq-field').forEach(f => {
    const title = f.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim() || '';
    if (!title.includes('*')) return;
    const inp = f.querySelector('input:not([type=hidden]):not([type=file])');
    const ta = f.querySelector('textarea');
    const val = (ta?.value || inp?.value || '').trim();
    if (!val) out.push(title);
  });
  return out;
});
console.log('当前空的必填字段:', required);

// 监听保存 API
const responses = [];
page.on('response', async (r) => {
  if (r.request().method() === 'POST') {
    try { const t = await r.text(); if (t && t.length < 10000) responses.push({ url: r.url().slice(-70), status: r.status(), body: t.slice(0, 500) }); } catch(e) {}
  }
});

console.log('\n触发 #bar_save...');
await page.evaluate(() => document.querySelector('#bar_save')?.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true})));
await page.waitForTimeout(8000);

const after = await page.evaluate(() => {
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0 && e.offsetParent!==null).map(e => e.textContent.trim()))];
  const errs = [...new Set([...document.querySelectorAll('[class*="valid-tip"],[role="alert"],[class*="error"]')].filter(e => e.offsetParent!==null && e.textContent?.trim()).map(e => e.textContent.trim().slice(0, 50)))];
  return { codes, errs, url: location.href };
});
console.log('保存后编码:', after.codes);
console.log('URL:', after.url.slice(-50));
console.log('错误:', after.errs);

// 找保存 API（含 billno/BT-/success/data）
const saveApi = responses.find(r => r.body && /BT-\d|billno|"success"|"data"\s*:\s*\[/i.test(r.body));
console.log('保存API响应:', saveApi ? `${saveApi.status} ${saveApi.body.replace(/\s+/g,' ').slice(0,250)}` : '未识别');
console.log('所有POST:', responses.length, '个');

await page.screenshot({ path: 'screenshots/save_test.png' });

// 判断成功
const emptyErr = after.errs.some(e => e.includes('不能为空') || e.includes('必填') || e.includes(' required'));
if (!emptyErr && after.codes.length > 0) {
  const newCode = after.codes.find(c => c !== beforeCode) || after.codes[0];
  defect.status = 'created';
  defect.devops_id = newCode;
  fs.writeFileSync('pending_defects.json', JSON.stringify(defects, null, 2));
  console.log(`\n✅✅✅ 创建成功: ${newCode}（关联故事非必填，确认！）`);
} else {
  console.log('\n❌ 仍有必填空字段或失败');
}

await browser.close();
