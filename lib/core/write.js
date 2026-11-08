/**
 * 写操作：文件夹树、条目字段、面板发来的写接口。
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import {
  PRIMARY,
  notesRoot,
  workspaceSlug,
  readText,
  normalizeSessionId,
} from './paths.js'
import { splitFrontmatter } from './text.js'
import { primaryFolder, readGroup, listTodos } from './groups.js'
import { writeWindows } from './windows.js'

// frontmatter 里凡是字符串都按字符串写回：纯数字、true/false/null 或带特殊符号时加引号，
// 否则 YAML 会把 `title: 123` 读成数字，面板标题就会退回正文第一行。
function yamlScalar(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const text = String(value)
  if (text === '') return '""'
  if (/^[0-9]/.test(text) || /^(true|false|null|~)$/i.test(text) || /[:#{}[\],"'\n]/.test(text) || text !== text.trim()) {
    return JSON.stringify(text)
  }
  return text
}

function groupDirFor(key, cwd) {  const root = notesRoot()
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
  const lines = Object.keys(meta).map((key) => key + ': ' + yamlScalar(meta[key]))
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
  if (action === 'saveWindows') {
    const saved = await writeWindows(body.windows)
    return saved ? { ok: true } : { ok: false, error: '窗口数据过大' }
  }
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
    const lines = Object.keys(meta).map((key) => key + ': ' + yamlScalar(meta[key]))
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
      const lines = Object.keys(meta).map((key) => key + ': ' + yamlScalar(meta[key]))
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
  if (action === 'saveTodoBody') {
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (id === '') return { ok: false, error: '缺少 id' }
    if (typeof body.body !== 'string') return { ok: false, error: '缺少正文' }
    const file = path.join(dir, 'todos', id + '.md')
    const raw = await readText(file)
    if (raw === null) return { ok: false, error: '找不到该条目' }
    const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(String(raw).replace(/^\uFEFF/, ''))
    let header = match === null ? '---\n---\n' : match[0]
    // frontmatter 原样保留，只刷新 updated 时间；正文完全由用户输入决定。
    header = header.replace(/^updated:.*$/m, 'updated: ' + new Date().toISOString())
    const text = body.body.endsWith('\n') ? body.body : body.body + '\n'
    await fsp.mkdir(path.join(dir, 'todos'), { recursive: true })
    await fsp.writeFile(file, header + text, 'utf8')
    return { ok: true }
  }
  return { ok: false, error: '未知的操作' }
}



export { groupDirFor, patchTodo, writeGroup, sanitizeFolders, handleWrite }
