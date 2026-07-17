// 填字段 + ⌘+S 保存（所有定位用 :visible 跳过隐藏元素）
import { chromium } from 'playwright';
import fs from 'fs';

const row = parseInt(process.argv[2] || '118');
const saveMethod = process.argv[3] || 'shortcut';
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const titleInput = page.locator('input[placeholder="名称不能为空"]:visible').last();
if (await titleInput.count() === 0) { console.log('❌ 表单不在'); await browser.close(); process.exit(1); }

console.log('填字段...');
await titleInput.click();
await titleInput.fill(defect.title);
await page.evaluate((html) => { const ed = window.tinymce?.activeEditor || Object.values(window.tinymce?.editors||{})[0]; if(ed) ed.setContent(html); }, '<p>' + defect.desc.replace(/\n/g,'</p><p>') + '</p>');
// 处理人
const hIn = page.locator('.kd-cq-field.kd-cq-basedata:visible', { hasText: '处理人' }).first().locator('input:visible').first();
await hIn.click({clickCount:3}); await page.keyboard.press('Backspace'); await page.waitForTimeout(200);
await hIn.fill(defect.handler_name); await page.waitForTimeout(1200);
await page.locator('.kd-cq-dropdown-menu-item:visible', { hasText: defect.handler_name }).first().click(); await page.waitForTimeout(500);
// 发阶段
const sIn = page.locator('.kd-cq-field.kd-cq-basedata:visible', { hasText: '发现阶段' }).first().locator('input:visible').first();
await sIn.click({clickCount:3}); await page.keyboard.press('Backspace'); await page.waitForTimeout(200);
await sIn.fill('dev'); await page.waitForTimeout(1200);
await page.locator('.kd-cq-dropdown-menu-item:visible', { hasText: 'dev测试' }).first().click(); await page.waitForTimeout(500);
// 备注
await page.locator('.kd-cq-field.kd-cq-textarea:visible', { hasText: '备注' }).first().locator('textarea:visible').first().fill(defect.note);
console.log('字段填完');

const beforeCode = await page.evaluate(() => [...document.querySelectorAll('*')].find(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0 && e.offsetParent!==null)?.textContent?.trim() || '');
console.log('保存前编码:', beforeCode);

const responses = [];
page.on('response', async (r) => { if (r.request().method()==='POST') { try { const t=await r.text(); responses.push({url:r.url().slice(-55),status:r.status(),body:t.slice(0,400)}); } catch(e){} } });

await titleInput.click();
await page.waitForTimeout(300);
console.log('\n保存方法:', saveMethod);
if (saveMethod === 'shortcut') await page.keyboard.press('Meta+S');
else if (saveMethod === 'click') { try { await page.locator('#bar_save:visible').click({timeout:5000}); } catch(e){ console.log('click失败:',e.message.slice(0,50)); } }
else if (saveMethod === 'events') await page.evaluate(() => { const b=document.querySelector('#bar_save'); ['mousedown','mouseup','click'].forEach(t=>b.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}))); });

await page.waitForTimeout(8000);

const after = await page.evaluate(() => {
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e=>/^BT-\d+$/.test(e.textContent?.trim()||'')&&e.children.length===0&&e.offsetParent!==null).map(e=>e.textContent.trim()))];
  const errs = [...new Set([...document.querySelectorAll('[class*="valid-tip"],[role="alert"]')].filter(e=>e.offsetParent!==null&&e.textContent?.trim()).map(e=>e.textContent.trim().slice(0,40)))];
  return { codes, errs, hasTitle: [...document.querySelectorAll('input[placeholder="名称不能为空"]')].filter(e => e.offsetParent!==null).length };
});
console.log('保存后编码:', after.codes);
console.log('表单还在(hasTitle):', after.hasTitle);
console.log('错误:', after.errs);
console.log('POST数:', responses.length);
responses.forEach((r,i) => console.log(`  [${i}] ${r.status} ${r.url} | ${r.body.replace(/\s+/g,' ').slice(0,90)}`));

const codeChanged = after.codes.some(c => c !== beforeCode);
const emptyErr = after.errs.some(e => e.includes('不能为空'));
console.log(`\n判断: POST>0=${responses.length>0} 编号变化=${codeChanged} 无必填错误=${!emptyErr}`);

if (responses.length > 0 && codeChanged && !emptyErr) {
  const newCode = after.codes.find(c => c !== beforeCode);
  defect.status = 'created'; defect.devops_id = newCode;
  fs.writeFileSync('pending_defects.json', JSON.stringify(defects, null, 2));
  console.log(`\n✅✅✅ 真正成功: ${newCode}`);
} else {
  console.log('\n❌ 未成功');
}
await page.screenshot({ path: `screenshots/save_${saveMethod}_${row}.png` });
await browser.close();
