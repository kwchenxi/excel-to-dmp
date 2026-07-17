import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
if (!page) { console.error('无 DevOps 页面'); process.exit(1); }
await page.bringToFront();

const titleInput = page.locator('input[placeholder="名称不能为空"]:visible').last();
if (await titleInput.count() === 0) {
  console.error('❌ 不在缺陷编辑表单。请双击缺陷行打开编辑。');
  await browser.close(); process.exit(1);
}

const title = await titleInput.inputValue();
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const match = defects.find(d => d.desc && title.trim().includes(d.desc.slice(0, 15)));
if (!match) { console.error('❌ 找不到匹配缺陷:', title.slice(0, 30)); await browser.close(); process.exit(1); }

const files = [...(match.screenshot_files || []), ...(match.design_ref_files || [])].map(f => 'images/' + f);
console.log(`上传 row=${match.row} ${match.devops_id}: ${files.length} 张图片`);

const reqs = [];
page.on('response', async (r) => {
  try { const u = r.url(); if (u.includes('uploadFile') || u.includes('ac=save')) reqs.push({ u: u.slice(-40), s: r.status() }); } catch(e) {}
});

// 逐个上传（file input idx=1 是附件上传）
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('  跳过(不存在):', f); continue; }
  console.log('  上传:', f);
  await page.locator('input[type=file]').nth(1).setInputFiles(f);
  await page.waitForTimeout(3000);
}

// React 同步 + 保存
await page.evaluate(() => {
  const t = document.querySelector('input[placeholder="名称不能为空"]');
  if (t) { t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); t.dispatchEvent(new Event('blur', { bubbles: true })); }
});
await page.waitForTimeout(500);
await titleInput.click();
console.log('保存...');
await page.locator('#bar_save').click({ timeout: 15000 });
await page.waitForTimeout(12000);

const hasSave = reqs.some(r => r.u.includes('ac=save'));
console.log(hasSave ? '✅ 上传+保存成功' : '❌ 保存未触发');

if (hasSave) {
  match.screenshot_uploaded = true;
  fs.writeFileSync('pending_defects.json', JSON.stringify(defects, null, 2));
  console.log('✅ 已标记 screenshot_uploaded');
}
await browser.close();
