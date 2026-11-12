      const menuFolder = folderMenu === null ? null : findFolder((findLiveGroup(folderMenu.group.key) || folderMenu.group).folders, folderMenu.folderId)
      const folderMenuNode = folderMenu === null || menuFolder === null
        ? null
        : h(
            'div',
            {
              key: 'folder-menu',
              className: 'dtn-menu',
              style: { left: folderMenu.x + 'px', top: folderMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  applyTreeOpen(false, [{ group: (findLiveGroup(folderMenu.group.key) || folderMenu.group), withHead: false, root: menuFolder }])
                  setFolderMenu(null)
                },
              },
              icon('chevronUp'),
              '全部收起',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  applyTreeOpen(true, [{ group: (findLiveGroup(folderMenu.group.key) || folderMenu.group), withHead: false, root: menuFolder }])
                  setFolderMenu(null)
                },
              },
              icon('chevronDown'),
              '全部展开',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); startRenameFolder(folderMenu.group, menuFolder) },
              },
              icon('edit'),
              '重命名',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  const liveGroup = findLiveGroup(folderMenu.group.key) || folderMenu.group
                  const scope = liveGroup.kind === 'user'
                    ? '用户级'
                    : liveGroup.kind === 'workspace'
                      ? '工作区级 ' + (liveGroup.title || '')
                      : '会话级 ' + (liveGroup.subtitle || liveGroup.title || '')
                  const chain = scope + ' / ' + folderDisplayName(liveGroup.key, folderMenu.folderId)
                  copyText(chain).then(function () {
                    showBubble('已复制层级链文本', event)
                    setFolderMenu(null)
                  })
                },
              },
              icon('copy'),
              '复制层级链文本',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub',
                'data-sub': 'folder-move',
                onPointerEnter: function () { setSubOpen('folder-move') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'folder-move' ? '' : 'folder-move') },
              },
              icon('folder'),
              '移动到',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'folder-move' ? ' dtn-submenu-open' : '') },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-menu-item',
                    onClick: function (event) { event.stopPropagation(); moveFolderTo(folderMenu.group, menuFolder.id, PRIMARY, event) },
                  },
                  icon('folder'),
                  folderLabel(PRIMARY),
                ),
                folderOptions(folderMenu.group).map(function (opt) {
                  const disabled = opt.id === menuFolder.id || folderContains(menuFolder, opt.id)
                  return h(
                    'button',
                    {
                      key: opt.id,
                      type: 'button',
                      className: 'dtn-menu-item' + (disabled ? ' dtn-menu-item-off' : ''),
                      disabled: disabled,
                      style: { paddingLeft: (10 + (opt.depth + 1) * 14) + 'px' },
                      onClick: function (event) {
                        event.stopPropagation()
                        if (disabled) return
                        moveFolderTo(folderMenu.group, menuFolder.id, opt.id, event)
                      },
                    },
                    icon('folder'),
                    opt.label,
                  )
                }),
              ),
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item dtn-warn',
                onClick: function (event) { event.stopPropagation(); deleteFolder(folderMenu.group, menuFolder.id, event) },
              },
              icon('folder'),
              '解除文件夹',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item dtn-danger',
                onClick: function (event) { event.stopPropagation(); deleteFolderTree(folderMenu.group, menuFolder.id, event) },
              },
              icon('trash'),
              '删除整个文件夹',
            ),
          )

      const treeMenuNode = treeMenu === null
        ? null
        : h(
            'div',
            {
              key: 'tree-menu',
              className: 'dtn-menu',
              style: { left: treeMenu.x + 'px', top: treeMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); toggleTree(treeMenu.target, false) },
              },
              icon('chevronUp'),
              '全部收起',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); toggleTree(treeMenu.target, true) },
              },
              icon('chevronDown'),
              '全部展开',
            ),
          )

      const todoMenuGroup = todoMenu === null ? null : (findLiveGroup(todoMenu.group.key) || todoMenu.group)
      const menuTodo = todoMenuGroup === null ? null : (Array.isArray(todoMenuGroup.todos) ? todoMenuGroup.todos : []).find(function (todo) { return todo.id === todoMenu.todoId })
      const todoMenuNode = todoMenu === null || menuTodo === null
        ? null
        : h(
            'div',
            {
              key: 'todo-menu',
              className: 'dtn-menu',
              style: { left: todoMenu.x + 'px', top: todoMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub',
                'data-sub': 'todo-prio',
                onPointerEnter: function () { setSubOpen('todo-prio') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'todo-prio' ? '' : 'todo-prio') },
              },
              icon('flag'),
              '设置优先级',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'todo-prio' ? ' dtn-submenu-open' : '') },
                prioChoiceNodes(function (value, event) { setTodoPriority(todoMenuGroup, menuTodo, value, event) }),
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); startRenameTodo(todoMenuGroup, menuTodo) },
              },
              icon('edit'),
              '重命名',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  const liveGroup = todoMenuGroup
                  const folderId = todoMenu.folderId !== undefined && todoMenu.folderId !== null ? todoMenu.folderId : menuTodo.primaryFolder
                  const scope = liveGroup.kind === 'user'
                    ? '用户级'
                    : liveGroup.kind === 'workspace'
                      ? '工作区级 ' + (liveGroup.title || '')
                      : '会话级 ' + (liveGroup.subtitle || liveGroup.title || '')
                  const chain = scope + ' / ' + folderDisplayName(liveGroup.key, folderId) + ' / ' + (menuTodo.title || '')
                  copyText(chain).then(function () {
                    showBubble('已复制层级链文本', event)
                    setTodoMenu(null)
                  })
                },
              },
              icon('copy'),
              '复制层级链文本',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub',
                'data-sub': 'todo-move',
                onPointerEnter: function () { setSubOpen('todo-move') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'todo-move' ? '' : 'todo-move') },
              },
              icon('folder'),
              '移动到',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'todo-move' ? ' dtn-submenu-open' : '') },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-menu-item',
                    style: { paddingLeft: '10px' },
                    onClick: function (event) { event.stopPropagation(); moveTodoToFolder(todoMenuGroup, menuTodo.id, PRIMARY, event) },
                  },
                  icon('folder'),
                  folderLabel(PRIMARY),
                ),
                folderOptions(todoMenuGroup).map(function (opt) {
                  return h(
                    'button',
                    {
                      key: opt.id,
                      type: 'button',
                      className: 'dtn-menu-item',
                      style: { paddingLeft: (10 + opt.depth * 14) + 'px' },
                      onClick: function (event) { event.stopPropagation(); moveTodoToFolder(todoMenuGroup, menuTodo.id, opt.id, event) },
                    },
                    icon('folder'),
                    opt.label,
                  )
                }),
              ),
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub',
                'data-sub': 'todo-collect',
                onPointerEnter: function () { setSubOpen('todo-collect') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'todo-collect' ? '' : 'todo-collect') },
              },
              icon('folder'),
              '管理收录',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'todo-collect' ? ' dtn-submenu-open' : '') },
                collectionOptions(todoMenuGroup).map(function (opt) {
                  const joined = todoJoined(todoMenuGroup, menuTodo, opt.id)
                  return h(
                    'div',
                    {
                      key: opt.id,
                      className: 'dtn-menu-item dtn-menu-check-row',
                      style: { paddingLeft: (10 + opt.depth * 14) + 'px' },
                      onClick: function (event) {
                        event.stopPropagation()
                        if (event.target !== null && event.target !== undefined && event.target.tagName === 'INPUT') return
                        toggleTodoReference(todoMenuGroup, menuTodo, opt.id, event)
                      },
                    },
                    h('input', {
                      type: 'checkbox',
                      className: 'dtn-menu-check',
                      checked: joined,
                      onPointerDown: function (event) { event.stopPropagation() },
                      onClick: function (event) { event.stopPropagation() },
                      onChange: function (event) {
                        event.stopPropagation()
                        const target = event.currentTarget
                        const rect = target !== null && target !== undefined && target.getBoundingClientRect !== undefined ? target.getBoundingClientRect() : null
                        const point = rect === null ? event : { clientX: rect.right, clientY: rect.top }
                        toggleTodoReference(todoMenuGroup, menuTodo, opt.id, point)
                      },
                    }),
                    h('span', { className: 'dtn-menu-label' }, opt.label),
                  )
                }),
              ),
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item dtn-danger',
                onClick: function (event) { event.stopPropagation(); deleteTodo(todoMenuGroup, menuTodo.id, event) },
              },
              icon('trash'),
              '删除',
            ),
          )

      const batchPanelPos = batchCreate !== null ? (batchPos || batchCreate.pos) : (batchPos || placePreview(null, 320))
      const batchNode = h(
        'div',
        {
          key: 'batch',
          className: 'dtn-preview dtn-batch' + (batchCreate === null ? ' dtn-preview-off' : ''),
          style: { left: batchPanelPos.x + 'px', top: batchPanelPos.y + 'px' },
          onPointerDown: function (event) { event.stopPropagation() },
        },
        batchCreate === null
          ? null
          : [
              h(
                'div',
                { key: 'head', className: 'dtn-preview-head', onPointerDown: function (event) { startWindowMove(event, 'batchCreate') } },
                h('span', { className: 'dtn-preview-title' }, '批量新建 TODO'),
                h(
                  'div',
                  { className: 'dtn-actions' },
                  h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { closeBatchCreate() } }, icon('close')),
                ),
              ),
              h(
                'div',
                { key: 'body', className: 'dtn-preview-body' },
                h('div', { className: 'dtn-batch-hint' }, '每行一条，确认后按行创建'),
                h(
                  'div',
                  { className: 'dtn-batch-field' },
                  h(
                    'div',
                    { className: 'dtn-batch-gutter', ref: batchGutterRef },
                    String(batchCreate.value || '').split(/\r?\n/).map(function (line, index) {
                      return h('div', { key: index, className: 'dtn-batch-line' }, String(index + 1))
                    }),
                  ),
                  h('textarea', {
                    className: 'dtn-batch-input',
                    value: batchCreate.value,
                    autoFocus: true,
                    wrap: 'off',
                    placeholder: '第一件事\n第二件事',
                    onScroll: function (event) {
                      if (batchGutterRef.current !== null) batchGutterRef.current.scrollTop = event.currentTarget.scrollTop
                    },
                    onChange: function (event) {
                      const value = event.currentTarget.value
                      setBatchCreate(function (state) { return state === null ? null : { key: state.key, group: state.group, folderId: state.folderId, value: value, pos: state.pos } })
                    },
                  }),
                ),
                h(
                  'div',
                  { className: 'dtn-batch-actions' },
                  h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { closeBatchCreate() } }, '取消'),
                  h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-primary', onClick: function () { confirmBatchCreate() } }, '确认'),
                ),
              ),
            ],
      )
