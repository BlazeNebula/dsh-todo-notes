/**
 * 外观设置：完成态/半完成态透明度、T0~T9 优先级色板。
 *
 * 这些是纯展示偏好，落在插件自己的数据目录里；DSH 设置页用来放需要审批语义的开关。
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { notesRoot } from './paths.js'

const DEFAULTS = {
  doneOpacity: 35,
  partialOpacity: 75,
  priorityPalette: '',
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
  return {
    doneOpacity: clampPercent(source.doneOpacity, DEFAULTS.doneOpacity),
    partialOpacity: clampPercent(source.partialOpacity, DEFAULTS.partialOpacity),
    priorityPalette: typeof source.priorityPalette === 'string' ? source.priorityPalette.slice(0, 600) : '',
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
  await fsp.mkdir(notesRoot(), { recursive: true })
  await fsp.writeFile(uiSettingsFile(), JSON.stringify(next, null, 2) + '\n', 'utf8')
  return next
}

async function resetUiSettings() {
  const next = Object.assign({}, DEFAULTS)
  await fsp.mkdir(notesRoot(), { recursive: true })
  await fsp.writeFile(uiSettingsFile(), JSON.stringify(next, null, 2) + '\n', 'utf8')
  return next
}

export { DEFAULTS as UI_SETTINGS_DEFAULTS, readUiSettings, writeUiSettings, resetUiSettings }
