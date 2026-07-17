// dump 关联故事搜索结果列表，找目标故事 ID
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const TARGET_ID = '2508756100443247625';

const search = async (keyword) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const storyField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '关联故事' }).first();
  const storyInput = storyField.locator('input').first();

  let respBody = '';
  const handler = async (resp) => {
    if (resp.request().method() === 'POST' && resp.url().includes('getLookUpList')) {
      try { respBody = await resp.text(); } catch(e) {}
    }
  };
  page.on('response', handler);
  await storyInput.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  await storyInput.fill(keyword);
  await page.waitForTimeout(2500);
  page.off('response', handler);
  return respBody;
};

const body = await search('日历');
console.log('响应长度:', body.length);
console.log('前 300 字符:', body.slice(0, 300));

// 解析 data 数组里的故事
try {
  const parsed = JSON.parse(body);
  const args = parsed.p?.[0]?.p?.[0]?.args;
  let data = args?.data;
  // 兼容不同结构
  if (!data) {
    // 找 data 字段
    const str = body;
    const m = str.match(/"data":\[(.*?)\]/);
  }
  console.log('\n故事列表:');
  if (Array.isArray(data)) {
    data.forEach((s, i) => {
      const id = s.id || s.Id || s.fid || '';
      const name = s.name || s.Name || s.fname || s.title || '';
      const number = s.number || s.Number || s.fnumber || s.code || '';
      const isTarget = String(id).includes(TARGET_ID);
      console.log(`  [${i}] id=${id} number=${number} name=${String(name).slice(0,40)} ${isTarget?'<== 目标!':''}`);
    });
  } else {
    console.log('  data 不是数组，dump 原始:', JSON.stringify(args).slice(0, 1500));
  }
} catch(e) {
  console.log('解析失败:', e.message);
}

await browser.close();
