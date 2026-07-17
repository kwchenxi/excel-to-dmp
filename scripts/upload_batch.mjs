import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import fs from 'fs';

const getNeed = () => {
  const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
  return defects.filter(d => d.status === 'created'
    && (d.screenshot_files?.length || d.design_ref_files?.length)
    && !d.screenshot_uploaded);
};

const isFormOpen = async () => {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
    const cnt = page ? await page.locator('input[placeholder="名称不能为空"]:visible').count().catch(() => 0) : 0;
    await browser.close();
    return cnt > 0;
  } catch (e) { return false; }
};

console.log('开始批量上传（动态检查剩余）');
while (true) {
  const need = getNeed();
  if (need.length === 0) { console.log('\n==== 全部上传完成 ===='); break; }
  const d = need[0];
  console.log(`\n======== 待上传 ${need.length} 条 | 下一条 row=${d.row} ${d.devops_id}: ${d.desc?.slice(0, 18)} ========`);
  console.log(`请双击缺陷行打开编辑，等待中...`);
  while (!(await isFormOpen())) await new Promise(r => setTimeout(r, 2000));
  console.log('✅ 表单已打开，上传中...');
  spawnSync('node', ['scripts/upload_one.mjs'], { stdio: 'inherit', cwd: process.cwd() });
  await new Promise(r => setTimeout(r, 3000));
}

const final = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
console.log(`已上传: ${final.filter(d => d.screenshot_uploaded).length}`);
