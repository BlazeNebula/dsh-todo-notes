    function pinGutter(draft) {
      return String(draft || '').split('\n').map(function (line, index) {
        return h('div', { key: 'pin-line-' + index, className: 'dtn-batch-line' }, String(index + 1))
      })
    }

    function closePin(win) {
      if (win.kind === 'preview' && win.editing === true && win.draft !== win.markdown) {
        // 关窗前把还没等到自动保存的正文补写一次，避免编辑内容丢失。
        postApi({ action: 'saveTodoBody', key: win.groupKey, id: win.todoId, body: win.draft }).catch(function () {})
      }
      if (win.kind === 'preview' && win.editing === true) {
        const title = String(win.renameDraft !== undefined && win.renameDraft !== null ? win.renameDraft : win.title).trim()
        if (title !== '' && title !== win.title) {
          postApi({ action: 'renameTodo', key: win.groupKey, id: win.todoId, title: title }).catch(function () {})
        }
      }
      removePin(win.id)
    }

    function renderPinPreview(win) {
      const meta = win.meta
      return h(
        'div',
        {
          key: win.id,
          className: 'dtn-preview dtn-pin',
          style: { left: win.pos.x + 'px', top: win.pos.y + 'px' },
          onPointerDown: function (event) { event.stopPropagation() },
        },
        h(
          'div',
          { className: 'dtn-preview-head', onPointerDown: function (event) { dragPinWindow(event, win.id) } },
          win.editing
            ? h('input', {
                className: 'dtn-pin-title-input',
                value: win.renameDraft !== undefined && win.renameDraft !== null ? win.renameDraft : win.title,
                spellCheck: false,
                onChange: function (event) {
                  updatePin(win.id, { renameDraft: event.currentTarget.value })
                  schedulePinTitleSave(win.id)
                },
                onPointerDown: function (event) { event.stopPropagation() },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                    if (pinTitleTimers.current[win.id] !== undefined) {
                      window.clearTimeout(pinTitleTimers.current[win.id])
                      delete pinTitleTimers.current[win.id]
                    }
                    savePinTitle(win.id)
                  }
                },
              })
            : h('span', { className: 'dtn-preview-title' }, win.title),
          h(
            'div',
            { className: 'dtn-actions' },
            h('button', {
              type: 'button',
              className: 'dtn-btn',
              title: win.editing ? '保存并完成编辑' : '编辑正文',
              onClick: function (event) { event.stopPropagation(); togglePinEditing(win.id) },
            }, icon(win.editing ? 'check' : 'edit')),
            h('button', {
              type: 'button',
              className: 'dtn-btn',
              title: '关闭',
              onClick: function (event) { event.stopPropagation(); closePin(win) },
            }, icon('close')),
          ),
        ),
        h(
          'div',
          { className: 'dtn-preview-meta' },
          meta === null || meta === undefined
            ? [h('span', { key: 'loading' }, win.loading ? '加载中…' : '')]
            : [
                h('span', { key: 'status' }, meta.status === 'done' ? '已完成' : meta.status === 'partial' ? '中间态（待人工确认）' : '未完成'),
                isAiSource(meta.source) ? h('span', { key: 'source', className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13)) : null,
                h('span', { key: 'folder' }, '无文件夹：' + folderLabel(meta.primaryFolder)),
                h('span', { key: 'priority', style: { color: prioColor(meta.priority) } }, '优先级 T' + (typeof meta.priority === 'number' ? meta.priority : 1)),
                meta.created !== '' ? h('span', { key: 'created' }, '创建 ' + formatStamp(meta.created)) : null,
              ],
        ),
        win.editing
          ? h(
              'div',
              { className: 'dtn-preview-body dtn-edit-body' },
              h(
                'div',
                { className: 'dtn-batch-field' },
                h('div', {
                  className: 'dtn-batch-gutter',
                  ref: function (node) { if (node !== null) pinGutterRefs.current[win.id] = node },
                }, pinGutter(win.draft)),
                h('textarea', {
                  className: 'dtn-batch-input dtn-edit-input',
                  value: win.draft,
                  autoFocus: true,
                  wrap: 'off',
                  spellCheck: false,
                  rows: Math.min(24, Math.max(6, String(win.draft || '').split('\n').length)),
                  style: win.editHeight ? { height: win.editHeight + 'px' } : undefined,
                  onPointerDown: function (event) { event.stopPropagation() },
                  onPointerUp: function (event) {
                    // 用户拖动右下角改变过高度后记住它；自动增高仍以内容行数为下限。
                    const height = event.currentTarget.offsetHeight
                    if (Math.abs(height - editAutoHeight(win.draft)) > 8) updatePin(win.id, { editHeight: height })
                  },
                  onScroll: function (event) {
                    const gutter = pinGutterRefs.current[win.id]
                    if (gutter !== undefined && gutter !== null) gutter.scrollTop = event.currentTarget.scrollTop
                  },
                  onChange: function (event) {
                    const value = event.currentTarget.value
                    const minHeight = editAutoHeight(value)
                    const patch = { draft: value }
                    if (win.editHeight && minHeight > win.editHeight) patch.editHeight = minHeight
                    updatePin(win.id, patch)
                    schedulePinSave(win.id)
                  },
                }),
              ),
              win.error !== '' ? h('div', { className: 'dtn-error' }, win.error) : null,
            )
          : h(
              'div',
              { className: 'dtn-preview-body dtn-md' },
              win.error !== ''
                ? h('div', { className: 'dtn-error' }, '读取失败：' + win.error)
                : renderMarkdown(win.markdown),
            ),
      )
    }

    function renderPinBatchCreate(win) {
      const lines = String(win.value || '').split(/\r?\n/)
      return h(
        'div',
        {
          key: win.id,
          className: 'dtn-preview dtn-batch dtn-pin',
          style: { left: win.pos.x + 'px', top: win.pos.y + 'px' },
          onPointerDown: function (event) { event.stopPropagation() },
        },
        h(
          'div',
          { className: 'dtn-preview-head', onPointerDown: function (event) { dragPinWindow(event, win.id) } },
          h('span', { className: 'dtn-preview-title' }, '批量新建 TODO'),
          h(
            'div',
            { className: 'dtn-actions' },
            h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { removePin(win.id) } }, icon('close')),
          ),
        ),
        h(
          'div',
          { className: 'dtn-preview-body' },
          h('div', { className: 'dtn-batch-hint' }, '每行一条，空行忽略'),
          h(
            'div',
            { className: 'dtn-batch-field' },
            h('div', { className: 'dtn-batch-gutter' }, lines.map(function (line, index) {
              return h('div', { key: 'pin-bc-line-' + index, className: 'dtn-batch-line' }, String(index + 1))
            })),
            h('textarea', {
              className: 'dtn-batch-input',
              value: win.value,
              wrap: 'off',
              onChange: function (event) { updatePin(win.id, { value: event.currentTarget.value }) },
            }),
          ),
          h(
            'div',
            { className: 'dtn-batch-actions' },
            h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { removePin(win.id) } }, '取消'),
            h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-primary', onClick: function () { confirmPinBatchCreate(win.id) } }, '确认'),
          ),
        ),
      )
    }

    function renderPinBatchRename(win) {
      return h(
        'div',
        {
          key: win.id,
          className: 'dtn-preview dtn-batch dtn-pin',
          style: { left: win.pos.x + 'px', top: win.pos.y + 'px' },
          onPointerDown: function (event) { event.stopPropagation() },
        },
        h(
          'div',
          { className: 'dtn-preview-head', onPointerDown: function (event) { dragPinWindow(event, win.id) } },
          h('span', { className: 'dtn-preview-title' }, '批量重命名'),
          h(
            'div',
            { className: 'dtn-actions' },
            h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { removePin(win.id) } }, icon('close')),
          ),
        ),
        h(
          'div',
          { className: 'dtn-preview-body' },
          h('div', { className: 'dtn-batch-hint' }, '行数固定为选中条目数，不能增加或删除换行；清空的行会被跳过'),
          h(
            'div',
            { className: 'dtn-batch-field' },
            h('div', { className: 'dtn-batch-gutter' }, win.items.map(function (item, index) {
              return h('div', { key: 'pin-br-line-' + index, className: 'dtn-batch-line' }, String(index + 1))
            })),
            h('textarea', {
              className: 'dtn-batch-input',
              value: win.value,
              wrap: 'off',
              rows: Math.min(12, Math.max(3, win.items.length)),
              onKeyDown: function (event) { if (event.key === 'Enter') event.preventDefault() },
              onChange: function (event) {
                const value = event.currentTarget.value
                if (String(value).split('\n').length !== win.items.length) return
                updatePin(win.id, { value: value })
              },
            }),
          ),
          h(
            'div',
            { className: 'dtn-batch-actions' },
            h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { removePin(win.id) } }, '取消'),
            h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-primary', onClick: function () { confirmPinBatchRename(win.id) } }, '确认'),
          ),
        ),
      )
    }

    function renderPinnedWindows() {
      return pinned.map(function (win) {
        if (win.kind === 'preview') return renderPinPreview(win)
        if (win.kind === 'batchCreate') return renderPinBatchCreate(win)
        return renderPinBatchRename(win)
      })
    }
