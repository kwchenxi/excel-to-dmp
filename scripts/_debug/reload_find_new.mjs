// 刷新页面 + 找新建缺陷入口
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

console.log('刷新页面...');
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('reload:', e.message.slice(0,50)));
await page.waitForTimeout(5000);
console.log('刷新后 URL:', page.url().slice(-60));

await page.screenshot({ path: 'screenshots/after_reload.png' });

// 找新建/缺陷管理入口
const entries = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('a, button, [role="button"], [class*="menu"], [class*="nav"], span, div').forEach(el => {
    if (el.offsetParent === null) return;
    const t = el.textContent?.trim();
    if (!t || t.length > 12 || el.children.length > 2) return;
    if (t.includes('新建') || t === '缺陷管理' || t === '缺陷列表' || t.includes('新增')) {
      const r = el.getBoundingClientRect();
      out.push({ text: t, tag: el.tagName, class: el.className?.slice(0,50), x: Math.round(r.x), y: Math.round(r.y) });
    }
  });
  // 去重
  const seen = new Set();
  return out.filter(o => { const k=o.text+o.x+o.y; if(seen.has(k))return false; seen.add(k); return true; }).slice(0, 20);
});
console.log('\n新建/缺陷入口:');
entries.forEach(e => console.log(`  "${e.text}" <${e.tag}> class="${e.class}" @(${e.x},${e.y})`));

await browser.close();
