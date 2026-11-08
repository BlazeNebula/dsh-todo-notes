# dsh-todo-notes

DeepSeek Harness 的三区 TODO 便签：用户级、工作区级、会话级并列展示，数据按层级存放在 `$DSH_HOME/todo-notes/` 下。面板既可以浮动在页面上，也可以作为右侧栏页签打开，两侧共用同一份数据。

## 安装

1. 打开 DSH 的**插件**页。
2. 在插件市场里找到「TODO 便签」并安装；还没有收录时，也可以从本仓库的本地目录安装。
3. 安装完成后，浮动面板会出现在页面右下角。改动客户端代码后按 Ctrl+R 生效；新增插件或设置项时，需要完全退出 DSH（含托盘图标）再启动。

## 快速开始

- 面板头部可以拖动、调整宽高、折叠；折叠后保留一个小条，悬停可临时展开。
- 每个组右侧的「+」在当前组新建 TODO；文件夹行的图标可以新建子文件夹。
- 单击条目打开预览；拖动条目可以调整顺序，Ctrl+拖动可以把它额外收录到另一个文件夹。
- 右键文件夹或条目可以重命名、移动、管理收录、删除；批量操作在框选后出现。
- 右键组标题可以全部展开或全部收起。
- 预览右上角的编辑按钮进入正文编辑；标题行会变成输入框，正文会按设置的间隔自动保存。

## 功能

- 浮动面板与右侧栏同一组件；浮动面板可拖动、调整宽高、折叠，收起后悬停临时展开；位置按视口比例记忆。
- 三区（用户 / 工作区 / 会话）并列、各自可收展；切换会话时只展开当前组。
- 组内可嵌套文件夹；一条 TODO 可被多个文件夹引用，主归属是默认文件夹；文件夹与条目都支持右键菜单（含全部展开 / 全部收起）。
- 支持框选多选、手柄拖拽排序、Ctrl 拖拽额外收录、批量重命名 / 优先级 / 移动 / 收录 / 删除。
- 优先级 T0~T9；同文件夹内拖动才会同化优先级。
- 点击条目打开 markdown 只读预览，正文由文件本身提供；预览、批量新建、批量重命名被拖动后会变成独立窗口，可同时保留多份，位置与内容持久化，刷新 DSH 后原位恢复。
- 预览右上角的编辑按钮进入正文编辑：标题行变成输入框可直接改名，正文只编辑 frontmatter 之后的原文，复用带行号的输入框；输入框随行数自动增高，也可以拖动右下角自由拉高。正文与标题各自独立计时，停止输入后按设置的间隔分别自动保存；关窗时若仍有未保存内容会补写一次。
- 勾选状态三态：未勾选、中间态（减号，智能体勾选后等待人工确认）、已勾选（人工确认）。排序依次是未勾选、中间态、已勾选，再按优先级、手动顺序、创建时间。

## 数据布局

```
$DSH_HOME/todo-notes/
  windows.json                            # 保留浮窗的位置与内容
  user/                                  # 用户级组
    group.json
    todos/<todoId>.md
  workspaces/<工作区 slug>/
    group.json
    todos/<todoId>.md
    sessions/<会话 id>/
      group.json
      todos/<todoId>.md
```

- 工作区 slug 与 DSH `sessions/` 目录使用同一套命名（例如 `D:\work\demo` → `--D-work-demo--`）。
- `group.json` 保存文件夹树（`folders`）与文件夹到条目的引用索引（`folderTodos`）；主归属节点 id 为 `__primary__`。
- `windows.json` 保存被拖动后保留的浮窗（预览 / 批量新建 / 批量重命名）的位置与内容，跨 DSH 重启恢复。
- 每个 TODO 是 markdown 文件，文件头属性：`id`、`title`、`status`（`todo` / `partial` / `done`）、`created`、`updated`、`source`（`user` 或 `session:<id>`）、`priority`、`primaryFolder`。
- `priority` 为 0~9，显示为 `T0`~`T9`：数字越小越优先（`T0` 最高），默认 `T1`。

## 设置

