import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const hasTitle = await page.locator('input[placeholder="名称不能为空"]:visible').count();
console.log('URL:', page.url().slice(-50));
console.log('在新建表单:', hasTitle > 0);

// 所有工具栏按钮
const btns = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('[data-opk],[data-btn-key],[data-title]').forEach(el => {
    if (el.offsetParent === null) return;
    const opk = el.getAttribute('data-opk');
    const title = el.getAttribute('data-title');
    if (opk || title) {
      const r = el.getBoundingClientRect();
      out.push({ opk, title, text: el.textContent?.trim().slice(0,6), id: el.id, y: Math.round(r.y) });
    }
  });
  return out;
});
console.log('\n所有 opk/title 按钮:');
btns.forEach(b => console.log(`  opk=${b.opk} title="${b.title}" text="${b.text}" id=${b.id} y=${b.y}`));

// 含"新建/新增/录入/添加"的可见元素
const newEls = await page.evaluate(() => {
  const out = new Set();
  document.querySelectorAll('*').forEach(el => {
    if (el.offsetParent === null || el.children.length > 1) return;
    const t = el.textContent?.trim();
    if (t && t.length <= 6 && /新建|新增|录入|添加|创建/.test(t)) {
      const r = el.getBoundingClientRect();
      out.add(`${t}|<${el.tagName}>|${(el.className||'').slice(0,25)}|@${Math.round(r.x)},${Math.round(r.y)}|parentOpk=${el.parentElement?.getAttribute('data-opk')}|parentId=${el.parentElement?.id}`);
    }
  });
  return [...out];
});
console.log('\n含新建/新增的元素:');
newEls.forEach(e => console.log('  ' + e));

await browser.close();
