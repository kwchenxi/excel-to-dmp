// 等待用户点击新建缺陷，然后截图分析弹窗
import { chromium } from 'playwright';
import fs from 'fs';

const userDataDir = `${process.cwd()}/.browser-profile`;
const url = process.argv[2] || 'https://devops.kingdee.com:8000/';

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1440, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = context.pages()[0] || (await context.newPage());

console.log(`[wait_modal] 导航到 ${url}`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

console.log(`[wait_modal] 浏览器已打开。请在浏览器里点击「新建缺陷」打开弹窗。`);
console.log(`[wait_modal] 我会每 3 秒检查一次是否有弹窗出现...`);

const screenshotPath = `${process.cwd()}/screenshots`;
if (!fs.existsSync(screenshotPath)) fs.mkdirSync(screenshotPath, { recursive: true });

// 轮询检测弹窗
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(3000);

  // 检测是否有弹窗/模态框
  const hasModal = await page.evaluate(() => {
    const selectors = ['.ant-modal', '.modal', '.dialog', '[role="dialog"]', '.kd-modal', '.kd-dialog', '.ant-modal-root'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return true;
    }
    return false;
  });

  if (hasModal) {
    console.log(`[wait_modal] 检测到弹窗！正在截图分析...`);

    // 截图
    const screenshotFile = `${screenshotPath}/defect_create_modal.png`;
    await page.screenshot({ path: screenshotFile, fullPage: false });
    console.log(`[wait_modal] 截图已保存: ${screenshotFile}`);

    // 分析弹窗结构
    const formInfo = await page.evaluate(() => {
      const results = {
        title: document.title,
        url: location.href,
        labels: [],
        inputs: [],
        selects: [],
        textareas: [],
        buttons: [],
        editors: []
      };

      // 表单标签
      document.querySelectorAll('label, .ant-form-item-label, .form-label').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 30) results.labels.push(text);
      });
      results.labels = [...new Set(results.labels)];

      // 输入框
      document.querySelectorAll('input:not([type="hidden"])').forEach(el => {
        results.inputs.push({
          type: el.type,
          placeholder: el.placeholder,
          id: el.id,
          class: el.className?.slice(0, 80),
          value: el.value?.slice(0, 30)
        });
      });

      // 下拉框
      document.querySelectorAll('.ant-select, select, [role="combobox"]').forEach(el => {
        results.selects.push({
          class: el.className?.slice(0, 80),
          id: el.id
        });
      });

      // 文本域
      document.querySelectorAll('textarea').forEach(el => {
        results.textareas.push({
          placeholder: el.placeholder,
          id: el.id,
          class: el.className?.slice(0, 80)
        });
      });

      // 富文本编辑器
      document.querySelectorAll('.tox-tinymce, .mce-content-body, .ql-editor, .ant-input[contenteditable]').forEach(el => {
        results.editors.push({
          id: el.id,
          class: el.className?.slice(0, 80)
        });
      });

      // 按钮
      document.querySelectorAll('button, .ant-btn').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 20) results.buttons.push(text);
      });
      results.buttons = [...new Set(results.buttons)];

      return results;
    });

    console.log('\n[wait_modal] ===== 弹窗表单分析 =====');
    console.log('标签:', formInfo.labels.slice(0, 15).join(', '));
    console.log('输入框:', formInfo.inputs.length, '个');
    console.log('下拉框:', formInfo.selects.length, '个');
    console.log('文本域:', formInfo.textareas.length, '个');
    console.log('富文本编辑器:', formInfo.editors.length, '个');
    console.log('按钮:', formInfo.buttons.join(', '));

    // 保存详细结果
    fs.writeFileSync(`${screenshotPath}/modal_form.json`, JSON.stringify(formInfo, null, 2));
    console.log(`\n[wait_modal] 详细结果已保存: ${screenshotPath}/modal_form.json`);

    break;
  }

  console.log(`[wait_modal] 等待中... (${i+1}/60)`);
}

console.log('\n[wait_modal] 完成。请查看截图和 JSON 结果。');
// 保持浏览器打开
console.log('[wait_modal] 浏览器保持打开，可以手动操作。按 Ctrl+C 退出。');
await new Promise(() => {});