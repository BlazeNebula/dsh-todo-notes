/**
 * dsh-todo-notes —— Host 半。
 *
 * 负责三件事：
 * 1. 数据层：$DSH_HOME/todo-notes 下按 用户 / 工作区 / 会话 分层存放便签组。
 * 2. Web 路由：GET /dsh-todo-notes/api 给面板提供只读数据。
 * 3. Agent 工具：todo_notes_list / todo_notes_read 只读，
 *    todo_notes_create / todo_notes_update / todo_notes_delete 每次写前
 *    经 DSH approval 服务审批，且永不改写用户手写的条目。
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export const name = 'dsh-todo-notes'
export const inject = ['tools', 'webServer']

const ROUTE = '/dsh-todo-notes/api'
const PRIMARY = '__primary__'
const PRIMARY_NAME = '主归属'

/** DSH 数据根目录。 */
function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv
  return path.join(os.homedir(), '.dsh')
}

/** 便签数据根目录。 */
function notesRoot() {
  return path.join(dshHome(), 'todo-notes')
}

/**
 * 工作区目录名，与 DSH 自己 sessions 目录的命名保持一致：
 * `E:\heshujiang\Deepseek-Harness` → `--E-heshujiang-Deepseek-Harness--`。
 */
function workspaceSlug(cwd) {
  const cleaned = String(cwd || '')
    .replace(/[:\\/]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return '--' + cleaned + '--'
}

async function readJson(file) {
  try {
    const text = (await fsp.readFile(file, 'utf8')).replace(/^\uFEFF/, '')
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 会话 id 在工具与目录里可能带 `session-` 前缀，统一去掉后再比对。 */
function normalizeSessionId(id) {
  return String(id || '').replace(/^session-/, '')
}

async function readText(file) {
  try {
    return await fsp.readFile(file, 'utf8')
  } catch {
    return ''
  }
}

/** 主归属节点，组里始终存在。 */
function primaryFolder() {
  return { id: PRIMARY, name: PRIMARY_NAME, children: [] }
}

/** 空组的默认结构。 */
function defaultGroup(kind, owner) {
  return {
    version: 1,
    kind,
    owner: owner || null,
    folders: [primaryFolder()],
    folderTodos: { [PRIMARY]: [] },
  }
}

/** 拆分 markdown 的 YAML 头与正文。 */
function splitFrontmatter(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (match === null) return { meta: {}, body: source }
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const cut = line.indexOf(':')
    if (cut <= 0) continue
    const key = line.slice(0, cut).trim()
    let value = line.slice(cut + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (/^-?\d+$/.test(value)) value = Number(value)
    meta[key] = value
  }
  return { meta, body: source.slice(match[0].length) }
}

function firstMeaningfulLine(body) {
  for (const line of String(body || '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    return trimmed.replace(/^#+\s*/, '').slice(0, 80)
  }
  return ''
}

/** 读取组结构；缺失时返回空组。 */
async function readGroup(dir, kind, owner) {
  const stored = await readJson(path.join(dir, 'group.json'))
  const base = defaultGroup(kind, owner)
  if (stored === null || typeof stored !== 'object') return base
  const folders = Array.isArray(stored.folders) && stored.folders.length > 0 ? stored.folders : base.folders
  const folderTodos = stored.folderTodos !== null && typeof stored.folderTodos === 'object' ? stored.folderTodos : {}
  if (!Array.isArray(folderTodos[PRIMARY])) folderTodos[PRIMARY] = []
  return {
    version: 1,
    kind,
    owner: stored.owner !== null && typeof stored.owner === 'object' ? stored.owner : owner || null,
    folders,
    folderTodos,
  }
}

/** 读取组内平铺的 TODO 摘要。 */
async function listTodos(dir) {
  const todoDir = path.join(dir, 'todos')
  let names = []
  try {
    names = (await fsp.readdir(todoDir)).filter((item) => item.endsWith('.md'))
  } catch {
    names = []
  }
  const todos = []
  for (const name of names) {
    const id = name.slice(0, -3)
    const text = await readText(path.join(todoDir, name))
    const { meta, body } = splitFrontmatter(text)
    todos.push({
      id,
      title: typeof meta.title === 'string' && meta.title !== '' ? meta.title : firstMeaningfulLine(body) || id,
      status: meta.status === 'done' ? 'done' : 'todo',
      priority: Number.isFinite(Number(meta.priority)) ? Number(meta.priority) : 1,
      source: typeof meta.source === 'string' && meta.source !== '' ? meta.source : 'user',
      primaryFolder: typeof meta.primaryFolder === 'string' && meta.primaryFolder !== '' ? meta.primaryFolder : PRIMARY,
      created: typeof meta.created === 'string' ? meta.created : '',
      updated: typeof meta.updated === 'string' ? meta.updated : '',
    })
  }
  return todos
}

/** 递归收集文件夹 id，用于判断引用索引是否指向不存在的文件夹。 */
function collectFolderIds(folders, into) {
  for (const folder of Array.isArray(folders) ? folders : []) {
    if (folder === null || typeof folder !== 'object' || typeof folder.id !== 'string') continue
    into.add(folder.id)
    collectFolderIds(folder.children, into)
  }
  return into
}

/** 把组目录整理成发给面板的结构。 */
async function loadGroupPayload(dir, descriptor) {
  const group = await readGroup(dir, descriptor.kind, descriptor.owner)
  const todos = await listTodos(dir)
  const folderIds = collectFolderIds(group.folders, new Set())
  const folderTodos = {}
  for (const [folderId, ids] of Object.entries(group.folderTodos)) {
    if (!folderIds.has(folderId) || !Array.isArray(ids)) continue
    folderTodos[folderId] = ids.filter((item) => typeof item === 'string')
  }
  return {
    key: descriptor.key,
    kind: descriptor.kind,
    title: descriptor.title,
    subtitle: descriptor.subtitle || '',
    current: descriptor.current === true,
    owner: group.owner,
    folders: group.folders,
    folderTodos,
    todos,
    count: todos.filter((item) => item.status !== 'done').length,
  }
}

/** 取组的标题（工作区用目录名，会话用标题或短 id）。 */
function workspaceTitle(group, cwdFallback) {
  const owner = group !== null && typeof group === 'object' ? group.owner : null
  if (owner !== null && typeof owner === 'object' && typeof owner.cwd === 'string' && owner.cwd !== '') {
    return path.basename(owner.cwd) || owner.cwd
  }
  if (typeof cwdFallback === 'string' && cwdFallback !== '') return path.basename(cwdFallback)
  return '工作区'
}

/** 解析客户端传来的同工作区会话列表（[{ id, title }]），用于生成会话级组。 */
function parseSessionList(raw) {
  if (typeof raw !== 'string' || raw === '') return []
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out = []
  const seen = new Set()
  for (const item of parsed) {
    if (item === null || typeof item !== 'object') continue
    const id = normalizeSessionId(typeof item.id === 'string' ? item.id : '')
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    out.push({ id, title: typeof item.title === 'string' ? item.title : '' })
  }
  return out.slice(0, 100)
}

/**
 * 扫描并组装面板需要的全部组。
 * currentCwd / currentSessionId 由客户端传入，用于标出当前组。
 */
/** 从任意对象里找第一个 cwd 字符串（DSH 的会话投影缓存结构会变，按层找）。 */
function findFirstCwd(value, depth) {
  if (value === null || value === undefined || depth > 6) return ''
  if (typeof value === 'object') {
    if (typeof value.cwd === 'string' && value.cwd !== '') return value.cwd
    for (const key of Object.keys(value)) {
      const found = findFirstCwd(value[key], depth + 1)
      if (found !== '') return found
    }
  }
  return ''
}

/**
 * DSH 把每个会话的工作目录记在 $DSH_HOME/storages/session_projcache/sessions/session-<id>.json。
 * 读这张表，让所有工作区组都能拿到绝对路径（不必只依赖当前会话传上来的 cwd）。
 */
async function sessionCwdMap() {
  const map = new Map()
  const dir = path.join(dshHome(), 'storages', 'session_projcache', 'sessions')
  let names = []
  try {
    names = await fsp.readdir(dir)
  } catch {
    return map
  }
  for (const name of names) {
    if (!name.startsWith('session-') || !name.endsWith('.json')) continue
    const text = await readText(path.join(dir, name))
    if (text === '') continue
    try {
      const cwd = findFirstCwd(JSON.parse(text), 0)
      if (cwd !== '') map.set(name.slice('session-'.length, -'.json'.length), cwd)
    } catch {
      /* 投影缓存损坏时跳过 */
    }
  }
  return map
}

async function buildGroupsPayload(query) {
  const cwd = typeof query.cwd === 'string' ? query.cwd : ''
  const sessionId = normalizeSessionId(typeof query.session === 'string' ? query.session : '')
  const sessionTitle = typeof query.sessionTitle === 'string' ? query.sessionTitle : ''
  const slug = cwd !== '' ? workspaceSlug(cwd) : ''

  const user = await loadGroupPayload(path.join(notesRoot(), 'user'), {
    key: 'user',
    kind: 'user',
    title: '我的便签',
    subtitle: '跟用户走',
    current: true,
  })

  const workspaces = []
  const cwdBySession = await sessionCwdMap()
  const cwdBySlug = new Map()
  for (const sessionCwd of cwdBySession.values()) {
    const sessionSlug = workspaceSlug(sessionCwd)
    if (sessionSlug !== '' && !cwdBySlug.has(sessionSlug)) cwdBySlug.set(sessionSlug, sessionCwd)
  }
  let workspaceNames = []
  try {
    workspaceNames = await fsp.readdir(path.join(notesRoot(), 'workspaces'))
  } catch {
    workspaceNames = []
  }
  for (const name of workspaceNames) {
    const dir = path.join(notesRoot(), 'workspaces', name)
    const stored = await readJson(path.join(dir, 'group.json'))
    const owner = stored !== null && typeof stored === 'object' && stored.owner !== null && typeof stored.owner === 'object' ? stored.owner : null
    const storedCwd = owner !== null && typeof owner.cwd === 'string' ? owner.cwd : ''
    const groupCwd = storedCwd !== '' ? storedCwd : (cwdBySlug.get(name) || '')
    workspaces.push(
      await loadGroupPayload(dir, {
        key: 'workspace:' + name,
        kind: 'workspace',
        title: workspaceTitle({ owner }, groupCwd),
        subtitle: groupCwd,
        current: slug !== '' && name === slug,
        owner: { slug: name, cwd: groupCwd },
      }),
    )
  }

  const sessions = []
  const knownSessionIds = new Set()
  // 客户端传入的真实会话列表（同一工作区）：每个会话都要有一个组，即使还没有便签数据。
  for (const entry of parseSessionList(query.sessions)) {
    if (knownSessionIds.has(entry.id)) continue
    knownSessionIds.add(entry.id)
    const dir = path.join(notesRoot(), 'workspaces', slug, 'sessions', entry.id)
    const stored = await readJson(path.join(dir, 'group.json'))
    const owner = stored !== null && typeof stored === 'object' && stored.owner !== null && typeof stored.owner === 'object' ? stored.owner : null
    const storedTitle = owner !== null && typeof owner.title === 'string' && owner.title !== '' ? owner.title : ''
    sessions.push(
      await loadGroupPayload(dir, {
        key: 'session:' + entry.id,
        kind: 'session',
        title: entry.title || storedTitle || entry.id.slice(0, 8),
        subtitle: entry.id,
        current: sessionId !== '' && entry.id === sessionId,
        owner: { slug, sessionId: entry.id },
      }),
    )
  }
  // 目录里还有、但客户端列表没给的会话（工具调用时没有列表，或列表尚未加载）。
  let sessionNames = []
  if (slug !== '') {
    try {
      sessionNames = await fsp.readdir(path.join(notesRoot(), 'workspaces', slug, 'sessions'))
    } catch {
      sessionNames = []
    }
  }
  for (const name of sessionNames) {
    if (knownSessionIds.has(name)) continue
    knownSessionIds.add(name)
    const dir = path.join(notesRoot(), 'workspaces', slug, 'sessions', name)
    const stored = await readJson(path.join(dir, 'group.json'))
    const owner = stored !== null && typeof stored === 'object' && stored.owner !== null && typeof stored.owner === 'object' ? stored.owner : null
    const title = owner !== null && typeof owner.title === 'string' && owner.title !== '' ? owner.title : name.slice(0, 8)
    sessions.push(
      await loadGroupPayload(dir, {
        key: 'session:' + name,
        kind: 'session',
        title: name === sessionId ? sessionTitle || title : title,
        subtitle: name,
        current: sessionId !== '' && name === sessionId,
        owner: { slug, sessionId: name },
      }),
    )
  }

  // 当前会话还没有数据目录时，也给它一个空组占位，面板才知道「当前会话」在哪。
  if (sessionId !== '' && !sessions.some((group) => group.current)) {
    sessions.push({
      key: 'session:' + sessionId,
      kind: 'session',
      title: sessionTitle || sessionId.slice(0, 8),
      subtitle: sessionId,
      current: true,
      owner: { slug, sessionId },
      folders: [primaryFolder()],
      folderTodos: { [PRIMARY]: [] },
      todos: [],
      count: 0,
    })
  }
  // 当前工作区还没有数据目录时同样给一个空组占位。
  if (slug !== '' && !workspaces.some((group) => group.current)) {
    workspaces.push({
      key: 'workspace:' + slug,
      kind: 'workspace',
      title: path.basename(cwd) || cwd,
      subtitle: cwd,
      current: true,
      owner: { slug, cwd },
      folders: [primaryFolder()],
      folderTodos: { [PRIMARY]: [] },
      todos: [],
      count: 0,
    })
  }

  return { ok: true, current: { cwd, sessionId, workspaceSlug: slug }, user, workspaces, sessions }
}

/** 在全部组里按 id 找一条 TODO 并返回正文。 */
async function findTodoBody(id, query) {
  const payload = await buildGroupsPayload(query)
  const groups = [payload.user, ...payload.workspaces, ...payload.sessions]
  for (const group of groups) {
    const hit = group.todos.find((item) => item.id === id)
    if (hit === undefined) continue
    let dir = ''
    if (group.kind === 'user') dir = path.join(notesRoot(), 'user')
    else if (group.kind === 'workspace') dir = path.join(notesRoot(), 'workspaces', group.owner.slug)
    else dir = path.join(notesRoot(), 'workspaces', group.owner.slug, 'sessions', group.owner.sessionId)
    const text = await readText(path.join(dir, 'todos', id + '.md'))
    const { meta, body } = splitFrontmatter(text)
    return { group, meta, body, summary: hit }
  }
  return null
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(body)
}

/** 读取 JSON 请求体。 */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1024 * 1024) request.destroy()
    })
    request.on('end', () => {
      try {
        resolve(raw === '' ? {} : JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    request.on('error', reject)
  })
}

/** 组 key → 组目录；key 形如 user / workspace:<slug> / session:<id>。 */
function groupDirFor(key, cwd) {
  const root = notesRoot()
  if (key === 'user') return path.join(root, 'user')
  if (key.startsWith('workspace:')) {
    const slug = key.slice('workspace:'.length)
    if (slug === '') return null
    return path.join(root, 'workspaces', slug)
  }
  if (key.startsWith('session:')) {
    const slug = workspaceSlug(cwd)
    if (slug === '') return null
    const id = normalizeSessionId(key.slice('session:'.length))
    if (id === '') return null
    return path.join(root, 'workspaces', slug, 'sessions', id)
  }
  return null
}

/** 改一条 TODO 的 frontmatter 字段，正文原样保留。 */
async function patchTodo(dir, id, patch) {
  const file = path.join(dir, 'todos', id + '.md')
  const text = await readText(file)
  if (text === '') return false
  const split = splitFrontmatter(text)
  const meta = Object.assign({}, split.meta, patch)
  const lines = Object.keys(meta).map((key) => key + ': ' + String(meta[key]))
  const body = split.body.replace(/^\n+/, '')
  const out = '---\n' + lines.join('\n') + '\n---\n' + body
  await fsp.writeFile(file, out, 'utf8')
  return true
}

/** 写回组结构。 */
async function writeGroup(dir, group) {
  await fsp.mkdir(dir, { recursive: true })
  const payload = {
    version: 1,
    kind: group.kind,
    owner: group.owner === null || group.owner === undefined ? null : group.owner,
    folders: group.folders,
    folderTodos: group.folderTodos,
  }
  await fsp.writeFile(path.join(dir, 'group.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8')
}

/** 校验客户端发来的文件夹树，只保留 id/name/children。 */
function sanitizeFolders(nodes, depth, seen) {
  if (!Array.isArray(nodes) || depth > 8) return []
  const out = []
  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue
    const id = typeof node.id === 'string' ? node.id.trim() : ''
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    const name = typeof node.name === 'string' ? node.name : ''
    out.push({ id, name: name, children: sanitizeFolders(node.children, depth + 1, seen) })
  }
  return out
}

/** 写操作：勾选完成、恢复未完成、改优先级、重排文件夹。 */
async function handleWrite(body, cwd) {
  const action = typeof body.action === 'string' ? body.action : ''
  const key = typeof body.key === 'string' ? body.key : ''
  const dir = groupDirFor(key, cwd)
  if (dir === null) return { ok: false, error: '未知的便签组' }
  if (action === 'complete' || action === 'reopen') {
    const id = typeof body.id === 'string' ? body.id : ''
    if (id === '') return { ok: false, error: '缺少 id' }
    const changed = await patchTodo(dir, id, {
      status: action === 'complete' ? 'done' : 'todo',
      updated: new Date().toISOString(),
    })
    return changed ? { ok: true } : { ok: false, error: '找不到该条目' }
  }
  if (action === 'priority') {
    const id = typeof body.id === 'string' ? body.id : ''
    const priority = Number(body.priority)
    if (id === '' || !Number.isFinite(priority)) return { ok: false, error: '参数无效' }
    const value = Math.max(0, Math.min(9, Math.round(priority)))
    const changed = await patchTodo(dir, id, {
      priority: String(value),
      updated: new Date().toISOString(),
    })
    return changed ? { ok: true } : { ok: false, error: '找不到该条目' }
  }
  if (action === 'createTodo') {
    const now = new Date().toISOString()
    const rawTitle = typeof body.title === 'string' ? body.title.replace(/\r?\n/g, ' ').trim() : ''
    const title = rawTitle !== '' ? rawTitle : '新建待办'
    const folderId = typeof body.folder === 'string' && body.folder !== '' ? body.folder : PRIMARY
    const id = 't-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36)
    const priorityValue = Number(body.priority)
    const meta = {
      id,
      title,
      status: 'todo',
      priority: String(Number.isFinite(priorityValue) ? Math.max(0, Math.min(9, Math.round(priorityValue))) : 1),
      created: now,
      updated: now,
      source: typeof body.source === 'string' && body.source !== '' ? body.source : 'user',
      primaryFolder: folderId,
    }
    const lines = Object.keys(meta).map((key) => key + ': ' + meta[key])
    await fsp.mkdir(path.join(dir, 'todos'), { recursive: true })
    await fsp.writeFile(path.join(dir, 'todos', id + '.md'), '---\n' + lines.join('\n') + '\n---\n' + title + '\n', 'utf8')
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const folders = Array.isArray(group.folders) ? group.folders : []
    if (!folders.some((folder) => folder !== null && typeof folder === 'object' && folder.id === PRIMARY)) {
      folders.unshift(primaryFolder())
    }
    group.folders = folders
    const folderTodos = Object.assign({}, group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {})
    const list = Array.isArray(folderTodos[folderId]) ? folderTodos[folderId].slice() : []
    if (!list.includes(id)) list.push(id)
    folderTodos[folderId] = list
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true, id, title }
  }
  if (action === 'createTodos') {
    const titles = Array.isArray(body.titles) ? body.titles.map((item) => String(item).replace(/\r?\n/g, ' ').trim()).filter((item) => item !== '') : []
    if (titles.length === 0) return { ok: false, error: '没有可创建的内容' }
    const folderId = typeof body.folder === 'string' && body.folder !== '' ? body.folder : PRIMARY
    const base = Date.now()
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const folders = Array.isArray(group.folders) ? group.folders : []
    if (!folders.some((folder) => folder !== null && typeof folder === 'object' && folder.id === PRIMARY)) {
      folders.unshift(primaryFolder())
    }
    group.folders = folders
    const folderTodos = Object.assign({}, group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {})
    const list = Array.isArray(folderTodos[folderId]) ? folderTodos[folderId].slice() : []
    await fsp.mkdir(path.join(dir, 'todos'), { recursive: true })
    const created = []
    for (let i = 0; i < titles.length; i += 1) {
      const stamp = new Date(base + i).toISOString()
      const id = 't-' + (base + i).toString(36) + Math.floor(Math.random() * 1296).toString(36)
      const meta = {
        id,
        title: titles[i],
        status: 'todo',
        priority: '1',
        created: stamp,
        updated: stamp,
        source: 'user',
        primaryFolder: folderId,
      }
      const lines = Object.keys(meta).map((key) => key + ': ' + meta[key])
      await fsp.writeFile(path.join(dir, 'todos', id + '.md'), '---\n' + lines.join('\n') + '\n---\n' + titles[i] + '\n', 'utf8')
      list.push(id)
      created.push({ id, title: titles[i] })
    }
    folderTodos[folderId] = list
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true, count: created.length }
  }
  if (action === 'renameTodo') {
    const id = typeof body.id === 'string' ? body.id : ''
    const title = typeof body.title === 'string' ? body.title.replace(/\r?\n/g, ' ').trim() : ''
    if (id === '' || title === '') return { ok: false, error: '参数无效' }
    const changed = await patchTodo(dir, id, { title, updated: new Date().toISOString() })
    return changed ? { ok: true } : { ok: false, error: '找不到该条目' }
  }
  if (action === 'deleteTodo') {
    const id = typeof body.id === 'string' ? body.id : ''
    if (id === '') return { ok: false, error: '缺少 id' }
    await fsp.rm(path.join(dir, 'todos', id + '.md'), { force: true })
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const folderTodos = Object.assign({}, group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {})
    for (const folderId of Object.keys(folderTodos)) {
      if (Array.isArray(folderTodos[folderId])) folderTodos[folderId] = folderTodos[folderId].filter((item) => item !== id)
    }
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true }
  }
  if (action === 'folders') {
    const seen = new Set()
    const folders = sanitizeFolders(body.folders, 0, seen)
    if (!seen.has(PRIMARY)) folders.unshift(primaryFolder())
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const previous = group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {}
    group.folders = folders
    const ids = new Set()
    const walk = (list) => {
      for (const folder of list) {
        ids.add(folder.id)
        walk(folder.children)
      }
    }
    walk(folders)
    const folderTodos = {}
    for (const fid of ids) folderTodos[fid] = Array.isArray(previous[fid]) ? previous[fid].slice() : []
    const primaryList = folderTodos[PRIMARY]
    // 被删掉文件夹里的条目退回主归属，不再保留在原文件夹的引用里。
    const removed = Object.keys(previous).filter((fid) => fid !== PRIMARY && !ids.has(fid))
    if (removed.length > 0) {
      const todos = await listTodos(dir)
      for (const todo of todos) {
        if (removed.includes(todo.primaryFolder)) {
          await patchTodo(dir, todo.id, {
            primaryFolder: PRIMARY,
            updated: new Date().toISOString(),
          })
          if (!primaryList.includes(todo.id)) primaryList.push(todo.id)
        }
      }
    }
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true }
  }
  if (action === 'detachFolder') {
    const folderId = typeof body.folder === 'string' ? body.folder : ''
    if (folderId === '' || folderId === PRIMARY) return { ok: false, error: '参数无效' }
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const folders = Array.isArray(group.folders) ? group.folders : []
    let target = null
    let container = null
    let parentId = PRIMARY
    const walk = (list, parent) => {
      for (const node of list) {
        if (node.id === folderId) {
          target = node
          container = list
          parentId = parent
          return true
        }
        const children = Array.isArray(node.children) ? node.children : []
        if (walk(children, node.id)) return true
      }
      return false
    }
    walk(folders, PRIMARY)
    if (target === null || container === null) return { ok: false, error: '找不到该文件夹' }
    const movedChildren = Array.isArray(target.children) ? target.children : []
    container.splice(container.indexOf(target), 1, ...movedChildren)
    const folderTodos = Object.assign({}, group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {})
    const childList = Array.isArray(folderTodos[folderId]) ? folderTodos[folderId].slice() : []
    const parentList = Array.isArray(folderTodos[parentId]) ? folderTodos[parentId].slice() : []
    for (const id of childList) {
      if (!parentList.includes(id)) parentList.push(id)
    }
    delete folderTodos[folderId]
    folderTodos[parentId] = parentList
    const todos = await listTodos(dir)
    for (const todo of todos) {
      if (todo.primaryFolder === folderId) {
        await patchTodo(dir, todo.id, { primaryFolder: parentId, updated: new Date().toISOString() })
      }
    }
    group.folders = folders
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true }
  }
  if (action === 'deleteFolderTree') {
    const folderId = typeof body.folder === 'string' ? body.folder : ''
    if (folderId === '' || folderId === PRIMARY) return { ok: false, error: '参数无效' }
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const folders = Array.isArray(group.folders) ? group.folders : []
    let target = null
    let container = null
    const walk = (list) => {
      for (const node of list) {
        if (node.id === folderId) {
          target = node
          container = list
          return true
        }
        const children = Array.isArray(node.children) ? node.children : []
        if (walk(children)) return true
      }
      return false
    }
    walk(folders)
    if (target === null || container === null) return { ok: false, error: '找不到该文件夹' }
    const ids = new Set()
    const collect = (node) => {
      ids.add(node.id)
      const children = Array.isArray(node.children) ? node.children : []
      for (const child of children) collect(child)
    }
    collect(target)
    container.splice(container.indexOf(target), 1)
    const folderTodos = Object.assign({}, group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {})
    const removedIds = []
    for (const fid of Array.from(ids)) {
      if (Array.isArray(folderTodos[fid])) removedIds.push(...folderTodos[fid])
      delete folderTodos[fid]
    }
    const doomed = new Set(removedIds)
    const todos = await listTodos(dir)
    for (const todo of todos) {
      if (doomed.has(todo.id) || ids.has(todo.primaryFolder)) {
        await fsp.rm(path.join(dir, 'todos', todo.id + '.md'), { force: true })
        doomed.add(todo.id)
      }
    }
    for (const fid of Object.keys(folderTodos)) {
      if (Array.isArray(folderTodos[fid])) folderTodos[fid] = folderTodos[fid].filter((id) => !doomed.has(id))
    }
    group.folders = folders
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true, count: doomed.size }
  }
  if (action === 'reorder') {
    const id = typeof body.id === 'string' ? body.id : ''
    const folderId = typeof body.folder === 'string' && body.folder !== '' ? body.folder : PRIMARY
    const beforeId = typeof body.beforeId === 'string' ? body.beforeId : ''
    if (id === '') return { ok: false, error: '缺少 id' }
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const folderTodos = Object.assign({}, group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {})
    const list = Array.isArray(folderTodos[folderId]) ? folderTodos[folderId].filter((item) => item !== id) : []
    const at = beforeId !== '' ? list.indexOf(beforeId) : -1
    if (at >= 0) list.splice(at, 0, id)
    else list.push(id)
    folderTodos[folderId] = list
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true }
  }
  if (action === 'removeReference') {
    const id = typeof body.id === 'string' ? body.id : ''
    const folderId = typeof body.folder === 'string' ? body.folder : ''
    if (id === '' || folderId === '') return { ok: false, error: '参数无效' }
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const folderTodos = Object.assign({}, group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {})
    if (Array.isArray(folderTodos[folderId])) {
      folderTodos[folderId] = folderTodos[folderId].filter((item) => item !== id)
    }
    const todos = await listTodos(dir)
    const todo = todos.find((item) => item.id === id)
    // 取消收录时，如果该文件夹正是条目的主归属，就退回无文件夹。
    if (todo !== undefined && todo.primaryFolder === folderId) {
      await patchTodo(dir, id, { primaryFolder: PRIMARY, updated: new Date().toISOString() })
      const primaryList = Array.isArray(folderTodos[PRIMARY]) ? folderTodos[PRIMARY].slice() : []
      if (!primaryList.includes(id)) primaryList.push(id)
      folderTodos[PRIMARY] = primaryList
    }
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true }
  }
  if (action === 'reference' || action === 'moveTodo') {
    const id = typeof body.id === 'string' ? body.id : ''
    const folderId = typeof body.folder === 'string' ? body.folder : ''
    if (id === '' || folderId === '') return { ok: false, error: '参数无效' }
    const kind = key === 'user' ? 'user' : key.startsWith('workspace:') ? 'workspace' : 'session'
    const group = await readGroup(dir, kind, null)
    const folders = Array.isArray(group.folders) ? group.folders : []
    const available = new Set()
    const walkAvailable = (list) => {
      for (const folder of list) {
        available.add(folder.id)
        walkAvailable(Array.isArray(folder.children) ? folder.children : [])
      }
    }
    walkAvailable(folders)
    if (!available.has(folderId)) return { ok: false, error: '找不到该文件夹' }
    const folderTodos = Object.assign({}, group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {})
    if (action === 'reference') {
      const list = Array.isArray(folderTodos[folderId]) ? folderTodos[folderId].slice() : []
      if (!list.includes(id)) list.push(id)
      folderTodos[folderId] = list
      group.folderTodos = folderTodos
      await writeGroup(dir, group)
      return { ok: true }
    }
    const todos = await listTodos(dir)
    const todo = todos.find((item) => item.id === id)
    if (todo === undefined) return { ok: false, error: '找不到该条目' }
    // 移动语义：目标文件夹一定收录；其它文件夹一律不再收录（即使目标此前已收录，也要把源文件夹摘掉）。
    for (const fid of Object.keys(folderTodos)) {
      if (!Array.isArray(folderTodos[fid])) continue
      if (fid === folderId) continue
      folderTodos[fid] = folderTodos[fid].filter((item) => item !== id)
    }
    const list = Array.isArray(folderTodos[folderId]) ? folderTodos[folderId].slice() : []
    if (!list.includes(id)) list.push(id)
    folderTodos[folderId] = list
    if (todo.primaryFolder !== folderId) {
      await patchTodo(dir, id, {
        primaryFolder: folderId,
        updated: new Date().toISOString(),
      })
    }
    group.folderTodos = folderTodos
    await writeGroup(dir, group)
    return { ok: true }
  }
  return { ok: false, error: '未知的操作' }
}

