// 核对当前表单所有字段值
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

const fields = await page.evaluate(() => {
  const result = [];
  // 遍历所有 kd-cq-field，取 label + 值
  document.querySelectorAll('.kd-cq-field, .kd-cq-container.kd-cq-flexpanel').forEach(field => {
    // 找字段名
    const titleEl = field.querySelector('.kd-cq-field-title-wrap, .kd-cq-label');
    let title = '';
    if (titleEl) {
      title = [...titleEl.childNodes].map(n => n.textContent).join('').trim() || titleEl.textContent?.trim();
    } else {
      title = field.textContent?.trim().slice(0, 10);
    }
    if (!title || title.length > 15) return;

    // 找值
    const input = field.querySelector('input:not([type="hidden"]):not([type="file"])');
    const textarea = field.querySelector('textarea');
    const selectValue = field.querySelector('.ant-select-selection-item, .kd-cq-select-selected-value');
    let value = '';
    if (textarea) value = textarea.value;
    else if (input) value = input.value;
    else if (selectValue) value = selectValue.textContent?.trim();

    if (title && title.length <= 12) {
      result.push({ title, value: (value || '').slice(0, 40) });
    }
  });

  // TinyMCE 描述
  let desc = '';
  try {
    const ed = window.tinymce?.activeEditor || Object.values(window.tinymce?.editors || {})[0];
    desc = ed?.getContent({ format: 'text' })?.slice(0, 60) || '';
  } catch(e) {}
  result.unshift({ title: '【缺陷描述TinyMCE】', value: desc });

  return result;
});

console.log('\n=== 当前表单所有字段值 ===');
for (const f of fields) {
  console.log(`  ${f.title}: ${f.value || '(空)'}`);
}

await browser.close();
