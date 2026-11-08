    // ------------------------------------------------------------ 设置页（DSH 设置 → 插件 → TODO 便签）

    const UI_DEFAULT_PALETTE = ['#d9a441', '#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#2dc6d8', '#238fba', '#205eaa', '#1e30a2', '#1e41a2']

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
      const [agentAllow, setAgentAllow] = React.useState(false)

      function applyUi(ui, config) {
        if (ui === null || ui === undefined) return
        setDoneOpacity(typeof ui.doneOpacity === 'number' ? ui.doneOpacity : 35)
        setPartialOpacity(typeof ui.partialOpacity === 'number' ? ui.partialOpacity : 67)
        setPalette(splitPalette(ui.priorityPalette))
        const delay = ui.bodyAutosaveMs !== null && ui.bodyAutosaveMs !== undefined
          ? ui.bodyAutosaveMs
          : (config !== null && config !== undefined && typeof config.bodyAutosaveMs === 'number' ? config.bodyAutosaveMs : 5000)
        setAutosaveSec(String(Math.max(1, Math.round(delay / 1000))))
        if (ui.agentWriteUserTodos === true) setAgentAllow(true)
        else if (ui.agentWriteUserTodos === false) setAgentAllow(false)
        else setAgentAllow(config !== null && config !== undefined && config.agentWriteUserTodos === true)
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
        patchUi({
          action: 'saveUiSettings',
          ui: {
            doneOpacity: doneOpacity,
            partialOpacity: partialOpacity,
            priorityPalette: palette.join(';'),
            bodyAutosaveMs: seconds * 1000,
            agentWriteUserTodos: agentAllow,
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
                { className: 'tns-preview' },
                h('div', { className: 'tns-preview-label' }, '预览'),
                h(
                  'div',
                  { className: 'tns-preview-row' },
                  h('span', { className: 'tns-preview-check' }, '☐'),
                  h('span', { className: 'tns-preview-prio', style: { color: palette[3] } }, 'T3'),
                  h('span', null, '未完成的条目'),
                ),
                h(
                  'div',
                  { className: 'tns-preview-row', style: { opacity: doneOpacity / 100 } },
                  h('span', { className: 'tns-preview-check' }, '☑'),
                  h('span', { className: 'tns-preview-prio', style: { color: palette[1] } }, 'T1'),
                  h('span', null, '已完成的条目'),
                ),
                h(
                  'div',
                  { className: 'tns-preview-row', style: { opacity: partialOpacity / 100 } },
                  h('span', { className: 'tns-preview-check' }, '◐'),
                  h('span', { className: 'tns-preview-prio', style: { color: palette[2] } }, 'T2'),
                  h('span', null, '半完成、等待确认的条目'),
                ),
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
                h('p', { className: 'tns-hint' }, 'T0 最高，T9 最低。点色块用取色器改，也可以直接填十六进制值。'),
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
              ),
            ),
      )
    }
