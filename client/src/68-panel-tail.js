      const prioRow = function (values) {
        return h(
          'div',
          { className: 'dtn-prio-row' },
          values.map(function (value) {
            const on = prioMenu !== null && prioMenu !== undefined && prioMenu.priority === value
            return h(
              'button',
              {
                key: value,
                type: 'button',
                className: 'dtn-prio-item' + (on ? ' dtn-prio-on' : ''),
                style: { color: prioColor(value) },
                title: '优先级 T' + value,
                onClick: function (event) { choosePriority(value, event) },
              },
              'T' + value,
            )
          }),
        )
      }
      const prioMenuNode = prioMenu === null
        ? null
        : h(
            'div',
            {
              key: 'prio-menu',
              className: 'dtn-prio-menu',
              style: { left: prioMenu.x + 'px', top: prioMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            prioRow([0, 1, 2, 3, 4]),
            prioRow([5, 6, 7, 8, 9]),
          )

      const batchTodoTotal = batchTodos().length
      const batchFolderTotal = batchFolders().length
      const batchMenuNode = batchMenu === null
        ? null
        : h(
            'div',
            {
              key: 'batch-menu',
              className: 'dtn-menu',
              style: { left: batchMenu.x + 'px', top: batchMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub' + (batchTodoTotal === 0 ? ' dtn-menu-hide' : ''),
                'data-sub': 'batch-prio',
                onPointerEnter: function () { setSubOpen('batch-prio') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'batch-prio' ? '' : 'batch-prio') },
              },
              icon('flag'),
              '批量设置优先级',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'batch-prio' ? ' dtn-submenu-open' : '') },
                prioChoiceNodes(function (value, event) { applyBatchPriority(value, event) }),
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); openBatchRename() },
              },
              icon('edit'),
              '批量重命名',
            ),
            h('div', { className: 'dtn-menu-sep' + (batchTodoTotal === 0 ? ' dtn-menu-hide' : '') }),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub' + (batchTodoTotal === 0 ? ' dtn-menu-hide' : ''),
                'data-sub': 'batch-move',
                onPointerEnter: function () { setSubOpen('batch-move') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'batch-move' ? '' : 'batch-move') },
              },
              icon('folder'),
              '批量移动到',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'batch-move' ? ' dtn-submenu-open' : '') },
                batchFolderOptions().map(function (opt) {
                  return h(
                    'button',
                    {
                      key: opt.id,
                      type: 'button',
                      className: 'dtn-menu-item',
                      style: { paddingLeft: (10 + opt.depth * 14) + 'px' },
                      onClick: function (event) { event.stopPropagation(); applyBatchMove(opt.id) },
                    },
                    icon('folder'),
                    opt.label,
                  )
                }),
              ),
            ),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub' + (batchTodoTotal === 0 ? ' dtn-menu-hide' : ''),
                'data-sub': 'batch-collect',
                onPointerEnter: function () { setSubOpen('batch-collect') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'batch-collect' ? '' : 'batch-collect') },
              },
              icon('folder'),
              '批量管理收录',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'batch-collect' ? ' dtn-submenu-open' : '') },
                (function () {
                  const total = batchTodos().length
                  return batchCollectFolders().map(function (opt) {
                    const count = batchFolderCount(opt.id)
                    return h(
                      'div',
                      {
                        key: opt.id,
                        className: 'dtn-menu-item dtn-menu-check-row',
                        style: { paddingLeft: (10 + opt.depth * 14) + 'px' },
                        onClick: function (event) {
                          event.stopPropagation()
                          if (event.target !== null && event.target !== undefined && event.target.tagName === 'INPUT') return
                          applyBatchCollectToggle(opt.id)
                        },
                      },
                      h('input', {
                        type: 'checkbox',
                        className: 'dtn-menu-check',
                        checked: total > 0 && count === total,
                        ref: function (node) {
                          if (node !== null && node !== undefined) node.indeterminate = count > 0 && count < total
                        },
                        onPointerDown: function (event) { event.stopPropagation() },
                        onClick: function (event) { event.stopPropagation() },
                        onChange: function (event) { event.stopPropagation(); applyBatchCollectToggle(opt.id) },
                      }),
                      h('span', { className: 'dtn-menu-label' }, opt.label),
                    )
                  })
                })(),
              ),
            ),
            h('div', { className: 'dtn-menu-sep' + (batchFolderTotal === 0 ? ' dtn-menu-hide' : '') }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item' + (batchFolderTotal === 0 ? ' dtn-menu-hide' : ''),
                onClick: function (event) { event.stopPropagation(); applyBatchExpand(false) },
              },
              icon('chevronUp'),
              '批量全部收起',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item' + (batchFolderTotal === 0 ? ' dtn-menu-hide' : ''),
                onClick: function (event) { event.stopPropagation(); applyBatchExpand(true) },
              },
              icon('chevronDown'),
              '批量全部展开',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item dtn-danger',
                onClick: function (event) { event.stopPropagation(); applyBatchDelete(event) },
              },
              icon('trash'),
              '批量删除',
            ),
          )

      const batchRenameNode = batchRename === null
        ? null
        : h(
            'div',
            {
              key: 'batch-rename',
              className: 'dtn-preview dtn-batch',
              style: { left: batchRename.pos.x + 'px', top: batchRename.pos.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'div',
              { className: 'dtn-preview-head' },
              h('span', { className: 'dtn-preview-title' }, '批量重命名'),
              h(
                'div',
                { className: 'dtn-actions' },
                h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { setBatchRename(null) } }, icon('close')),
              ),
            ),
            h(
              'div',
              { className: 'dtn-preview-body' },
              h('div', { className: 'dtn-batch-hint' }, '行数固定为选中条目数，不能增加或删除换行；清空的行会被跳过'),
              h(
                'div',
                { className: 'dtn-batch-field' },
                h(
                  'div',
                  { className: 'dtn-batch-gutter', ref: renameGutterRef },
                  batchRename.items.map(function (item, index) {
                    return h('div', { key: 'line-' + index, className: 'dtn-batch-line' }, String(index + 1))
                  }),
                ),
                h('textarea', {
                  className: 'dtn-batch-input',
                  value: batchRename.value,
                  autoFocus: true,
                  wrap: 'off',
                  rows: Math.min(12, Math.max(3, batchRename.items.length)),
                  onKeyDown: function (event) {
                    if (event.key === 'Enter') event.preventDefault()
                  },
                  onScroll: function (event) {
                    if (renameGutterRef.current !== null) renameGutterRef.current.scrollTop = event.currentTarget.scrollTop
                  },
                  onChange: function (event) {
                    const value = event.currentTarget.value
                    // 行数固定：换行既不能新增也不能删掉，否则该次输入整体丢弃。
                    if (String(value).split('\n').length !== batchRename.items.length) return
                    setBatchRename(function (state) { return state === null ? null : { items: state.items, value: value, pos: state.pos } })
                  },
                }),
              ),
              h(
                'div',
                { className: 'dtn-batch-actions' },
                h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { setBatchRename(null) } }, '取消'),
                h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-primary', onClick: confirmBatchRename }, '确认'),
              ),
            ),
          )

      const marqueeNode = marquee === null
        ? null
        : h('div', {
            key: 'marquee',
            className: 'dtn-marquee',
            style: { left: marquee.x + 'px', top: marquee.y + 'px', width: marquee.w + 'px', height: marquee.h + 'px' },
          })

      const confirmNode = confirmDialog === null
        ? null
        : h(
            'div',
            {
              key: 'confirm',
              className: 'dtn-menu dtn-confirm',
              style: {
                left: Math.max(8, Math.min(confirmDialog.x, window.innerWidth - 268)) + 'px',
                top: Math.max(8, Math.min(confirmDialog.y, window.innerHeight - 136)) + 'px',
              },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h('div', { className: 'dtn-confirm-text' }, confirmDialog.message),
            h(
              'div',
              { className: 'dtn-confirm-actions' },
              h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { settleConfirm(false) } }, '取消'),
              h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-danger', onClick: function () { settleConfirm(true) } }, '确认删除'),
            ),
          )

      return h(React.Fragment, null, panel, previewPanel, bubbleNodes, folderMenuNode, treeMenuNode, todoMenuNode, batchMenuNode, batchRenameNode, marqueeNode, batchNode, prioMenuNode, confirmNode)
    }
