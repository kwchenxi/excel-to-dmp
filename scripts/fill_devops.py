#!/usr/bin/env python3
"""
DevOps 缺陷自动填单脚本 (Playwright 独立版)
==============================================
不依赖任何 MCP 插件，可在任意 IDE/终端中运行。

用法:
  cd /Users/hoho/Projects/trying/Excel-to-DMP
  pip install playwright pyyaml
  python -m playwright install chromium
  python scripts/fill_devops.py

首次运行会打开浏览器，请手动登录 DevOps。
脚本会自动读取 pending_defects.json 中 status=pending 的缺陷逐条创建。
"""

import json
import os
import re
import sys
import time
import yaml
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ─── 路径与配置 ──────────────────────────────────────────

PROJECT_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_DIR / "config.yaml"
DEFECTS_PATH = PROJECT_DIR / "pending_defects.json"
DEVOPS_URL = "https://devops.kingdee.com:8000/"

def load_config():
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def load_defects():
    with open(DEFECTS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_defects(defects):
    with open(DEFECTS_PATH, 'w', encoding='utf-8') as f:
        json.dump(defects, f, ensure_ascii=False, indent=2)

def find_images(row_num):
    """根据行号查找本地截图"""
    config = load_config()
    img_dir = Path("/Users/hoho/Desktop/飞书表格图片")
    if not img_dir.exists():
        return []
    return sorted(str(f) for f in img_dir.glob(f"r{row_num}c*.png"))

# ─── 浏览器操作工具 ──────────────────────────────────────

def wait_for_login(page):
    """等待用户手动登录 DevOps"""
    print("\n" + "=" * 60)
    print("  请在浏览器中手动登录 DevOps 平台")
    print("  登录成功后（看到侧边栏），脚本将自动继续...")
    print("=" * 60)
    try:
        page.wait_for_selector("text=缺陷管理", timeout=300000)
        print("✅ 检测到已登录！\n")
        return True
    except PWTimeout:
        print("❌ 等待超时（5分钟），请重新运行")
        return False

def js_click_text(page, text, container_sel="*"):
    """通过 JS 点击包含指定文本的元素（避免 Playwright click 超时）"""
    return page.evaluate(f"""() => {{
        const els = document.querySelectorAll('{container_sel}');
        for (const el of els) {{
            if (el.childNodes.length <= 3 && el.textContent.trim() === '{text}') {{
                el.dispatchEvent(new MouseEvent('click', {{bubbles: true, cancelable: true}}));
                return 'ok:' + el.tagName;
            }}
        }}
        return 'not_found';
    }}""")

def js_click_toolbar(page, text):
    """点击工具栏按钮"""
    return page.evaluate(f"""() => {{
        const items = document.querySelectorAll('.kd-cq-toolbar-item, [class*=toolbar] *');
        for (const el of items) {{
            if (el.textContent.trim().includes('{text}')) {{
                el.dispatchEvent(new MouseEvent('click', {{bubbles: true, cancelable: true}}));
                return 'ok';
            }}
        }}
        return 'not_found';
    }}""")

# ─── 表单字段填写 ────────────────────────────────────────

def set_title(page, title):
    """
    设置缺陷标题。
    关键：必须用 execCommand('insertText') 而非 input.value 或 fill()，
    否则 React 状态不同步，保存时报"请填写缺陷标题"。
    """
    print(f"  📝 标题: {title[:60]}...")
    result = page.evaluate(f"""() => {{
        const title_json = {json.dumps(title)};
        // 方法1: localeText contenteditable
        const editables = document.querySelectorAll('[contenteditable=true]');
        for (const el of editables) {{
            if (el.closest('[class*=localeText], [class*=title]') || 
                el.getAttribute('class')?.includes('localeText')) {{
                el.focus();
                el.textContent = '';
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, title_json);
                return 'ok:localeText';
            }}
        }}
        // 方法2: 任何 contenteditable
        for (const el of editables) {{
            el.focus();
            el.textContent = '';
            document.execCommand('insertText', false, title_json);
            return 'ok:contenteditable';
        }}
        return 'not_found';
    }}""")
    print(f"    → {result}")
    time.sleep(0.5)
    return 'ok' in result

def set_description(page, desc):
    """
    设置缺陷描述（TinyMCE 富文本编辑器）。
    """
    print(f"  📄 描述: {desc[:40]}...")
    html = desc.replace('\n', '<br>')
    result = page.evaluate(f"""() => {{
        const html = {json.dumps(html)};
        // 方法1: TinyMCE API
        if (typeof tinymce !== 'undefined' && tinymce.editors.length > 0) {{
            tinymce.editors[0].setContent(html);
            return 'ok:tinymce';
        }}
        // 方法2: iframe contenteditable
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {{
            try {{
                const body = iframe.contentDocument?.body;
                if (body) {{
                    body.innerHTML = html;
                    body.dispatchEvent(new Event('input', {{bubbles: true}}));
                    return 'ok:iframe';
                }}
            }} catch(e) {{}}
        }}
        return 'not_found';
    }}""")
    print(f"    → {result}")
    return 'ok' in result

def set_textarea(page, label, value):
    """设置 textarea 类型字段（如备注、测试环境）"""
    print(f"  📋 {label}: {value[:40]}...")
    result = page.evaluate(f"""() => {{
        const val = {json.dumps(value)};
        const labels = document.querySelectorAll('*');
        for (const lbl of labels) {{
            if (lbl.textContent.trim() === '{label}' && lbl.childNodes.length <= 2) {{
                const row = lbl.closest('[class*=row], [class*=field], [class*=item]') || lbl.parentElement;
                const ta = row?.querySelector('textarea');
                if (ta) {{
                    const setter = Object.getOwnPropertyDescriptor(
                        window.HTMLTextAreaElement.prototype, 'value').set;
                    setter.call(ta, val);
                    ta.dispatchEvent(new Event('input', {{bubbles: true}}));
                    ta.dispatchEvent(new Event('change', {{bubbles: true}}));
                    return 'ok:textarea';
                }}
            }}
        }}
        return 'not_found';
    }}""")
    print(f"    → {result}")
    return 'ok' in result

def set_handler(page, handler_name, handler_id):
    """
    设置处理人（basedata 下拉搜索选人）。
    流程：点击字段 → 输入姓名搜索 → 等待下拉 → 点击选项
    """
    print(f"  👤 处理人: {handler_name} ({handler_id})")
    result = page.evaluate(f"""() => {{
        const name = {json.dumps(handler_name)};
        // 找到处理人字段的 input
        const labels = document.querySelectorAll('*');
        for (const lbl of labels) {{
            if (lbl.textContent.trim() === '处理人' && lbl.childNodes.length <= 2) {{
                const row = lbl.closest('[class*=row], [class*=field], [class*=item]') || lbl.parentElement;
                const input = row?.querySelector('input[type=text], input:not([type])');
                if (input) {{
                    input.focus();
                    input.click();
                    const setter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value').set;
                    setter.call(input, name);
                    input.dispatchEvent(new Event('input', {{bubbles: true}}));
                    input.dispatchEvent(new Event('change', {{bubbles: true}}));
                    return 'ok:input_set';
                }}
            }}
        }}
        return 'not_found';
    }}""")
    print(f"    → 搜索: {result}")
    
    if 'ok' in result:
        time.sleep(1.5)  # 等待搜索结果
        # 点击下拉选项
        click_result = page.evaluate(f"""() => {{
            const name = {json.dumps(handler_name)};
            const items = document.querySelectorAll('.kd-cq-dropdown-menu-qs-list li, [class*=dropdown] li');
            for (const li of items) {{
                if (li.textContent.includes(name)) {{
                    li.click();
                    return 'ok:selected';
                }}
            }}
            return 'no_option_found';
        }}""")
        print(f"    → 选择: {click_result}")
        return 'ok' in click_result
    return False

def upload_screenshot(page, image_paths):
    """
    上传截图附件。
    关键：必须对"上传文件"按钮使用 set_input_files，不是"选择文件"。
    """
    if not image_paths:
        return True
    print(f"  📎 上传 {len(image_paths)} 张截图...")
    for img_path in image_paths:
        if not os.path.exists(img_path):
            print(f"    ⚠️ 文件不存在: {img_path}")
            continue
        try:
            # 查找 file input
            file_input = page.locator('input[type="file"]').first
            file_input.set_input_files(img_path)
            print(f"    ✅ {os.path.basename(img_path)}")
            time.sleep(1)
        except Exception as e:
            print(f"    ❌ 上传失败: {e}")
    return True

def click_save(page):
    """保存缺陷单"""
    print("  💾 保存...")
    result = js_click_toolbar(page, '保存')
    time.sleep(3)  # 等待保存完成
    print(f"    → {result}")
    return 'ok' in result

# ─── 安装 API 拦截器（注入发现阶段值）──────────────────

def install_api_interceptor(page, config):
    """
    安装网络请求拦截器。
    发现阶段"验收测试"需要通过 API 注入，因为下拉选项是动态加载的。
    """
    discovery = config.get('devops_defaults', {}).get('discovery_stage', '验收测试')
    page.evaluate(f"""() => {{
        const discoveryValue = {json.dumps(discovery)};
        // 拦截 fetch 请求，在发现阶段 API 响应中注入选项
        const origFetch = window.fetch;
        window.fetch = async function(...args) {{
            const resp = await origFetch.apply(this, args);
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            // 拦截基础数据查询 API
            if (url.includes('basedata') || url.includes('findStage') || url.includes('discoveryStage')) {{
                try {{
                    const clone = resp.clone();
                    const data = await clone.json();
                    // 注入发现阶段选项（如果响应中缺少）
                    if (data?.data && Array.isArray(data.data)) {{
                        const exists = data.data.some(d => d.name === discoveryValue || d.displayName === discoveryValue);
                        if (!exists) {{
                            data.data.push({{
                                name: discoveryValue,
                                displayName: discoveryValue,
                                value: discoveryValue
                            }});
                        }}
                    }}
                    return new Response(JSON.stringify(data), {{
                        status: resp.status,
                        headers: resp.headers
                    }});
                }} catch(e) {{}}
            }}
            return resp;
        }};
    }}""")

# ─── 主流程 ──────────────────────────────────────────────

def create_single_defect(page, defect, config, idx, total):
    """创建单条缺陷"""
    row = defect.get('row', '?')
    title = defect.get('title', '')
    desc = defect.get('desc', '')
    handler_name = defect.get('handler_name', '')
    handler_id = defect.get('handler_id', '')
    note = defect.get('note', '')
    
    print(f"\n{'─'*60}")
    print(f"[{idx+1}/{total}] Row {row}: {title[:50]}...")
    print(f"{'─'*60}")
    
    defaults = config.get('devops_defaults', {})
    
    # 点击"新增"
    if not js_click_toolbar(page, '新增'):
        print("  ❌ 找不到新增按钮，请手动点击新增后按回车")
        input("  按回车继续...")
    
    time.sleep(2)  # 等待新表单打开
    
    # 1. 标题
    set_title(page, title)
    time.sleep(0.3)
    
    # 2. 描述
    set_description(page, desc)
    time.sleep(0.3)
    
    # 3. 测试环境
    test_env = defaults.get('test_env', 'LingeeBeta 版')
    set_textarea(page, '测试环境', test_env)
    time.sleep(0.3)
    
    # 4. 备注
    if note:
        set_textarea(page, '备注', note)
        time.sleep(0.3)
    
    # 5. 处理人
    if handler_name:
        set_handler(page, handler_name, handler_id)
        time.sleep(0.5)
    
    # 6. 上传截图
    images = find_images(row)
    if images:
        upload_screenshot(page, images)
    
    # 7. 保存
    print()
    user_input = input("  确认保存？(y=保存/s=跳过/q=退出) [y]: ").strip().lower()
    if user_input == 'q':
        return 'quit'
    if user_input == 's':
        print("  ⏭️ 跳过")
        return 'skipped'
    
    if click_save(page):
        time.sleep(2)
        print(f"  ✅ Row {row} 保存成功")
        return 'created'
    else:
        print(f"  ❌ Row {row} 保存失败")
        return 'failed'

def main():
    """主入口"""
    print("=" * 60)
    print("  DevOps 缺陷自动填单工具 (Playwright)")
    print("=" * 60)
    
    # 加载配置
    config = load_config()
    defects = load_defects()
    pending = [d for d in defects if d.get('status') == 'pending']
    
    print(f"\n共 {len(defects)} 条缺陷，已完成 {len(defects)-len(pending)} 条，待创建 {len(pending)} 条")
    
    if not pending:
        print("🎉 没有待创建的缺陷！")
        return
    
    print("\n待创建列表：")
    for i, d in enumerate(pending):
        print(f"  {i+1}. Row {d['row']} - {d['title'][:45]}... ({d['handler_name']})")
    
    with sync_playwright() as p:
        # 使用有头浏览器，用户可以看到操作过程
        browser = p.chromium.launch(
            headless=False,
            slow_mo=500,  # 放慢操作速度
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900}
        )
        page = context.new_page()
        
        # 导航到 DevOps
        page.goto(DEVOPS_URL)
        
        # 等待登录
        if not wait_for_login(page):
            browser.close()
            return
        
        # 安装 API 拦截器
        install_api_interceptor(page, config)
        
        # 导航到缺陷列表
        navigate_result = js_click_text(page, '缺陷管理')
        print(f"导航: {navigate_result}")
        time.sleep(2)
        
        # 逐条创建
        created_count = 0
        for i, defect in enumerate(pending):
            # 找到 defects 列表中的原始索引
            orig_idx = defects.index(defect)
            
            result = create_single_defect(page, defect, config, i, len(pending))
            
            if result == 'quit':
                print("\n⏹️ 用户退出")
                break
            elif result == 'created':
                defects[orig_idx]['status'] = 'created'
                created_count += 1
            elif result == 'failed':
                defects[orig_idx]['status'] = 'failed'
            elif result == 'skipped':
                pass
            
            # 每条后保存进度
            save_defects(defects)
            time.sleep(1)
        
        browser.close()
    
    # 最终统计
    print(f"\n{'='*60}")
    print(f"  本次创建: {created_count} 条")
    all_status = {}
    for d in defects:
        s = d.get('status', 'unknown')
        all_status[s] = all_status.get(s, 0) + 1
    for s, c in sorted(all_status.items()):
        print(f"  {s}: {c} 条")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
