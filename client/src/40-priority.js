    // 优先级颜色：T0 用主题的 warn 色，T1~T9 用 ColorBrewer 的 YlGnBu 9 档顺序色阶。
    // T1~T4 保留原始的浅色饱和度，保证四档并列时仍能分出层次；T5~T9 统一到 T5 的亮度与平均饱和度。
    const PRIO_PALETTE = [
      'var(--dsw-alias-state-warn-primary, #d9a441)',
      '#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#2dc6d8',
      '#339fd2', '#387dcd', '#3d60c8', '#4246c3',
    ]
    let prioOverride = null

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

    function prioColor(priority) {
      const value = typeof priority === 'number' && priority >= 0 ? Math.min(9, Math.floor(priority)) : 1
      const palette = prioOverride === null ? PRIO_PALETTE : prioOverride
      return palette[value]
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