设置 → 插件 → TODO 便签：

- `agentWriteUserTodos`（默认关闭）：允许智能体改写、勾选或删除用户手写的 TODO。关闭时智能体只能修改自己创建的条目；打开后每次写入仍会逐次请求 DSH 审批，不会因为会话处于完全权限而跳过。
- `bodyAutosaveMs`（默认 5000）：正文编辑停止输入后等待多久自动保存，单位毫秒，可调范围 1000~60000。

## Agent 工具

- `todo_notes_list`：按 `scope`（current / user / workspace / session）列出摘要，不返回正文。
- `todo_notes_read`：按 id 读取正文与属性。
- `todo_notes_create`：创建条目（默认写入当前会话组），每次请求审批。
- `todo_notes_update`：改标题、优先级、状态、文件夹；智能体把状态设为完成时最多写成中间态，只有人工勾选才会变成完成。
- `todo_notes_toggle`：勾选 / 取消勾选；勾选同样最多到中间态。
- `todo_notes_delete`：删除条目。

所有写工具在修改用户手写条目时受 `agentWriteUserTodos` 控制；无论设置如何，写前都会调用 DSH approval 服务，未获批准不写入。

## 代码结构

```
lib/
  index.js           入口：Config 与 apply，只做组装
  core/paths.js      数据根目录、工作区 slug、文件读取
  core/text.js       frontmatter 拆分与首行提取
  core/groups.js     组结构、条目摘要、三区负载、按 id 查条目
  core/write.js      文件夹树、条目字段与写接口
  core/runtime.js    运行时设置（审批策略、自动保存间隔）
  core/http.js       /dsh-todo-notes/api
  core/tools.js      Agent 工具与 DSH 审批
client/
  client.js          构建产物（DSH 只加载这一个文件，约 4000 行）
  src/               源码分段，按 build-client.mjs 的顺序拼成 client.js
   00-bootstrap.js   模块工厂外壳与常量
   10-styles.js      样式表
   20-storage.js     本地存储与几何
   30-markdown.js    markdown 渲染
   40-priority.js    优先级色与排序
   50-icons.js       图标表
   60-panel.js       组件：状态与副作用
   62-panel-layout.js 面板几何、拖动、缩放、预览开合
   63-panel-folders.js 文件夹与条目操作
   64-panel-batch.js 多选、框选、批量操作
   65-panel-rows.js  条目 / 文件夹 / 组的渲染
   66-panel-surface.js 三区表面、面板头部、预览
   67-panel-menus.js 右键菜单与优先级菜单
   69-pins.js        可保留浮窗：拖动成窗、位置与内容持久化、正文自动保存
   69b-pins-render.js 浮窗渲染（预览 / 批量新建 / 批量重命名）
   68-panel-tail.js  批量面板、确认浮层与根节点
   90-entry.js       样式注入、导出与注册
scripts/
  build-client.mjs    拼接 client/src 生成 client/client.js
```

除构建产物 `client/client.js` 外，所有源码文件都在 500 行以内。

## 开发

- 修改 `client/src/*` 后运行 `node scripts/build-client.mjs`（或 `npm run build:client`）重新生成 `client/client.js`；直接改生成文件会在下次构建被覆盖。
- 检查语法：`npm run check`。
- 数据目录默认 `$DSH_HOME/todo-notes`，可直接手工改 `group.json` 与 `.md` 验证渲染。
- `client/src` 的分段共享同一个模块工厂作用域：这是 DSH 客户端加载器只接受单文件所决定的，拼接后的 `client/client.js` 才是浏览器执行的代码。

## 隐私与数据

- 所有 TODO、文件夹与浮窗位置都保存在本机的 `$DSH_HOME/todo-notes/`，不会上传到任何服务器。
- 插件不发起网络请求；它只注册一个本机 DSH 路由（`/dsh-todo-notes/api`）供面板读写本地文件。
- 智能体的写入必须经过 DSH 的审批服务；审批被拒绝或会话不允许审批时不会写入。

## 许可

MIT，见 [LICENSE](LICENSE)。


