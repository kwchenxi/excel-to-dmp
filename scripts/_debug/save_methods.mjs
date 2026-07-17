// 尝试多种保存方式：⌘+S 快捷键 / 真实 click / 完整事件序列
import { chromium } from 'playwright';
import fs from 'fs';

const row = parseInt(process.argv[2] || '118');
const method = process.argv[3] || 'shortcut'; // shortcut | click | events
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const beforeCode = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0 && e.offsetParent!==null);
  return el?.textContent?.trim() || '';
});
console.log('保存前编码:', beforeCode, '| 方法:', method);

const responses = [];
page.on('response', async (r) => {
  if (r.request().method() === 'POST') {
    try { const t = await r.text(); responses.push({ url: r.url().slice(-60), status: r.status(), body: t.slice(0,400) }); } catch(e) {}
  }
});

// 确保焦点在表单
await page.locator('input[placeholder="名称不能为空"]').last().click();
await page.waitForTimeout(300);

if (method === 'shortcut') {
  console.log('按 Meta+S...');
  await page.keyboard.press('Meta+S');
} else if (method === 'click') {
  console.log('真实 click #bar_save...');
  try { await page.locator('#bar_save').click({ timeout: 5000 }); } catch(e) { console.log('click 失败:', e.message.slice(0,60)); }
} else if (method === 'events') {
  console.log('完整事件序列...');
  await page.evaluate(() => {
    const btn = document.querySelector('#bar_save');
    ['mousedown','mouseup','click'].forEach(t => btn.dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, view:window})));
  });
}

await page.waitForTimeout(8000);

const after = await page.evaluate(() => {
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0 && e.offsetParent!==null).map(e => e.textContent.trim()))];
  const errs = [...new Set([...document.querySelectorAll('[class*="valid-tip"],[role="alert"]')].filter(e => e.offsetParent!==null && e.textContent?.trim()).map(e => e.textContent.trim().slice(0,40)))];
  return { codes, errs };
});
console.log('保存后编码:', after.codes, '(变化?', after.codes.some(c => c !== beforeCode), ')');
console.log('错误:', after.errs);
console.log('POST请求数:', responses.length);
responses.forEach((r,i) => console.log(`  [${i}] ${r.status} ${r.url} | ${r.body.replace(/\s+/g,' ').slice(0,100)}`));

await page.screenshot({ path: `screenshots/save_${method}.png` });

const codeChanged = after.codes.some(c => c !== beforeCode);
const emptyErr = after.errs.some(e => e.includes('不能为空'));
if (responses.length > 0 && codeChanged && !emptyErr) {
  const newCode = after.codes.find(c => c !== beforeCode);
  defect.status = 'created'; defect.devops_id = newCode;
  fs.writeFileSync('pending_defects.json', JSON.stringify(defects, null, 2));
  console.log(`\n✅ 真正创建成功: ${newCode}`);
} else {
  console.log('\n❌ 未成功（POST=' + responses.length + ' 编号变化=' + codeChanged + '）');
}
await browser.close();
