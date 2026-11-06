/**
 * Agent 工具层：只读工具与带 DSH 审批的写工具。
 */
import { PRIMARY, workspaceSlug, normalizeSessionId } from './paths.js'
import { buildGroupsPayload, findTodoBody } from './groups.js'
import { groupDirFor, patchTodo, handleWrite } from './write.js'

/** 工具里通用的 cwd / 会话信息提取。 */
function toolContext(exec) {
  const session = exec !== null && exec !== undefined && exec.agent !== null && exec.agent !== undefined ? exec.agent.session : null
  const cwd = session !== null && session !== undefined && session.header !== null && session.header !== undefined && typeof session.header.cwd === 'string' ? session.header.cwd : process.cwd()
  const sessionId = session !== null && session !== undefined && typeof session.id === 'string' ? session.id : ''
  return { cwd, sessionId }
}

/** 便签组对象 → 写接口使用的 key。 */
function groupKeyOf(group) {
  if (group.kind === 'user') return 'user'
  if (group.kind === 'workspace') return 'workspace:' + group.owner.slug
  return 'session:' + normalizeSessionId(group.owner.sessionId)
}

/**
 * 每次 Agent 写操作都向 DSH approval 服务要一次授权。
 * 返回 'allowed' | 'missing' | 'denied' | 'error'；只有 allowed-once 算批准，
 * 其余（含服务缺失、抛错、取消、不可用）一律拒绝。
 */
async function askApproval(ctx, exec, toolName, reason) {
  const approval = typeof ctx.get === 'function' ? ctx.get('approval') : null
  if (approval === null || approval === undefined) return 'missing'
  try {
    const outcome = await approval.request({
      agent: exec.agent,
      toolName,
      reason,
      callId: exec.callId,
      signal: exec.signal,
    })
    return outcome === 'allowed-once' ? 'allowed' : 'denied'
  } catch {
    return 'error'
  }
}

/** 拒批文案。 */
function refusalText(status) {
  if (status === 'missing') return '当前 DSH 没有提供审批服务，写操作已取消。'
  if (status === 'denied') return 'DSH 审批未通过，写操作已取消。'
  return '审批请求失败，写操作已取消。'
}

function sourceLabel(source) {
  if (typeof source !== 'string' || source === '' || source === 'user') return '自定义'
  return '智能体'
}

function renderTodoLine(todo) {
  const flag = todo.status === 'done' ? '[x]' : todo.status === 'partial' ? '[-]' : '[ ]'
  const badge = ` T${Number.isFinite(todo.priority) ? todo.priority : 0}`
  return `- ${flag} ${todo.title}${badge}  (${todo.id}, ${sourceLabel(todo.source)}, 文件夹: ${todo.primaryFolder === PRIMARY ? '主归属' : todo.primaryFolder})`
}

function renderGroupText(group) {
  const lines = [`## ${group.title}（${group.kind === 'user' ? '用户级' : group.kind === 'workspace' ? '工作区级' : '会话级'}，未完成 ${group.count} 条）`]
  const byFolder = group.folderTodos
  const folderOrder = []
  const walk = (folders, depth) => {
    for (const folder of Array.isArray(folders) ? folders : []) {
      if (folder === null || typeof folder !== 'object' || typeof folder.id !== 'string') continue
      folderOrder.push({ folder, depth })
      walk(folder.children, depth + 1)
    }
  }
  walk(group.folders, 0)
  for (const entry of folderOrder) {
    const ids = Array.isArray(byFolder[entry.folder.id]) ? byFolder[entry.folder.id] : []
    const todos = ids.map((id) => group.todos.find((item) => item.id === id)).filter(Boolean)
    const indent = '  '.repeat(entry.depth)
    lines.push(`${indent}- 📁 ${entry.folder.name || entry.folder.id}（${todos.length}）`)
    for (const todo of todos) lines.push(indent + '  ' + renderTodoLine(todo))
  }
  const referenced = new Set(Object.values(byFolder).flat())
  const loose = group.todos.filter((item) => !referenced.has(item.id))
  if (loose.length > 0) {
    lines.push('  - 未在任何文件夹中引用：')
    for (const todo of loose) lines.push('    ' + renderTodoLine(todo))
  }
  return lines.join('\n')
}

