// 打开一个可见的持久化 Chromium 窗口，导航到指定 URL。
// 登录态保存在 .browser-profile/，后续脚本复用。
//
// 用法: node scripts/browser_open.mjs <url>
//   不传 url 则打开 about:blank（自己在地址栏输入）
//
// 窗口会一直保持打开，直到手动关闭窗口或被 kill。
import { chromium } from 'playwright';

const userDataDir = `${process.cwd()}/.browser-profile`;
const url = process.argv[2] || 'about:blank';

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',        // 用系统 Google Chrome，不用下载 Chromium
  viewport: null,           // 使用窗口实际大小
  args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
});

const page = context.pages()[0] || (await context.newPage());
await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});

console.log(`[browser_open] 窗口已打开, URL=${url}`);
console.log(`[browser_open] PID=${process.pid}`);
console.log(`[browser_open] profile=${userDataDir}`);
console.log(`[browser_open] 保持运行中... 登录后请回复 Claude。`);

// 保持运行直到用户关闭窗口
await new Promise((resolve) => context.on('close', resolve));
console.log('[browser_open] 窗口已关闭, 退出。');
