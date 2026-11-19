/**
 * Agent 工具层：只读工具与带 DSH 审批的写工具。
 */
import { PRIMARY, workspaceSlug, normalizeSessionId } from './paths.js'
import { buildGroupsPayload, findTodoBody } from './groups.js'
import { groupDirFor, patchTodo, handleWrite, titleLimit } from './write.js'
import { readUiSettings } from './ui-settings.js'
import { languageOf, t } from './i18n.js'

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
function refusalText(status, lang) {
  if (status === 'missing') return t(lang, 'refuseMissingApproval')
  if (status === 'denied') return t(lang, 'refuseDenied')
  return t(lang, 'refuseError')
}

function changeText(keys, lang) {
  return keys
    .map((item) => t(lang, item.key, item.level === undefined ? undefined : { level: item.level }))
    .join(lang === 'zh' ? '、' : ', ')
}

function sourceLabel(source) {
  if (typeof source !== 'string' || source === '' || source === 'user') return 'custom'
  return 'agent'
}

function renderTodoLine(todo) {
  const flag = todo.status === 'done' ? '[x]' : todo.status === 'partial' ? '[-]' : '[ ]'
  const badge = ` T${Number.isFinite(todo.priority) ? todo.priority : 0}`
  return `- ${flag} ${todo.title}${badge}  (${todo.id}, ${sourceLabel(todo.source)}, folder: ${todo.primaryFolder === PRIMARY ? 'primary' : todo.primaryFolder})`
}

function renderGroupText(group) {
  const lines = [`## ${group.title} (${group.kind === 'user' ? 'user' : group.kind === 'workspace' ? 'workspace' : 'session'}, ${group.count} open)`]
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
    lines.push(`${indent}- 📁 ${entry.folder.id === PRIMARY ? 'primary' : (entry.folder.name || entry.folder.id)} (${todos.length})`)
    for (const todo of todos) lines.push(indent + '  ' + renderTodoLine(todo))
  }
  const referenced = new Set(Object.values(byFolder).flat())
  const loose = group.todos.filter((item) => !referenced.has(item.id))
  if (loose.length > 0) {
    lines.push('  - Not referenced in any folder:')
    for (const todo of loose) lines.push('    ' + renderTodoLine(todo))
  }
  return lines.join('\n')
}

const listTool = {
  name: 'todo_notes_list',
  description:
    'List TODO notes: the user, workspace and current-session groups. Returns item summaries (id, title, status, priority, source, folder) without bodies; use it to find ids, then todo_notes_read for one item body.',
  parameters: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['current', 'user', 'workspace', 'session'],
        description: 'current=user + current workspace + current session (default); user=user only; workspace=current workspace only; session=current session only.',
      },
      includeDone: { type: 'boolean', description: 'Whether to include completed items; default false.' },
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
        lines.push(`## ${group.title}: no items`)
        continue
      }
      lines.push(renderGroupText(copy))
    }
    return { text: lines.join('\n\n') }
  },
}

const readTool = {
  name: 'todo_notes_read',
  description: 'Read one TODO note full markdown body and properties. Statuses are open, half-done (an agent checked it off and it awaits human confirmation) and done; half-done is not done. The id comes from todo_notes_list.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The TODO item id (the file name without .md).' },
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
    if (id === '') return { text: 'Error: missing id.' }
    const context = toolContext(exec)
    const found = await findTodoBody(id, { cwd: context.cwd, session: context.sessionId, sessionTitle: '' })
    if (found === null) return { text: `No item with id ${id}. Use todo_notes_list first to get available ids.` }
    const head = [
      `# ${found.summary.title}`,
      '',
      `- Item id: ${id}`,
      `- Group: ${found.group.title}`,
      `- Status: ${found.summary.status === 'done' ? 'done' : found.summary.status === 'partial' ? 'half-done (agent checked it off; awaiting human confirmation)' : 'open'}`,
      `- Source: ${sourceLabel(found.summary.source)}`,
      `- Priority: T${found.summary.priority}`,
      `- Primary folder: ${found.summary.primaryFolder === PRIMARY ? 'primary' : found.summary.primaryFolder}`,
      `- Created: ${found.summary.created || 'not recorded'}`,
      '',
      '---',
      '',
    ].join('\n')
    return { text: head + found.body }
  },
}