const listTool = {
  name: 'todo_notes_list',
  description:
    '列出 TODO 便签：用户级、工作区级、当前会话级三组。返回条目摘要（id、标题、状态、优先级、来源、所属文件夹）而不返回正文；先用它找 id，再用 todo_notes_read 读某一条的正文。',
  parameters: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['current', 'user', 'workspace', 'session'],
        description: 'current=用户级+当前工作区+当前会话（默认）；user=仅用户级；workspace=仅当前工作区；session=仅当前会话。',
      },
      includeDone: { type: 'boolean', description: '是否包含已完成条目，默认 false。' },
    },
    additionalProperties: false,
  },
  output: {
    schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    render: (_args, value) => [{ type: 'text', text: typeof value.text === 'string' ? value.text : '' }],
  },
  async execute(args, exec) {
    const input = args !== null && typeof args === 'object' ? args : {}
    const scope = typeof input.scope === 'string' ? input.scope : 'current'
    const includeDone = input.includeDone === true
    const context = toolContext(exec)
    const payload = await buildGroupsPayload({
      cwd: context.cwd,
      session: context.sessionId,
      sessionTitle: '',
    })
    const groups = []
    if (scope === 'user') groups.push(payload.user)
    else if (scope === 'workspace') {
      for (const group of payload.workspaces) if (group.current) groups.push(group)
    } else if (scope === 'session') {
      for (const group of payload.sessions) if (group.current) groups.push(group)
    } else {
      groups.push(payload.user)
      for (const group of payload.workspaces) if (group.current) groups.push(group)
      for (const group of payload.sessions) if (group.current) groups.push(group)
    }
    const lines = []
    for (const group of groups) {
      const copy = includeDone
        ? group
        : {
            ...group,
            todos: group.todos.filter((item) => item.status !== 'done'),
          }
      if (copy.todos.length === 0) {
        lines.push(`## ${group.title}：暂无条目`)
        continue
      }
      lines.push(renderGroupText(copy))
    }
    return { text: lines.join('\n\n') }
  },
}

const readTool = {
  name: 'todo_notes_read',
  description: '读取单条 TODO 便签的完整 markdown 正文与属性。参数 id 来自 todo_notes_list 的返回。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'TODO 条目的 id（文件名去掉 .md）。' },
    },
    required: ['id'],
    additionalProperties: false,
  },
  output: {
    schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    render: (_args, value) => [{ type: 'text', text: typeof value.text === 'string' ? value.text : '' }],
  },
  async execute(args, exec) {
    const input = args !== null && typeof args === 'object' ? args : {}
    const id = typeof input.id === 'string' ? input.id.trim() : ''
    if (id === '') return { text: '错误：缺少 id。' }
    const context = toolContext(exec)
    const found = await findTodoBody(id, { cwd: context.cwd, session: context.sessionId, sessionTitle: '' })
    if (found === null) return { text: `没有找到 id 为 ${id} 的条目。先用 todo_notes_list 获取可用 id。` }
    const head = [
      `# ${found.summary.title}`,
      '',
      `- 条目 id：${id}`,
      `- 所属组：${found.group.title}`,
      `- 状态：${found.summary.status === 'done' ? '已完成' : found.summary.status === 'partial' ? '中间态（智能体已勾选，等待人工确认）' : '未完成'}`,
      `- 来源：${sourceLabel(found.summary.source)}`,
      `- 优先级：T${found.summary.priority}`,
      `- 主归属文件夹：${found.summary.primaryFolder === PRIMARY ? '主归属' : found.summary.primaryFolder}`,
      `- 创建时间：${found.summary.created || '未记录'}`,
      '',
      '---',
      '',
    ].join('\n')
    return { text: head + found.body }
  },
}

