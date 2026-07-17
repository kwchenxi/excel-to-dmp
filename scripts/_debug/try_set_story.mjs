// 绕过搜索：直接设置关联故事 input value + 保存
import { chromium } from 'playwright';
import fs from 'fs';

const row = parseInt(process.argv[2] || '118');
const STORY_ID = '2508756100443247625';
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 确认表单在
if (await page.locator('input[placeholder="名称不能为空"]:visible').last().count() === 0) {
  console.log('❌ 表单不在'); await browser.close(); process.exit(1);
}

// 1. 填字段
console.log('填字段...');
const titleInput = page.locator('input[placeholder="名称不能为空"]:visible').last();
await titleInput.click();
await titleInput.fill(defect.title);
await page.evaluate((html) => { const ed = window.tinymce?.activeEditor || Object.values(window.tinymce?.editors||{})[0]; if(ed) ed.setContent(html); }, '<p>' + defect.desc.replace(/\n/g,'</p><p>') + '</p>');
const hIn = page.locator('.kd-cq-field.kd-cq-basedata:visible', { hasText: '处理人' }).first().locator('input:visible').first();
await hIn.click({clickCount:3}); await page.keyboard.press('Backspace'); await page.waitForTimeout(200);
await hIn.fill(defect.handler_name); await page.waitForTimeout(1200);
await page.locator('.kd-cq-dropdown-menu-item:visible', { hasText: defect.handler_name }).first().click(); await page.waitForTimeout(500);
const sIn = page.locator('.kd-cq-field.kd-cq-basedata:visible', { hasText: '发现阶段' }).first().locator('input:visible').first();
await sIn.click({clickCount:3}); await page.keyboard.press('Backspace'); await page.waitForTimeout(200);
await sIn.fill('dev'); await page.waitForTimeout(1200);
await page.locator('.kd-cq-dropdown-menu-item:visible', { hasText: 'dev测试' }).first().click(); await page.waitForTimeout(500);
await page.locator('.kd-cq-field.kd-cq-textarea:visible', { hasText: '备注' }).first().locator('textarea:visible').first().fill(defect.note);

// 2. 关联故事：dump + 直接设值
console.log('\n关联故事字段结构:');
const storyInfo = await page.evaluate(() => {
  const field = [...document.querySelectorAll('.kd-cq-basedata:visible')].find(f => {
    const t = f.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim();
    return t === '关联故事' || t === '关联故事*';
  });
  if (!field) return { error: 'not found' };
  const inputs = [...field.querySelectorAll('input:not([type=hidden]):not([type=file])')].map(el => ({
    tag: el.tagName, type: el.type, id: el.id, class: el.className?.slice(0,40),
    value: el.value, placeholder: el.placeholder, offsetParent: el.offsetParent !== null
  }));
  const allInputs = [...field.querySelectorAll('input')].map(el => ({
    tag: el.tagName, type: el.type, value: el.value?.slice(0,20), class: el.className?.slice(0,30), vis: el.offsetParent !== null
  }));
  return { inputs, allInputs };
});
console.log(JSON.stringify(storyInfo, null, 2));

// 直接设置关联故事
console.log('\n直接设置关联故事 =', STORY_ID);
const setResult = await page.evaluate((id) => {
  const field = [...document.querySelectorAll('.kd-cq-basedata:visible')].find(f => {
    const t = f.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim();
    return t === '关联故事' || t === '关联故事*';
  });
  if (!field) return 'field not found';
  const inp = field.querySelector('input:not([type=hidden]):not([type=file])');
  if (!inp) return 'no input';
  inp.value = id;
  inp.dispatchEvent(new Event('input', {bubbles:true}));
  inp.dispatchEvent(new Event('change', {bubbles:true}));
  inp.dispatchEvent(new KeyboardEvent('blur', {bubbles:true}));
  return 'set ok';
}, STORY_ID);
console.log('设置结果:', setResult);

// 3. 保存
const beforeCode = await page.evaluate(() => [...document.querySelectorAll('*')].find(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0 && e.offsetParent!==null)?.textContent?.trim() || '');
console.log('\n保存前编码:', beforeCode);

const responses = [];
page.on('response', async (r) => { if (r.request().method()==='POST') { try { const t=await r.text(); responses.push({url:r.url().slice(-55),status:r.status(),body:t.slice(0,300)}); } catch(e){} } });

await titleInput.click();
await page.waitForTimeout(300);
console.log('dispatchEvent click #bar_save...');
await page.evaluate(() => document.querySelector('#bar_save')?.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true})));
await page.waitForTimeout(8000);

const after = await page.evaluate(() => {
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e=>/^BT-\d+$/.test(e.textContent?.trim()||'')&&e.children.length===0&&e.offsetParent!==null).map(e=>e.textContent.trim()))];
  const errs = [...new Set([...document.querySelectorAll('[class*="valid-tip"],[role="alert"]')].filter(e=>e.offsetParent!==null&&e.textContent?.trim()).map(e=>e.textContent.trim().slice(0,40)))];
  return { codes, errs, hasTitle: [...document.querySelectorAll('input[placeholder="名称不能为空"]')].filter(e=>e.offsetParent!==null).length };
});
console.log('保存后编码:', after.codes);
console.log('表单还在:', after.hasTitle);
console.log('错误:', after.errs);
console.log('POST数:', responses.length);
responses.forEach((r,i) => console.log(`  [${i}] ${r.status} ${r.url} | ${r.body.replace(/\s+/g,' ').slice(0,80)}`));

await page.screenshot({ path: 'screenshots/try_set_story.png' });

if (responses.length > 0 && after.codes.some(c => c !== beforeCode) && !after.errs.some(e => e.includes('不能为空'))) {
  const newCode = after.codes.find(c => c !== beforeCode);
  defect.status = 'created'; defect.devops_id = newCode;
  fs.writeFileSync('pending_defects.json', JSON.stringify(defects, null, 2));
  console.log(`\n✅ 成功: ${newCode}`);
} else {
  console.log('\n❌ 未成功');
}
await browser.close();
