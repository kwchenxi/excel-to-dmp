// 直接截图 + dump 当前页面所有可见的表单元素和文字
import { chromium } from 'playwright';
import fs from 'fs';

const userDataDir = `${process.cwd()}/.browser-profile`;

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1440, height: 900 },
});

const page = context.pages()[0] || (await context.newPage());
await page.waitForTimeout(2000);

const screenshotPath = `${process.cwd()}/screenshots`;
const shot = `${screenshotPath}/current_state.png`;
await page.screenshot({ path: shot, fullPage: false });
console.log('截图:', shot);

// dump 当前页面所有可见文本 + 表单元素结构
const info = await page.evaluate(() => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  };

  // 所有可见的 label/字段名
  const fields = [];
  document.querySelectorAll('*').forEach(el => {
    if (!isVisible(el)) return;
    const text = el.textContent?.trim();
    // 找叶子文本节点（字段名通常是短文本）
    if (text && text.length >= 2 && text.length <= 12 && el.children.length === 0) {
      // 排除纯数字、日期
      if (!/^\d/.test(text) && !/[年月日]/.test(text)) {
        fields.push(text);
      }
    }
  });

  // 所有可见的输入框 + 它附近可能的名字
  const inputs = [];
  document.querySelectorAll('input:not([type="hidden"]), textarea').forEach(el => {
    if (!isVisible(el)) return;
    inputs.push({
      tag: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      id: el.id,
      class: el.className?.slice(0, 60),
      value: el.value?.slice(0, 30),
      ariaLabel: el.getAttribute('aria-label'),
      name: el.name
    });
  });

  // 所有可见的按钮
  const buttons = [];
  document.querySelectorAll('button, [role="button"], a').forEach(el => {
    if (!isVisible(el)) return;
    const text = el.textContent?.trim();
    if (text && text.length < 20) buttons.push({ text, class: el.className?.slice(0, 60) });
  });

  return {
    url: location.href,
    title: document.title,
    fields: [...new Set(fields)].slice(0, 50),
    inputs,
    buttons: [...new Set(buttons.map(b => b.text))].slice(0, 20),
    // 检测各种弹窗选择器
    modalSelectors: {
      'kd-modal': !!document.querySelector('.kd-modal'),
      'kd-dialog': !!document.querySelector('.kd-dialog'),
      'ant-modal': !!document.querySelector('.ant-modal'),
      '[role=dialog]': !!document.querySelector('[role="dialog"]'),
      'panel': document.querySelectorAll('[class*="panel"],[class*="modal"],[class*="dialog"],[class*="drawer"]').length
    }
  };
});

console.log('\nURL:', info.url);
console.log('可能字段名:', info.fields.join(', '));
console.log('\n检测到的弹窗选择器:', JSON.stringify(info.modalSelectors));
console.log('\n输入框:', info.inputs.length, '个');
info.inputs.forEach((i, idx) => console.log(`  ${idx+1}. ${i.tag} type=${i.type} id="${i.id}" placeholder="${i.placeholder}" value="${i.value}"`));
console.log('\n按钮:', info.buttons.join(', '));

fs.writeFileSync(`${screenshotPath}/current_state.json`, JSON.stringify(info, null, 2));
console.log('\n详细结果: screenshots/current_state.json');

await context.close();
