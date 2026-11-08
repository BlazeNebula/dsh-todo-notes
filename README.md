# TODO 便签（dsh-todo-notes）

DeepSeek Harness 的三层 TODO 便签：用户级、工作区级、当前会话级各一组，数据按层级落在本机的 `$DSH_HOME/todo-notes/`。便签可以浮在页面上，也可以作为右侧栏页签打开；两边读写的都是同一份数据。

## 能做什么

- 三层并列：用户的长期事项、工作区事项、当前会话事项分开记录，切换会话只展开当前组；当前工作区、当前会话的组标题显示为斜体。
- 组内可以建文件夹，文件夹可嵌套；一条 TODO 有一个主归属，同时能被多个文件夹收录；点文件夹行左侧的三角或文件夹图标都能收展，文件夹里的条目比文件夹多缩进一级，一眼能看出从属关系。
- 优先级 T0~T9，T0 最高；支持拖动排序、跨文件夹移动，按住 Ctrl 拖动把条目额外收录到另一个文件夹。
- 框选多选后可以批量移动、批量收录、批量改优先级、批量重命名、批量删除。
- 点条目打开 markdown 预览；预览可以保留成独立窗口，位置、内容和尺寸跨刷新与重启恢复。
- 预览里能直接改标题和正文；正文只改 frontmatter 之后的原文，带行号、随行数变高，停止输入后自动保存。
- 勾选三态：未勾选、中间态（智能体勾选，等待人工确认）、已勾选（人工确认）。人工勾选才是真正的完成。
- 智能体可以通过工具列出、读取、创建、修改、勾选和删除便签；涉及用户手写条目时受设置与 DSH 审批控制。

## 安装

1. 打开 DSH 的**插件**页，在插件市场里搜索「TODO 便签」安装。
2. 市场未收录时，用插件页的安装入口填入仓库地址 `https://github.com/BlazeNebula/dsh-todo-notes`，或选择本地目录安装。
3. 装好后页面右上角出现浮动面板；右侧栏页签里也会多一个「TODO 便签」。

客户端改动按 Ctrl+R 生效。新增插件、设置项或页签类型时，需要完全退出 DSH（包括托盘图标）再启动。

## 使用

### 面板与右侧栏

- 面板头部可拖动，右下角可调整宽高，标题栏按钮可折叠；折叠后悬停会临时展开。
- 面板位置按窗口比例保存，换分辨率或调整 DSH 窗口大小后仍在相近位置。
- 「显示到右侧栏」打开右侧栏的 TODO 页签；两个入口可以同时存在，改动会互相刷新。
- 每个被拖动过的预览、批量新建、批量重命名都会变成独立窗口，可同时保留多份；同一条目的预览只保留一个，再次打开会把已有窗口置顶。

### 组织条目

- 组标题右侧的图标用于新建条目、新建文件夹、复制路径或会话 ID。
- 文件夹行支持双击重命名、右键菜单、拖动调整层级与顺序。
- 拖动条目到另一个文件夹会移动它；按住 Ctrl 拖动只增加收录，不改变主归属。
- 面板首次打开时按“未勾选 → 中间态 → 已勾选”排序，同状态下按优先级、手动顺序、创建时间排列。

### 新建与批量

- 组标题右侧的「+」新建条目，文件夹行的「+」新建子文件夹；批量新建按行拆成多条，行号栏会随行数增长。
- 起手拖动会拉出选框，选中多行后出现批量菜单；Shift 点击可连续选择。
- 批量菜单支持移动、管理收录、优先级、重命名、全部展开 / 收起、删除。管理收录与单条一致，第一项是「无文件夹」。

### 预览与编辑

- 单击条目打开临时预览，点击其他条目会替换内容；拖动预览标题栏会把它保留下来。
- 预览头部显示状态、所属文件夹、优先级、创建时间与来源；面板里改勾选、优先级、文件夹或标题后，已保留的预览会同步刷新。
- 右上角编辑按钮进入编辑：标题行变成输入框，正文用带行号的输入框，frontmatter 不出现在编辑区。
- 正文框随行数自动增高，也可以拖动右下角自由拉高；标题与正文各自计时，停止输入后自动保存，关窗前会把未保存内容补写一次。

### 勾选状态

- 单击勾选框会在未勾选与已勾选之间切换；双击勾选框区域直接完成。
- 智能体只能把条目写成中间态；人工点击中间态才会确认完成。
- 取消勾选退回未完成。

### 右键菜单

