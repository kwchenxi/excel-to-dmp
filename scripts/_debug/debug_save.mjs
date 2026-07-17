// 查空必填字段 + 找所有保存按钮
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 1. 空必填字段
const emptyReq = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.kd-cq-field').forEach(f => {
    const title = f.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim() || '';
    if (!title.includes('*')) return;
    const inp = f.querySelector('input:not([type=hidden]):not([type=file])');
    const ta = f.querySelector('textarea');
    const val = (ta?.value || inp?.value || '').trim();
    const vis = inp ? inp.offsetParent !== null : (ta ? ta.offsetParent !== null : false);
    if (!val) out.push({ title, vis });
  });
  return out;
});
console.log('=== 空的必填字段 ===');
emptyReq.forEach(f => console.log(`  ${f.title}${f.vis ? '' : ' (隐藏)'}`));

// 2. 所有含"保存"的按钮/可点击
const saveBtns = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(el => {
    if (el.offsetParent === null) return;
    const t = el.textContent?.trim();
    if (t !== '保存') return;
    const r = el.getBoundingClientRect();
    out.push({ tag: el.tagName, class: el.className?.slice(0,50), id: el.id, opk: el.getAttribute('data-opk'), x: Math.round(r.x), y: Math.round(r.y) });
  });
  const seen = new Set();
  return out.filter(o => { const k=o.id+o.opk; if(seen.has(k))return false; seen.add(k); return true; });
});
console.log('\n=== 含"保存"的可点击元素 ===');
saveBtns.forEach(b => console.log(`  <${b.tag}> id="${b.id}" opk="${b.opk}" class="${b.class}" @(${b.x},${b.y})`));

// 3. 所有工具栏按钮
const toolbarBtns = await page.evaluate(() => {
  return [...document.querySelectorAll('.kd-cq-toolbar-item')].filter(e=>e.offsetParent!==null).map(el => ({
    title: el.getAttribute('data-title'), opk: el.getAttribute('data-opk'), text: el.textContent?.trim().slice(0,6), id: el.id
  }));
});
console.log('\n=== 工具栏按钮 ===');
toolbarBtns.forEach(b => console.log(`  id="${b.id}" opk="${b.opk}" title="${b.title}" text="${b.text}"`));

await browser.close();
