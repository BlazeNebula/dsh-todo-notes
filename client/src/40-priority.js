    // 优先级色相：Tailwind 300/400 色相带，T0 暖金 → T9 紫，按暖到冷排列。
    // 文字明度不写死，而是从主题前景色派生，因此浅色主题自动变深、深色主题自动变亮。
    const PRIO_PALETTE = [
      '#f59e0b', '#eab308', '#84cc16', '#10b981', '#14b8a6',
      '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
    ]
    let prioOverride = null
    let prioRelativeSupported = null

    // 设置页里的色板用分号分隔，必须是 10 个值；不合法时回退内置色板。
    function applyPriorityPalette(raw) {
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (text === '') {
        prioOverride = null
        return
      }
      const parts = text.split(';').map(function (item) { return item.trim() }).filter(function (item) { return item !== '' })
      prioOverride = parts.length === 10 ? parts : null
    }

    // 十六进制 → OKLCH 的色相与彩度；用于把用户选的颜色换算成着色参数。
    function hexToOklch(hex) {
      const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim())
      if (match === null) return { hue: 220, chroma: 0.09 }
      let body = match[1]
      if (body.length === 3) body = body.split('').map(function (part) { return part + part }).join('')
      const toLinear = function (value) {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
      }
      const r = toLinear(parseInt(body.slice(0, 2), 16))
      const g = toLinear(parseInt(body.slice(2, 4), 16))
      const b = toLinear(parseInt(body.slice(4, 6), 16))
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
      const aa = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
      const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
      let hue = Math.atan2(bb, aa) * 180 / Math.PI
      if (hue < 0) hue += 360
      const chroma = Math.sqrt(aa * aa + bb * bb)
      return { hue: hue.toFixed(1), chroma: Math.max(0.055, Math.min(0.13, chroma)).toFixed(3) }
    }

    function relativeColorAvailable() {
      if (prioRelativeSupported !== null) return prioRelativeSupported
      try {
        prioRelativeSupported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' &&
          CSS.supports('color', 'oklch(from #ffffff calc(l * 0.9) 0.09 200)')
      } catch (error) {
        prioRelativeSupported = false
      }
      return prioRelativeSupported
    }

    function prioInk(hex) {
      if (!relativeColorAvailable()) return hex
      const color = hexToOklch(hex)
      return 'oklch(from var(--dsw-alias-label-primary, #e8e8ea) calc(l * 0.9) ' + color.chroma + ' ' + color.hue + ')'
    }

    function prioColor(priority) {
      const value = typeof priority === 'number' && priority >= 0 ? Math.min(9, Math.floor(priority)) : 1
      // T0 固定使用 DSH 的错误色令牌，深浅主题都由主题本身校正。
      if (value === 0) return 'var(--dsw-alias-state-error-primary, #e55353)'
      const palette = prioOverride === null ? PRIO_PALETTE : prioOverride
      return prioInk(palette[value])
    }

    // 排序口径：未勾选 > 中间态（智能体勾选等人工确认）> 已勾选。
    function statusRank(status) {
      if (status === 'done') return 2
      if (status === 'partial') return 1
      return 0
    }

    function sortTodosForView(list) {
      return (Array.isArray(list) ? list.slice() : []).sort(function (a, b) {
        const ad = statusRank(a.status)
        const bd = statusRank(b.status)
        if (ad !== bd) return ad - bd
        const ap = typeof a.priority === 'number' ? a.priority : 0
        const bp = typeof b.priority === 'number' ? b.priority : 0
        if (ap !== bp) return ap - bp
        return String(a.created || '').localeCompare(String(b.created || ''))
      })
    }

    function isAiSource(source) {
      return typeof source === 'string' && source !== '' && source !== 'user'
    }

    // 预览里的时间统一成「YYYY-MM-DD hh:mm:ss:mil」（24 小时制，本地时区）。
    function formatStamp(value) {
      const text = typeof value === 'string' ? value.trim() : ''
      if (text === '') return ''
      const date = new Date(text)
      if (Number.isNaN(date.getTime())) return text
      const pad = function (number, size) {
        let out = String(number)
        while (out.length < size) out = '0' + out
        return out
      }
      return date.getFullYear() + '-' + pad(date.getMonth() + 1, 2) + '-' + pad(date.getDate(), 2) +
        ' ' + pad(date.getHours(), 2) + ':' + pad(date.getMinutes(), 2) + ':' + pad(date.getSeconds(), 2) +
        '.' + pad(date.getMilliseconds(), 3)
    }

    function folderLabel(folderId) {
      return folderId === PRIMARY ? '无文件夹' : String(folderId)
    }

    // 图标统一用 NaiveUI 推荐的 vicons 图标库：界面图标取 Ionicons 5（@vicons/ionicons5），