// dump 关联故事搜索"日历"的完整响应，找目标故事
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const dumpSearch = async (keyword) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const storyField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '关联故事' }).first();
  const storyInput = storyField.locator('input').first();

  let respBody = '';
  const handler = async (resp) => {
    const url = resp.url();
    if (resp.request().method() === 'POST' && url.includes('getLookUpList')) {
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

  console.log(`\n=== 搜 "${keyword}" 完整响应 ===`);
  console.log(respBody.slice(0, 2500));
};

await dumpSearch('日历');

await browser.close();