- 文件夹：重命名、移动到、解除文件夹（里面的条目退回主归属）、删除整个文件夹（连同条目）。
- 条目：重命名、移动到、管理收录、优先级、删除。
- 组标题：全部展开、全部收起。

## 设置

设置 → 内置插件 → TODO 便签：

- 已完成 / 半完成条目的整行透明度；滑块调，右侧数字可直接输入。
- 优先级颜色：T0~T9 共 10 个颜色，点色块用取色器改，也可以直接填十六进制值。
- 「恢复默认」把这三项重置回初始值；「保存」后立即应用到所有面板。

外观设置存在数据目录的 `ui-settings.json`。

插件 Config 另提供两个供宿主读取的字段（`agentWriteUserTodos`、`bodyAutosaveMs`），用于控制 Agent 写权限与正文自动保存间隔。

- `agentWriteUserTodos`（默认关闭）：允许智能体改写、勾选或删除用户手写的 TODO。关闭时智能体只能修改自己创建的条目；打开后每次写入仍会逐次请求 DSH 审批。
- `bodyAutosaveMs`（默认 5000）：正文编辑停止输入后等待多久自动保存，单位毫秒，范围 1000~60000。

## Agent 工具

| 工具 | 作用 |
| --- | --- |
| `todo_notes_list` | 按 `scope`（current / user / workspace / session）列摘要，不返回正文 |
| `todo_notes_read` | 按 id 读取正文与属性 |
| `todo_notes_create` | 创建条目，默认写入当前会话组 |
| `todo_notes_update` | 改标题、优先级、状态、文件夹 |
| `todo_notes_toggle` | 勾选或取消勾选 |
| `todo_notes_delete` | 删除条目 |

所有写工具在修改用户手写条目时受 `agentWriteUserTodos` 控制；无论设置如何，写前都会调用 DSH approval 服务，未获批准不写入。智能体把状态设为完成时最多写成中间态。

## 数据存放

```
$DSH_HOME/todo-notes/
  windows.json                    保留窗口的位置、尺寸与内容
  user/                           用户级组
    group.json
    todos/<todoId>.md
  workspaces/<工作区 slug>/
    group.json
    todos/<todoId>.md
    sessions/<会话 id>/
      group.json
      todos/<todoId>.md
```

- 工作区 slug 与 DSH `sessions/` 目录同一套命名，例如 `D:\work\demo` → `--D-work-demo--`。
- `group.json` 保存文件夹树（`folders`）和文件夹到条目的引用索引（`folderTodos`）；主归属节点 id 是 `__primary__`。
- 每个 TODO 是 markdown 文件，frontmatter 字段：`id`、`title`、`status`（`todo` / `partial` / `done`）、`created`、`updated`、`source`（`user` 或 `session:<id>`）、`priority`、`primaryFolder`。
- 数字形式的标题会以带引号的字符串写回，避免被解析成数字后丢掉标题。

## 隐私

- 所有 TODO、文件夹与窗口状态只写本机的 `$DSH_HOME/todo-notes/`，不上传。
- 插件不发起网络请求，只注册本机 DSH 路由 `/dsh-todo-notes/api` 供面板读写本地文件。
- 智能体写入必须经过 DSH 审批；拒绝或无法审批时不写入。

## 开发

```
lib/
  index.js            入口：Config 与 apply
  core/paths.js       数据根目录、工作区 slug、文件读取
  core/text.js        frontmatter 拆分与首行提取
  core/groups.js      组结构、条目摘要、三区负载、按 id 查条目
  core/write.js       文件夹树、条目字段与写接口
  core/runtime.js     运行时设置
  core/windows.js     保留窗口的读写
  core/http.js        /dsh-todo-notes/api
  core/tools.js       Agent 工具与 DSH 审批
client/
  client.js           构建产物，DSH 只加载这一个文件
  src/                源码分段，按 build-client.mjs 的顺序拼接
scripts/
  build-client.mjs    拼接 client/src 生成 client/client.js
```

- 修改 `client/src/*` 后运行 `node scripts/build-client.mjs` 或 `npm run build:client`；直接改 `client/client.js` 会在下次构建被覆盖。
- `npm run check` 检查全部源码语法。
- 除构建产物 `client/client.js` 外，源码文件都在 500 行以内。`client/src` 共享同一个模块工厂作用域，这是 DSH 客户端只接受单文件加载所决定的。
- 数据目录默认 `$DSH_HOME/todo-notes`，可直接改 `group.json` 与 `.md` 验证渲染。

## 许可

MIT，见 [LICENSE](LICENSE)。
