// 探测保存按钮的真实结构（精确文本、class、点击方式）
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 找所有可见的、文本含"保"或"存"或"退出"的元素
const btns = await page.evaluate(() => {
  const result = [];
  document.querySelectorAll('button, [role="button"], .ant-btn, .kd-btn, a, [class*="btn"], [class*="button"]').forEach(el => {
    if (el.offsetParent === null) return;
    const text = el.textContent?.trim();
    if (!text || text.length > 10) return;
    if (text.includes('保') || text.includes('存') || text.includes('退出') || text.includes('提交')) {
      const r = el.getBoundingClientRect();
      result.push({
        text: text,
        rawText: JSON.stringify(el.textContent),
        tag: el.tagName,
        class: el.className?.slice(0, 80),
        id: el.id,
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        disabled: el.disabled || el.getAttribute('disabled') !== null || el.className?.includes('disabled')
      });
    }
  });
  return result;
});
console.log('=== 含"保/存/退出"的可见按钮 ===');
btns.forEach((b, i) => console.log(`  [${i+1}] text=${JSON.stringify(b.text)} tag=${b.tag} class="${b.class}" @(${b.x},${b.y}) ${b.w}x${b.h} disabled=${b.disabled}`));

// dump 保存按钮父容器结构（看是否有特殊包裹）
console.log('\n=== 工具栏区域 HTML（文本含"保存"的元素附近）===');
const html = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => e.textContent?.trim() === '保存' && e.offsetParent !== null && e.children.length === 0);
  if (!els.length) return '没找到 textContent==="保存" 的叶子元素';
  let p = els[0];
  for (let i = 0; i < 3; i++) p = p.parentElement;
  return p?.outerHTML?.slice(0, 1000);
});
console.log(html);

await browser.close();
