/**
 * 浮窗持久化：把保留窗口的位置与内容存在数据目录里，跨 DSH 重启仍然有效。
 * 浏览器 localStorage 按端口隔离，而 DSH 每次启动的端口可能变化，因此必须落到文件。
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { notesRoot, writeFileAtomic } from './paths.js'

function windowsFile() {
  return path.join(notesRoot(), 'windows.json')
}

async function readWindows() {
  try {
    const text = await fsp.readFile(windowsFile(), 'utf8')
    const parsed = JSON.parse(text.replace(/^\uFEFF/, ''))
    if (parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.windows)) return parsed.windows
    return []
  } catch {
    return []
  }
}

async function writeWindows(windows) {
  const list = Array.isArray(windows) ? windows.slice(0, 50) : []
  const raw = JSON.stringify({ version: 1, windows: list })
  // 防止异常输入把磁盘写满：最多 1 MB。
  if (raw.length > 1024 * 1024) return false
  await fsp.mkdir(notesRoot(), { recursive: true })
  await writeFileAtomic(windowsFile(), raw)
  return true
}

export { readWindows, writeWindows }
