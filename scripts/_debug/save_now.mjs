// 真正保存当前表单（用 #bar_save），含 verify + API 监听
import { chromium } from 'playwright';
import fs from 'fs';

const row = parseInt(process.argv[2] || '118');
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const defect = defects.find(d => d.row === row);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// verify 标题还在（确认表单未丢）
const titleCheck = await page.locator('input[placeholder="名称不能为空"]').first().inputValue().catch(() => '');
console.log('当前标题:', titleCheck?.slice(0, 40) || '(空!)');
if (!titleCheck) { console.log('⚠️ 表单为空，需重新填'); await browser.close(); process.exit(1); }

// 监听所有 POST 响应
const responses = [];
page.on('response', async (resp) => {
  const url = resp.url();
  if (resp.request().method() === 'POST') {
    try { const t = await resp.text(); responses.push({ url: url.slice(-90), status: resp.status(), body: t?.slice(0,400) }); } catch(e) {}
  }
});

console.log('\n触发 #bar_save dispatchEvent...');
await page.evaluate(() => {
  const btn = document.querySelector('#bar_save');
  if (btn) { btn.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true})); return 'ok'; }
  return 'not found';
}).then(r => console.log('保存触发:', r));

await page.waitForTimeout(8000);

// 读结果
const after = await page.evaluate(() => {
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim()||'') && e.children.length===0).map(e=>e.textContent.trim()))];
  const errs = [...document.querySelectorAll('[class*="error"],[class*="message"],[role="alert"],[class*="toast"],[class*="notice"]')].filter(e=>e.offsetParent!==null && e.textContent?.trim()).map(e=>e.textContent?.trim().slice(0,100));
  return { codes, url: location.href, errors: [...new Set(errs)].slice(0,5) };
});
console.log('\n编号候选:', after.codes);
console.log('URL:', after.url);
console.log('错误/提示:', after.errors);
console.log('\nPOST 响应:', responses.length, '个');
responses.slice(-12).forEach((r, i) => console.log(`  [${i}] ${r.status} ${r.url}\n      body: ${r.body?.replace(/\s+/g,' ').slice(0,150)}`));

await page.screenshot({ path: 'screenshots/after_save_real.png' });

// 判断：找保存 API 响应里的编号
const saveApi = responses.find(r => r.body && /BT-|billno|billNo|number|编号|defect/i.test(r.body));
console.log('\n保存API响应:', saveApi ? `${saveApi.status} ${saveApi.body.replace(/\s+/g,' ').slice(0,200)}` : '未明确识别');

await browser.close();
