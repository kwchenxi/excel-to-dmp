// 探测关联故事 basedata 组件的方法（onBaseDataSelectItem 等），找直接关联方式
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// 确认表单在
const hasTitle = await page.locator('input[placeholder="名称不能为空"]').count();
console.log('标题输入框存在:', hasTitle > 0);

// 从关联故事 input 找 React fiber 上的组件方法
const apiInfo = await page.evaluate(() => {
  const allEls = [...document.querySelectorAll('*')];
  const labelEl = allEls.find(e => e.textContent?.trim() === '关联故事' && e.children.length <= 1 && e.offsetParent !== null);
  if (!labelEl) return { error: '找不到关联故事 label' };
  let container = labelEl;
  for (let i = 0; i < 6; i++) { container = container.parentElement; if (!container) break; }
  if (!container) return { error: '无容器' };

  // 找 React fiber key（__reactFiber$ / __reactInternalInstance$）
  const fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  let methods = [];
  if (fiberKey) {
    let fiber = container[fiberKey];
    // 沿 fiber 树找含 onBaseDataSelectItem 的状态/props
    for (let i = 0; i < 15 && fiber; i++) {
      const props = fiber.memoizedProps || {};
      const state = fiber.stateNode?.props || fiber.memoizedState || {};
      const candidates = { ...props, ...(fiber.stateNode?.props || {}) };
      for (const k of Object.keys(candidates)) {
        if (typeof candidates[k] === 'function' && /select|basedata|choose|pick/i.test(k)) {
          methods.push(k);
        }
      }
      // 也找组件实例方法
      const inst = fiber.stateNode;
      if (inst && typeof inst === 'object') {
        for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(inst) || {})) {
          if (/onBaseData|selectItem|chooseItem|setBaseData/i.test(k)) methods.push('inst.' + k);
        }
      }
      fiber = fiber.return;
    }
  }
  return { fiberKey: !!fiberKey, methods: [...new Set(methods)].slice(0, 20), containerClass: container.className?.slice(0, 60) };
});
console.log('探测结果:', JSON.stringify(apiInfo, null, 2));

// 同时 dump 搜索"日历"的故事列表（备用方案）
console.log('\n=== 备用：搜"日历"故事列表 ===');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const storyField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '关联故事' }).first();
let respBody = '';
const handler = async (resp) => {
  if (resp.request().method() === 'POST' && resp.url().includes('getLookUpList')) {
    try { respBody = await resp.text(); } catch(e) {}
  }
};
page.on('response', handler);
await storyField.locator('input').first().click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await storyField.locator('input').first().fill('日历');
await page.waitForTimeout(2500);
page.off('response', handler);

try {
  const parsed = JSON.parse(respBody);
  const data = parsed.p?.[0]?.p?.[0]?.args?.data;
  if (Array.isArray(data) && data.length) {
    console.log(`找到 ${data.length} 个故事:`);
    data.forEach((s, i) => {
      console.log(`  [${i}] id=${s.id||s.fid||'?'} number=${s.number||s.fnumber||'?'} name=${(s.name||s.fname||'').slice(0,40)}`);
    });
  } else {
    console.log('data 为空或无故事。响应前200字:', respBody.slice(0, 200));
  }
} catch(e) { console.log('解析失败:', e.message, respBody.slice(0, 200)); }

await page.keyboard.press('Escape');
await browser.close();
