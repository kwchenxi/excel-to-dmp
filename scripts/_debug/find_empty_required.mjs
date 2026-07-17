// 找所有必填字段（label含*）里为空的，以及标红的字段
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const result = await page.evaluate(() => {
  const fields = [];
  document.querySelectorAll('.kd-cq-field').forEach(f => {
    const titleEl = f.querySelector('.kd-cq-field-title-wrap, .kd-cq-label');
    let title = titleEl?.textContent?.trim() || '';
    if (!title || title.length > 15) return;

    const required = title.includes('*');
    const input = f.querySelector('input:not([type=hidden]):not([type=file])');
    const ta = f.querySelector('textarea');
    const sel = f.querySelector('.ant-select-selection-item, [class*="selected-value"]');
    let value = ta?.value || input?.value || sel?.textContent?.trim() || '';
    value = value.trim();

    // 检测错误状态（class 含 error 或 border 红）
    const hasError = /error|invalid|warning/i.test(f.className) || f.querySelector('[class*="error"],[class*="invalid"]');

    if (required || hasError || !value) {
      fields.push({ title, required, value: value.slice(0, 30) || '(空)', hasError });
    }
  });
  return fields;
});

console.log('=== 必填(*)或为空或报错的字段 ===');
result.forEach(f => {
  const flag = f.hasError ? '❌报错' : (f.required && !f.value?.replace('(空)','') ? '⚠️必填空' : '');
  console.log(`  ${f.required ? '*': ' '} ${f.title}: ${f.value}  ${flag}`);
});

// 额外：dump 所有可见的错误提示文本
console.log('\n=== 所有错误/校验提示 ===');
const errs = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('[class*="error"],[class*="invalid"],[class*="verify"],[class*="validate"],[role="alert"]').forEach(e => {
    if (e.offsetParent !== null) {
      const t = e.textContent?.trim();
      if (t && t.length < 60) out.push({ text: t, class: e.className?.slice(0, 50) });
    }
  });
  return [...new Set(out.map(o => o.text + '|' + o.class))].map(s => s.split('|'));
});
errs.forEach(e => console.log(`  "${e[0]}" class="${e[1]}"`));

await browser.close();
