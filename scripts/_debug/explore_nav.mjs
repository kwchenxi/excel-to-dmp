import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// dump 树菜单所有项
const items = await page.evaluate(() => {
  return [...document.querySelectorAll('[class*="treemenu"]')].filter(e => e.offsetParent !== null && e.children.length <= 3).map(el => ({
    text: el.textContent?.trim().slice(0, 12),
    class: el.className?.slice(0, 45),
    opk: el.getAttribute('data-opk'),
    url: el.getAttribute('data-url') || el.getAttribute('href'),
    tag: el.tagName
  })).filter(i => i.text);
});
console.log('树菜单项:', items.length);
items.slice(0, 25).forEach(i => console.log(`  "${i.text}" <${i.tag}> ${i.class} opk=${i.opk} url=${i.url}`));

// 点击"缺陷列表"（如果存在）
const beforeUrl = page.url();
const clicked = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => e.textContent?.trim() === '缺陷列表' && e.offsetParent !== null && e.children.length === 0);
  if (!els.length) return 'no 缺陷列表 text';
  const el = els[0];
  let p = el;
  for (let i = 0; i < 5; i++) {
    p = p.parentElement; if (!p) break;
    if (p.getAttribute('data-opk') || p.tagName === 'A' || /item|menu/i.test(p.className || '')) {
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return 'clicked ancestor: ' + (p.className || '').slice(0, 40);
    }
  }
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return 'clicked el';
});
console.log('\n点击缺陷列表:', clicked);
await page.waitForTimeout(5000);
console.log('URL变化:', beforeUrl.slice(-25), '->', page.url().slice(-25));

// 到列表后 dump 新建按钮
const listBtns = await page.evaluate(() => {
  return [...document.querySelectorAll('[data-opk],[data-btn-key]')].filter(e => e.offsetParent !== null).map(e => ({
    opk: e.getAttribute('data-opk'), title: e.getAttribute('data-title'), text: e.textContent?.trim().slice(0, 6), id: e.id
  }));
});
console.log('\n列表工具栏按钮:', listBtns.length);
listBtns.forEach(b => console.log(`  opk=${b.opk} title="${b.title}" text="${b.text}" id=${b.id}`));

await page.screenshot({ path: 'screenshots/nav_test.png' });
await browser.close();
