/**
 * 鎶?client/src 涓嬬殑鍒嗘鎷兼垚 DSH 闇€瑕佺殑鍗曟枃浠舵祻瑙堝櫒鍖呫€? *
 * DSH 鐨勫鎴风妯″潡鍔犺浇鍣ㄥ彧鎺ュ彈涓€涓?CJS 宸ュ巶鏂囦欢锛屼笉鑳藉悓姝?require 鐩搁偦鐨? * 鏈湴鏂囦欢锛屽洜姝よ繖閲屾寜鍥哄畾椤哄簭鎷兼帴锛涘垎娈典箣闂村叡浜悓涓€涓伐鍘備綔鐢ㄥ煙銆? * 杩愯锛歯ode scripts/build-client.mjs锛堟垨 pnpm run build:client锛? */
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
  '90-entry.js',
]

const bodies = []
for (const name of sources) {
  const text = await fsp.readFile(path.join(root, 'client/src', name), 'utf8')
  bodies.push(text)
}
await fsp.writeFile(path.join(root, 'client/client.js'), bodies.join('\n') + '\n')
console.log('client bundle written')
