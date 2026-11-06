/**
 * 路径与存储：DSH 数据根目录、工作区 slug、文件读取。
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

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


export {
  ROUTE,
  PRIMARY,
  PRIMARY_NAME,
  dshHome,
  notesRoot,
  workspaceSlug,
  readJson,
  normalizeSessionId,
  readText,
}
