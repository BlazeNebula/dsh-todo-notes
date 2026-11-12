      function batchCollectFolders() {
        const groups = []
        batchTodos().forEach(function (item) {
          if (groups.some(function (group) { return group.key === item.groupKey })) return
          const group = findLiveGroup(item.groupKey)
          if (group !== null && group !== undefined) groups.push(group)
        })
        const seen = { [PRIMARY]: true }
        const out = [{ id: PRIMARY, label: folderLabel(PRIMARY), depth: 0 }]
        groups.forEach(function (group) {
          folderOptions(group).forEach(function (option) {
            if (seen[option.id] === true) return
            seen[option.id] = true
            out.push(option)
          })
        })
        return out
      }

      function liveTodoOf(item) {
        const group = findLiveGroup(item.groupKey)
        if (group === null || group === undefined) return null
        const todos = Array.isArray(group.todos) ? group.todos : []
        for (let i = 0; i < todos.length; i += 1) if (todos[i].id === item.id) return { group: group, todo: todos[i] }
        return null
      }

      function batchFolderCount(folderId) {
        let count = 0
        batchTodos().forEach(function (item) {
          const live = liveTodoOf(item)
          if (live === null) return
          if (todoJoined(live.group, live.todo, folderId)) count += 1
        })
        return count
      }

      function applyBatchCollectToggle(folderId) {
        const todos = batchTodos()
        if (todos.length === 0) return
        const total = todos.length
        const checked = batchFolderCount(folderId) === total
        const tasks = []
        todos.forEach(function (item) {
          const live = liveTodoOf(item)
          if (live === null) return
          const joined = todoJoined(live.group, live.todo, folderId)
          if (checked && !joined) return
          if (!checked && joined) return
          const action = checked ? 'removeReference' : 'reference'
          tasks.push(function () { return postApi({ action: action, key: item.groupKey, id: item.id, folder: folderId }) })
        })
        if (tasks.length === 0) return
        runSequential(tasks)
          .then(function () {
            animatePendingRef.current = true
            refresh()
            showBubble((checked ? '已取消收录 ' : '已收录 ') + tasks.length + ' 条', { clientX: panelPos.x + 40, clientY: panelPos.y + 56 })
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), null) })
      }

      function runSequential(tasks) {
        return tasks.reduce(function (chain, task) { return chain.then(task) }, Promise.resolve())
      }

      function applyBatchExpand(open) {
        const entries = []
        batchFolders().forEach(function (item) {
          const group = findLiveGroup(item.groupKey)
          if (group === null || group === undefined) return
          const folder = findFolder(Array.isArray(group.folders) ? group.folders : [], item.id)
          if (folder !== null) entries.push({ group: group, withHead: false, root: folder })
        })
        closeBatchMenu()
        if (entries.length === 0) return
        applyTreeOpen(open, entries)
      }

      function applyBatchMove(folderId) {
        const tasks = batchTodos().map(function (item) {
          return function () { return postApi({ action: 'moveTodo', key: item.groupKey, id: item.id, folder: folderId }) }
        })
        closeBatchMenu()
        if (tasks.length === 0) return
        runSequential(tasks)
          .then(function () {
            setSelectionNow([])
            animatePendingRef.current = true
            refresh()
            showBubble('已移动 ' + tasks.length + ' 条', null)
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), null) })
      }

      function applyBatchReference(folderId) {
        const tasks = batchTodos().map(function (item) {
          return function () { return postApi({ action: 'reference', key: item.groupKey, id: item.id, folder: folderId }) }
        })
        closeBatchMenu()
        if (tasks.length === 0) return
        runSequential(tasks)
          .then(function () {
            animatePendingRef.current = true
            refresh()
            showBubble('已收录 ' + tasks.length + ' 条', null)
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), null) })
      }

      function applyBatchDelete(event) {
        const todos = batchTodos()
        const folders = batchFolders()
        if (todos.length + folders.length === 0) return
        closeBatchMenu()
        confirmDelete(event, '确定删除选中的 ' + (todos.length + folders.length) + ' 项？删除后不可恢复。').then(function (ok) {
          if (ok !== true) return
          const tasks = todos
            .map(function (item) {
              return function () { return postApi({ action: 'deleteTodo', key: item.groupKey, id: item.id }) }
            })
            .concat(folders.map(function (item) {
              return function () { return postApi({ action: 'deleteFolderTree', key: item.groupKey, folder: item.id }) }
            }))
          Promise.all(tasks.map(function (task) { return task() }))
            .then(function () {
              setSelectionNow([])
              animatePendingRef.current = true
              refresh()
              showBubble('已删除 ' + tasks.length + ' 项', null)
            })
            .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), null) })
        })
      }

      function openBatchRename() {
        const items = batchItems().slice()
        if (items.length === 0) return
        const lines = items.map(itemLabel)
        setBatchMenu(null)
        setSubOpen('')
        setBatchRename({ items: items, value: lines.join('\n'), pos: placePreview(null, 360) })
      }

      function confirmBatchRename() {
        const state = batchRename
        if (state === null || state === undefined) return
        const names = String(state.value || '').split('\n')
        setBatchRename(null)
        const tasks = []
        const folderRenames = {}
        const todoRenames = []
        let truncatedLimit = 0
        state.items.forEach(function (item, index) {
          const name = String(names[index] === undefined ? '' : names[index]).trim()
          if (name === '') return
          if (item.type === 'todo') {
            const clamped = clampTitleDraft(name)
            if (clamped.truncated) truncatedLimit = clamped.limit
            todoRenames.push({ groupKey: item.groupKey, id: item.id, title: clamped.text })
            tasks.push(function () { return postApi({ action: 'renameTodo', key: item.groupKey, id: item.id, title: clamped.text }) })
          } else {
            if (folderRenames[item.groupKey] === undefined) folderRenames[item.groupKey] = {}
            folderRenames[item.groupKey][item.id] = name
          }
        })
        Object.keys(folderRenames).forEach(function (groupKey) {
          const group = findLiveGroup(groupKey)
          if (group === null || group === undefined) return
          const tree = ensurePrimary(cloneFolders(group))
          Object.keys(folderRenames[groupKey]).forEach(function (folderId) {
            const folder = findFolder(tree, folderId)
            if (folder !== null) folder.name = folderRenames[groupKey][folderId]
          })
          tasks.push(function () { return saveFolders(group, tree, null) })
        })
        if (tasks.length === 0) return
        runSequential(tasks)
          .then(function () {
            setSelectionNow([])
            todoRenames.forEach(function (item) { syncTodoTitle(item.groupKey, item.id, item.title) })
            animatePendingRef.current = true
            refresh()
            if (truncatedLimit > 0) {
              showBubble('标题最多 ' + truncatedLimit + ' 个字，超出部分已截断', { clientX: panelPos.x + 40, clientY: panelPos.y + 56 })
            }
            showBubble('已重命名 ' + tasks.length + ' 项', null)
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), null) })
      }

      function startRenameTodo(group, todo) {
        setTodoMenu(null)
        setEditingTodo({ key: group.key, id: todo.id, draft: todo.title })
      }

      function commitRenameTodo(group, event) {
        const state = editingTodo
        if (state === null || state === undefined || state.key !== group.key) return
        setEditingTodo(null)
        const raw = String(state.draft === undefined || state.draft === null ? '' : state.draft).replace(/\r?\n/g, ' ').trim()
        const clamped = clampTitleDraft(raw)
        const title = clamped.text
        if (title === '') return
        postApi({ action: 'renameTodo', key: group.key, id: state.id, title: title })
          .then(function () {
            syncTodoTitle(group.key, state.id, title)
            if (clamped.truncated) {
              showBubble('标题最多 ' + clamped.limit + ' 个字，已截断并保存', event !== null && event !== undefined && typeof event.clientX === 'number' ? event : { clientX: panelPos.x + 40, clientY: panelPos.y + 56 })
            }
            refresh()
          })
          .catch(function (err) { failWith(event, err) })
      }

      function cancelRenameTodo() {
        setEditingTodo(null)
      }

      async function deleteTodo(group, todoId, event) {
        setTodoMenu(null)
        const ok = await confirmDelete(event, '删除后不可恢复，确认删除这条 TODO？')
        if (ok !== true) return
        postApi({ action: 'deleteTodo', key: group.key, id: todoId })
          .then(function () {
            animatePendingRef.current = true
            refresh()
          })
          .catch(function (err) { failWith(event, err) })
      }

      function openTodoMenu(event, group, todo, folderId) {
        event.preventDefault()
        event.stopPropagation()
        setSubOpen('')
        setTodoMenu({ x: event.clientX, y: event.clientY, groupKey: group.key, group: group, todoId: todo.id, folderId: folderId })
      }

      // 组内可选文件夹（用于右键「移动到」子菜单）。主归属的子文件夹按顶层列出。
      function folderOptions(group) {
        const out = []
        const walk = function (nodes, depth) {
          ;(Array.isArray(nodes) ? nodes : []).forEach(function (node) {
            if (node === null || typeof node !== 'object') return
            if (node.id === PRIMARY) {
              walk(node.children, depth)
              return
            }
            out.push({ id: node.id, label: node.name || folderLabel(node.id), depth: depth })
            walk(node.children, depth + 1)
          })
        }
        walk(group.folders, 0)
        return out
      }

      function moveTodoToFolder(group, todoId, folderId, event) {
        setTodoMenu(null)
        postApi({ action: 'moveTodo', key: group.key, id: todoId, folder: folderId })
          .then(function () {
            showBubble('已移动到' + folderLabel(folderId), event)
            animatePendingRef.current = true
            refresh()
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      // 右键「管理收录」：勾选/取消某条 TODO 与各文件夹的收录关系。
      function toggleTodoReference(group, todo, folderId, event) {
        const lists = group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {}
        const list = Array.isArray(lists[folderId]) ? lists[folderId] : []
        const joined = list.indexOf(todo.id) >= 0
        if (joined && folderId === PRIMARY) {
          // 「无文件夹」是主归属的兜底位：它本身不能单独删除，只能把主归属挪到另一个已收录的文件夹。
          const others = Object.keys(lists).filter(function (key) {
            return key !== PRIMARY && Array.isArray(lists[key]) && lists[key].indexOf(todo.id) >= 0
          })
          if (others.length === 0) {
            showBubble('至少保留一个收录位置', event)
            return
          }
          const target = others[0]
          postApi({ action: 'moveTodo', key: group.key, id: todo.id, folder: target })
            .then(function () {
              showBubble('已取消无文件夹收录，主归属改为' + folderLabel(target), event)
              animatePendingRef.current = true
              refresh()
            })
            .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
          return
        }
        postApi({ action: joined ? 'removeReference' : 'reference', key: group.key, id: todo.id, folder: folderId })
          .then(function () {
            showBubble(joined ? '已取消收录到' + folderLabel(folderId) : '已收录到' + folderLabel(folderId), event)
            animatePendingRef.current = true
            refresh()
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      function todoJoined(group, todo, folderId) {
        const lists = group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {}
        return Array.isArray(lists[folderId]) && lists[folderId].indexOf(todo.id) >= 0
      }

      // 「管理收录」的可选项与「移动到」同一份顺序：主归属（界面上就叫「无文件夹」）打头，再按文件夹层级。
      function collectionOptions(group) {
        const out = [{ id: PRIMARY, label: folderLabel(PRIMARY), depth: 0 }]
        const folders = folderOptions(group)
        for (let i = 0; i < folders.length; i += 1) out.push(folders[i])
        return out
      }

      // 优先级面板：上排 T0~T4、下排 T5~T9，点数字直接保存。
      function openPrioMenu(event, group, todo) {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        const width = 172
        const height = 78
        const x = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
        let y = rect.bottom + 6
        if (y + height > window.innerHeight - 8) y = rect.top - height - 6
        if (y < 8) y = 8
        setPrioMenu({
          key: group.key,
          id: todo.id,
          priority: typeof todo.priority === 'number' ? todo.priority : 1,
          x: x,
          y: y,
        })
      }

      // 统一的优先级变更：下拉面板、右键菜单、批量菜单共用这段请求与冒泡提示。
      function changeTodoPriority(key, id, value, event) {
        postApi({ action: 'priority', key: key, id: id, priority: value })
          .then(function () {
            animatePendingRef.current = true
            showBubble('已调整优先级为T' + value, event)
            refresh()
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      function choosePriority(value, event) {
        const state = prioMenu
        if (state === null || state === undefined) return
        setPrioMenu(null)
        if (value === state.priority) return
        changeTodoPriority(state.key, state.id, value, event)
      }

      function setTodoPriority(group, todo, value, event) {
        setTodoMenu(null)
        setSubOpen('')
        if (todo === null || todo === undefined || todo.priority === value) return
        changeTodoPriority(group.key, todo.id, value, event)
      }

      function applyBatchPriority(value, event) {
        const todos = batchTodos()
        setBatchMenu(null)
        setSubOpen('')
        if (todos.length === 0) return
        const tasks = todos.map(function (item) {
          return function () { return postApi({ action: 'priority', key: item.groupKey, id: item.id, priority: value }) }
        })
        runSequential(tasks)
          .then(function () {
            animatePendingRef.current = true
            refresh()
            showBubble('已调整 ' + todos.length + ' 项优先级为T' + value, event)
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      function prioChoiceNodes(action) {
        const rows = []
        for (let value = 0; value <= 9; value += 1) {
          rows.push(
            h(
              'button',
              {
                key: 'prio-' + value,
                type: 'button',
                className: 'dtn-menu-item dtn-prio-choice',
                onClick: function (event) { event.stopPropagation(); action(value, event) },
              },
              h('span', { className: 'dtn-prio-dot', style: { background: prioColor(value) } }),
              'T' + value,
            ),
          )
        }
        return h('div', { className: 'dtn-prio-submenu' }, rows)
      }

      // 文件夹拖到组名 = 归为主归属（顶层）。
      function moveFolderToPrimary(group, folderId, event) {
        const tree = ensurePrimary(cloneFolders(group))
        const primary = findFolder(tree, PRIMARY)
        if (primary === null || folderContains(primary, folderId)) return
        const moved = detachFolder(tree, folderId)
        if (moved === null) return
        if (!Array.isArray(primary.children)) primary.children = []
        primary.children.push(moved)
        saveFolders(group, tree, event)
      }

      // 点击菜单外部或按 Esc 关闭文件夹/条目/收展/批量右键菜单与优先级面板。
      React.useEffect(function () {
        if (folderMenu === null && todoMenu === null && prioMenu === null && treeMenu === null && batchMenu === null) return undefined
        const onDown = function (event) {
          // 菜单内部的点击（含真实 checkbox 切换、子菜单展开）不关闭菜单，便于连续勾选。
          const target = event !== null && event !== undefined ? event.target : null
          if (target !== null && target !== undefined && target.closest !== undefined && target.closest('.dtn-menu') !== null) return
          if (target !== null && target !== undefined && target.closest !== undefined && target.closest('.dtn-prio-menu') !== null) return
          setFolderMenu(null)
          setTodoMenu(null)
          setPrioMenu(null)
          setTreeMenu(null)
          setBatchMenu(null)
          setSubOpen('')
        }
        const onKey = function (event) { if (event.key === 'Escape') { setFolderMenu(null); setTodoMenu(null); setPrioMenu(null); setTreeMenu(null); setBatchMenu(null); setSubOpen('') } }
        window.addEventListener('pointerdown', onDown)
        window.addEventListener('keydown', onKey)
        return function () {
          window.removeEventListener('pointerdown', onDown)
          window.removeEventListener('keydown', onKey)
        }
      }, [folderMenu, todoMenu, prioMenu, treeMenu, batchMenu])

      // 一级右键菜单靠窗口右/下边缘时整体回收进视口，避免被裁掉。
      React.useLayoutEffect(function () {
        let menu = null
        let apply = null
        if (folderMenu !== null) { menu = folderMenu; apply = setFolderMenu }
        else if (todoMenu !== null) { menu = todoMenu; apply = setTodoMenu }
        else if (treeMenu !== null) { menu = treeMenu; apply = setTreeMenu }
        else if (batchMenu !== null) { menu = batchMenu; apply = setBatchMenu }
        if (menu === null || menu === undefined || apply === null) return
        const node = document.querySelector('.dtn-menu')
        if (node === null) return
        const rect = node.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        let x = menu.x
        let y = menu.y
        const maxRight = window.innerWidth - 8
        const maxBottom = window.innerHeight - 8
        if (rect.right > maxRight) x = Math.max(8, x - (rect.right - maxRight))
        if (rect.bottom > maxBottom) y = Math.max(8, y - (rect.bottom - maxBottom))
        if (x !== menu.x || y !== menu.y) apply(Object.assign({}, menu, { x: x, y: y }))
      }, [folderMenu, todoMenu, treeMenu, batchMenu])

      // 二级菜单渲染完成后再定位：右侧放不下翻到左侧，上/下超出时夹进视口。
      React.useLayoutEffect(function () {
        if (subOpen === '') return
        const host = document.querySelector('.dtn-has-sub[data-sub="' + subOpen + '"]')
        if (host === null) return
        fitSubmenuNode(host)
      }, [subOpen, folderMenu, todoMenu])
