# dsh-todo-notes

TODO 便签：DeepSeek Harness 的三区浮动便签面板。用户级、工作区级、会话级并列展示，数据按层级存放在 `$DSH_HOME/todo-notes/` 下。

## 首版范围

- 浮动、可拖拽、可折叠的便签面板；三区（用户 / 工作区 / 会话）并列、各自可收展。
- 每个用户、每个工作区、每个会话各持有一个便签组。
- 组内可嵌套「文件夹」，条目可在多个文件夹下被引用；主归属是默认文件夹。
- 点击条目在面板侧打开 markdown 只读预览。
- Agent 只读工具：`todo_notes_list`（摘要列表）与 `todo_notes_read`（单条正文）。

后续阶段（未实现）：编辑器集成与自建、Agent 写工具、权限与人工审批、工作区仓库共享读取。

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
- 每个 TODO 是一个 markdown 文件，文件头为 YAML 属性：`id`、`title`、`status`（`todo` / `done`）、`created`、`updated`、`source`（`user` 或 `session:<id>`）、`priority`、`primaryFolder`。
- `priority` 为 0~9，显示为 `T0`~`T9`：数字越小越优先（`T0` 最高），用户创建时默认 `T1`；所有级别都会显示标签，不存在「默认不渲染」的级别。
- 正文里可自由写 markdown；面板只读渲染，不修改文件。

## 面板操作

- 标题栏拖动移动面板，位置记在浏览器 localStorage。
- 标题栏右侧 `▴` 折叠面板；`▾` 展开。
- 每个区标题可点击折叠；组与文件夹可点击展开 / 收起。
- 切换会话时，工作区与会话区只展开当前组，其余组自动收起。
- 点击任意条目，在主面板左侧打开只读 markdown 预览，可拖动、可关闭。
- 条目排序：未完成在前、已完成在后；同状态内按优先级 `T0`→`T9` 升序，同优先级按创建时间正序。

## 智能体优先级规则（写工具阶段）

- 智能体创建 TODO 且用户未显式指定优先级时，必须先读目标便签组已有条目的标题与优先级，再决定新条目插入哪个 `T` 级别；不得静默使用默认值。
- 读取标题与优先级即可，不需要载入正文；除非用户在会话里明确要求读正文。
- 当前首版只提供只读工具，写工具与上述判断逻辑留到下一阶段实现。

## Agent 工具

- `todo_notes_list`：按 `scope`（current / user / workspace / session）列出条目摘要，含 id、标题、状态、优先级、来源、所属文件夹；不返回正文。
- `todo_notes_read`：按 id 读取单条正文与属性。

## 开发

- Host 半：`lib/index.js`（数据层、`/dsh-todo-notes/api` 只读路由、两个 Agent 工具）。
- Browser 半：`client/client.js`（`shell.overlay` 浮动面板与预览）。
- 本仓库通过 bundle 方式安装：`plugin_manager install_bundle target=<仓库绝对路径>`。安装后 Host 半可能立即热加载，但 Client 半（`shell.overlay` 面板）要完全重启 DSH 才会注册到客户端模块清单。
- 本地检查：`node --check lib/index.js` 与 `node --check client/client.js`。
- 数据目录默认是 `$DSH_HOME/todo-notes`（本机即 `E:\heshujiang\Deepseek-Harness\todo-notes`），可直接手工改 `group.json` 与 `.md` 验证面板渲染。
