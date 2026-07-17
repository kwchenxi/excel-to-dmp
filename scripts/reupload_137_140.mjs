#!/usr/bin/env node
/**
 * 重新补传 row 137 + 140 的图片（按顺序打开）
 */
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
if (!page) { console.error('无 DevOps 页面'); process.exit(1); }
await page.bringToFront();

const defects = JSON.parse(fs.readFileSync('pending_defects.json', 'utf-8'));
const targets = [137, 140].map(r => defects.find(d => d.row === r)).filter(Boolean);

console.log(`\n==== 重新补传 ${targets.length} 条（请按顺序打开：137 → 140）====`);

for (let i = 0; i < targets.length; i++) {
  const d = targets[i];
  const imgFiles = [...(d.screenshot_files || []), ...(d.design_ref_files || [])].map(f => 'images/' + f).filter(f => fs.existsSync(f));

  if (imgFiles.length === 0) {
    console.log(`\n[${i+1}/${targets.length}] row=${d.row}: 无图片，跳过`);
    continue;
  }

  console.log(`\n======== [${i+1}/${targets.length}] row=${d.row} ${d.devops_id}: ${d.desc?.slice(0, 20)} ======== `);
  console.log(`请打开该缺陷的编辑页面，等待中...`);

  // 等编辑页面打开
  while (true) {
    try {
      const cnt = await page.locator('input[placeholder="名称不能为空"]:visible').count().catch(() => 0);
      if (cnt > 0) break;
    } catch(e) {}
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('✅ 编辑页面已打开，上传图片中...');

  // 上传图片 + 轮询等附件显示
  for (const f of imgFiles) {
    console.log(`  上传: ${f}`);
    const fname = f.split('/').pop();
    try {
      const fileInput = page.locator('input[type=file]').nth(1);
      await fileInput.setInputFiles(f);
      await fileInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
      let attached = false;
      for (let j = 0; j < 16; j++) {
        await page.waitForTimeout(500);
        const hasAttach = await page.evaluate((fn) => [...document.querySelectorAll('*')].some(e => e.textContent?.includes(fn) && e.offsetParent !== null), fname);
        if (hasAttach) { attached = true; break; }
      }
      console.log(`    ${attached ? '✅ 附件已显示' : '⚠️ 附件未显示'}`);
    } catch(e) { console.log('  上传失败:', e.message.slice(0, 50)); }
  }

  // React 同步 + 保存
  console.log('  保存...');
  await page.evaluate(() => {
    const trigger = (el) => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })); };
    const title = document.querySelector('input[placeholder="名称不能为空"]');
    if (title) trigger(title);
    document.querySelectorAll('textarea').forEach(trigger);
    document.querySelectorAll('.kd-cq-basedata input:not([type=hidden]):not([type=file])').forEach(el => { if (el.offsetParent !== null) trigger(el); });
  });
  await page.waitForTimeout(1000);

  await page.locator('input[placeholder="名称不能为空"]:visible').last().click();
  await page.locator('#bar_save').click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(10000);

  console.log('✅ 保存完成');
  await new Promise(r => setTimeout(r, 2000));
}

console.log('\n==== 补传完成 ====');
await browser.close();
