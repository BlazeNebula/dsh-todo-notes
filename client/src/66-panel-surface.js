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
            h('span', { className: 'dtn-folder-caret' }),
            h('span', { className: 'dtn-folder-name' }, h('span', { className: 'dtn-folder-icon' }, icon('folder')), '未归类'),
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
            { className: 'dtn-sec-head', onClick: function () { toggleSection(kind) }, onContextMenu: function (event) { openTreeMenu(event, { kind: 'section', sectionKind: kind, groups: groups }) } },
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
        const margin = 48
        const onMove = function (event) {
          const node = panelRef.current
          if (node === null || node === undefined) return
          const rect = node.getBoundingClientRect()
          const inside =
            event.clientX >= rect.left - margin &&
            event.clientX <= rect.right + margin &&
            event.clientY >= rect.top - margin &&
            event.clientY <= rect.bottom + margin
          if (!inside) setHoverOpen(false)
        }
        window.addEventListener('pointermove', onMove)
        return function () { window.removeEventListener('pointermove', onMove) }
      }, [hoverOpen])

      const panelCollapsed = collapsed && !(hoverOpen && !embedded)
      const panel = h(
        'div',
        {
          ref: panelRef,
          className:
            'dtn-root' +
            (panelCollapsed && !embedded ? ' dtn-collapsed' : '') +
            (resizing ? ' dtn-resizing' : '') +
            (dragging ? ' dtn-dragging' : '') +
            (embedded ? ' dtn-embedded' : '') +
            (embedded && mode !== 'sidebar' ? ' dtn-hidden' : ''),
          style: embedded
            ? {}
            : {
                left: panelLeftOf(panelPos, panelWidth, panelCollapsed) + 'px',
                top: panelPos.y + 'px',
                width: panelCollapsed ? undefined : panelWidth + 'px',
                height: panelCollapsed || panelHeight === null ? undefined : panelHeight + 'px',
              },
          onMouseEnter: embedded
            ? undefined
            : function () { if (collapsed) setHoverOpen(true) },
        },
        h(
          'div',
          {
            className: 'dtn-head',
            onPointerDown: embedded ? undefined : function (event) { startDrag(event, 'main') },
            onClick: embedded
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
          },
          h('span', { className: 'dtn-logo' }, '▤'),
          h('span', { className: 'dtn-title' }, 'TODO 便签'),
          h('span', { className: 'dtn-count' }, data === null ? '加载中…' : totalOpen + ' 条未完成'),
          embedded
            ? null
            : h(
                'div',
                { className: 'dtn-actions' },
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
        ),
        h(
          'div',
          { className: 'dtn-body-wrap' },
          h(
            'div',
            { className: 'dtn-body', onPointerDown: beginMarquee },
            error !== '' ? h('div', { className: 'dtn-error' }, '读取失败：' + error) : null,
            renderSection('user', '用户级TODO', userGroups),
            renderSection('workspace', '工作区级TODO', workspaceGroups),
            renderSection('session', '会话级TODO', sessionGroups),
          ),
        ),
        panelCollapsed || embedded
          ? null
          : [
              h('div', { key: 'r-r', className: 'dtn-resize dtn-resize-r', title: '拖动调整宽度', onPointerDown: function (event) { beginResize(event, 'r') } }),
              h('div', { key: 'r-l', className: 'dtn-resize dtn-resize-l', title: '拖动调整宽度', onPointerDown: function (event) { beginResize(event, 'l') } }),
              h('div', { key: 'r-t', className: 'dtn-resize dtn-resize-t', title: '拖动调整高度', onPointerDown: function (event) { beginResize(event, 't') } }),
              h('div', { key: 'r-b', className: 'dtn-resize dtn-resize-b', title: '拖动调整高度', onPointerDown: function (event) { beginResize(event, 'b') } }),
              h('div', { key: 'r-br', className: 'dtn-resize dtn-resize-br', title: '拖动调整大小', onPointerDown: function (event) { beginResize(event, 'br') } }),
            ],
      )

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
                { key: 'head', className: 'dtn-preview-head', onPointerDown: function (event) { startDrag(event, 'preview') } },
                h('span', { className: 'dtn-preview-title' }, previewData !== null && typeof previewData.title === 'string' ? previewData.title : preview.title),
                h(
                  'div',
                  { className: 'dtn-actions' },
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
                      h('span', { key: 'status' }, previewData.status === 'done' ? '已完成' : previewData.status === 'partial' ? '中间态（待人工确认）' : '未完成'),
                      isAiSource(previewData.source)
                        ? h('span', { key: 'source', className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13))
                        : null,
                      h('span', { key: 'folder' }, '无文件夹：' + folderLabel(previewData.primaryFolder)),
                      h('span', { key: 'priority', style: { color: prioColor(previewData.priority) } }, '优先级 T' + (typeof previewData.priority === 'number' ? previewData.priority : 1)),
                      previewData.created !== '' ? h('span', { key: 'created' }, '创建 ' + formatStamp(previewData.created)) : null,
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
