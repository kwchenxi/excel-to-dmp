import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 确认在表单
const hasTitle = await page.locator('input[placeholder="名称不能为空"]:visible').count();
console.log('表单在:', hasTitle > 0);

// 找到关联故事 input
const field = page.locator('.kd-cq-field.kd-cq-basedata:visible', { hasText: '关联故事' }).first();
const inp = field.locator('input:visible').first();

// 清空 + 搜索 PRJ-00761367
console.log('\n搜索 PRJ-00761367...');
await inp.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);

let respBody = '';
const handler = async (r) => {
  if (r.request().method() === 'POST' && r.url().includes('getLookUpList')) {
    try { respBody = await r.text(); } catch(e) {}
  }
};
page.on('response', handler);
await inp.fill('PRJ-00761367');
await page.waitForTimeout(3000);
page.off('response', handler);

console.log('响应长度:', respBody.length);

try {
  const parsed = JSON.parse(respBody);
  const data = parsed.p?.[0]?.p?.[0]?.args?.data;
  const columns = parsed.p?.[0]?.p?.[0]?.args?.columns;
  console.log('data 类型:', Array.isArray(data) ? '数组' : typeof data);
  console.log('data 长度:', Array.isArray(data) ? data.length : 'N/A');
  if (Array.isArray(data) && data.length > 0) {
    console.log('\n第一条数据:');
    console.log(JSON.stringify(data[0], null, 2).slice(0, 1000));
  }
  if (columns) {
    console.log('\ncolumns:');
    console.log(JSON.stringify(columns, null, 2).slice(0, 500));
  }
  console.log('\nargs 完整:', JSON.stringify(parsed.p?.[0]?.p?.[0]?.args, null, 2).slice(0, 800));
} catch(e) {
  console.log('解析失败:', e.message);
  console.log('原始响应:', respBody.slice(0, 500));
}

// 也试搜 "PRJ" 前缀
console.log('\n=== 搜 "PRJ" 前缀 ===');
await inp.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(200);
respBody = '';
await inp.fill('PRJ');
await page.waitForTimeout(3000);

try {
  const parsed = JSON.parse(respBody);
  const data = parsed.p?.[0]?.p?.[0]?.args?.data;
  console.log('data 长度:', Array.isArray(data) ? data.length : 'N/A');
  if (Array.isArray(data) && data.length > 0) {
    console.log('第一条:', JSON.stringify(data[0], null, 2).slice(0, 500));
  }
} catch(e) { console.log('解析失败:', e.message, respBody.slice(0, 200)); }

await page.keyboard.press('Escape');
await browser.close();
