import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const hasTblnew = await page.locator('#tblnew').count();
console.log('#tblnew 存在:', hasTblnew);

if (hasTblnew > 0) {
  console.log('点击 #tblnew (新增)...');
  await page.evaluate(() => document.querySelector('#tblnew')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  await page.waitForTimeout(5000);
  const hasTitle = await page.locator('input[placeholder="名称不能为空"]:visible').count();
  console.log('新建表单已打开:', hasTitle > 0);
  if (hasTitle > 0) {
    console.log('✅✅ #tblnew 成功打开新建表单！');
  } else {
    // 也许需要真实 click
    console.log('dispatchEvent 无效，尝试真实 click...');
    try {
      await page.locator('#tblnew').click({ timeout: 5000 });
      await page.waitForTimeout(5000);
      const hasTitle2 = await page.locator('input[placeholder="名称不能为空"]:visible').count();
      console.log('真实click后表单打开:', hasTitle2 > 0);
    } catch (e) { console.log('click 失败:', e.message.slice(0, 60)); }
  }
} else {
  console.log('当前不在缺陷列表（无 #tblnew）');
}
await page.screenshot({ path: 'screenshots/new_btn_test.png' });
await browser.close();
