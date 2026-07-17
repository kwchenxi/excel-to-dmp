import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 所有必填字段（带*）+ 值
const req = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.kd-cq-field').forEach(f => {
    if (f.offsetParent === null) return;
    const title = f.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim() || '';
    if (!title.includes('*')) return;
    const inp = f.querySelector('input:not([type=hidden]):not([type=file])');
    const ta = f.querySelector('textarea');
    const val = (ta?.value || inp?.value || '').trim();
    out.push({ title, val: val.slice(0, 30) || '(空)' });
  });
  return out;
});
console.log('=== 所有必填字段 ===');
req.forEach(r => console.log(`  ${r.title}: ${r.val}`));

// 所有错误提示（valid-tip）+ 所属字段
const errs = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.kd-cq-field-valid-tip, [class*="valid-tip"]').forEach(e => {
    if (e.offsetParent === null) return;
    const t = e.textContent?.trim();
    if (!t) return;
    // 找所属字段
    let p = e;
    for (let i = 0; i < 6; i++) {
      p = p.parentElement;
      if (!p) break;
      if (p.classList?.contains('kd-cq-field')) {
        out.push({ err: t, field: p.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim() });
        break;
      }
    }
  });
  return out;
});
console.log('\n=== 错误提示 ===');
if (errs.length === 0) console.log('  (无)');
errs.forEach(e => console.log(`  字段"${e.field}": ${e.err}`));

await browser.close();
