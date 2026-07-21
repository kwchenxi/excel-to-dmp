---
name: excel-to-dmp
description: 读取飞书/腾讯文档/金山文档/本地Excel中的BUG记录（模块、问题描述、截图、处理人、走查人等），自动在金蝶DMP缺陷管理系统逐条创建缺陷单，包括附件上传和字段映射。适用于缺陷批量录入场景，替代手动逐条填写，单条约20秒完成录入。
---

# BUG 记录批量录入金蝶 DMP

## 数据源策略

按数据源选择最优提取方式：

| 数据源在哪 | 推荐脚本 | 图片 | 说明 |
|-----------|---------|------|------|
| **飞书** | `extract_feishu.py`（API）| ✅ 自动下载 | 项目重度依赖截图，**飞书 API 是唯一能自动拿图的途径**，优先用 |
| **腾讯文档** | `extract_tencent.py`（API）| ✅ 自动下载 | 需配置腾讯开放平台 API 凭证 |
| **金山文档** | `extract_wps.py`（API）| ✅ 自动下载 | 需配置 WPS 开放平台 API 凭证 |
| **本地 Excel** | `extract_excel.py` | ❌ 需手动补 | 通用，导入 .xlsx 后使用 |

### 关键差异：图片

- **飞书 API**：能通过 fileToken 自动下载图片（本项目 132 张截图的核心来源）
- **Excel 文件**：各平台导出 xlsx 时**普遍丢失图片**（飞书/腾讯/金山均如此），需从原平台手动下载图片放 `images/`，按 `r{行号}_screenshot_xxx.png` 命名

> ⚠️ 因此：**数据源是飞书时，优先用 `extract_feishu.py`（带图）**；只有数据源不是飞书、或不需要图片时，才用 `extract_excel.py`。

### 提取脚本

| 脚本 | 输入 | 输出 |
|------|------|------|
| `scripts/extract_feishu.py` | wiki token | pending_defects.json + images/ |
| `scripts/extract_tencent.py` | 腾讯文档 URL | pending_defects.json + images/ |
| `scripts/extract_wps.py` | 金山文档 URL | pending_defects.json + images/ |
| `scripts/extract_excel.py` | Excel 文件路径 | pending_defects.json（无图）|

所有脚本输出统一的 `pending_defects.json`，下游 `create_batch.mjs` 不区分来源。

### 统一输出格式（所有数据源）

```json
{
  "row": 2,
  "module": "日历",
  "title": "【进度】【模块】描述",
  "desc": "问题描述",
  "handler_name": "姓名",
  "handler_id": "工号",
  "note": "备注",
  "screenshot_files": [],
  "design_ref_files": [],
  "status": "pending"
}
```

---

## 触发场景

当用户说以下内容时触发此 Skill：
- "帮我把飞书/腾讯/金山/Excel 表格的缺陷填到 DevOps"
- "批量创建缺陷单"
- "从在线表格创建 DevOps 缺陷"
- 发送飞书/腾讯/金山文档链接并要求创建缺陷

## ⚠️ 人工确认节点（执行前必做）

Claude 执行此 Skill 时，**严禁自行猜测以下信息**，必须停下来向用户确认：

### 首次使用（config.yaml 未配置或为空）

Claude 必须先提取数据，然后**一次性集中确认**：

1. **处理人 → 工号映射**
   - Claude 列出表格中所有处理人姓名
   - 用户提供每个姓名对应的 DevOps 工号
   - Claude 生成 `handler_mapping` 写入 config.yaml

2. **默认值与必填项确认**
   - 模块路径（如"会议(LJ0001-0009)"）
   - 发现阶段（如"dev测试"）
   - 优先级、缺陷类型、测试环境等
   - **关联故事编码**（必填，搜索 API 不可用。若飞书表格有该列则用表格值，否则问用户）
   - 其他 DevOps 必填字段

   > ⚠️ 关联故事编码可能每批不同。若用户本次提供的编码与 config 默认值不同，以本次为准。

3. **列名映射确认**
   - Claude 推断飞书列名 → DevOps 字段的映射
   - 用户确认或修正

4. **标题/备注模板确认**
   - Claude 展示模板预览
   - 用户确认或修改

### 执行中遇到新值

当 Claude 发现 config.yaml 未覆盖的新值时，**暂停并询问**：

1. **新处理人**：表格中出现 config 未映射的姓名
   - Claude："row 145 处理人'王五'不在映射表，工号是？"

