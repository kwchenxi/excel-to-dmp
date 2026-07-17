import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 找到关联故事 field
const field = page.locator('.kd-cq-field.kd-cq-basedata:visible', { hasText: '关联故事' }).first();
const inp = field.locator('input:visible').first();

// dump 所有 input（包括 hidden）
const inputs = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.kd-cq-basedata')].find(x => x.offsetParent !== null && x.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim().includes('关联故事'));
  if (!f) return [];
  return [...f.querySelectorAll('input')].map(el => ({
    type: el.type, id: el.id, class: el.className?.slice(0,30),
    value: el.value?.slice(0,20), name: el.name
  }));
});
console.log('关联故事字段所有 input:');
inputs.forEach(i => console.log(`  type=${i.type} id="${i.id}" class="${i.class}" value="${i.value}" name="${i.name}"`));

// 搜索 PRJ-00761367，看下拉项
console.log('\n搜索 PRJ-00761367...');
await inp.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
await inp.fill('PRJ-00761367');
await page.waitForTimeout(3000);

// dump 下拉项的完整 HTML
const items = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.kd-cq-dropdown-menu-item').forEach(el => {
    if (el.offsetParent === null) return;
    out.push({
      text: el.textContent?.trim().slice(0, 50),
      html: el.outerHTML?.slice(0, 300),
      attrs: [...el.attributes].map(a => `${a.name}=${a.value}`).join(' ')
    });
  });
  return out;
});
console.log('\n下拉项:');
items.forEach((it, i) => console.log(`  [${i}] ${it.text}`));
items.forEach((it, i) => console.log(`      attrs: ${it.attrs}`));

// 设内部 ID
if (inputs.length > 0) {
  const hidden = inputs.find(i => i.type === 'hidden');
  console.log('\n隐藏 input:', JSON.stringify(hidden));
}

await page.keyboard.press('Escape');
await browser.close();
