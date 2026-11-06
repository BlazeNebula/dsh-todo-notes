    function inlineNodes(text) {
      const nodes = []
      let rest = String(text === undefined || text === null ? '' : text)
      let guard = 0
      while (rest.length > 0 && guard < 800) {
        guard += 1
        const patterns = [
          { re: /^`([^`]+)`/, kind: 'code' },
          { re: /^\*\*([^*]+)\*\*/, kind: 'strong' },
          { re: /^\*([^*]+)\*/, kind: 'em' },
          { re: /^\[([^\]]+)\]\(([^)]+)\)/, kind: 'link' },
        ]
        let matched = false
        for (let i = 0; i < patterns.length; i += 1) {
          const hit = patterns[i].re.exec(rest)
          if (hit === null) continue
          matched = true
          if (patterns[i].kind === 'code') nodes.push(h('code', { key: nodes.length }, hit[1]))
          else if (patterns[i].kind === 'strong') nodes.push(h('strong', { key: nodes.length }, hit[1]))
          else if (patterns[i].kind === 'em') nodes.push(h('em', { key: nodes.length }, hit[1]))
          else nodes.push(h('a', { key: nodes.length, href: hit[2], target: '_blank', rel: 'noreferrer' }, hit[1]))
          rest = rest.slice(hit[0].length)
          break
        }
        if (matched) continue
        const next = rest.search(/[`*[]/)
        if (next < 0) {
          nodes.push(rest)
          rest = ''
        } else if (next === 0) {
          nodes.push(rest[0])
          rest = rest.slice(1)
        } else {
          nodes.push(rest.slice(0, next))
          rest = rest.slice(next)
        }
      }
      return nodes
    }

    function renderMarkdown(text) {
      const lines = String(text === undefined || text === null ? '' : text).split(/\r?\n/)
      const blocks = []
      let index = 0
      let key = 0
      const isFence = (line) => /^```/.test(line.trim())
      const isHeading = (line) => /^(#{1,6})\s+/.test(line)
      const isUl = (line) => /^\s*[-*+]\s+/.test(line)
      const isOl = (line) => /^\s*\d+[.)]\s+/.test(line)
      const isQuote = (line) => /^\s*>\s?/.test(line)
      const isRule = (line) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
      while (index < lines.length) {
        const line = lines[index]
        if (line.trim() === '') {
          index += 1
          continue
        }
        if (isFence(line)) {
          const lang = line.trim().slice(3).trim()
          const code = []
          index += 1
          while (index < lines.length && !isFence(lines[index])) {
            code.push(lines[index])
            index += 1
          }
          index += 1
          blocks.push(
            h('pre', { key: key++, className: 'dtn-md-pre' },
              h('code', { className: lang === '' ? undefined : 'language-' + lang }, code.join('\n'))),
          )
          continue
        }
        if (isHeading(line)) {
          const hit = /^(#{1,6})\s+(.*)$/.exec(line)
          const level = hit[1].length
          blocks.push(h('h' + level, { key: key++ }, inlineNodes(hit[2])))
          index += 1
          continue
        }
        if (isUl(line)) {
          const items = []
          while (index < lines.length && isUl(lines[index])) {
            items.push(lines[index].replace(/^\s*[-*+]\s+/, ''))
            index += 1
          }
          blocks.push(h('ul', { key: key++ }, items.map((item, itemIndex) => h('li', { key: itemIndex }, inlineNodes(item)))))
          continue
        }
        if (isOl(line)) {
          const items = []
          while (index < lines.length && isOl(lines[index])) {
            items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''))
            index += 1
          }
          blocks.push(h('ol', { key: key++ }, items.map((item, itemIndex) => h('li', { key: itemIndex }, inlineNodes(item)))))
          continue
        }
        if (isQuote(line)) {
          const quote = []
          while (index < lines.length && isQuote(lines[index])) {
            quote.push(lines[index].replace(/^\s*>\s?/, ''))
            index += 1
          }
          blocks.push(h('blockquote', { key: key++ }, renderMarkdown(quote.join('\n'))))
          continue
        }
        if (isRule(line)) {
          blocks.push(h('hr', { key: key++ }))
          index += 1
          continue
        }
        const paragraph = []
        while (
          index < lines.length &&
          lines[index].trim() !== '' &&
          !isFence(lines[index]) &&
          !isHeading(lines[index]) &&
          !isUl(lines[index]) &&
          !isOl(lines[index]) &&
          !isQuote(lines[index]) &&
          !isRule(lines[index])
        ) {
          paragraph.push(lines[index])
          index += 1
        }
        blocks.push(h('p', { key: key++ }, inlineNodes(paragraph.join(' '))))
      }
      return blocks
    }

    function sourceLabel(source) {
      return typeof source === 'string' && source !== '' && source !== 'user' ? '由智能体创建' : ''
    }
