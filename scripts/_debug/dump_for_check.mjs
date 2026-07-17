import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const pages = browser.contexts().flatMap(c => c.pages());
const page = pages.find(p => p.url().includes('devops'));
if (!page) { console.log('无 devops 页'); process.exit(0); }
await page.bringToFront();

const info = await page.evaluate(() => {
  const visible = (e) => e.offsetParent !== null;
  const inputs = [...document.querySelectorAll('input')].filter(visible).slice(0, 25).map(e => ({
    ph: e.placeholder || '', cls: (e.className || '').slice(0, 40), id: e.id || ''
  }));
  // 搜索类
  const searchish = [...document.querySelectorAll('input,[class*=search],[class*=Search]')].filter(visible).slice(0, 15).map(e => ({
    tag: e.tagName, ph: e.placeholder || '', cls: (e.className || '').slice(0, 50)
  }));
  // 附件区
  const attach = [...document.querySelectorAll('[class*=ttach],[class*=upload],[class*=file],[class*=File]')].filter(visible).slice(0, 12).map(e => ({
    cls: (e.className || '').slice(0, 50), txt: (e.textContent || '').replace(/\s+/g, ' ').slice(0, 60)
  }));
  // 列表行
  const rows = document.querySelectorAll('tr,[role=row]');
  // 标题输入（判断是否在编辑页）
  const titleInp = [...document.querySelectorAll('input[placeholder="名称不能为空"]')].filter(visible).length;
  // BT 编号
  const codes = [...new Set([...document.querySelectorAll('*')].filter(e => /^BT-\d+$/.test(e.textContent?.trim() || '') && e.children.length === 0 && visible).map(e => e.textContent.trim()))];
  return {
    url: location.href.slice(-60), title: document.title,
    inEditForm: titleInp > 0, titleInputCount: titleInp,
    inputCount: inputs.length, inputs,
    searchish, attachCount: attach.length, attach,
    rowCount: rows.length, visibleCodes: codes
  };
}).catch(e => ({ err: e.message }));

console.log(JSON.stringify(info, null, 2));
process.exit(0);
