/**
 * 把 client/src 下的分段拼成 DSH 需要的单文件浏览器包。
 *
 * DSH 的客户端模块加载器只接受一个 CJS 工厂文件，不能同步 require 相邻的
 * 本地文件，因此这里按固定顺序拼接；分段之间共享同一个工厂作用域。
 * 运行：node scripts/build-client.mjs（或 pnpm run build:client）
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sources = [
  '00-bootstrap.js',
  '10-styles.js',
  '20-storage.js',
  '30-markdown.js',
  '40-priority.js',
  '50-icons.js',
  '60-panel.js',
  '62-panel-layout.js',
  '63-panel-folders.js',
  '64-panel-batch.js',
  '65-panel-rows.js',
  '66-panel-surface.js',
  '67-panel-menus.js',
  '69-pins.js',
  '69b-pins-render.js',
  '68-panel-tail.js',
  '70-settings-page.js',
  '90-entry.js',
]

const bodies = []
for (const name of sources) {
  const text = await fsp.readFile(path.join(root, 'client/src', name), 'utf8')
  bodies.push(text)
}
await fsp.writeFile(path.join(root, 'client/client.js'), bodies.join('\n') + '\n')
console.log('client bundle written')
