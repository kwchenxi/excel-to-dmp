import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 当前缺陷
const title = await page.locator('input[placeholder="名称不能为空"]:visible').last().inputValue().catch(() => '');
const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const match = defects.find(d => d.desc && title.trim().includes(d.desc.slice(0, 15)));
console.log('当前缺陷:', match?.row, match?.devops_id, '|', title.slice(0, 30));

if (!match || !match.screenshot_files?.length) {
  console.log('当前缺陷无图片，请打开一个有图片的缺陷（如 row 128/BT-02374239）');
  await browser.close(); process.exit(0);
}

const imgPath = 'images/' + match.screenshot_files[0];
console.log('将上传:', imgPath, '存在:', fs.existsSync(imgPath));

// 监听上传 API
const reqs = [];
page.on('response', async (r) => {
  try { const t = await r.text(); reqs.push({ m: r.request().method(), u: r.url().slice(-55), s: r.status(), b: t.slice(0, 80) }); } catch(e) {}
});

// 试每个 rc-upload file input（idx 0,1,2）
for (const idx of [2, 1, 0]) {
  console.log(`\n试 file input idx=${idx}...`);
  try {
    const fileInput = page.locator('input[type=file]').nth(idx);
    await fileInput.setInputFiles(imgPath);
    console.log('  setInputFiles ok');
    await page.waitForTimeout(4000);
    if (reqs.length > 0) {
      console.log(`  触发 ${reqs.length} 个请求:`);
      reqs.forEach((r,i) => console.log(`    [${i}] ${r.m} ${r.s} ${r.u} | ${r.b.replace(/\s+/g,' ').slice(0,70)}`));
      break;
    } else {
      console.log('  无请求');
    }
  } catch (e) { console.log('  失败:', e.message.slice(0, 50)); }
}

await page.screenshot({ path: 'screenshots/upload_test.png' });
await browser.close();
