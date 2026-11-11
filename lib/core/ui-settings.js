/**
 * 外观设置：完成态/半完成态透明度、T0~T9 优先级色板。
 *
 * 纯展示偏好，落在插件自己的数据目录；DSH 设置页里的「TODO 便签」页负责编辑它们。
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { notesRoot, writeFileAtomic } from './paths.js'

const DEFAULTS = {
  doneOpacity: 35,
  partialOpacity: 67,
  priorityPalette: '',
  bodyAutosaveMs: null,
  agentWriteUserTodos: null,
  titleMaxLength: 30,
  injectAgentTodos: true,
  injectMinPriority: 2,
  injectDetail: 'headings',
  enableAnimations: true,
}

function uiSettingsFile() {
  return path.join(notesRoot(), 'ui-settings.json')
}

function clampPercent(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.min(100, Math.round(number)))
}

function sanitize(value) {
  const source = value !== null && value !== undefined && typeof value === 'object' ? value : {}
  const rawDelay = Number(source.bodyAutosaveMs)
  const delay = Number.isFinite(rawDelay) ? Math.max(1000, Math.min(60000, Math.round(rawDelay))) : null
  const rawTitleMax = Number(source.titleMaxLength)
  const titleMaxLength = Number.isFinite(rawTitleMax) ? Math.max(1, Math.min(200, Math.round(rawTitleMax))) : DEFAULTS.titleMaxLength
  const rawMinPriority = Number(source.injectMinPriority)
  const injectMinPriority = Number.isFinite(rawMinPriority) ? Math.max(0, Math.min(9, Math.round(rawMinPriority))) : DEFAULTS.injectMinPriority
  const injectDetail = source.injectDetail === 'title' || source.injectDetail === 'body200' ? source.injectDetail : DEFAULTS.injectDetail
  return {
    doneOpacity: clampPercent(source.doneOpacity, DEFAULTS.doneOpacity),
    partialOpacity: clampPercent(source.partialOpacity, DEFAULTS.partialOpacity),
    priorityPalette: typeof source.priorityPalette === 'string' ? source.priorityPalette.slice(0, 600) : '',
    bodyAutosaveMs: delay,
    agentWriteUserTodos: source.agentWriteUserTodos === true ? true : source.agentWriteUserTodos === false ? false : null,
    titleMaxLength,
    injectAgentTodos: source.injectAgentTodos === false ? false : true,
    injectMinPriority,
    injectDetail,
    enableAnimations: source.enableAnimations === false ? false : true,
  }
}

async function readUiSettings() {
  try {
    const text = await fsp.readFile(uiSettingsFile(), 'utf8')
    return sanitize(JSON.parse(text.replace(/^\uFEFF/, '')))
  } catch {
    return Object.assign({}, DEFAULTS)
  }
}

async function writeUiSettings(patch) {
  const next = sanitize(Object.assign({}, await readUiSettings(), patch !== null && patch !== undefined && typeof patch === 'object' ? patch : {}))
  await writeFileAtomic(uiSettingsFile(), JSON.stringify(next, null, 2) + '\n')
  return next
}

async function resetUiSettings() {
  const next = Object.assign({}, DEFAULTS)
  await writeFileAtomic(uiSettingsFile(), JSON.stringify(next, null, 2) + '\n')
  return next
}

export { DEFAULTS as UI_SETTINGS_DEFAULTS, readUiSettings, writeUiSettings, resetUiSettings }
