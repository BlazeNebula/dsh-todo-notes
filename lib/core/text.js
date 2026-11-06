/**
 * markdown 文本工具：frontmatter 拆分与首行提取。
 */
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


export { splitFrontmatter, firstMeaningfulLine }
