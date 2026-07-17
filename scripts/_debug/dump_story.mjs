// dump 关联故事搜索结果，找目标故事 ID
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const hasTitle = await page.locator('input[placeholder="名称不能为空"]').count();
console.log('表单在:', hasTitle > 0);

const search = async (keyword) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const storyField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '关联故事' }).first();
  const inp = storyField.locator('input').first();
  let body = '';
  const h = async (r) => { if (r.request().method()==='POST' && r.url().includes('getLookUpList')) { try{body=await r.text();}catch(e){} } };
  page.on('response', h);
  await inp.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
  await inp.fill(keyword);
  await page.waitForTimeout(2500);
  page.off('response', h);
  return body;
};

let body = await search('日历');
console.log('\n搜"日历"响应长度:', body.length);

try {
  const parsed = JSON.parse(body);
  const data = parsed.p?.[0]?.p?.[0]?.args?.data;
  console.log('故事数:', Array.isArray(data) ? data.length : '非数组');
  if (Array.isArray(data) && data.length > 0) {
    console.log('\n第一个故事完整字段:');
    console.log(JSON.stringify(data[0], null, 2).slice(0, 1500));
    console.log('\n所有故事 (id/number/name):');
    data.forEach((s, i) => console.log(`  [${i}] ${JSON.stringify({id:s.id, fid:s.fid, number:s.number, fnumber:s.fnumber, name:(s.name||s.fname||'').slice(0,30)})}`));
  } else {
    console.log('data 空，响应前500字:', body.slice(0, 500));
  }
} catch(e) {
  console.log('解析失败:', e.message, body.slice(0, 300));
}

await page.keyboard.press('Escape');
await browser.close();