2. **新模块**：表格中出现 config 未配置的模块路径

3. **数据异常**：
   - 处理人字段不像人名（如"需要组件库去改"）
   - 必填字段为空
   - Claude 暂停询问是否跳过或如何处理

### 确认呈现原则

- **批量展示，不逐条问**：首次配置时，一次性列出所有待确认项
- **静默复用已知值**：config 已有的映射，直接使用不重复问
- **只问不确定的**：只询问 config 未覆盖的新值或每批必变的值

---

## 工作流程

### 第 1 步：解析飞书链接

从用户提供的链接中提取 wiki token：
```
https://my.feishu.cn/wiki/{wiki_token}
```

### 第 2 步：读取配置

读取 `config.yaml` 获取：
- 飞书列名映射
- DevOps 默认值
- 处理人 ID 映射

### 第 3 步：提取飞书数据

运行 `scripts/extract_feishu.py` 提取表格数据：
```bash
python scripts/extract_feishu.py --wiki-token {token} --config config.yaml
```

输出：`pending_defects.json` 包含所有待创建的缺陷数据

### 第 4 步：提取图片

同一脚本会下载所有嵌入图片到 `images/` 目录

### 第 5 步：填充 DevOps 表单

使用 browser-use 工具自动化填充：

1. **打开 DevOps 新建缺陷页面**
2. **逐条填充**：
   - 标题：`【{进度}】【{模块}】{问题描述}`
   - 缺陷描述：使用 TinyMCE API
   - 处理人：使用 `onBaseDataSelectItem(personId)`
   - 关联故事：使用 `onBaseDataSelectItem(storyId)`
   - 备注：原始备注 + 走查人 + 设计稿参考文字
   - 附件：使用 `upload_file` 上传问题截图和设计稿参考图片
3. **保存**：拦截保存 API 确认成功
4. **下一条**：创建新空白表单，重复上述步骤

## 关键技术细节

### 飞书 API 认证

```python
# 获取 tenant_access_token
POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
{
  "app_id": "{from config}",
  "app_secret": "{from config}"
}
```

### DevOps 表单字段操作

```javascript
// 设置标题（使用 execCommand 确保 React 状态同步）
component.execCommand('insertText', false, title)

// 设置处理人（basedata 类型）
component.onBaseDataSelectItem(personId, false)

// 设置缺陷描述（TinyMCE）
tinymce.get('editor_id').setContent(htmlContent)

// 上传文件
// 使用 browser-use 的 upload_file 工具，uid 为上传按钮
```

### 字段映射规则

**必填字段**：
- 标题 ← `【{进度}】【{模块}】{问题描述}`
- 缺陷描述 ← 飞书"问题描述"列
- 测试环境 ← 默认 "LingeeBeta 版"
- 项目名称 ← 默认 "灵基AIOS项目"
- 模块路径 ← 默认 "AI能力中心（R020334）"
- 缺陷类型 ← 默认 "交互体验"
- 发现阶段 ← 默认 "验收测试"
- 优先级 ← 默认 "高"
- 来源 ← 默认 "手工新增"
- 关联故事 ← 默认特定故事 ID

**动态字段**：
- 处理人 ← 飞书"处理人"列（需 ID 映射）
- 备注 ← 飞书"备注" + "走查人{走查人}" + 设计稿参考文字
- 附件 ← 飞书"问题截图" + "设计稿参考"（如果是图片）

## 配置说明

详见 `config.yaml`：
- `feishu_columns`：飞书列名映射
- `devops_defaults`：DevOps 默认值
- `handler_mapping`：处理人姓名 → 系统 ID 映射
- `feishu_api`：飞书 API 凭证

## 浏览器自动化踩坑记录（browser-use MCP）

### click 超时问题
工具栏按钮（修改、保存、新增等）的 `click` 操作会超时 5000ms。
**解决方案**：使用 `evaluate_script` + `dispatchEvent` 代替：
```javascript
el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}))
```

### upload_file 正确用法
- 必须使用 **"上传文件"按钮** 的 uid
- **不要**使用页面底部的 "选择文件" button（隐藏的 file input），upload_file 对它无效
- 有时第一次 upload_file 不生效，需要重试一次

### 打开编辑表单
通过 evaluate_script 选中行 checkbox + 双击行：
```javascript
row.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))
```

### 搜索过滤器清除
- 搜索标签使用 `.search-label` class
- 清除图标使用 `.kdfont-qingkong2` class

