// 分析 DevOps 新建缺陷表单结构
// 用法: node scripts/analyze_form.mjs <url>
import { chromium } from 'playwright';
import fs from 'fs';

const userDataDir = `${process.cwd()}/.browser-profile`;
const url = process.argv[2];

if (!url) {
  console.error('用法: node analyze_form.mjs <url>');
  process.exit(1);
}

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1440, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = context.pages()[0] || (await context.newPage());

console.log(`[analyze] 导航到 ${url}`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000); // 额外等待 SPA 渲染

// 截图
const screenshotPath = `${process.cwd()}/screenshots`;
if (!fs.existsSync(screenshotPath)) fs.mkdirSync(screenshotPath, { recursive: true });
const screenshotFile = `${screenshotPath}/defect_form.png`;
await page.screenshot({ path: screenshotFile, fullPage: false });
console.log(`[analyze] 截图已保存: ${screenshotFile}`);

// 分析表单元素
const formInfo = await page.evaluate(() => {
  const results = {
    title: document.title,
    url: location.href,
    inputs: [],
    selects: [],
    textareas: [],
    buttons: [],
    iframes: [],
    editors: []
  };

  // 输入框
  document.querySelectorAll('input').forEach(el => {
    results.inputs.push({
      type: el.type,
      placeholder: el.placeholder,
      name: el.name,
      id: el.id,
      class: el.className?.slice(0, 100),
      value: el.value?.slice(0, 50)
    });
  });

  // 下拉选择
  document.querySelectorAll('select, .ant-select, [role="listbox"], .kdfont-down').forEach(el => {
    results.selects.push({
      tag: el.tagName,
      class: el.className?.slice(0, 100),
      id: el.id,
      text: el.textContent?.slice(0, 50)
    });
  });

  // 文本域
  document.querySelectorAll('textarea').forEach(el => {
    results.textareas.push({
      placeholder: el.placeholder,
      id: el.id,
      class: el.className?.slice(0, 100)
    });
  });

  // 按钮
  document.querySelectorAll('button, .ant-btn, [role="button"]').forEach(el => {
    results.buttons.push({
      text: el.textContent?.trim().slice(0, 30),
      class: el.className?.slice(0, 100),
      type: el.type
    });
  });

  // iframe（可能用于编辑器）
  document.querySelectorAll('iframe').forEach(el => {
    results.iframes.push({
      id: el.id,
      class: el.className?.slice(0, 100),
      src: el.src,
      title: el.title
    });
  });

  // TinyMCE 或类似编辑器
  document.querySelectorAll('.tox-tinymce, .mce-content-body, .ql-editor').forEach(el => {
    results.editors.push({
      class: el.className?.slice(0, 100),
      id: el.id
    });
  });

  // 查找标签文本（用于定位字段）
  const labels = [];
  document.querySelectorAll('label, .ant-form-item-label').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length < 20) {
      labels.push(text);
    }
  });
  results.labels = [...new Set(labels)];

  return results;
});

console.log('\n[analyze] 表单分析结果:');
console.log('='.repeat(60));
console.log('页面标题:', formInfo.title);
console.log('URL:', formInfo.url);
console.log('\n标签文本:', formInfo.labels?.join(', '));
console.log('\n输入框:', formInfo.inputs.length, '个');
formInfo.inputs.forEach((i, idx) => console.log(`  ${idx+1}. type=${i.type}, placeholder="${i.placeholder}", id="${i.id}"`));

console.log('\n下拉/选择框:', formInfo.selects.length, '个');
formInfo.selects.forEach((s, idx) => console.log(`  ${idx+1}. ${s.tag}, class="${s.class?.slice(0,50)}"`));

console.log('\n文本域:', formInfo.textareas.length, '个');
formInfo.textareas.forEach((t, idx) => console.log(`  ${idx+1}. id="${t.id}", placeholder="${t.placeholder}"`));

console.log('\n富文本编辑器:', formInfo.editors.length, '个');
formInfo.editors.forEach((e, idx) => console.log(`  ${idx+1}. id="${e.id}", class="${e.class?.slice(0,50)}"`));

console.log('\n按钮:', formInfo.buttons.length, '个');
formInfo.buttons.forEach((b, idx) => console.log(`  ${idx+1}. "${b.text}", class="${b.class?.slice(0,50)}"`));

console.log('\niframe:', formInfo.iframes.length, '个');
formInfo.iframes.forEach((f, idx) => console.log(`  ${idx+1}. id="${f.id}", title="${f.title}"`));

// 保存详细结果到 JSON
const jsonPath = `${screenshotPath}/form_analysis.json`;
fs.writeFileSync(jsonPath, JSON.stringify(formInfo, null, 2));
console.log(`\n[analyze] 详细结果已保存: ${jsonPath}`);

// 保持窗口打开，等待用户确认
console.log('\n[analyze] 窗口保持打开，请查看截图并确认。按 Ctrl+C 退出。');
await new Promise(() => {}); // 永远等待