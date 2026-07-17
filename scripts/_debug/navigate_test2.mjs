import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 导航到 DMP
await page.evaluate(() => {
  [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === '应用' && e.offsetParent !== null && e.children.length === 0)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === '研发管理（DMP）' && e.offsetParent !== null && e.children.length === 0)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});
await page.waitForTimeout(4000);

// 试真实 click 缺陷管理
console.log('尝试 click 缺陷管理...');
try {
  await page.locator('text=缺陷管理').first().click({ timeout: 10000 });
  console.log('真实click ok');
} catch (e) {
  console.log('真实click 失败:', e.message.slice(0, 60));
  // 试 dispatchEvent 点父容器
  console.log('试 dispatchEvent 点父容器...');
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === '缺陷管理' && e.offsetParent !== null && e.children.length === 0);
    if (el?.parentElement) el.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}
await page.waitForTimeout(3000);

const tblnew = await page.locator('#tblnew').count();
console.log('#tblnew:', tblnew);

if (tblnew > 0) {
  console.log('点击 #tblnew');
  await page.locator('#tblnew').click({ timeout: 5000 });
  await page.waitForTimeout(5000);
  const hasTitle = await page.locator('input[placeholder="名称不能为空"]:visible').count();
  console.log('新建表单:', hasTitle > 0);
}

await browser.close();