### 缺陷编号动态分配
表单打开时的编号 ≠ 最终保存的编号，以保存后系统分配的编号为准。

### "我处理的"列表过滤
缺陷列表默认显示当前用户的缺陷，无法直接查看其他处理人的缺陷。
需要关闭"我处理的"过滤标签才能搜索其他人的缺陷。

## Playwright 方案（browser-use MCP 不可用时）

当前环境未配置 browser-use MCP，改用 **Playwright + Chrome CDP** 实现浏览器自动化。脚本在 `scripts/` 下。

### 启动浏览器（每次会话一次）

```bash
node scripts/launch_cdp.mjs
```
- 用系统 Google Chrome 启动，暴露 CDP 端口 9222
- 登录态保存在 `.browser-profile/`，下次复用
- 浏览器保持运行，脚本通过 `connectOverCDP('http://localhost:9222')` 连接
- **依赖**：`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright`（用系统 Chrome，无需下载 Chromium）

### 创建缺陷

```bash
# 单条（前提：浏览器里已手动打开「新建缺陷」表单）
node scripts/create_one.mjs <row> [storyValue] [saveMethod]

# 批量（遍历所有 pending，每条等待手动打开新建表单）
node scripts/create_batch.mjs [storyValue] [saveMethod]
```
- `row`: pending_defects.json 的行号
- `storyValue`: 关联故事搜索词/编码（**当前搜索 API 返回空，需用户提供编码**）
- `saveMethod`: `dispatch`(默认) | `click` | `enter`

### 字段定位（DevOps 用金蝶苍穹平台 `kd-cq-*` 组件，非标准 React）

| 字段 | 定位方式 |
|------|---------|
| 标题 | `input[placeholder="名称不能为空"]:visible` |
| 描述 | TinyMCE：`window.tinymce.activeEditor.setContent(html)` |
| 处理人/发现阶段/关联故事（basedata） | `.kd-cq-field.kd-cq-basedata:visible` → fill 关键词 → 选 `.kd-cq-dropdown-menu-item` |
| 备注（textarea） | `.kd-cq-field.kd-cq-textarea:visible` |
| 保存按钮 | `#bar_save`（opk=save，是 `<div>` 不是 `<button>`） |

### 关键踩坑（Playwright 方案）

1. **所有定位必须加 `:visible`**：重新打开表单后 DOM 会残留旧实例，`.first()` 会定位到隐藏的 data-input 导致超时。
2. **basedata 是搜索型，不是点击展开**：必须 `fill` 关键词触发搜索，再选 `.kd-cq-dropdown-menu-item`（第一项通常是"新增"，要跳过）。
   - 处理人：搜姓名（如"孔维辰曦"）
   - 发现阶段：搜"dev"选"dev测试"。**选项是 release测试/dev测试/灰度发布/编码&自测/sit测试/发布完成，没有"验收测试"**
3. **关联故事搜索 API 返回空**：`getLookUpList` 始终返回 `data:[]`，自动和手动都选不了。关联故事是**必填(*)**，必须解决——需用户提供故事编码直接设值。
4. **`#bar_save` 的 dispatchEvent click**：验证失败时触发页面跳转（退出表单）但不发 POST；验证通过后应能正常保存（待关联故事解决后验证）。
5. **会话易过期**：操作超过 ~30 分钟触发"会话缓存丢失，请重新登录"，需重新登录。
6. **config 默认值部分过时**：`module_path="AI能力中心(R020334)"`、`discovery_stage="验收测试"` 与实际 DevOps 不符。实际用「会议(LJ0001-0009)」+「dev测试」（用户确认）。

### 已验证可用的操作

- ✅ 标题 fill、描述 TinyMCE setContent、处理人搜索选择、发现阶段搜索选择、备注 fill
- ✅ 字段 verify（一次性 dump，不来回验证）
- ⏳ 保存：dispatchEvent click（待关联故事填好后验证是否触发 POST + 编号变化）
- ❌ 关联故事：搜索 API 空，阻塞中

## 错误处理

1. **飞书 API 失败**：检查 App ID/Secret 是否正确，应用是否已发布
2. **处理人找不到**：使用 `handler_mapping.default` 指派的默认处理人
3. **图片下载失败**：记录错误，继续处理其他缺陷
4. **DevOps 保存失败**：检查必填字段是否完整，重试一次

## 输出

完成后生成报告：
- 成功创建的缺陷数量
- 失败的缺陷及原因
- 创建时间统计
