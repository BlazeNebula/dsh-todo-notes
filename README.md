# dsh-todo-notes

DeepSeek Harness 的三区 TODO 便签：用户级、工作区级、会话级并列展示，数据按层级存放在 `$DSH_HOME/todo-notes/` 下。面板既可以浮动在页面上，也可以作为右侧栏页签打开，两侧共用同一份数据。

## 功能

- 浮动面板与右侧栏同一组件；浮动面板可拖动、调整宽高、折叠，收起后悬停临时展开；位置按视口比例记忆。
- 三区（用户 / 工作区 / 会话）并列、各自可收展；切换会话时只展开当前组。
- 组内可嵌套文件夹；一条 TODO 可被多个文件夹引用，主归属是默认文件夹；文件夹与条目都支持右键菜单（含全部展开 / 全部收起）。
- 支持框选多选、手柄拖拽排序、Ctrl 拖拽额外收录、批量重命名 / 优先级 / 移动 / 收录 / 删除。
- 优先级 T0~T9；同文件夹内拖动才会同化优先级。
- 点击条目打开 markdown 只读预览，正文由文件本身提供。
- 勾选状态三态：未勾选、中间态（减号，智能体勾选后等待人工确认）、已勾选（人工确认）。排序依次是未勾选、中间态、已勾选，再按优先级、手动顺序、创建时间。

## 数据布局

```
$DSH_HOME/todo-notes/
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

- 工作区 slug 与 DSH `sessions/` 目录使用同一套命名（例如 `E:\heshujiang\Deepseek-Harness` → `--E-heshujiang-Deepseek-Harness--`）。
- `group.json` 保存文件夹树（`folders`）与文件夹到条目的引用索引（`folderTodos`）；主归属节点 id 为 `__primary__`。
- 每个 TODO 是 markdown 文件，文件头属性：`id`、`title`、`status`（`todo` / `partial` / `done`）、`created`、`updated`、`source`（`user` 或 `session:<id>`）、`priority`、`primaryFolder`。
- `priority` 为 0~9，显示为 `T0`~`T9`：数字越小越优先（`T0` 最高），默认 `T1`。

## 设置

设置 → 插件 → TODO 便签：

- `agentWriteUserTodos`（默认关闭）：允许智能体改写、勾选或删除用户手写的 TODO。关闭时智能体只能修改自己创建的条目；打开后每次写入仍会逐次请求 DSH 审批，不会因为会话处于完全权限而跳过。

## Agent 工具

- `todo_notes_list`：按 `scope`（current / user / workspace / session）列出摘要，不返回正文。
- `todo_notes_read`：按 id 读取正文与属性。
- `todo_notes_create`：创建条目（默认写入当前会话组），每次请求审批。
- `todo_notes_update`：改标题、优先级、状态、文件夹；智能体把状态设为完成时最多写成中间态，只有人工勾选才会变成完成。
- `todo_notes_toggle`：勾选 / 取消勾选；勾选同样最多到中间态。
- `todo_notes_delete`：删除条目。

所有写工具在修改用户手写条目时受 `agentWriteUserTodos` 控制；无论设置如何，写前都会调用 DSH approval 服务，未获批准不写入。

## 开发

- Host 半：`lib/index.js`（数据层、`/dsh-todo-notes/api` 路由、Agent 工具、`Config` 设置）。
- Browser 半：`client/client.js`（`shell.overlay` 浮动面板与 `sidebar.right.pane.tab` 右栏页签）。
- 本地检查：`node --check lib/index.js` 与 `node --check client/client.js`。
- 数据目录默认 `$DSH_HOME/todo-notes`，可直接手工改 `group.json` 与 `.md` 验证渲染。
