// 通过 CDP 连接到正在运行的 Chrome，截图 + 分析当前页面（弹窗）
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const contexts = browser.contexts();

// 找到有内容的标签页
let page = null;
for (const ctx of contexts) {
  for (const p of ctx.pages()) {
    const url = p.url();
    if (url.includes('devops.kingdee.com') || (url !== 'about:blank' && url !== '')) {
      page = p;
      console.log(`[connect] 找到标签页: ${url}`);
      break;
    }
  }
  if (page) break;
}

if (!page) {
  console.log('[connect] 没找到 DevOps 标签页, 使用第一个标签页');
  page = contexts[0]?.pages()[0];
}

if (!page) {
  console.log('[connect] 无可用标签页');
  process.exit(1);
}

await page.bringToFront();
await page.waitForTimeout(1000);

const screenshotPath = `${process.cwd()}/screenshots`;
const shot = `${screenshotPath}/defect_create_form.png`;
await page.screenshot({ path: shot, fullPage: false });
console.log(`[connect] 截图: ${shot}`);

// 全面分析：所有可见元素
const info = await page.evaluate(() => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // 所有可见叶子文本（字段名候选）
  const texts = [];
  document.querySelectorAll('span, label, div, p').forEach(el => {
    if (!isVisible(el)) return;
    const text = el.textContent?.trim();
    if (text && text.length >= 2 && text.length <= 15 && el.children.length === 0) {
      texts.push(text);
    }
  });

  // 所有可见输入框
  const inputs = [];
  document.querySelectorAll('input:not([type="hidden"]), textarea').forEach(el => {
    if (!isVisible(el)) return;
    // 找前面的 label
    const container = el.closest('[class*="form-item"],[class*="field"],tr,div');
    const nearbyLabels = container?.querySelectorAll('label, span, div');
    let labelText = '';
    nearbyLabels?.forEach(l => {
      const t = l.textContent?.trim();
      if (t && t.length < 12 && l !== el) labelText = labelText || t;
    });
    inputs.push({
      tag: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      id: el.id,
      class: el.className?.slice(0, 50),
      value: el.value?.slice(0, 20),
      label: labelText
    });
  });

  // 所有可见按钮
  const buttons = [];
  document.querySelectorAll('button, [role="button"], a, .ant-btn, [class*="btn"]').forEach(el => {
    if (!isVisible(el)) return;
    const text = el.textContent?.trim();
    if (text && text.length < 15) buttons.push({ text, class: el.className?.slice(0, 50) });
  });

  // 富文本编辑器 / iframe
  const editors = [];
  document.querySelectorAll('iframe, [contenteditable="true"], .tox-tinymce, [class*="editor"]').forEach(el => {
    if (!isVisible(el)) return;
    editors.push({ tag: el.tagName, id: el.id, class: el.className?.slice(0, 50), src: el.src?.slice(0, 60) });
  });

  return {
    url: location.href,
    title: document.title,
    texts: [...new Set(texts)].slice(0, 60),
    inputs,
    buttons: [...new Set(buttons.map(b => b.text))].filter(Boolean).slice(0, 25),
    editors
  };
});

console.log('\nURL:', info.url);
console.log('\n=== 可见文本（字段名候选）===');
console.log(info.texts.join(' | '));
console.log('\n=== 输入框', info.inputs.length, '个 ===');
info.inputs.forEach((i, idx) => console.log(`  ${idx+1}. [${i.label || '?'}] ${i.tag} type=${i.type} id="${i.id}" placeholder="${i.placeholder}" val="${i.value}"`));
console.log('\n=== 按钮 ===');
console.log(info.buttons.join(' | '));
console.log('\n=== 编辑器/iframe', info.editors.length, '个 ===');
info.editors.forEach((e, idx) => console.log(`  ${idx+1}. ${e.tag} id="${e.id}" class="${e.class}"`));

fs.writeFileSync(`${screenshotPath}/create_form.json`, JSON.stringify(info, null, 2));
console.log('\n详细: screenshots/create_form.json');

// 断开连接（不关闭浏览器）
await browser.close();
