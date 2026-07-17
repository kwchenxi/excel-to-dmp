// 探测关键字段的 DOM 结构：label 文本 -> 对应 input 的定位
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops')) || browser.contexts()[0].pages()[0];

console.log('页面:', page.url());

// 对每个目标字段，探测 label -> input 关系
const targets = ['标题', '处理人', '备注', '模块路径', '缺陷描述', '关联故事', '发现阶段'];

const result = await page.evaluate((targets) => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // 找到包含精确文本的叶子元素
  const findLabelEl = (text) => {
    const els = document.querySelectorAll('span, label, div, p, td');
    for (const el of els) {
      if (!isVisible(el)) continue;
      if (el.textContent?.trim() === text && el.children.length <= 1) {
        return el;
      }
    }
    return null;
  };

  return targets.map(text => {
    const labelEl = findLabelEl(text);
    if (!labelEl) return { text, found: false };

    // 从 label 往上找 form-item 容器（含 input 的最近祖先）
    let container = labelEl;
    let input = null;
    let textarea = null;
    let editor = null;
    for (let i = 0; i < 6; i++) {
      container = container.parentElement;
      if (!container) break;
      input = container.querySelector('input:not([type="hidden"]):not([type="file"])');
      textarea = container.querySelector('textarea');
      editor = container.querySelector('.tox-tinymce, iframe[class*="tox"]');
      // 找到包含实际可交互元素的容器就停
      if (input || textarea || editor) break;
    }

    return {
      text,
      found: true,
      labelClass: labelEl.className?.slice(0, 50),
      labelTag: labelEl.tagName,
      containerClass: container?.className?.slice(0, 60),
      inputClass: input?.className?.slice(0, 50),
      inputType: input?.type,
      inputValue: input?.value?.slice(0, 20),
      hasTextarea: !!textarea,
      hasEditor: !!editor,
      // input 相对 label 的关系
      inputIsSibling: input ? labelEl.parentElement?.contains(input) : false
    };
  });
}, targets);

console.log('\n=== 字段定位探测 ===');
for (const r of result) {
  console.log(`\n【${r.text}】 found=${r.found}`);
  if (r.found) {
    console.log(`  label: <${r.labelTag} class="${r.labelClass}">`);
    console.log(`  container: class="${r.containerClass}"`);
    console.log(`  input: class="${r.inputClass}" type=${r.inputType} val="${r.inputValue}"`);
    console.log(`  textarea=${r.hasTextarea} editor=${r.hasEditor}`);
  }
}

// 额外：探测处理人下拉怎么触发（是否 basedata）
console.log('\n=== 处理人字段周边 HTML（前 800 字符）===');
const handlerHtml = await page.evaluate(() => {
  const els = document.querySelectorAll('span, label, div');
  for (const el of els) {
    if (el.textContent?.trim() === '处理人' && el.children.length <= 1) {
      let p = el;
      for (let i = 0; i < 4; i++) p = p.parentElement;
      return p?.outerHTML?.slice(0, 800);
    }
  }
  return '未找到';
});
console.log(handlerHtml);

await browser.close();
