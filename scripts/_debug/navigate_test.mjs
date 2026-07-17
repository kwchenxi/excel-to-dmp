import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const clickText = async (text) => {
  return await page.evaluate((t) => {
    const el = [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === t && e.offsetParent !== null && e.children.length === 0);
    if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
    return false;
  }, text);
};

console.log('1. 点应用');
await clickText('应用');
await page.waitForTimeout(2000);

console.log('2. 点研发管理(DMP)');
const ok = await clickText('研发管理（DMP）');
console.log('  点击:', ok);
await page.waitForTimeout(4000);

let tblnew = await page.locator('#tblnew').count();
const hasDefectMgmt = await page.evaluate(() => !![...document.querySelectorAll('*')].find(e => e.textContent?.trim() === '缺陷管理' && e.offsetParent !== null));
console.log('  #tblnew:', tblnew, '| 缺陷管理菜单:', hasDefectMgmt);

if (hasDefectMgmt && tblnew === 0) {
  console.log('3. 点缺陷管理');
  await clickText('缺陷管理');
  await page.waitForTimeout(2000);
  const hasDefectList = await page.evaluate(() => !![...document.querySelectorAll('*')].find(e => e.textContent?.trim() === '缺陷列表' && e.offsetParent !== null && e.children.length === 0));
  console.log('  缺陷列表出现:', hasDefectList);
  if (hasDefectList) {
    console.log('4. 点缺陷列表');
    await clickText('缺陷列表');
    await page.waitForTimeout(3000);
    tblnew = await page.locator('#tblnew').count();
    console.log('  #tblnew:', tblnew);
  }
}

if (tblnew > 0) {
  console.log('5. 点 #tblnew');
  await page.locator('#tblnew').click({ timeout: 5000 });
  await page.waitForTimeout(5000);
  const hasTitle = await page.locator('input[placeholder="名称不能为空"]:visible').count();
  console.log('  新建表单打开:', hasTitle > 0);
}

await browser.close();
