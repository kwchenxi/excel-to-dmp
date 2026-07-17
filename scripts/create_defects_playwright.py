#!/usr/bin/env python3
"""DevOps 缺陷自动创建工具 - 使用 Playwright 自动填充表单"""

import json
import asyncio
import os
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# DevOps 配置
DEVOPS_URL = "https://dmp.kingdee.com/dmp/"
DEFECT_CREATE_URL = "https://dmp.kingdee.com/dmp/web/index.html#/main/qc/defect/create"

# 默认值（从 config.yaml）
DEVOPS_DEFAULTS = {
    "project_name": "灵基AIOS项目",
    "module_path": "AI能力中心（R020334）",
    "defect_type": "交互体验",
    "discovery_stage": "验收测试",
    "priority": "高",
    "source": "手工新增",
    "test_env": "LingeeBeta 版",
    "project_team": "Chat日历及会议组",
    "related_story": "2508756100443247625"
}


async def create_defect(page, defect, index, total):
    """创建单条缺陷"""
    print(f"\n[{index+1}/{total}] 创建缺陷: {defect['title'][:50]}...")

    try:
        # 导航到创建页面
        await page.goto(DEFECT_CREATE_URL, wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # 1. 填写标题
        print("  → 填写标题...")
        title_input = page.locator('input[placeholder="请输入标题"]').first
        await title_input.click()
        await title_input.fill(defect["title"])

        # 2. 填写缺陷描述 (TinyMCE)
        print("  → 填写描述...")
        # 等待 TinyMCE 加载
        await page.wait_for_selector('.tox-tinymce', timeout=10000)
        # 切换到 iframe
        iframe = page.frame_locator('.tox-tinymce iframe').first
        await iframe.locator('body').click()
        await iframe.locator('body').fill(defect["desc"])

        # 3. 选择测试环境
        print("  → 选择测试环境...")
        await select_dropdown_option(page, '测试环境', DEVOPS_DEFAULTS["test_env"])

        # 4. 选择项目名称
        print("  → 选择项目名称...")
        await select_dropdown_option(page, '项目名称', DEVOPS_DEFAULTS["project_name"])

        # 5. 选择模块路径
        print("  → 选择模块路径...")
        await select_dropdown_option(page, '模块路径', DEVOPS_DEFAULTS["module_path"])

        # 6. 选择缺陷类型
        print("  → 选择缺陷类型...")
        await select_dropdown_option(page, '缺陷类型', DEVOPS_DEFAULTS["defect_type"])

        # 7. 选择发现阶段
        print("  → 选择发现阶段...")
        await select_dropdown_option(page, '发现阶段', DEVOPS_DEFAULTS["discovery_stage"])

        # 8. 选择优先级
        print("  → 选择优先级...")
        await select_dropdown_option(page, '优先级', DEVOPS_DEFAULTS["priority"])

        # 9. 选择来源
        print("  → 选择来源...")
        await select_dropdown_option(page, '来源', DEVOPS_DEFAULTS["source"])

        # 10. 设置处理人
        print(f"  → 设置处理人: {defect['handler_name']}...")
        await set_handler(page, defect["handler_id"], defect["handler_name"])

        # 11. 填写备注
        print("  → 填写备注...")
        await fill_note(page, defect["note"])

        # 12. 上传附件（如果有）
        if defect.get("screenshot_files") or defect.get("design_ref_files"):
            print("  → 上传附件...")
            await upload_files(page, defect)

        # 13. 保存
        print("  → 保存...")
        await save_defect(page)

        # 14. 获取缺陷编号
        defect_id = await get_defect_id(page)
        print(f"  ✅ 创建成功: {defect_id}")
        return defect_id

    except Exception as e:
        print(f"  ❌ 创建失败: {e}")
        return None


async def select_dropdown_option(page, label_text, option_text):
    """选择下拉框选项"""
    try:
        # 找到标签所在的行
        label = page.locator(f'label:has-text("{label_text}")').first
        parent = label.locator('xpath=..')
        # 点击下拉框
        dropdown = parent.locator('.ant-select, .kdfont-down').first
        await dropdown.click()
        await page.wait_for_timeout(300)
        # 选择选项
        option = page.locator(f'.ant-select-dropdown li:has-text("{option_text}")').first
        await option.click()
        await page.wait_for_timeout(300)
    except Exception as e:
        print(f"    ⚠️ 选择 {label_text} 失败: {e}")


async def set_handler(page, handler_id, handler_name):
    """设置处理人"""
    try:
        # 找到处理人字段
        handler_label = page.locator('label:has-text("处理人")').first
        parent = handler_label.locator('xpath=..')
        # 点击下拉框
        dropdown = parent.locator('.ant-select').first
        await dropdown.click()
        await page.wait_for_timeout(500)

        # 搜索处理人
        search_input = page.locator('.ant-select-dropdown input').first
        await search_input.fill(handler_name)
        await page.wait_for_timeout(500)

        # 选择搜索结果
        option = page.locator(f'.ant-select-dropdown li:has-text("{handler_name}")').first
        await option.click()
        await page.wait_for_timeout(300)
    except Exception as e:
        print(f"    ⚠️ 设置处理人失败: {e}")


async def fill_note(page, note):
    """填写备注"""
    try:
        # 找到备注字段（可能是 textarea 或 TinyMCE）
        note_label = page.locator('label:has-text("备注")').first
        parent = note_label.locator('xpath=..')
        textarea = parent.locator('textarea').first
        if await textarea.is_visible():
            await textarea.fill(note)
        else:
            # 可能是 TinyMCE
            iframe = parent.frame_locator('iframe').first
            await iframe.locator('body').fill(note)
    except Exception as e:
        print(f"    ⚠️ 填写备注失败: {e}")


async def upload_files(page, defect):
    """上传附件"""
    try:
        # 找到上传按钮
        upload_btn = page.locator('button:has-text("上传文件")').first
        await upload_btn.click()
        await page.wait_for_timeout(500)

        # 上传文件
        files = []
        for f in defect.get("screenshot_files", []):
            files.append(f"images/{f}")
        for f in defect.get("design_ref_files", []):
            files.append(f"images/{f}")

        if files:
            file_input = page.locator('input[type="file"]').first
            await file_input.set_input_files(files)
            await page.wait_for_timeout(1000)
    except Exception as e:
        print(f"    ⚠️ 上传附件失败: {e}")


async def save_defect(page):
    """保存缺陷"""
    try:
        # 使用 JavaScript 点击保存按钮（避免超时）
        await page.evaluate('''() => {
            const btn = document.querySelector('button:has-text("保存")') ||
                        document.querySelector('.ant-btn-primary');
            if (btn) {
                btn.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
            }
        }''')
        await page.wait_for_timeout(2000)
    except Exception as e:
        print(f"    ⚠️ 保存失败: {e}")


async def get_defect_id(page):
    """获取创建后的缺陷编号"""
    try:
        # 等待页面跳转或编号显示
        await page.wait_for_timeout(1000)
        # 尝试从 URL 获取
        url = page.url
        if 'defect/' in url:
            return url.split('defect/')[-1.split('?')[0]
        # 尝试从页面获取
        id_element = page.locator('.defect-id, .task-id').first
        if await id_element.is_visible():
            return await id_element.text_content()
    except:
        pass
    return "未知"


async def main():
    """主函数"""
    # 读取待创建缺陷
    with open('pending_defects.json', 'r', encoding='utf-8') as f:
        defects = json.load(f)

    # 过滤出待创建的
    pending_defects = [d for d in defects if d.get("status") == "pending"]
    print(f"共有 {len(pending_defects)} 条缺陷待创建")

    if not pending_defects:
        print("没有待创建的缺陷")
        return

    # 启动浏览器
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        # 创建缺陷
        for i, defect in enumerate(pending_defects):
            defect_id = await create_defect(page, defect, i, len(pending_defects))
            if defect_id:
                defect["status"] = "created"
                defect["devops_id"] = defect_id
            else:
                defect["status"] = "failed"

            # 更新 JSON 文件
            with open('pending_defects.json', 'w', encoding='utf-8') as f:
                json.dump(defects, f, ensure_ascii=False, indent=2)

            # 等待一下再创建下一条
            await page.wait_for_timeout(1000)

        await browser.close()

    # 打印结果
    created = [d for d in defects if d.get("status") == "created"]
    failed = [d for d in defects if d.get("status") == "failed"]
    print(f"\n=== 完成 ===")
    print(f"✅ 成功创建: {len(created)} 条")
    print(f"❌ 创建失败: {len(failed)} 条")


if __name__ == "__main__":
    asyncio.run(main())