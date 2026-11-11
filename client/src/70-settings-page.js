    // ------------------------------------------------------------ 设置页（DSH 设置 → 插件 → TODO 便签）

    const UI_DEFAULT_PALETTE = ['#e55353', '#eab308', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6']

    function splitPalette(raw) {
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (text === '') return UI_DEFAULT_PALETTE.slice()
      const parts = text.split(';').map(function (item) { return item.trim() }).filter(function (item) { return item !== '' })
      if (parts.length !== 10) return UI_DEFAULT_PALETTE.slice()
      return parts
    }

    function isHexColor(value) {
      return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    }

    function TodoNotesSettings() {
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [status, setStatus] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [doneOpacity, setDoneOpacity] = React.useState(35)
      const [partialOpacity, setPartialOpacity] = React.useState(67)
      const [palette, setPalette] = React.useState(UI_DEFAULT_PALETTE.slice())
      const [autosaveSec, setAutosaveSec] = React.useState('5')
      const [titleMax, setTitleMax] = React.useState('30')
      const [agentAllow, setAgentAllow] = React.useState(false)
      const [injectAgentTodos, setInjectAgentTodos] = React.useState(true)
      const [injectMinPriority, setInjectMinPriority] = React.useState(2)
      const [injectDetail, setInjectDetail] = React.useState('headings')
      const [enableAnimations, setEnableAnimations] = React.useState(true)

      function applyUi(ui, config) {
        if (ui === null || ui === undefined) return
        setDoneOpacity(typeof ui.doneOpacity === 'number' ? ui.doneOpacity : 35)
        setPartialOpacity(typeof ui.partialOpacity === 'number' ? ui.partialOpacity : 67)
        setPalette(splitPalette(ui.priorityPalette))
        const delay = ui.bodyAutosaveMs !== null && ui.bodyAutosaveMs !== undefined
          ? ui.bodyAutosaveMs
          : (config !== null && config !== undefined && typeof config.bodyAutosaveMs === 'number' ? config.bodyAutosaveMs : 5000)
        setAutosaveSec(String(Math.max(1, Math.round(delay / 1000))))
        setTitleMax(String(typeof ui.titleMaxLength === 'number' ? ui.titleMaxLength : 30))
        if (ui.agentWriteUserTodos === true) setAgentAllow(true)
        else if (ui.agentWriteUserTodos === false) setAgentAllow(false)
        else setAgentAllow(config !== null && config !== undefined && config.agentWriteUserTodos === true)
        setInjectAgentTodos(ui.injectAgentTodos !== false)
        setInjectMinPriority(typeof ui.injectMinPriority === 'number' ? ui.injectMinPriority : 2)
        setInjectDetail(ui.injectDetail === 'title' || ui.injectDetail === 'body200' ? ui.injectDetail : 'headings')
        setEnableAnimations(ui.enableAnimations !== false)
      }

      React.useEffect(function () {
        let alive = true
        fetch(ROUTE + '?what=uiSettings&ts=' + Date.now(), { cache: 'no-store' })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (!alive) return
            if (payload !== null && payload !== undefined && payload.ok === true) applyUi(payload.ui, payload.config)
            else setError('读取设置失败')
            setLoading(false)
          })
          .catch(function (err) {
            if (!alive) return
            setError('读取设置失败：' + (err !== null && err !== undefined && err.message ? err.message : err))
            setLoading(false)
          })
        return function () { alive = false }
      }, [])

      function patchUi(body) {
        setBusy(true)
        setStatus('')
        return fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (payload !== null && payload !== undefined && payload.ok === true) {
              applyUi(payload.ui, payload.config)
              setStatus('已保存')
            } else {
              setStatus('保存失败：' + (payload !== null && payload !== undefined && payload.error ? payload.error : '未知错误'))
            }
            setBusy(false)
          })
          .catch(function (err) {
            setStatus('保存失败：' + (err !== null && err !== undefined && err.message ? err.message : err))
            setBusy(false)
          })
      }

      function save() {
        const seconds = Math.max(1, Math.min(60, Math.round(Number(autosaveSec) || 5)))
        const maxTitle = Math.max(1, Math.min(200, Math.round(Number(titleMax) || 30)))
        patchUi({
          action: 'saveUiSettings',
          ui: {
            doneOpacity: doneOpacity,
            partialOpacity: partialOpacity,
            priorityPalette: palette.join(';'),
            bodyAutosaveMs: seconds * 1000,
            agentWriteUserTodos: agentAllow,
            titleMaxLength: maxTitle,
            injectAgentTodos: injectAgentTodos,
            injectMinPriority: injectMinPriority,
            injectDetail: injectDetail,
            enableAnimations: enableAnimations,
          },
        })
      }

      function reset() {
        patchUi({ action: 'resetUiSettings' })
      }

      function setColor(index, value) {
        setPalette(function (list) {
          const next = list.slice()
          next[index] = value
          return next
        })
      }

      function opacityRow(label, hint, value, onChange) {
        return h(
          'div',
          { className: 'tns-row' },
          h(
            'div',
            { className: 'tns-row-text' },
            h('div', { className: 'tns-label' }, label),
            h('div', { className: 'tns-hint' }, hint),
          ),
          h(
            'div',
            { className: 'tns-opacity' },
            h('input', {
              type: 'range', min: 0, max: 100, step: 1, value: value, className: 'tns-range',
              onChange: function (event) { onChange(Number(event.target.value)) },
            }),
            h('input', {
              type: 'number', min: 0, max: 100, value: value, className: 'tns-number',
              onChange: function (event) {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) onChange(Math.max(0, Math.min(100, Math.round(next))))
              },
            }),
            h('span', { className: 'tns-unit' }, '%'),
          ),
        )
      }

      return h(
        'div',
        { className: 'tns-page' },
        h('p', { className: 'tns-desc' }, '调整完成状态的外观与优先级颜色。改完点“保存”，设置会立即应用到所有面板。'),
        loading
          ? h('div', { className: 'tns-loading' }, '读取设置…')
          : h(
              React.Fragment,
              null,
              error !== '' ? h('div', { className: 'tns-error' }, error) : null,
              h(
                'div',
                { className: 'tns-actions' },
                h('button', { type: 'button', className: 'tns-btn', disabled: busy, onClick: reset }, '恢复默认'),
                h('button', { type: 'button', className: 'tns-btn tns-btn-primary', disabled: busy, onClick: save }, busy ? '保存中…' : '保存'),
                status !== '' ? h('span', { className: 'tns-status' }, status) : null,
              ),
              h(
                'div',
                { className: 'tns-preview-grid' },
                [['浅色主题', '#ffffff', '#1f1f24'], ['深色主题', '#1a1a1a', '#e8e8ea']].map(function (theme) {
                  return h(
                    'div',
                    { key: theme[0], className: 'tns-preview-box', style: { background: theme[1], color: theme[2], '--dsw-alias-label-primary': theme[2] } },
                    h('div', { className: 'tns-preview-label' }, theme[0]),
                    h(
                      'div',
                      { className: 'tns-preview-row' },
                      h('span', { className: 'tns-preview-check' }, '☐'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[3]) } }, 'T3'),
                      h('span', null, '未完成的条目'),
                    ),
                    h(
                      'div',
                      { className: 'tns-preview-row', style: { opacity: doneOpacity / 100 } },
                      h('span', { className: 'tns-preview-check' }, '☑'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[1]) } }, 'T1'),
                      h('span', null, '已完成的条目'),
                    ),
                    h(
                      'div',
                      { className: 'tns-preview-row', style: { opacity: partialOpacity / 100 } },
                      h('span', { className: 'tns-preview-check' }, '◐'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[2]) } }, 'T2'),
                      h('span', null, '半完成、等待确认的条目'),
                    ),
                  )
                }),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, '状态外观'),
                opacityRow('已完成', '整行变淡，便于把注意力留在未完成项上', doneOpacity, setDoneOpacity),
                opacityRow('半完成', '智能体已勾选、等待你确认的条目', partialOpacity, setPartialOpacity),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, '优先级颜色'),
                h('p', { className: 'tns-hint' }, 'T0 最高，T9 最低。T0 默认跟随 DSH 错误色；10 档都可以点色块或用取色器改。'),
                h(
                  'div',
                  { className: 'tns-colors' },
                  [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]].map(function (column, columnIndex) {
                    return h(
                      'div',
                      { key: columnIndex, className: 'tns-color-column' },
                      column.map(function (index) {
                        const color = palette[index]
                        return h(
                          'div',
                          { key: index, className: 'tns-color-row' },
                          h('span', { className: 'tns-color-label' }, 'T' + index),
                          h('input', {
                            type: 'color', className: 'tns-color-input', value: isHexColor(color) ? color : '#888888',
                            onChange: function (event) { setColor(index, event.target.value) },
                          }),
                          h('input', {
                            type: 'text', className: 'tns-hex', value: color, spellCheck: false,
                            onChange: function (event) {
                              const next = String(event.target.value).trim()
                              if (next === '' || /^#[0-9a-fA-F]{0,6}$/.test(next)) setColor(index, next)
                            },
                            onBlur: function () {
                              const current = palette[index]
                              if (!isHexColor(current)) setColor(index, UI_DEFAULT_PALETTE[index])
                            },
                          }),
                        )
                      }),
                    )
                  }),
                ),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, '智能体上下文'),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '每轮注入当前会话的智能体 TODO'),
                    h('div', { className: 'tns-hint' }, '只注入会话级、由智能体创建且未完成的条目；默认开启'),
                  ),
                  h('input', {
                    type: 'checkbox', className: 'tns-check', checked: injectAgentTodos,
                    onChange: function (event) { setInjectAgentTodos(event.target.checked === true) },
                  }),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '注入最低优先级'),
                    h('div', { className: 'tns-hint' }, '只注入该优先级及更高的条目（T0 最高）'),
                  ),
                  h(
                    'select',
                    {
                      className: 'tns-select', value: String(injectMinPriority),
                      onChange: function (event) { setInjectMinPriority(Number(event.target.value)) },
                    },
                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (level) {
                      return h('option', { key: level, value: String(level) }, 'T' + level)
                    }),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '注入颗粒度'),
                    h('div', { className: 'tns-hint' }, '控制正文随标题注入多少内容'),
                  ),
                  h(
                    'select',
                    {
                      className: 'tns-select', value: injectDetail,
                      onChange: function (event) { setInjectDetail(event.target.value) },
                    },
                    h('option', { value: 'title' }, '仅标题'),
                    h('option', { value: 'headings' }, '正文中的所有 Markdown 标题'),
                    h('option', { value: 'body200' }, '正文前 200 行'),
                  ),
                ),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, '编辑与保存'),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '允许智能体修改你手写的条目'),
                    h('div', { className: 'tns-hint' }, '关闭时智能体只能动自己创建的条目；打开后每次写入仍需 DSH 审批'),
                  ),
                  h('input', {
                    type: 'checkbox', className: 'tns-check', checked: agentAllow,
                    onChange: function (event) { setAgentAllow(event.target.checked === true) },
                  }),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '正文自动保存'),
                    h('div', { className: 'tns-hint' }, '停止输入后等待多久保存；标题使用同一个间隔'),
                  ),
                  h(
                    'div',
                    { className: 'tns-opacity' },
                    h('input', {
                      type: 'number', min: 1, max: 60, value: autosaveSec, className: 'tns-number',
                      onChange: function (event) { setAutosaveSec(event.target.value) },
                    }),
                    h('span', { className: 'tns-unit' }, '秒'),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '标题最大长度'),
                    h('div', { className: 'tns-hint' }, '手动改名与智能体创建、改名都受此限制；超出部分会被截掉，默认 30 个字'),
                  ),
                  h(
                    'div',
                    { className: 'tns-opacity' },
                    h('input', {
                      type: 'number', min: 1, max: 200, value: titleMax, className: 'tns-number',
                      onChange: function (event) { setTitleMax(event.target.value) },
                    }),
                    h('span', { className: 'tns-unit' }, '字'),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '启用 CSS 动画'),
                    h('div', { className: 'tns-hint' }, '关闭后收展、气泡与悬停过渡都不再播放'),
                  ),
                  h('input', {
                    type: 'checkbox', className: 'tns-check', checked: enableAnimations,
                    onChange: function (event) { setEnableAnimations(event.target.checked === true) },
                  }),
                ),
              ),
            ),
      )
    }
