      function renderLooseTodos(group) {
        const referenced = {}
        if (group.folderTodos !== null && typeof group.folderTodos === 'object') {
          Object.keys(group.folderTodos).forEach(function (folderId) {
            const ids = group.folderTodos[folderId]
            if (Array.isArray(ids)) ids.forEach(function (id) { referenced[id] = true })
          })
        }
        const loose = sortTodosForView((group.todos || []).filter(function (todo) { return referenced[todo.id] !== true }))
        if (loose.length === 0) return null
        return h(
          'div',
          { className: 'dtn-loose' },
          h(
            'div',
            { className: 'dtn-folder-head' },
            h('span', { className: 'dtn-folder-toggle', style: { cursor: 'default' } }, icon('folder')),
            h('span', { className: 'dtn-folder-name' }, '未归类'),
          ),
          loose.map(function (todo) { return renderTodoRow(group, todo, '') }),
        )
      }

      function renderSection(kind, label, groups) {
        const sectionCollapsed = sections[kind] === true
        return h(
          'div',
          { key: kind, className: 'dtn-sec' },
          h(
            'div',
            Object.assign(
              {
                className: 'dtn-sec-head' + (kind === 'user' && dropKey === 'section:user' ? ' dtn-drop-target' : ''),
                onClick: function () { toggleSection(kind) },
                onContextMenu: function (event) { openTreeMenu(event, { kind: 'section', sectionKind: kind, groups: groups }) },
              },
              kind === 'user' && groups.length > 0
                ? {
                    onDragEnter: function () {
                      if (dragPayloadKey.current === '') return
                      markDropTarget('section:user')
                    },
                    onDragOver: function (event) {
                      if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    },
                    onDragLeave: function (event) { leaveDropTarget('section:user', event) },
                    onDrop: function (event) {
                      if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                      clearDropTarget()
                      const payload = dragData(event)
                      dragPayloadKey.current = ''
                      if (payload === null || payload.kind !== 'todo' || payload.key !== groups[0].key) return
                      if (Array.isArray(payload.ids) && payload.ids.length > 1) {
                        moveBatchTodos(groups[0], payload.ids, PRIMARY, event)
                        return
                      }
                      postApi({ action: 'moveTodo', key: groups[0].key, id: payload.id, folder: PRIMARY })
                        .then(function () { showBubble('已归入无文件夹', event); refresh() })
                        .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                    },
                  }
                : {},
            ),
            h('span', { className: 'dtn-sec-caret' }, sectionCollapsed ? icon('chevronRight') : icon('chevronDown')),
            h('span', { className: 'dtn-sec-name' }, label),
            kind === 'user' && groups.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-copy dtn-sec-add',
                    title: '新建文件夹',
                    onClick: function (event) {
                      event.stopPropagation()
                      createFolder(groups[0], event)
                    },
                  },
                  icon('folderAdd'),
                )
              : null,
            kind === 'user' && groups.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-copy dtn-sec-add',
                    title: '新建 TODO',
                    onClick: function (event) {
                      event.stopPropagation()
                      createTodo(groups[0], event)
                    },
                  },
                  icon('add'),
                )
              : null,
            kind === 'user' && groups.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-copy dtn-sec-add',
                    title: '批量新建 TODO',
                    onClick: function (event) {
                      event.stopPropagation()
                      openBatchCreate(groups[0], event)
                    },
                  },
                  icon('addBatch'),
                )
              : null,
            h(
              'span',
              { className: 'dtn-sec-count', title: '该层级 TODO 总数' },
              String(groups.reduce(function (total, group) { return total + (Array.isArray(group.todos) ? group.todos.length : 0) }, 0)),
            ),
          ),
          h(
            'div',
            { className: 'dtn-sec-body dtn-fold' + (sectionCollapsed ? ' dtn-fold-off' : '') },
            groups.length === 0
              ? h('div', { className: 'dtn-empty' }, '暂无便签组')
              : groups.map(function (group) { return renderGroup(group, kind === 'user') }),
          ),
        )
      }

      const userGroups = data !== null && data.user !== null && data.user !== undefined ? [data.user] : []
      const workspaceGroups = data !== null && Array.isArray(data.workspaces) ? data.workspaces : []
      const sessionGroups = data !== null && Array.isArray(data.sessions) ? data.sessions : []
      const totalOpen =
        userGroups.concat(workspaceGroups).concat(sessionGroups).reduce(function (sum, group) {
          return sum + (typeof group.count === 'number' ? group.count : 0)
        }, 0)

      React.useEffect(function () {
        if (hoverOpen !== true) return undefined
        const onDown = function (event) {
          // 点击面板外部时收起临时展开；面板内部交给各自控件处理。
          const node = panelRef.current
          if (node !== null && node !== undefined && node.contains(event.target)) return
          setHoverOpen(false)
        }
        window.addEventListener('pointerdown', onDown)
        return function () { window.removeEventListener('pointerdown', onDown) }
      }, [hoverOpen])

      const panelCollapsed = collapsed && !(hoverOpen && !embedded)
      const uiSettings = data !== null && data !== undefined && data.ui !== null && data.ui !== undefined ? data.ui : {}
      const donePercent = typeof uiSettings.doneOpacity === 'number' ? Math.max(0, Math.min(100, uiSettings.doneOpacity)) : 35
      const partialPercent = typeof uiSettings.partialOpacity === 'number' ? Math.max(0, Math.min(100, uiSettings.partialOpacity)) : 67
      const panel = h(
        WindowFrame,
        {
          rootRef: panelRef,
          windowKey: 'main',
          zIndex: 2147482500,
          zIndexActive: 2147482515,
          className:
            'dtn-root' +
            (resizing ? ' dtn-resizing' : '') +
            (dragging ? ' dtn-dragging' : '') +
            (embedded ? ' dtn-embedded' : '') +
            (embedded && mode !== 'sidebar' ? ' dtn-hidden' : ''),
          headClassName: 'dtn-head',
          bodyClassName: 'dtn-body',
          style: Object.assign(
            {
              '--dtn-done-opacity': String(donePercent / 100),
              '--dtn-partial-opacity': String(partialPercent / 100),
            },
            embedded
              ? {}
              : {
                  left: panelLeftOf(panelPos, panelWidth, panelCollapsed) + 'px',
                  top: panelPos.y + 'px',
                  width: panelCollapsed ? undefined : panelWidth + 'px',
                  height: panelCollapsed ? '44px' : panelHeight === null ? undefined : panelHeight + 'px',
                },
          ),
          collapsed: collapsed === true && !embedded,
          expanded: hoverOpen === true && !embedded,
          onHoverEnter: embedded
            ? undefined
            : function () { if (collapsed) setHoverOpen(true) },
          onHoverLeave: embedded ? undefined : function () { if (hoverOpen) setHoverOpen(false) },
          onDragStart: embedded ? undefined : function (event) { startDrag(event, 'main') },
          onHeadClick: embedded
            ? undefined
            : function (event) {
                // 拖动结束后的 click 不算收展。
                if (dragMoved.current) {
                  dragMoved.current = false
                  return
                }
                if (event.target !== null && typeof event.target.closest === 'function' && event.target.closest('button') !== null) return
                toggleCollapsed()
              },
          onBodyPointerDown: beginMarquee,
          onResize: beginResize,
          resizeDirs: panelCollapsed || embedded ? null : ['r', 'l', 't', 'b', 'br'],
          head: [
            h('span', { key: 'logo', className: 'dtn-logo' }, icon('list', 14)),
            h('span', { key: 'title', className: 'dtn-title' }, 'TODO 便签'),
            h('span', { key: 'count', className: 'dtn-count' }, data === null ? '加载中…' : totalOpen + ' 条未完成'),
            embedded
              ? null
              : h(
                  'div',
                  { key: 'actions', className: 'dtn-actions' },
                  h(
                    'button',
                    { type: 'button', className: 'dtn-btn', title: '显示到右侧栏', onClick: function (event) { event.stopPropagation(); showInSidebar() } },
                    icon('panelRight'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dtn-btn',
                      title: collapsed ? '展开面板' : '折叠面板',
                      onClick: toggleCollapsed,
                    },
                    collapsed ? icon('chevronDown') : icon('chevronUp'),
                  ),
                ),
          ],
        },
        error !== '' ? h('div', { className: 'dtn-error' }, '读取失败：' + error) : null,
        renderSection('user', '用户级TODO', userGroups),
        renderSection('workspace', '工作区级TODO', workspaceGroups),
        renderSection('session', '会话级TODO', sessionGroups),
      )

      function previewFolderLabel(data) {
        if (data === null || data === undefined) return ''
        return folderDisplayName(preview !== null && preview !== undefined ? preview.groupKey : '', data.primaryFolder)
      }

      const previewPanel = h(
        'div',
        {
          className: 'dtn-preview' + (preview === null ? ' dtn-preview-off' : ''),
          style: { left: previewPos.x + 'px', top: previewPos.y + 'px' },
          ref: previewRef,
          onMouseEnter: cancelClose,
          onMouseLeave: leavePreview,
        },
        preview === null
          ? null
          : [
              h(
                'div',
                { key: 'head', className: 'dtn-preview-head', onPointerDown: function (event) { startWindowMove(event, 'preview') } },
                h('span', { className: 'dtn-preview-title' }, previewData !== null && typeof previewData.title === 'string' ? previewData.title : preview.title),
                h(
                  'div',
                  { className: 'dtn-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dtn-btn',
                      title: '编辑正文',
                      onClick: function (event) { event.stopPropagation(); pinFromPreview(true) },
                    },
                    icon('edit'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dtn-btn',
                      title: '关闭预览',
                      onClick: closePreview,
                    },
                    icon('close'),
                  ),
                ),
              ),
              h(
                'div',
                { key: 'meta', className: 'dtn-preview-meta' },
                previewData !== null
                  ? [
                      h('span', { key: 'status', className: 'dtn-meta-item' }, icon(previewData.status === 'done' ? 'check' : 'clock', 11), previewData.status === 'done' ? '条目已完成' : previewData.status === 'partial' ? '条目待确认' : '条目未完成'),
                      h('span', { key: 'priority', className: 'dtn-meta-item', style: { color: prioColor(previewData.priority) } }, icon('flag', 11), '优先级 T' + (typeof previewData.priority === 'number' ? previewData.priority : 1)),
                      h('span', { key: 'folder', className: 'dtn-meta-item' }, icon('folder', 11), previewFolderLabel(previewData)),
                      previewData.created !== '' ? h('span', { key: 'created', className: 'dtn-meta-item' }, icon('clock', 11), '创建 ' + formatStamp(previewData.created)) : null,
                      isAiSource(previewData.source)
                        ? h('span', { key: 'source', className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13))
                        : null,
                    ]
                  : [h('span', { key: 'loading' }, '加载中…')],
              ),
              h(
                'div',
                { key: 'body', className: 'dtn-preview-body dtn-md' },
                previewError !== ''
                  ? h('div', { className: 'dtn-error' }, '读取失败：' + previewError)
                  : previewData === null
                    ? h('div', { className: 'dtn-empty' }, '加载中…')
                    : typeof MarkdownText === 'function' || (MarkdownText !== null && typeof MarkdownText === 'object')
                    ? h(MarkdownText, { text: previewData.markdown, variant: 'body' })
                    : renderMarkdown(previewData.markdown),
              ),
            ],
      )

      const bubbleNodes = bubbles.map(function (entry) {
        return h(
          'div',
          {
            key: 'bubble-' + entry.id,
            className: 'dtn-bubble',
            style: { left: entry.x + 'px', top: entry.y + 'px' },
          },
          entry.text,
        )
      })

      function findLiveGroup(key) {
        if (data === null) return null
        const lists = [data.user].concat(data.workspaces || [], data.sessions || [])
        for (let i = 0; i < lists.length; i += 1) {
          if (lists[i] !== null && lists[i] !== undefined && lists[i].key === key) return lists[i]
        }
        return null
      }

      // 预览类窗口统一用这一处解析文件夹显示名，避免临时预览与保留窗口各写一套。
      function folderDisplayName(groupKey, folderId) {
        const id = typeof folderId === 'string' && folderId !== '' ? folderId : PRIMARY
        if (id === PRIMARY) return '无文件夹'
        const group = findLiveGroup(groupKey)
        const nodes = group === null || group === undefined || !Array.isArray(group.folders) ? [] : group.folders
        const trail = []
        const walk = function (list, path) {
          for (let index = 0; index < list.length; index += 1) {
            const node = list[index]
            if (node === null || node === undefined) continue
            const name = typeof node.name === 'string' && node.name !== '' ? node.name : node.id
            const next = path.concat(name)
            if (node.id === id) {
              trail.push.apply(trail, next)
              return true
            }
            if (Array.isArray(node.children) && walk(node.children, next)) return true
          }
          return false
        }
        walk(nodes, [])
        return trail.length > 0 ? trail.join(' / ') : id
      }
