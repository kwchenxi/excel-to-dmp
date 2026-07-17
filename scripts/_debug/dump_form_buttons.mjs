import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// dump 所有可见按钮/可点击（opk/title/text/id）
const btns = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, [role="button"], .ant-btn, .kd-btn, [class*="btn"], a').forEach(el => {
    if (el.offsetParent === null) return;
    const t = el.textContent?.trim();
    if (!t || t.length > 10) return;
    out.push({
      opk: el.getAttribute('data-opk'),
      title: el.getAttribute('data-title'),
      text: t,
      id: el.id,
      class: el.className?.slice(0, 40),
      y: Math.round(el.getBoundingClientRect().y)
    });
  });
  // 去重
  const seen = new Set();
  return out.filter(b => {
    const k = b.opk + b.title + b.text + b.id;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((a,b) => a.y - b.y);
});
console.log('所有按钮/可点击（按 Y 排序）:');
btns.forEach(b => console.log(`  y=${b.y} opk=${b.opk} title="${b.title}" text="${b.text}" id=${b.id}`));

await browser.close();