async function handleApi(request, response) {
  try {
    if (request.method === 'POST') {
      const body = await readJsonBody(request)
      const cwd = typeof body.cwd === 'string' ? body.cwd : ''
      const result = await handleWrite(body, cwd)
      sendJson(response, result.ok ? 200 : 400, result)
      return
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { ok: false, error: '仅支持 GET / POST' })
      return
    }
    const url = new URL(request.url || '/', 'http://localhost')
    const what = url.searchParams.get('what') || 'groups'
    const query = {
      cwd: url.searchParams.get('cwd') || '',
      session: url.searchParams.get('session') || '',
      sessionTitle: url.searchParams.get('sessionTitle') || '',
    }
    if (what === 'groups') {
      sendJson(response, 200, await buildGroupsPayload(query))
      return
    }
    if (what === 'todo') {
      const id = url.searchParams.get('id') || ''
      if (id === '') {
        sendJson(response, 400, { ok: false, error: '缺少 id' })
        return
      }
      const found = await findTodoBody(id, query)
      if (found === null) {
        sendJson(response, 404, { ok: false, error: '没有找到该条目' })
        return
      }
      sendJson(response, 200, {
        ok: true,
        id,
        title: found.summary.title,
        status: found.summary.status,
        priority: found.summary.priority,
        source: found.summary.source,
        primaryFolder: found.summary.primaryFolder,
        created: found.summary.created,
        updated: found.summary.updated,
        groupTitle: found.group.title,
        groupKind: found.group.kind,
        markdown: found.body,
        meta: found.meta,
      })
      return
    }
    sendJson(response, 404, { ok: false, error: '未知的查询类型' })
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

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
  const flag = todo.status === 'done' ? '[x]' : '[ ]'
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
      `- 状态：${found.summary.status === 'done' ? '已完成' : '未完成'}`,
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

function writeTools(ctx) {
  const textOutput = {
    schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    render: (_args, value) => [{ type: 'text', text: typeof value.text === 'string' ? value.text : '' }],
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
      '修改一条由智能体创建的 TODO：可改标题、优先级、完成状态、所属文件夹。用户手动创建的条目不允许智能体改写。每次调用都会请求 DSH 审批。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '条目 id，来自 todo_notes_list。' },
        title: { type: 'string', description: '可选：新标题。' },
        priority: { type: 'integer', minimum: 0, maximum: 9, description: '可选：新优先级 0~9。' },
        status: { type: 'string', enum: ['todo', 'done'], description: '可选：todo=未完成，done=已完成。' },
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
      if (typeof found.summary.source !== 'string' || found.summary.source === '' || found.summary.source === 'user') {
        return { text: '该条目由用户手动创建，智能体不能改写。请让用户在面板里修改。' }
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
        patch.status = input.status
        changes.push(input.status === 'done' ? '已完成' : '未完成')
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
      '删除一条由智能体创建的 TODO。用户手动创建的条目不删除。每次调用都会请求 DSH 审批。',
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
      if (typeof found.summary.source !== 'string' || found.summary.source === '' || found.summary.source === 'user') {
        return { text: '该条目由用户手动创建，智能体不能删除。请让用户在面板里删除。' }
      }
      const verdict = await askApproval(ctx, exec, 'todo_notes_delete', `删除 TODO「${found.summary.title}」`)
      if (verdict !== 'allowed') return { text: refusalText(verdict) }
      const result = await handleWrite({ action: 'deleteTodo', key: groupKeyOf(found.group), id }, context.cwd)
      if (result.ok !== true) return { text: '删除失败：' + (typeof result.error === 'string' ? result.error : '未知错误') }
      return { text: `已删除 TODO「${found.summary.title}」。` }
    },
  }

  return [createTool, updateTool, deleteTool]
}

export function apply(ctx) {
  ctx.inject(['tools'], (toolsCtx) => {
    const tools = toolsCtx.get('tools')
    toolsCtx.effect(() => tools.register(listTool), 'dsh-todo-notes: tool todo_notes_list')
    toolsCtx.effect(() => tools.register(readTool), 'dsh-todo-notes: tool todo_notes_read')
    for (const tool of writeTools(ctx)) {
      toolsCtx.effect(() => tools.register(tool), 'dsh-todo-notes: tool ' + tool.name)
    }
  })
  ctx.inject(['webServer'], (hostCtx) => {
    hostCtx.effect(
      () => hostCtx.webServer.register({ kind: 'prefix', path: ROUTE, handler: handleApi }),
      'dsh-todo-notes: web route',
    )
  })
}
