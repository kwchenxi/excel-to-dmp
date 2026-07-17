// 直接 spawn Chrome 进程，带 CDP 调试端口，可被 connect.mjs 连接
import { spawn } from 'child_process';

const url = process.argv[2] || 'https://devops.kingdee.com:8000/';
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--remote-debugging-port=9222',
  `--user-data-dir=${process.cwd()}/.browser-profile`,
  '--no-first-run',
  '--no-default-browser-check',
  url
], { stdio: 'ignore', detached: false });

console.log(`[launch_cdp] Chrome 启动, PID=${chrome.pid}`);
console.log(`[launch_cdp] CDP 端口: 9222`);
console.log(`[launch_cdp] 初始 URL: ${url}`);
console.log(`[launch_cdp] 浏览器保持运行中... 操作到「新建缺陷弹窗」打开后回复 Claude。`);

chrome.on('exit', (code) => {
  console.log(`[launch_cdp] Chrome 退出, code=${code}`);
  process.exit(0);
});

// 保持进程
await new Promise(() => {});
