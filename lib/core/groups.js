/**
 * 组与条目：组结构、条目摘要、三区负载、按 id 查条目。
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import {
  PRIMARY,
  PRIMARY_NAME,
  dshHome,
  notesRoot,
  workspaceSlug,
  readJson,
  readText,
  normalizeSessionId,
} from './paths.js'
import { splitFrontmatter, firstMeaningfulLine } from './text.js'
import { getRuntimeConfig } from './runtime.js'
import { readUiSettings } from './ui-settings.js'

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
    const rawTitle = meta.title
    const title = typeof rawTitle === 'string' && rawTitle !== ''
      ? rawTitle
      : typeof rawTitle === 'number' && Number.isFinite(rawTitle)
        ? String(rawTitle)
        : firstMeaningfulLine(body) || id
    todos.push({
      id,
      title,
      status: meta.status === 'done' ? 'done' : meta.status === 'partial' ? 'partial' : 'todo',
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

  const ui = await readUiSettings()
  const config = Object.assign({}, getRuntimeConfig())
  if (ui.bodyAutosaveMs !== null && ui.bodyAutosaveMs !== undefined) config.bodyAutosaveMs = ui.bodyAutosaveMs
  if (ui.agentWriteUserTodos !== null && ui.agentWriteUserTodos !== undefined) config.agentWriteUserTodos = ui.agentWriteUserTodos
  return { ok: true, config: config, ui: ui, current: { cwd, sessionId, workspaceSlug: slug }, user, workspaces, sessions }
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



export {
  primaryFolder,
  defaultGroup,
  readGroup,
  listTodos,
  collectFolderIds,
  loadGroupPayload,
  workspaceTitle,
  parseSessionList,
  sessionCwdMap,
  buildGroupsPayload,
  findTodoBody,
}
