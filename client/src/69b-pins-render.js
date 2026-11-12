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
        const raw = String(win.renameDraft !== undefined && win.renameDraft !== null ? win.renameDraft : win.title).trim()
        const clamped = clampTitleDraft(raw)
        const title = clamped.text
        if (title !== '' && title !== win.title) {
          postApi({ action: 'renameTodo', key: win.groupKey, id: win.todoId, title: title })
            .then(function () { syncTodoTitle(win.groupKey, win.todoId, title) })
            .catch(function () {})
        }
      }
      removePin(win.id)
    }

    // 预览信息里的文件夹名与临时预览共用同一处解析。
    function pinFolderLabel(win) {
      const meta = win.meta
      return folderDisplayName(win.groupKey, meta !== null && meta !== undefined ? meta.primaryFolder : PRIMARY)
    }

    function pinHeadCommon(win) {
      return h('button', {
        type: 'button',
        className: 'dtn-btn dtn-head-collapse dtn-collapse-pin',
        title: win.collapsed ? '展开' : '收起',
        'data-open': win.collapsed ? 'false' : 'true',
        onClick: function (event) {
          event.stopPropagation()
          const wasPeek = win.collapsed === true && hoverPin === win.id
          setHoverPin('')
          updatePin(win.id, { collapsed: !win.collapsed })
          if (wasPeek) {
            setPulsePin(win.id)
            window.setTimeout(function () { setPulsePin(function (value) { return value === win.id ? '' : value }) }, 420)
          }
        },
      }, icon('chevronDown'))
    }

    function pinHeadClick(win) {
      return function (event) {
        if (pinDragMoved.current) {
          pinDragMoved.current = false
          return
        }
        if (event.target !== null && event.target !== undefined && event.target.closest !== undefined) {
          if (event.target.closest('button') !== null || event.target.closest('input') !== null) return
        }
        const wasPeek = win.collapsed === true && hoverPin === win.id
        setHoverPin('')
        updatePin(win.id, { collapsed: !win.collapsed })
        if (wasPeek) {
          setPulsePin(win.id)
          window.setTimeout(function () { setPulsePin(function (value) { return value === win.id ? '' : value }) }, 420)
        }
      }
    }

    function pinShell(win, options) {
      const expanded = win.collapsed !== true || hoverPin === win.id
      return h(
        WindowFrame,
        {
          key: win.id,
          pinId: win.id,
          windowKey: win.id,
          zIndex: 2147482510,
          zIndexActive: 2147482512,
          className: options.className + (pulsePin === win.id ? ' dtn-pin-pulse' : ''),
          headClassName: options.headClassName,
          bodyClassName: 'dtn-pin-content',
          style: {
            left: win.pos.x + 'px',
            top: win.pos.y + 'px',
            width: win.width ? win.width + 'px' : undefined,
            height: expanded ? (win.height ? win.height + 'px' : undefined) : '40px',
          },
          collapsed: win.collapsed === true,
          expanded: hoverPin === win.id,
          onHoverEnter: function () { if (win.collapsed) setHoverPin(win.id) },
          onHoverLeave: function () { if (hoverPin === win.id) setHoverPin('') },
          onDragStart: function (event) { dragPinWindow(event, win.id) },
          onHeadClick: pinHeadClick(win),
          onResize: function (event, dir) { beginPinResize(event, win.id, dir) },
          resizeDirs: ['r', 'l', 't', 'b', 'br'],
          head: options.head,
        },
        options.body,
      )
    }

    function renderPinPreview(win) {
      const meta = win.meta
      const head = [
        h('span', { className: 'dtn-pin-type', title: '预览' }, icon('fileText', 13)),
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
            title: win.editing ? '取消编辑并还原内容' : '关闭',
            onClick: function (event) {
              event.stopPropagation()
              if (win.editing === true) cancelPinEditing(win.id)
              else closePin(win)
            },
          }, icon('close')),
          pinHeadCommon(win),
        ),
      ]
      const metaNodes = meta === null || meta === undefined
        ? [h('span', { key: 'loading' }, win.loading ? '加载中…' : '')]
        : [
            h('span', { key: 'status', className: 'dtn-meta-item' }, icon(meta.status === 'done' ? 'check' : 'clock', 11), meta.status === 'done' ? '条目已完成' : meta.status === 'partial' ? '条目待确认' : '条目未完成'),
            h('span', { key: 'priority', className: 'dtn-meta-item', style: { color: prioColor(meta.priority) } }, icon('flag', 11), '优先级 T' + (typeof meta.priority === 'number' ? meta.priority : 1)),
            h('span', { key: 'folder', className: 'dtn-meta-item' }, icon('folder', 11), pinFolderLabel(win)),
            meta.created !== '' ? h('span', { key: 'created', className: 'dtn-meta-item' }, icon('clock', 11), '创建 ' + formatStamp(meta.created)) : null,
            isAiSource(meta.source) ? h('span', { key: 'source', className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13)) : null,
          ]
      const bodyNodes = [
        h('div', { key: 'meta', className: 'dtn-preview-meta' }, metaNodes),
        win.editing
          ? h(
              'div',
              { key: 'editor', className: 'dtn-preview-body dtn-edit-body' },
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
              { key: 'markdown', className: 'dtn-preview-body dtn-md' },
              win.error !== ''
                ? h('div', { className: 'dtn-error' }, '读取失败：' + win.error)
                : typeof MarkdownText === 'function' || (MarkdownText !== null && typeof MarkdownText === 'object')
                ? h(MarkdownText, { text: win.markdown, variant: 'body' })
                : renderMarkdown(win.markdown),
            ),
      ]
      return pinShell(win, {
        className: 'dtn-preview dtn-pin',
        headClassName: 'dtn-preview-head',
        head: head,
        body: bodyNodes,
      })
    }

    function renderPinBatchCreate(win) {
      const lines = String(win.value || '').split(/\r?\n/)
      const head = [
        h('span', { className: 'dtn-pin-type', title: '批量新建' }, icon('addBatch', 13)),
        h('span', { className: 'dtn-preview-title' }, '批量新建 TODO'),
        h(
          'div',
          { className: 'dtn-actions' },
          h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { removePin(win.id) } }, icon('close')),
          pinHeadCommon(win),
        ),
      ]
      return pinShell(win, {
        className: 'dtn-preview dtn-batch dtn-pin',
        headClassName: 'dtn-preview-head',
        head: head,
        body: h(
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
      })
    }

    function renderPinBatchRename(win) {
      const head = [
        h('span', { className: 'dtn-pin-type', title: '批量重命名' }, icon('edit', 13)),
        h('span', { className: 'dtn-preview-title' }, '批量重命名'),
        h(
          'div',
          { className: 'dtn-actions' },
          h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { removePin(win.id) } }, icon('close')),
          pinHeadCommon(win),
        ),
      ]
      return pinShell(win, {
        className: 'dtn-preview dtn-batch dtn-pin',
        headClassName: 'dtn-preview-head',
        head: head,
        body: h(
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
      })
    }

    function renderPinnedWindows() {
      return pinned.map(function (win) {
        if (win.kind === 'preview') return renderPinPreview(win)
        if (win.kind === 'batchCreate') return renderPinBatchCreate(win)
        return renderPinBatchRename(win)
      })
    }