function writeTools(ctx, options) {
  const allowUser = options !== null && typeof options === 'object' && options.agentWriteUserTodos === true
  const textOutput = {
    schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    render: (_args, value) => [{ type: 'text', text: typeof value.text === 'string' ? value.text : '' }],
  }
  /** 用户手写条目默认拒绝；设置项打开后放行，审批仍逐次进行。 */
  const userBlocked = (found) => {
    const source = found.summary.source
    const isUser = typeof source !== 'string' || source === '' || source === 'user'
    return isUser && !allowUser
  }

  const createTool = {
    name: 'todo_notes_create',
    description:
      '创建一条 TODO 便签。默认写入当前会话组；scope 可选 session（默认）/ workspace / user。每次调用都会请求 DSH 审批，未获批准时不会写入。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '条目标题。' },
        scope: { type: 'string', enum: ['session', 'workspace', 'user'], description: '写入哪个便签组，默认 session。' },
        folder: { type: 'string', description: '可选：目标文件夹 id，默认主归属。' },
        priority: { type: 'integer', minimum: 0, maximum: 9, description: '可选：优先级 0~9，默认 1。' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    output: textOutput,
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const title = typeof input.title === 'string' ? input.title.replace(/\r?\n/g, ' ').trim() : ''
      if (title === '') return { text: '错误：缺少标题。' }
      const context = toolContext(exec)
      const scope = input.scope === 'workspace' || input.scope === 'user' ? input.scope : 'session'
      const scopeLabel = scope === 'user' ? '用户级' : scope === 'workspace' ? '工作区级' : '会话级'
      let key = 'user'
      if (scope === 'workspace') {
        const slug = workspaceSlug(context.cwd)
        if (slug === '') return { text: '错误：当前没有可用的工作区目录。' }
        key = 'workspace:' + slug
      } else if (scope === 'session') {
        const sid = normalizeSessionId(context.sessionId)
        if (sid === '') return { text: '错误：当前会话不可用。' }
        key = 'session:' + sid
      }
      const verdict = await askApproval(ctx, exec, 'todo_notes_create', `创建 TODO「${title}」（${scopeLabel}）`)
      if (verdict !== 'allowed') return { text: refusalText(verdict) }
      const source = 'session:' + normalizeSessionId(context.sessionId)
      const result = await handleWrite(
        {
          action: 'createTodo',
          key,
          title,
          folder: typeof input.folder === 'string' ? input.folder : '',
          priority: input.priority,
          source,
        },
        context.cwd,
      )
      if (result.ok !== true) return { text: '创建失败：' + (typeof result.error === 'string' ? result.error : '未知错误') }
      return { text: `已在${scopeLabel}创建 TODO「${result.title}」，id=${result.id}。` }
    },
  }

  const updateTool = {
    name: 'todo_notes_update',
    description:
      '修改一条 TODO：可改标题、优先级、完成状态、所属文件夹。用户手动创建的条目仅在设置项「允许智能体改写用户条目」打开后可改，且每次调用都会请求 DSH 审批。智能体把条目设为完成时最多写成中间态，只有人工勾选才会真正完成。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '条目 id，来自 todo_notes_list。' },
        title: { type: 'string', description: '可选：新标题。' },
        priority: { type: 'integer', minimum: 0, maximum: 9, description: '可选：新优先级 0~9。' },
        status: { type: 'string', enum: ['todo', 'done'], description: '可选：todo=取消勾选，done=勾选（智能体执行时最多写成中间态）。' },
        folder: { type: 'string', description: '可选：移动到某个文件夹 id。' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    output: textOutput,
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      if (id === '') return { text: '错误：缺少 id。' }
      const context = toolContext(exec)
      const query = { cwd: context.cwd, session: context.sessionId, sessionTitle: '' }
      const found = await findTodoBody(id, query)
      if (found === null) return { text: `没有找到 id 为 ${id} 的条目。先用 todo_notes_list 获取可用 id。` }
      if (userBlocked(found)) {
        return { text: '该条目由用户手动创建，智能体不能改写。请让用户在面板里修改，或在插件设置中打开「允许智能体改写用户条目」。' }
      }
      const patch = { updated: new Date().toISOString() }
      const changes = []
      if (typeof input.title === 'string') {
        const title = input.title.replace(/\r?\n/g, ' ').trim()
        if (title !== '') {
          patch.title = title
          changes.push('标题')
        }
      }
      const priority = Number(input.priority)
      if (Number.isFinite(priority)) {
        patch.priority = String(Math.max(0, Math.min(9, Math.round(priority))))
        changes.push('优先级 T' + patch.priority)
      }
      if (input.status === 'todo' || input.status === 'done') {
        if (input.status === 'done') {
          if (found.summary.status !== 'done') {
            patch.status = 'partial'
            changes.push('中间态（待人工确认）')
          }
        } else {
          patch.status = 'todo'
          changes.push('取消勾选')
        }
      }
      const folder = typeof input.folder === 'string' ? input.folder.trim() : ''
      if (folder !== '') changes.push('文件夹')
      if (changes.length === 0) return { text: '错误：没有可修改的字段。' }
      const verdict = await askApproval(ctx, exec, 'todo_notes_update', `修改 TODO「${found.summary.title}」的${changes.join('、')}`)
      if (verdict !== 'allowed') return { text: refusalText(verdict) }
      const key = groupKeyOf(found.group)
      const dir = groupDirFor(key, context.cwd)
      if (Object.keys(patch).length > 1) {
        const changed = await patchTodo(dir, id, patch)
        if (changed !== true) return { text: '修改失败：找不到该条目。' }
      }
      if (folder !== '' && folder !== found.summary.primaryFolder) {
        const moved = await handleWrite({ action: 'moveTodo', key, id, folder }, context.cwd)
        if (moved.ok !== true) return { text: '部分完成：属性已改，移动失败（' + (moved.error || '未知错误') + '）。' }
      }
      return { text: `已修改 TODO「${found.summary.title}」：${changes.join('、')}。` }
    },
  }

  const deleteTool = {
    name: 'todo_notes_delete',
    description:
      '删除一条 TODO。用户手动创建的条目仅在设置项「允许智能体改写用户条目」打开后可删，且每次调用都会请求 DSH 审批。',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '条目 id，来自 todo_notes_list。' } },
      required: ['id'],
      additionalProperties: false,
    },
    output: textOutput,
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      if (id === '') return { text: '错误：缺少 id。' }
      const context = toolContext(exec)
      const found = await findTodoBody(id, { cwd: context.cwd, session: context.sessionId, sessionTitle: '' })
      if (found === null) return { text: `没有找到 id 为 ${id} 的条目。` }
      if (userBlocked(found)) {
        return { text: '该条目由用户手动创建，智能体不能删除。请让用户在面板里删除，或在插件设置中打开「允许智能体改写用户条目」。' }
      }
      const verdict = await askApproval(ctx, exec, 'todo_notes_delete', `删除 TODO「${found.summary.title}」`)
      if (verdict !== 'allowed') return { text: refusalText(verdict) }
      const result = await handleWrite({ action: 'deleteTodo', key: groupKeyOf(found.group), id }, context.cwd)
      if (result.ok !== true) return { text: '删除失败：' + (typeof result.error === 'string' ? result.error : '未知错误') }
      return { text: `已删除 TODO「${found.summary.title}」。` }
    },
  }

  const toggleTool = {
    name: 'todo_notes_toggle',
    description:
      '勾选或取消勾选一条 TODO。勾选时最多写成中间态（减号），只有人工在面板里勾选才会变成真正的完成；取消勾选会退回未完成。用户手动创建的条目仅在设置项打开后可操作，且每次调用都会请求 DSH 审批。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '条目 id，来自 todo_notes_list。' },
        done: { type: 'boolean', description: 'true=勾选（最多到中间态），false=取消勾选。' },
      },
      required: ['id', 'done'],
      additionalProperties: false,
    },
    output: textOutput,
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      if (id === '') return { text: '错误：缺少 id。' }
      if (typeof input.done !== 'boolean') return { text: '错误：缺少 done（true/false）。' }
      const context = toolContext(exec)
      const found = await findTodoBody(id, { cwd: context.cwd, session: context.sessionId, sessionTitle: '' })
      if (found === null) return { text: `没有找到 id 为 ${id} 的条目。先用 todo_notes_list 获取可用 id。` }
      if (userBlocked(found)) {
        return { text: '该条目由用户手动创建，智能体不能勾选或取消勾选。请让用户在面板里操作，或在插件设置中打开「允许智能体改写用户条目」。' }
      }
      if (input.done === true && found.summary.status === 'done') {
        return { text: `TODO「${found.summary.title}」已经是人工确认的完成态，智能体无需再勾选。` }
      }
      const nextStatus = input.done === true ? 'partial' : 'todo'
      if (found.summary.status === nextStatus) {
        return { text: `TODO「${found.summary.title}」当前就是${nextStatus === 'partial' ? '中间态' : '未勾选'}，未做改动。` }
      }
      const verdict = await askApproval(
        ctx,
        exec,
        'todo_notes_toggle',
        `${input.done === true ? '勾选' : '取消勾选'} TODO「${found.summary.title}」`,
      )
      if (verdict !== 'allowed') return { text: refusalText(verdict) }
      const changed = await patchTodo(groupDirFor(groupKeyOf(found.group), context.cwd), id, {
        status: nextStatus,
        updated: new Date().toISOString(),
      })
      if (changed !== true) return { text: '修改失败：找不到该条目。' }
      return {
        text:
          input.done === true
            ? `已把 TODO「${found.summary.title}」标记为中间态；需要人工在面板里勾选才会变成完成。`
            : `已取消勾选 TODO「${found.summary.title}」。`,
      }
    },
  }

  return [createTool, updateTool, toggleTool, deleteTool]
}

export { listTool, readTool, writeTools }
