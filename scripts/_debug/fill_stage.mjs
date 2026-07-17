// 填发现阶段 = dev测试，然后 verify（不保存）
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('devops'));
await page.bringToFront();

// ESC 关闭任何打开的下拉
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// 点击发现阶段 field 展开
console.log('=== 填发现阶段 = dev测试 ===');
const stageField = page.locator('.kd-cq-field.kd-cq-basedata', { hasText: '发现阶段' }).first();
await stageField.click();
await page.waitForTimeout(1200);

// 探测 dev测试 选项的位置
const devOptionInfo = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => {
    return e.textContent?.trim() === 'dev测试' && e.children.length === 0 && e.offsetParent !== null;
  });
  return els.map(e => ({
    tag: e.tagName,
    class: e.className?.slice(0, 80),
    parentClass: e.parentElement?.className?.slice(0, 80),
    rect: (() => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; })()
  }));
});
console.log('dev测试选项元素:', JSON.stringify(devOptionInfo, null, 2));

// 点击 dev测试
if (devOptionInfo.length > 0) {
  try {
    await page.locator('text=dev测试').first().click({ timeout: 3000 });
    console.log('✅ 点击了 dev测试');
  } catch (e) {
    // 用坐标点击
    const o = devOptionInfo[0];
    await page.mouse.click(o.rect.x + 30, o.rect.y + 10);
    console.log('✅ 坐标点击 dev测试');
  }
} else {
  console.log('❌ 没找到 dev测试 选项');
}
await page.waitForTimeout(800);

// verify 发阶段
const stageVal = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.kd-cq-basedata')];
  for (const el of els) {
    const title = el.querySelector('.kd-cq-field-title-wrap')?.textContent?.trim();
    if (title === '发现阶段' || title?.includes('发现阶段')) {
      return el.querySelector('input')?.value;
    }
  }
  return null;
});
console.log('发现阶段现为:', stageVal);

await page.screenshot({ path: 'screenshots/step_stage_done.png' });
await browser.close();
