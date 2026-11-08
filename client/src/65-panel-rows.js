      function renderTodoRow(group, todo, folderId, indent) {
        const isDone = todo.status === 'done'
        const isPartial = todo.status === 'partial'
        const rowScope = typeof folderId === 'string' && folderId !== '' ? folderId : 'loose'
        const rowKey = group.key + ':' + todo.id + ':' + rowScope
        const rowIndent = typeof indent === 'number' && indent > 0 ? indent : 0
        const selectItem = { key: rowKey, type: 'todo', groupKey: group.key, id: todo.id, folder: rowScope }
        const selected = isSelectedKey(rowKey)
        const renamingTodo = editingTodo !== null && editingTodo !== undefined && editingTodo.key === group.key && editingTodo.id === todo.id
        return h(
          'div',
          {
            key: rowKey,
            'data-todo-id': todo.id,
            'data-select-key': rowKey,
            'data-select-type': 'todo',
            'data-select-group': group.key,
            'data-select-id': todo.id,
            'data-select-folder': rowScope,
            className: 'dtn-todo' + (isDone ? ' dtn-done' : '') + (isPartial ? ' dtn-partial' : '') + (selected ? ' dtn-selected' : '') + (flashKey === rowKey ? ' dtn-drop' : '') + (dropKey === rowKey ? ' dtn-drop-target' : ''),
            style: rowIndent > 0 ? { marginLeft: rowIndent + 'px' } : undefined,
            title: todo.title,
            draggable: !renamingTodo,
            onDragStart: function (event) {
              if (dragArmedRef.current !== true) { event.preventDefault(); return }
              dragArmedRef.current = false
              onTodoDragStart(event, group, todo, folderId)
            },
            onDragOver: function (event) {
              if (event !== null && event.preventDefault !== undefined) event.preventDefault()
              if (dragPayloadKey.current !== group.key) return
              if (dropKey !== rowKey) setDropKey(rowKey)
            },
            onDragLeave: function (event) {
              if (dropKey !== rowKey) return
              const related = event !== null && event !== undefined ? event.relatedTarget : null
              if (related !== null && related !== undefined && event.currentTarget !== null && event.currentTarget.contains(related)) return
              setDropKey('')
            },
            onDragEnd: function () { dragArmedRef.current = false; dragPayloadKey.current = ''; setDropKey('') },
            onDrop: function (event) { setDropKey(''); onTodoDrop(event, group, todo, folderId) },
            onContextMenu: function (event) {
              event.preventDefault()
              event.stopPropagation()
              const multi = selectionRef.current.length > 1 && selectionRef.current.some(function (value) { return value.key === rowKey })
              if (multi) { openBatchMenu(event, selectionRef.current); return }
              clickSelect(selectItem, event)
              openTodoMenu(event, group, todo)
            },
            onClick: function (event) {
              if (marqueeMovedRef.current === true) { marqueeMovedRef.current = false; return }
              if (editingTodo !== null && editingTodo !== undefined && editingTodo.key === group.key && editingTodo.id === todo.id) return
              if (event.ctrlKey === true || event.metaKey === true || event.shiftKey === true) {
                clickSelect(selectItem, event)
                return
              }
              clickSelect(selectItem, event)
              const rect = event !== null && event.currentTarget !== null ? event.currentTarget.getBoundingClientRect() : null
              openPreview(group, todo, rect)
            },
            onMouseEnter: function (event) { hoverPreview(group, todo, event) },
            onMouseLeave: leavePreview,
          },
          h(
            'button',
            {
              type: 'button',
              className: 'dtn-check' + (isDone ? ' dtn-check-on' : '') + (isPartial ? ' dtn-check-partial' : ''),
              title: isDone ? '取消完成' : isPartial ? '中间态：点一下确认完成' : '标记完成',
              onClick: function (event) {
                event.stopPropagation()
                const action = isDone ? 'reopen' : 'complete'
                postApi({ action: action, key: group.key, id: todo.id })
                  .then(function () {
                    animatePendingRef.current = true
                    refresh()
                  })
                  .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
              },
            },
            isDone ? '✓' : isPartial ? '–' : '',
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dtn-prio',
              style: { color: prioColor(todo.priority) },
              title: '优先级 T0 最高，点开选择',
              onClick: function (event) { openPrioMenu(event, group, todo) },
            },
            'T' + (typeof todo.priority === 'number' ? todo.priority : 1),
          ),
          editingTodo !== null && editingTodo !== undefined && editingTodo.key === group.key && editingTodo.id === todo.id
            ? h('input', {
                className: 'dtn-rename dtn-rename-todo',
                value: editingTodo.draft,
                autoFocus: true,
                onClick: function (event) { event.stopPropagation() },
                onPointerDown: function (event) { event.stopPropagation() },
                onChange: function (event) {
                  const value = event.currentTarget.value
                  setEditingTodo(function (state) { return state === null ? null : { key: state.key, id: state.id, draft: value } })
                },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') { event.preventDefault(); commitRenameTodo(group, event) }
                  else if (event.key === 'Escape') { event.preventDefault(); cancelRenameTodo() }
                },
                onBlur: function (event) { commitRenameTodo(group, event) },
              })
            : h('span', {
                className: 'dtn-todo-title',
                style: { color: prioColor(todo.priority) },
                title: '双击文字重命名，右键更多',
              },
              h('span', {
                className: 'dtn-todo-text',
                onDoubleClick: function (event) { event.stopPropagation(); startRenameTodo(group, todo) },
              }, todo.title),
              ),
          isAiSource(todo.source)
            ? h('span', { className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13))
            : null,
          h('span', {
            className: 'dtn-grip',
            title: '按住拖动排序',
            onPointerDown: function (event) { event.stopPropagation(); dragArmedRef.current = true },
            onPointerUp: function () { dragArmedRef.current = false },
            onClick: function (event) { event.stopPropagation() },
          }, icon('grip')),
        )
      }

      function todosForFolder(group, folderId) {
        const ids = group.folderTodos !== null && typeof group.folderTodos === 'object' && Array.isArray(group.folderTodos[folderId]) ? group.folderTodos[folderId] : []
        const rows = ids
          .map(function (id) {
            for (let i = 0; i < group.todos.length; i += 1) {
              if (group.todos[i].id === id) return group.todos[i]
            }
            return null
          })
          .filter(function (item) { return item !== null })
        const rank = {}
        ids.forEach(function (id, index) { rank[id] = index })
        rows.sort(function (a, b) {
          const ad = statusRank(a.status)
          const bd = statusRank(b.status)
          if (ad !== bd) return ad - bd
          const ap = typeof a.priority === 'number' ? a.priority : 1
          const bp = typeof b.priority === 'number' ? b.priority : 1
          if (ap !== bp) return ap - bp
          const ra = rank[a.id] === undefined ? -1 : rank[a.id]
          const rb = rank[b.id] === undefined ? -1 : rank[b.id]
          if (ra >= 0 && rb >= 0 && ra !== rb) return ra - rb
          return String(a.created || '').localeCompare(String(b.created || ''))
        })
        return rows
      }

      function renderFolder(group, folder, depth) {
        if (folder === null || typeof folder !== 'object' || typeof folder.id !== 'string') return null
        const folderKey = group.key + '/' + folder.id
        const todos = todosForFolder(group, folder.id)
        const folderOpen = openFolders[folderKey] === true || (openFolders[folderKey] === undefined && depth === 0)
        const children = Array.isArray(folder.children) ? folder.children : []
        const renaming = editingFolder !== null && editingFolder !== undefined && editingFolder.key === group.key && editingFolder.folderId === folder.id
        const selectItem = { key: folderKey, type: 'folder', groupKey: group.key, id: folder.id }
        const selected = isSelectedKey(folderKey)
        return h(
          'div',
          { key: folderKey, className: 'dtn-folder', style: depth > 0 ? { marginLeft: '10px' } : undefined },
          h(
            'div',
            {
              'data-select-key': folderKey,
              'data-select-type': 'folder',
              'data-select-group': group.key,
              'data-select-id': folder.id,
              className: 'dtn-folder-head' + (selected ? ' dtn-selected' : '') + (dropKey === folderKey ? ' dtn-drop-target' : ''),
              onClick: function (event) {
                if (marqueeMovedRef.current === true) { marqueeMovedRef.current = false; return }
                if (renaming) return
                clickSelect(selectItem, event)
              },
              onContextMenu: function (event) {
                event.preventDefault()
                event.stopPropagation()
                const multi = selectionRef.current.length > 1 && selectionRef.current.some(function (value) { return value.key === folderKey })
                if (multi) { openBatchMenu(event, selectionRef.current); return }
                clickSelect(selectItem, event)
                openFolderMenu(event, group, folder)
              },
              draggable: true,
              onDragStart: function (event) {
                if (dragArmedRef.current !== true) { event.preventDefault(); return }
                dragArmedRef.current = false
                onFolderDragStart(event, group, folder)
              },
              onDragOver: function (event) {
                if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                if (dragPayloadKey.current !== group.key) return
                if (dropKey !== folderKey) setDropKey(folderKey)
              },
              onDragLeave: function (event) {
                if (dropKey !== folderKey) return
                const related = event !== null && event !== undefined ? event.relatedTarget : null
                if (related !== null && related !== undefined && event.currentTarget !== null && event.currentTarget.contains(related)) return
                setDropKey('')
              },
              onDragEnd: function () { dragArmedRef.current = false; dragPayloadKey.current = ''; setDropKey('') },
              onDrop: function (event) {
                setDropKey('')
                const payload = dragData(event)
                if (payload !== null && payload.kind === 'todo') {
                  onFolderTodoDrop(event, group, folder)
                  return
                }
                const rect = event.currentTarget.getBoundingClientRect()
                // 指针在文件夹行下半部分视为「紧跟其后、成为子文件夹」；否则按同级插到它后面。
                const intoChild = event.clientY > rect.top + rect.height * 0.6
                onFolderDrop(event, group, folder, intoChild)
              },
            },
            h('span', {
              className: 'dtn-folder-toggle',
              title: folderOpen ? '收起文件夹' : '展开文件夹',
              onClick: function (event) { event.stopPropagation(); toggleFolder(folderKey) },
            },
            folderOpen ? icon('chevronDown') : icon('chevronRight'),
            icon('folder')),
            renaming
              ? h('input', {
                  className: 'dtn-rename',
                  value: editingFolder.draft,
                  autoFocus: true,
                  onClick: function (event) { event.stopPropagation() },
                  onPointerDown: function (event) { event.stopPropagation() },
                  onChange: function (event) {
                    const value = event.currentTarget.value
                    setEditingFolder(function (state) { return state === null ? null : { key: state.key, folderId: state.folderId, draft: value } })
                  },
                  onKeyDown: function (event) {
                    if (event.key === 'Enter') { event.preventDefault(); commitRenameFolder(group, event) }
                    else if (event.key === 'Escape') { event.preventDefault(); cancelRenameFolder() }
                  },
                  onBlur: function (event) { commitRenameFolder(group, event) },
                })
              : h(
                  'span',
                  {
                    className: 'dtn-folder-name',
                    title: '双击文字重命名，右键更多',
                  },
                  h('span', {
                    className: 'dtn-folder-text',
                    onDoubleClick: function (event) { event.stopPropagation(); startRenameFolder(group, folder) },
                  }, folder.name || folderLabel(folder.id)),
                ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-copy',
                title: '在此文件夹新建子文件夹',
                onClick: function (event) { event.stopPropagation(); createSubFolder(group, folder, event) },
              },
              icon('folderAdd'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-copy',
                title: '在此文件夹新建 TODO',
                onClick: function (event) { event.stopPropagation(); createTodo(group, event, folder.id) },
              },
              icon('add'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-copy',
                title: '在此文件夹批量新建 TODO',
                onClick: function (event) { event.stopPropagation(); openBatchCreate(group, event, folder.id) },
              },
              icon('addBatch'),
            ),
            h('span', { className: 'dtn-folder-count' }, String(todos.length)),
            h('span', {
              className: 'dtn-grip',
              title: '按住拖动文件夹',
              onPointerDown: function (event) { event.stopPropagation(); dragArmedRef.current = true },
              onPointerUp: function () { dragArmedRef.current = false },
              onClick: function (event) { event.stopPropagation() },
            }, icon('grip')),
          ),
          h(
            'div',
            { className: 'dtn-fold' + (folderOpen ? '' : ' dtn-fold-off') },
            children.map(function (child) { return renderFolder(group, child, depth + 1) }),
            todos.map(function (todo) { return renderTodoRow(group, todo, folder.id, 24) }),
          ),
        )
      }

      function todoFolderHasItems(folder) {
        return Array.isArray(folder.children) && folder.children.length > 0
      }

      function groupPrimary(group) {
        const folders = Array.isArray(group.folders) ? group.folders : []
        for (let i = 0; i < folders.length; i += 1) {
          if (folders[i] !== null && typeof folders[i] === 'object' && folders[i].id === PRIMARY) return folders[i]
        }
        return null
      }

      function renderPrimaryChildren(group) {
        const primary = groupPrimary(group)
        const children = primary !== null && Array.isArray(primary.children) ? primary.children : []
        return children.map(function (child) { return renderFolder(group, child, 0) })
      }

      function renderTopFolders(group) {
        const folders = Array.isArray(group.folders) ? group.folders : []
        return folders
          .filter(function (folder) { return folder !== null && typeof folder === 'object' && folder.id !== PRIMARY })
          .map(function (folder) { return renderFolder(group, folder, 0) })
      }

      function renderGroup(group, hideHead) {
        if (group === null || typeof group !== 'object' || typeof group.key !== 'string') return null
        const explicit = openGroups[group.key]
        const groupOpen = hideHead === true || (explicit === undefined ? group.current === true : explicit === true)
        const current = group.current === true
        return h(
          'div',
          Object.assign(
            { key: group.key, className: 'dtn-group' + (hideHead === true && dropKey === 'group:' + group.key ? ' dtn-drop-target' : ''), 'data-dtn-group': group.key },
            hideHead === true
              ? {
                  onDragOver: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    if (dragPayloadKey.current !== group.key) return
                    if (dropKey !== 'group:' + group.key) setDropKey('group:' + group.key)
                  },
                  onDragLeave: function (event) {
                    if (dropKey !== 'group:' + group.key) return
                    const related = event !== null && event !== undefined ? event.relatedTarget : null
                    if (related !== null && related !== undefined && event.currentTarget !== null && event.currentTarget.contains(related)) return
                    setDropKey('')
                  },
                  onDrop: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    setDropKey('')
                    const payload = dragData(event)
                    dragPayloadKey.current = ''
                    if (payload === null || payload.key !== group.key) return
                    if (payload.kind === 'todo') {
                      postApi({ action: 'moveTodo', key: group.key, id: payload.id, folder: PRIMARY })
                        .then(function () { showBubble('已归入无文件夹', event); refresh() })
                        .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                    } else if (payload.kind === 'folder') {
                      moveFolderToPrimary(group, payload.id, event)
                    }
                  },
                }
              : {},
          ),
          hideHead === true
            ? null
            : h(
                'div',
                {
                  className: 'dtn-group-head' + (current ? ' dtn-current' : '') + (dropKey === 'group:' + group.key ? ' dtn-drop-target' : ''),
                  onClick: function () { toggleGroup(group.key) },
                  onContextMenu: function (event) { openTreeMenu(event, { kind: 'group', group: group }) },
                  title: group.subtitle || group.title,
                  onDragOver: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    if (dragPayloadKey.current !== group.key) return
                    if (dropKey !== 'group:' + group.key) setDropKey('group:' + group.key)
                  },
                  onDragLeave: function (event) {
                    if (dropKey !== 'group:' + group.key) return
                    const related = event !== null && event !== undefined ? event.relatedTarget : null
                    if (related !== null && related !== undefined && event.currentTarget !== null && event.currentTarget.contains(related)) return
                    setDropKey('')
                  },
                  onDrop: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    setDropKey('')
                    const payload = dragData(event)
                    dragPayloadKey.current = ''
                    if (payload === null || payload.key !== group.key) return
                    if (payload.kind === 'todo') {
                      postApi({ action: 'moveTodo', key: group.key, id: payload.id, folder: PRIMARY })
                        .then(function () { showBubble('已归入无文件夹', event); refresh() })
                        .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                    } else if (payload.kind === 'folder') {
                      moveFolderToPrimary(group, payload.id, event)
                    }
                  },
                },
                h('span', { className: 'dtn-group-caret' }, groupOpen ? icon('chevronDown') : icon('chevronRight')),
                h('span', {
                  className: 'dtn-group-name',
                  style: group.current === true && (group.kind === 'workspace' || group.kind === 'session') ? { fontStyle: 'italic' } : undefined,
                  title: (group.subtitle || group.title || '') +
                    (group.current === true && group.kind === 'workspace' ? '（当前工作区）' : group.current === true && group.kind === 'session' ? '（当前会话）' : ''),
                }, group.title || '未命名组'),
                group.kind === 'workspace' || group.kind === 'session'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dtn-copy',
                        title: group.kind === 'workspace' ? '复制工作区路径' : '复制 Session ID',
                        onClick: function (event) {
                          event.stopPropagation()
                          copyGroup(group, event, group.kind === 'workspace' ? '已复制工作区路径' : '已复制SessionID')
                        },
                      },
                      icon('copy'),
                    )
                  : null,
                group.kind === 'workspace' || group.kind === 'session'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dtn-copy',
                        title: '新建文件夹',
                        onClick: function (event) {
                          event.stopPropagation()
                          createFolder(group, event)
                        },
                      },
                      icon('folderAdd'),
                    )
                  : null,
                group.kind === 'workspace' || group.kind === 'session'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dtn-copy',
                        title: '新建 TODO',
                        onClick: function (event) {
                          event.stopPropagation()
                          createTodo(group, event)
                        },
                      },
                      icon('add'),
                    )
                  : null,
                group.kind === 'workspace' || group.kind === 'session'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dtn-copy',
                        title: '批量新建 TODO',
                        onClick: function (event) {
                          event.stopPropagation()
                          openBatchCreate(group, event)
                        },
                      },
                      icon('addBatch'),
                    )
                  : null,
                h('span', { className: 'dtn-group-count' }, String(group.count === undefined ? 0 : group.count)),
              ),
          h(
            'div',
            { className: 'dtn-group-body dtn-fold' + (groupOpen ? '' : ' dtn-fold-off') },
            // 主归属是默认容器，不单独显示成文件夹；它的条目直接列在组里。
            todosForFolder(group, PRIMARY).map(function (todo) { return renderTodoRow(group, todo, PRIMARY) }),
            renderPrimaryChildren(group),
            renderTopFolders(group),
            renderLooseTodos(group),
          ),
        )
      }
