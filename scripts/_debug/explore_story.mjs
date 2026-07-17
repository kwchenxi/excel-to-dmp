// 探测关联故事的搜索机制：监听搜索 API + 试不同搜索词
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const trySearch = async (keyword, label) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const storyField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '关联故事' }).first();
  const storyInput = storyField.locator('input').first();

  // 监听这次搜索的请求
  const reqs = [];
  const handler = async (resp) => {
    const url = resp.url();
    if (resp.request().method() === 'POST' && (url.includes('look') || url.includes('search') || url.includes('query') || url.includes('invokeAction'))) {
      try { const t = await resp.text(); reqs.push({ url: url.slice(-70), body: t?.slice(0, 300) }); } catch(e) {}
    }
  };
  page.on('response', handler);

  await storyInput.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  await storyInput.fill(keyword);
  await page.waitForTimeout(2000);

  const opts = await page.locator('.kd-cq-dropdown-menu-item').allTextContents();
  page.off('response', handler);

  console.log(`\n[搜 "${keyword}"] 下拉选项: ${JSON.stringify([...new Set(opts)].slice(0,5))}`);
  console.log(`  搜索请求:`);
  reqs.slice(0,3).forEach(r => console.log(`    ${r.url}\n      resp: ${r.body?.replace(/\s+/g,' ').slice(0,150)}`));
  return opts;
};

await trySearch('2508756100443247625', '完整ID');
await trySearch('250875610044324762', '去掉末位');
await trySearch('日历', '关键词日历');

await browser.close();