function writeTools(ctx, options) {
  const fallbackAllowUser = options !== null && typeof options === 'object' && options.agentWriteUserTodos === true
  const policyKeys = ['deny', 'ask', 'agent-only', 'allow-all']
  /** 智能体写入策略：完全拒绝 / 需要审批 / 仅放行智能体条目 / 放行所有条目。每次调用重新读设置。 */
  async function policyNow() {
    const ui = await readUiSettings()
    if (policyKeys.indexOf(ui.agentWritePolicy) >= 0) return ui.agentWritePolicy
    return fallbackAllowUser ? 'ask' : 'agent-only'
  }
  function isUserCreated(found) {
    const source = found.summary.source
    return typeof source !== 'string' || source === '' || source === 'user'
  }
  const textOutput = {
    schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    render: (_args, value) => [{ type: 'text', text: typeof value.text === 'string' ? value.text : '' }],
  }
  function policyBlocked(policy, found, lang) {
    if (policy === 'deny') return t(lang, 'policyDeny')
    if (policy === 'agent-only' && found !== null && isUserCreated(found)) return t(lang, 'policyAgentOnly')
    return ''
  }

  const createTool = {
    name: 'todo_notes_create',
    description:
      'Create a TODO note. title is a single-line plain-text title (bounded by the settings page max title length, default 30 characters; markdown syntax is not rendered); body is optional Markdown stored verbatim as the note body and rendered as Markdown in the panel, defaulting to the title. Writes to the current session group by default; scope may be session (default), workspace or user. Whether DSH approval is required is decided by the plugin agent-write setting.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Required: a single-line plain-text title without Markdown syntax; it must not exceed the settings page max title length (default 30 characters).' },
        body: { type: 'string', description: 'Optional: Markdown body, which may contain headings, lists, tables and so on; defaults to the title.' },
        scope: { type: 'string', enum: ['session', 'workspace', 'user'], description: 'Which note group to write to; default session.' },
        folder: { type: 'string', description: 'Optional: target folder id; defaults to the primary folder.' },
        priority: { type: 'integer', minimum: 0, maximum: 9, description: 'Optional: priority 0-9; default 1.' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    output: textOutput,
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const title = typeof input.title === 'string' ? input.title.replace(/\r?\n/g, ' ').trim() : ''
      if (title === '') return { text: 'Error: missing title.' }
      const limit = await titleLimit()
      if (Array.from(title).length > limit) {
        return { text: `Error: titles are limited to ${limit} characters; this one is ${Array.from(title).length}. Shorten it and retry.` }
      }
      const context = toolContext(exec)
      const lang = await languageOf(ctx)
      const scope = input.scope === 'workspace' || input.scope === 'user' ? input.scope : 'session'
      const scopeLabel = scope === 'user' ? 'user' : scope === 'workspace' ? 'workspace' : 'session'
      let key = 'user'
      if (scope === 'workspace') {
        const slug = workspaceSlug(context.cwd)
        if (slug === '') return { text: 'Error: no workspace directory is available.' }
        key = 'workspace:' + slug
      } else if (scope === 'session') {
        const sid = normalizeSessionId(context.sessionId)
        if (sid === '') return { text: 'Error: the current session is unavailable.' }
        key = 'session:' + sid
      }
      const policy = await policyNow()
      const blocked = policyBlocked(policy, null, lang)
      if (blocked !== '') return { text: blocked }
      let verdict = 'allowed'
      if (policy === 'ask') verdict = await askApproval(ctx, exec, 'todo_notes_create', t(lang, 'approveCreate', { title, scope: t(lang, scope === 'user' ? 'scopeUser' : scope === 'workspace' ? 'scopeWorkspace' : 'scopeSession') }))
      if (verdict !== 'allowed') return { text: refusalText(verdict, lang) }
      const source = 'session:' + normalizeSessionId(context.sessionId)
      const result = await handleWrite(
        {
          action: 'createTodo',
          key,
          title,
          body: typeof input.body === 'string' ? input.body : '',
          folder: typeof input.folder === 'string' ? input.folder : '',
          priority: input.priority,
          source,
        },
        context.cwd,
      )
      if (result.ok !== true) return { text: 'Create failed: ' + (typeof result.error === 'string' ? result.error : 'unknown error') }
      return { text: `Created TODO "${result.title}" in the ${scopeLabel} group, id=${result.id}.` }
    },
  }

  const updateTool = {
    name: 'todo_notes_update',
    description:
      'Update a TODO: every field is optional and only the fields you pass change. Editable fields are title, Markdown body, priority, completion state and folder. The title is single-line plain text (bounded by the settings page max title length, default 30 characters); the body is Markdown and replaces everything after the frontmatter. Whether user-written items may be changed is decided by the agent-write setting; an agent can at most mark an item half-done, and only a human check completes it.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Required: the item id from todo_notes_list.' },
        title: { type: 'string', description: 'Optional: a new single-line plain-text title; it must not exceed the settings page max title length (default 30 characters).' },
        body: { type: 'string', description: 'Optional: a new Markdown body that replaces the existing one; omitted leaves the body untouched.' },
        priority: { type: 'integer', minimum: 0, maximum: 9, description: 'Optional: new priority 0-9.' },
        status: { type: 'string', enum: ['todo', 'done'], description: 'Optional: todo=uncheck, done=check off (an agent execution at most writes half-done).' },
        folder: { type: 'string', description: 'Optional: move to a folder id.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    output: textOutput,
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      if (id === '') return { text: 'Error: missing id.' }
      const context = toolContext(exec)
      const lang = await languageOf(ctx)
      const query = { cwd: context.cwd, session: context.sessionId, sessionTitle: '' }
      const found = await findTodoBody(id, query)
      if (found === null) return { text: `No item with id ${id}. Use todo_notes_list first to get available ids.` }
      const policy = await policyNow()
      const blocked = policyBlocked(policy, found, lang)
      if (blocked !== '') return { text: blocked }
      const patch = { updated: new Date().toISOString() }
      const changes = []
      const changeKeys = []
      if (typeof input.title === 'string') {
        const title = input.title.replace(/\r?\n/g, ' ').trim()
        if (title !== '') {
          const limit = await titleLimit()
          if (Array.from(title).length > limit) {
            return { text: `Error: titles are limited to ${limit} characters; this one is ${Array.from(title).length}. Shorten it and retry.` }
          }
          patch.title = title
          changes.push('title')
          changeKeys.push({ key: 'changeTitle' })
        }
      }
      if (typeof input.body === 'string') {
        patch.body = input.body
        changes.push('body')
        changeKeys.push({ key: 'changeBody' })
      }
      const priority = Number(input.priority)
      if (Number.isFinite(priority)) {
        patch.priority = String(Math.max(0, Math.min(9, Math.round(priority))))
        changes.push('priority T' + patch.priority)
        changeKeys.push({ key: 'changePriority', level: patch.priority })
      }
      if (input.status === 'todo' || input.status === 'done') {
        if (input.status === 'done') {
          if (found.summary.status !== 'done') {
            patch.status = 'partial'
            changes.push('half-done (awaiting confirmation)')
            changeKeys.push({ key: 'changePartial' })
          }
        } else {
          patch.status = 'todo'
          changes.push('unchecked')
          changeKeys.push({ key: 'changeUncheck' })
        }
      }
      const folder = typeof input.folder === 'string' ? input.folder.trim() : ''
      if (folder !== '') {
        changes.push('folder')
        changeKeys.push({ key: 'changeFolder' })
      }
      if (changes.length === 0) return { text: 'Error: no fields to update.' }
      let verdict = 'allowed'
      if (policy === 'ask') verdict = await askApproval(ctx, exec, 'todo_notes_update', t(lang, 'approveUpdate', { title: found.summary.title, changes: changeText(changeKeys, lang) }))
      if (verdict !== 'allowed') return { text: refusalText(verdict, lang) }
      const key = groupKeyOf(found.group)
      const dir = groupDirFor(key, context.cwd)
      if (Object.keys(patch).length > 1) {
        const changed = await patchTodo(dir, id, patch)
        if (changed !== true) return { text: 'Update failed: the item was not found.' }
      }
      if (folder !== '' && folder !== found.summary.primaryFolder) {
        const moved = await handleWrite({ action: 'moveTodo', key, id, folder }, context.cwd)
        if (moved.ok !== true) return { text: 'Partially done: fields were updated but the move failed (' + (moved.error || 'unknown error') + '）。' }
      }
      return { text: `Updated TODO "${found.summary.title}": ${changes.join(', ')}.` }
    },
  }

  const deleteTool = {
    name: 'todo_notes_delete',
    description:
      'Delete a TODO. Items a human wrote can be deleted only when the plugin setting allows agent edits of user items, and every call requests DSH approval.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The item id from todo_notes_list.' } },
      required: ['id'],
      additionalProperties: false,
    },
    output: textOutput,
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      if (id === '') return { text: 'Error: missing id.' }
      const context = toolContext(exec)
      const lang = await languageOf(ctx)
      const found = await findTodoBody(id, { cwd: context.cwd, session: context.sessionId, sessionTitle: '' })
      if (found === null) return { text: `No item with id ${id}.` }
      const policy = await policyNow()
      const blocked = policyBlocked(policy, found, lang)
      if (blocked !== '') return { text: blocked }
      let verdict = 'allowed'
      if (policy === 'ask') verdict = await askApproval(ctx, exec, 'todo_notes_delete', t(lang, 'approveDelete', { title: found.summary.title }))
      if (verdict !== 'allowed') return { text: refusalText(verdict, lang) }
      const result = await handleWrite({ action: 'deleteTodo', key: groupKeyOf(found.group), id }, context.cwd)
      if (result.ok !== true) return { text: 'Delete failed: ' + (typeof result.error === 'string' ? result.error : 'unknown error') }
      return { text: `Deleted TODO "${found.summary.title}".` }
    },
  }

  const toggleTool = {
    name: 'todo_notes_toggle',
    description:
      'Check off or uncheck a TODO. Checking off at most writes half-done; only a human check in the panel makes it done. Unchecking returns it to open. Items a human wrote can be changed only when the plugin setting allows it, and every call requests DSH approval.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The item id from todo_notes_list.' },
        done: { type: 'boolean', description: 'true=check off (at most half-done), false=uncheck.' },
      },
      required: ['id', 'done'],
      additionalProperties: false,
    },
    output: textOutput,
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      if (id === '') return { text: 'Error: missing id.' }
      if (typeof input.done !== 'boolean') return { text: 'Error: missing done (true/false).' }
      const context = toolContext(exec)
      const lang = await languageOf(ctx)
      const found = await findTodoBody(id, { cwd: context.cwd, session: context.sessionId, sessionTitle: '' })
      if (found === null) return { text: `No item with id ${id}. Use todo_notes_list first to get available ids.` }
      const policy = await policyNow()
      const blocked = policyBlocked(policy, found, lang)
      if (blocked !== '') return { text: blocked }
      if (input.done === true && found.summary.status === 'done') {
        return { text: `TODO "${found.summary.title}" is already confirmed done by a human; no further check is needed.` }
      }
      const nextStatus = input.done === true ? 'partial' : 'todo'
      if (found.summary.status === nextStatus) {
        return { text: `TODO "${found.summary.title}" is already ${nextStatus === 'partial' ? 'half-done' : 'unchecked'}; nothing changed.` }
      }
      let verdict = 'allowed'
      if (policy === 'ask') {
        verdict = await askApproval(
          ctx,
          exec,
          'todo_notes_toggle',
          t(lang, input.done === true ? 'approveToggle' : 'approveUntoggle', { title: found.summary.title }),
        )
      }
      if (verdict !== 'allowed') return { text: refusalText(verdict, lang) }
      const changed = await patchTodo(groupDirFor(groupKeyOf(found.group), context.cwd), id, {
        status: nextStatus,
        updated: new Date().toISOString(),
      })
      if (changed !== true) return { text: 'Update failed: the item was not found.' }
      return {
        text:
          input.done === true
            ? `Marked TODO "${found.summary.title}" as half-done; a human must check it off in the panel to complete it.`
            : `Unchecked TODO "${found.summary.title}".`,
      }
    },
  }

  return [createTool, updateTool, toggleTool, deleteTool]
}

export { listTool, readTool, writeTools }
