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
      const [writePolicy, setWritePolicy] = React.useState('ask')
      const [injectAgentTodos, setInjectAgentTodos] = React.useState(true)
      const [injectMinPriority, setInjectMinPriority] = React.useState(2)
      const [injectDetail, setInjectDetail] = React.useState('headings')
      const [injectMaxItems, setInjectMaxItems] = React.useState('20')
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
        if (ui.agentWritePolicy === 'deny' || ui.agentWritePolicy === 'ask' || ui.agentWritePolicy === 'agent-only' || ui.agentWritePolicy === 'allow-all') {
          setWritePolicy(ui.agentWritePolicy)
        } else {
          setWritePolicy('ask')
        }
        setInjectAgentTodos(ui.injectAgentTodos !== false)
        setInjectMinPriority(typeof ui.injectMinPriority === 'number' ? ui.injectMinPriority : 2)
        setInjectDetail(ui.injectDetail === 'title' || ui.injectDetail === 'body200' ? ui.injectDetail : 'headings')
        setInjectMaxItems(String(typeof ui.injectMaxItems === 'number' ? ui.injectMaxItems : 20))
        setEnableAnimations(ui.enableAnimations !== false)
      }

      React.useEffect(function () {
        let alive = true
        fetch(ROUTE + '?what=uiSettings&ts=' + Date.now(), { cache: 'no-store' })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (!alive) return
            if (payload !== null && payload !== undefined && payload.ok === true) applyUi(payload.ui, payload.config)
            else setError(tr('settingsLoadFailed'))
            setLoading(false)
          })
          .catch(function (err) {
            if (!alive) return
            setError(tr('settingsLoadFailedDetail', { detail: err !== null && err !== undefined && err.message ? err.message : err }))
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
              setStatus(tr('settingsSaved'))
            } else {
              setStatus(tr('settingsSaveFailedDetail', { detail: payload !== null && payload !== undefined && payload.error ? payload.error : tr('settingsUnknownError') }))
            }
            setBusy(false)
          })
          .catch(function (err) {
            setStatus(tr('settingsSaveFailedDetail', { detail: err !== null && err !== undefined && err.message ? err.message : err }))
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
            agentWritePolicy: writePolicy,
            titleMaxLength: maxTitle,
            injectAgentTodos: injectAgentTodos,
            injectMinPriority: injectMinPriority,
            injectDetail: injectDetail,
            injectMaxItems: Math.max(1, Math.min(50, Math.round(Number(injectMaxItems) || 20))),
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
        h('p', { className: 'tns-desc' }, tr('settingsIntro')),
        loading
          ? h('div', { className: 'tns-loading' }, tr('settingsLoading'))
          : h(
              React.Fragment,
              null,
              error !== '' ? h('div', { className: 'tns-error' }, error) : null,
              h(
                'div',
                { className: 'tns-actions' },
                h('button', { type: 'button', className: 'tns-btn', disabled: busy, onClick: reset }, tr('settingsReset')),
                h('button', { type: 'button', className: 'tns-btn tns-btn-primary', disabled: busy, onClick: save }, busy ? tr('settingsSaving') : tr('settingsSave')),
                status !== '' ? h('span', { className: 'tns-status' }, status) : null,
              ),
              h(
                'div',
                { className: 'tns-preview-grid' },
                [[tr('previewLight'), '#ffffff', '#1f1f24'], [tr('previewDark'), '#1a1a1a', '#e8e8ea']].map(function (theme) {
                  return h(
                    'div',
                    { key: theme[0], className: 'tns-preview-box', style: { background: theme[1], color: theme[2], '--dsw-alias-label-primary': theme[2] } },
                    h('div', { className: 'tns-preview-label' }, theme[0]),
                    h(
                      'div',
                      { className: 'tns-preview-row' },
                      h('span', { className: 'tns-preview-check' }, '☐'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[3]) } }, 'T3'),
                      h('span', null, tr('previewOpen')),
                    ),
                    h(
                      'div',
                      { className: 'tns-preview-row', style: { opacity: doneOpacity / 100 } },
                      h('span', { className: 'tns-preview-check' }, '☑'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[1]) } }, 'T1'),
                      h('span', null, tr('previewDone')),
                    ),
                    h(
                      'div',
                      { className: 'tns-preview-row', style: { opacity: partialOpacity / 100 } },
                      h('span', { className: 'tns-preview-check' }, '◐'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[2]) } }, 'T2'),
                      h('span', null, tr('previewPartial')),
                    ),
                  )
                }),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, tr('sectionAppearance')),
                opacityRow(tr('doneLabel'), tr('doneHint'), doneOpacity, setDoneOpacity),
                opacityRow(tr('partialLabel'), tr('partialHint'), partialOpacity, setPartialOpacity),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, tr('sectionPriority')),
                h('p', { className: 'tns-hint' }, tr('priorityHint')),
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
                h('h3', { className: 'tns-section-title' }, tr('sectionAgent')),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, tr('injectLabel')),
                    h('div', { className: 'tns-hint' }, tr('injectHint')),
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
                    h('div', { className: 'tns-label' }, tr('minPriorityLabel')),
                    h('div', { className: 'tns-hint' }, tr('minPriorityHint')),
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
                    h('div', { className: 'tns-label' }, tr('detailLabel')),
                    h('div', { className: 'tns-hint' }, tr('detailHint')),
                  ),
                  h(
                    'select',
                    {
                      className: 'tns-select', value: injectDetail,
                      onChange: function (event) { setInjectDetail(event.target.value) },
                    },
                    h('option', { value: 'title' }, tr('detailTitle')),
                    h('option', { value: 'headings' }, tr('detailHeadings')),
                    h('option', { value: 'body200' }, tr('detailBody200')),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, tr('maxItemsLabel')),
                    h('div', { className: 'tns-hint' }, tr('maxItemsHint')),
                  ),
                  h(
                    'div',
                    { className: 'tns-opacity' },
                    h('input', {
                      type: 'number', min: 1, max: 50, value: injectMaxItems, className: 'tns-number',
                      onChange: function (event) { setInjectMaxItems(event.target.value) },
                    }),
                    h('span', { className: 'tns-unit' }, tr('itemsUnit')),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, tr('writePolicyLabel')),
                    h('div', { className: 'tns-hint' }, tr('writePolicyHint')),
                  ),
                  h(
                    'select',
                    {
                      className: 'tns-select', value: writePolicy,
                      onChange: function (event) { setWritePolicy(event.target.value) },
                    },
                    h('option', { value: 'deny' }, tr('policyDeny')),
                    h('option', { value: 'ask' }, tr('policyAsk')),
                    h('option', { value: 'agent-only' }, tr('policyAgentOnly')),
                    h('option', { value: 'allow-all' }, tr('policyAllowAll')),
                  ),
                ),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, tr('sectionEditing')),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, tr('autosaveLabel')),
                    h('div', { className: 'tns-hint' }, tr('autosaveHint')),
                  ),
                  h(
                    'div',
                    { className: 'tns-opacity' },
                    h('input', {
                      type: 'number', min: 1, max: 60, value: autosaveSec, className: 'tns-number',
                      onChange: function (event) { setAutosaveSec(event.target.value) },
                    }),
                    h('span', { className: 'tns-unit' }, tr('secondsUnit')),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, tr('titleMaxLabel')),
                    h('div', { className: 'tns-hint' }, tr('titleMaxHint')),
                  ),
                  h(
                    'div',
                    { className: 'tns-opacity' },
                    h('input', {
                      type: 'number', min: 1, max: 200, value: titleMax, className: 'tns-number',
                      onChange: function (event) { setTitleMax(event.target.value) },
                    }),
                    h('span', { className: 'tns-unit' }, tr('charsUnit')),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, tr('animationsLabel')),
                    h('div', { className: 'tns-hint' }, tr('animationsHint')),
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
