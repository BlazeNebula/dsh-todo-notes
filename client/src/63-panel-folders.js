      function moveFolderTo(group, folderId, targetId, event) {
        setFolderMenu(null)
        if (targetId !== PRIMARY && targetId === folderId) return
        const tree = JSON.parse(JSON.stringify(Array.isArray(group.folders) ? group.folders : []))
        const moved = detachFolder(tree, folderId)
        if (moved === null) return
        if (targetId === PRIMARY) {
          let primary = null
          for (let i = 0; i < tree.length; i += 1) {
            if (tree[i] !== null && typeof tree[i] === 'object' && tree[i].id === PRIMARY) { primary = tree[i]; break }
          }
          if (primary === null) tree.unshift({ id: PRIMARY, name: '无文件夹', children: [moved] })
          else {
            if (!Array.isArray(primary.children)) primary.children = []
            primary.children.push(moved)
          }
        } else {
          const targetNode = findFolder(tree, targetId)
          if (targetNode === null) return
          if (!Array.isArray(targetNode.children)) targetNode.children = []
          targetNode.children.push(moved)
        }
        postApi({ action: 'folders', key: group.key, folders: tree }).then(function () {
          showBubble('已移动到' + folderLabel(targetId), event)
          refresh()
        }).catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      function folderAncestorIds(nodes, id, trail) {
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i]
          if (node === null || typeof node !== 'object') continue
          if (node.id === id) return trail
          const children = Array.isArray(node.children) ? node.children : []
          const found = folderAncestorIds(children, id, trail.concat([node.id]))
          if (found !== null) return found
        }
        return null
      }

      // 批量移动文件夹：保持各自的相对嵌套；若同时选中了父与子，只移动父，避免重复。
      function moveFolderBatch(group, ids, targetId, intoChild, event) {
        setFolderMenu(null)
        const tree = JSON.parse(JSON.stringify(Array.isArray(group.folders) ? group.folders : []))
        const selected = ids.filter(function (id) { return typeof id === 'string' && id !== '' && id !== targetId })
        const kept = selected.filter(function (id) {
          const ancestors = folderAncestorIds(tree, id, []) || []
          return !ancestors.some(function (ancestor) { return selected.indexOf(ancestor) >= 0 })
        })
        let lastId = targetId
        for (let i = 0; i < kept.length; i += 1) {
          const moved = detachFolder(tree, kept[i])
          if (moved === null) continue
          if (targetId === PRIMARY) {
            let primary = null
            for (let j = 0; j < tree.length; j += 1) {
              if (tree[j] !== null && typeof tree[j] === 'object' && tree[j].id === PRIMARY) { primary = tree[j]; break }
            }
            if (primary === null) tree.unshift({ id: PRIMARY, name: '无文件夹', children: [moved] })
            else {
              if (!Array.isArray(primary.children)) primary.children = []
              primary.children.push(moved)
            }
          } else if (intoChild) {
            if (folderContains(moved, targetId)) continue
            const targetNode = findFolder(tree, targetId)
            if (targetNode === null) continue
            if (!Array.isArray(targetNode.children)) targetNode.children = []
            targetNode.children.push(moved)
          } else {
            if (!insertAfterFolder(tree, lastId, moved)) continue
            lastId = moved.id
          }
        }
        postApi({ action: 'folders', key: group.key, folders: tree }).then(function () {
          showBubble('已移动 ' + kept.length + ' 个文件夹', event)
          refresh()
        }).catch(function (err) { failWith(event, err) })
      }

      function onFolderDrop(event, group, target, intoChild) {
        if (event !== null && event.preventDefault !== undefined) event.preventDefault()
        dragPayloadKey.current = ''
        const payload = dragData(event)
        if (payload === null || payload.kind !== 'folder' || payload.key !== group.key || payload.id === target.id) return
        if (Array.isArray(payload.ids) && payload.ids.length > 1) {
          moveFolderBatch(group, payload.ids, target.id, intoChild, event)
          return
        }
        const tree = JSON.parse(JSON.stringify(Array.isArray(group.folders) ? group.folders : []))
        const targetNode = findFolder(tree, target.id)
        if (targetNode === null) return
        const moved = detachFolder(tree, payload.id)
        if (moved === null) return
        if (intoChild) {
          // 不能拖进自己的子树。
          if (folderContains(moved, target.id)) return
          if (!Array.isArray(targetNode.children)) targetNode.children = []
          targetNode.children.push(moved)
        } else if (!insertAfterFolder(tree, target.id, moved)) {
          return
        }
        postApi({ action: 'folders', key: group.key, folders: tree }).then(refresh).catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      function beginResize(event, dir) {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        setResizing(true)
        const root = event.currentTarget !== null ? event.currentTarget.parentElement : null
        const startX = event.clientX
        const startY = event.clientY
        const startWidth = panelWidth
        const startHeight = panelHeight !== null ? panelHeight : (root !== null ? root.offsetHeight : 320)
        const startPos = { x: panelPos.x, y: panelPos.y }
        const viewHeight = function () { return typeof window === 'undefined' ? 900 : window.innerHeight }
        const move = function (moveEvent) {
          const dx = moveEvent.clientX - startX
          const dy = moveEvent.clientY - startY
          let nextWidth = startWidth
          let nextHeight = startHeight
          let nextX = startPos.x
          let nextY = startPos.y
          if (dir === 'r' || dir === 'br') nextWidth = startWidth + dx
          if (dir === 'l') nextWidth = startWidth - dx
          if (dir === 'b' || dir === 'br') nextHeight = startHeight + dy
          if (dir === 't') nextHeight = startHeight - dy
          nextWidth = Math.max(MIN_PANEL_WIDTH, Math.min(maxPanelWidth(), nextWidth))
          nextHeight = Math.max(160, Math.min(viewHeight() - 72, nextHeight))
          if (dir === 'l') nextX = startPos.x + (startWidth - nextWidth)
          if (dir === 't') nextY = Math.max(56, startPos.y + (startHeight - nextHeight))
          setPanelWidth(nextWidth)
          setPanelHeight(nextHeight)
          setPanelPos(clampPos({ x: nextX, y: nextY }, nextWidth, 200, 56))
        }
        const up = function () {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          setResizing(false)
          setPanelWidth(function (value) {
            writeStored(LS_WIDTH, value)
            return value
          })
          setPanelHeight(function (value) {
            writeStored(LS_HEIGHT, value)
            return value
          })
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }

      // ---------------------------------------------------------- 文件夹编辑

      function cloneFolders(group) {
        return JSON.parse(JSON.stringify(Array.isArray(group.folders) ? group.folders : []))
      }

      function ensurePrimary(tree) {
        const hasPrimary = tree.some(function (node) {
          return node !== null && typeof node === 'object' && node.id === PRIMARY
        })
        if (!hasPrimary) tree.unshift({ id: PRIMARY, name: '无文件夹', children: [] })
        return tree
      }

      function failWith(event, err) {
        showBubble('保存失败：' + (err && err.message ? err.message : err), event && typeof event.clientX === 'number' ? event : { clientX: panelPos.x + 40, clientY: panelPos.y + 56 })
      }

      function saveFolders(group, tree, event) {
        return postApi({ action: 'folders', key: group.key, folders: tree })
          .then(function () { refresh() })
          .catch(function (err) { failWith(event, err) })
      }

      function createFolder(group, event) {
        const tree = ensurePrimary(cloneFolders(group))
        const id = 'f-' + Date.now().toString(36)
        tree.push({ id: id, name: '新建文件夹', children: [] })
        postApi({ action: 'folders', key: group.key, folders: tree })
          .then(function () {
            setEditingFolder({ key: group.key, folderId: id, draft: '新建文件夹' })
            refresh()
          })
          .catch(function (err) { failWith(event, err) })
      }

      function createSubFolder(group, folder, event) {
        const tree = ensurePrimary(cloneFolders(group))
        const node = findFolder(tree, folder.id)
        if (node === null) return
        if (!Array.isArray(node.children)) node.children = []
        const id = 'f-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36)
        node.children.push({ id: id, name: '新建文件夹', children: [] })
        postApi({ action: 'folders', key: group.key, folders: tree })
          .then(function () {
            setOpenFolders(function (state) {
              const next = Object.assign({}, state)
              next[group.key + '/' + folder.id] = true
              return next
            })
            setEditingFolder({ key: group.key, folderId: id, draft: '新建文件夹' })
            refresh()
          })
          .catch(function (err) { failWith(event, err) })
      }

      function startRenameFolder(group, folder) {
        setFolderMenu(null)
        setEditingFolder({ key: group.key, folderId: folder.id, draft: folder.name || folderLabel(folder.id) })
      }

      function commitRenameFolder(group, event) {
        const state = editingFolder
        if (state === null || state === undefined || state.key !== group.key) return
        setEditingFolder(null)
        const name = String(state.draft === undefined || state.draft === null ? '' : state.draft).trim()
        if (name === '') return
        const tree = ensurePrimary(cloneFolders(group))
        const node = findFolder(tree, state.folderId)
        if (node === null) return
        if (node.name === name) return
        node.name = name
        saveFolders(group, tree, event)
      }

      function cancelRenameFolder() {
        setEditingFolder(null)
      }

      // 删除确认改为面板内浮层，在点击位置附近给出「取消 / 确认删除」。
      // 按住 Ctrl 点击删除仍然直接通过，不弹确认。
      function settleConfirm(value) {
        const resolve = confirmResolveRef.current
        confirmResolveRef.current = null
        setConfirmDialog(null)
        if (typeof resolve === 'function') resolve(value)
      }

      function confirmDelete(event, message) {
        if (event !== null && event !== undefined && event.ctrlKey === true) return Promise.resolve(true)
        const point = event !== null && event !== undefined && typeof event.clientX === 'number'
          ? { x: event.clientX, y: event.clientY }
          : { x: panelPos.x + 40, y: panelPos.y + 56 }
        return new Promise(function (resolve) {
          confirmResolveRef.current = resolve
          setConfirmDialog({ message: message, x: point.x, y: point.y })
        })
      }

      function deleteFolder(group, folderId, event) {
        setFolderMenu(null)
        if (folderId === PRIMARY) return
        postApi({ action: 'detachFolder', key: group.key, folder: folderId })
          .then(function () { showBubble('已解除文件夹', event); refresh() })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      async function deleteFolderTree(group, folderId, event) {
        setFolderMenu(null)
        if (folderId === PRIMARY) return
        const ok = await confirmDelete(event, '会连同子文件夹里的全部 TODO 一起删除，且不可恢复，确认删除整个文件夹？')
        if (ok !== true) return
        postApi({ action: 'deleteFolderTree', key: group.key, folder: folderId })
          .then(function (result) {
            showBubble('已删除整个文件夹' + (result !== null && result !== undefined && result.count !== undefined ? '（' + result.count + ' 条）' : ''), event)
            refresh()
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      // 批量拖拽：把选中的多条 TODO 一起移动到目标文件夹。
      function moveBatchTodos(group, ids, folderId, event) {
        const unique = []
        ids.forEach(function (id) {
          if (typeof id === 'string' && id !== '' && unique.indexOf(id) < 0) unique.push(id)
        })
        if (unique.length === 0) return
        dragPayloadKey.current = ''
        Promise.all(unique.map(function (id) {
          return postApi({ action: 'moveTodo', key: group.key, id: id, folder: folderId })
        })).then(function () {
          showBubble('已移动 ' + unique.length + ' 条到' + folderLabel(folderId), event)
          refresh()
        }).catch(function (err) { failWith(event, err) })
      }

      // 拖 TODO 到文件夹头：按住 Ctrl = 额外加入该文件夹；否则移动（主归属改到该文件夹）。
      function onFolderTodoDrop(event, group, folder) {
        if (event !== null && event.preventDefault !== undefined) event.preventDefault()
        const payload = dragData(event)
        if (payload === null || payload.kind !== 'todo' || payload.key !== group.key) return
        if (Array.isArray(payload.ids) && payload.ids.length > 1) {
          moveBatchTodos(group, payload.ids, folder.id, event)
          return
        }
        dragPayloadKey.current = ''
        const action = event.ctrlKey === true ? 'reference' : 'moveTodo'
        postApi({ action: action, key: group.key, id: payload.id, folder: folder.id })
          .then(function () { showBubble(action === 'reference' ? '已加入' + folderLabel(folder.id) : '已移动到' + folderLabel(folder.id), event); refresh() })
          .catch(function (err) { failWith(event, err) })
      }

      function openFolderMenu(event, group, folder) {
        event.preventDefault()
        event.stopPropagation()
        setSubOpen('')
        setFolderMenu({ x: event.clientX, y: event.clientY, groupKey: group.key, group: group, folderId: folder.id })
      }

      // 二级菜单出现在右侧会超出窗口时改挂左侧，并在纵向夹进视口。
      // 必须在子菜单已渲染后量尺寸，所以由 subOpen 的 layout effect 调用。
      function fitSubmenuNode(host) {
        if (host === null || host === undefined || host.querySelector === undefined) return
        const sub = host.querySelector('.dtn-submenu')
        if (sub === null || sub === undefined) return
        sub.classList.remove('dtn-submenu-left')
        sub.style.top = ''
        const hostRect = host.getBoundingClientRect()
        const subRect = sub.getBoundingClientRect()
        const width = subRect.width > 0 ? subRect.width : 176
        const height = subRect.height > 0 ? subRect.height : 0
        if (hostRect.right + width + 8 > window.innerWidth) sub.classList.add('dtn-submenu-left')
        if (height > 0 && hostRect.top < 8) {
          sub.style.top = (8 - hostRect.top) + 'px'
        } else if (height > 0 && hostRect.top + height > window.innerHeight - 8) {
          const top = Math.max(8 - hostRect.top, window.innerHeight - 8 - height - hostRect.top)
          sub.style.top = top + 'px'
        }
      }

      // ---------------------------------------------------------- TODO 编辑

      function createTodo(group, event, folderId) {
        postApi({ action: 'createTodo', key: group.key, folder: folderId || PRIMARY })
          .then(function (result) {
            setEditingTodo({ key: group.key, id: result.id, draft: result.title || '新建待办' })
            animatePendingRef.current = true
            refresh()
          })
          .catch(function (err) { failWith(event, err) })
      }

      function openBatchCreate(group, event, folderId) {
        const rect = event !== null && event !== undefined && event.currentTarget !== null && event.currentTarget !== undefined
          ? event.currentTarget.getBoundingClientRect()
          : null
        const avoid = preview === null
          ? null
          : { x: previewPos.x, y: previewPos.y, w: 440, h: previewRef.current !== null ? previewRef.current.offsetHeight : 440 }
        const pos = placePreview(rect, 320, avoid)
        setBatchPos(pos)
        setBatchCreate({ key: group.key, group: group, folderId: folderId || PRIMARY, value: '', pos: pos })
      }

      function closeBatchCreate() {
        setBatchCreate(null)
      }

      function confirmBatchCreate() {
        const state = batchCreate
        if (state === null || state === undefined) return
        let truncatedLimit = 0
        const titles = String(state.value || '').split(/\r?\n/).map(function (line) {
          const clamped = clampTitleDraft(line.trim())
          if (clamped.truncated) truncatedLimit = clamped.limit
          return clamped.text
        }).filter(function (line) { return line !== '' })
        if (titles.length === 0) return
        setBatchCreate(null)
        postApi({ action: 'createTodos', key: state.key, folder: state.folderId, titles: titles })
          .then(function (result) {
            animatePendingRef.current = true
            refresh()
            if (truncatedLimit > 0) {
              showBubble('标题最多 ' + truncatedLimit + ' 个字，超出部分已截断', { clientX: state.pos.x + 20, clientY: state.pos.y + 14 })
            }
            if (result !== null && typeof result === 'object' && typeof result.count === 'number') {
              setVersion(function (value) { return value + 1 })
            }
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), null) })
      }

      // ---------------------------------------------------------- 选择、框选与批量操作

      function itemOfElement(node) {
        if (node === null || node === undefined) return null
        const key = node.getAttribute('data-select-key')
        if (typeof key !== 'string' || key === '') return null
        return {
          key: key,
          type: node.getAttribute('data-select-type') || 'todo',
          groupKey: node.getAttribute('data-select-group') || '',
          id: node.getAttribute('data-select-id') || '',
          folder: node.getAttribute('data-select-folder') || '',
        }
      }

      function setSelectionNow(list) {
        selectionRef.current = list
        setSelection(list)
      }

      function isSelectedKey(key) {
        const list = selectionRef.current
        for (let i = 0; i < list.length; i += 1) if (list[i].key === key) return true
        return false
      }

      function clickSelect(item, event) {
        if (item === null) return
        const additive = event.ctrlKey === true || event.metaKey === true
        if (event.shiftKey === true && selectAnchorRef.current !== '') {
          const host = event.currentTarget !== null && event.currentTarget !== undefined && event.currentTarget.closest !== undefined
            ? event.currentTarget.closest('.dtn-root')
            : null
          const scope = host !== null && host !== undefined ? host : document
          const nodes = Array.prototype.slice.call(scope.querySelectorAll('[data-select-key]'))
          const items = nodes.map(itemOfElement).filter(function (value) { return value !== null })
          const from = items.findIndex(function (value) { return value.key === selectAnchorRef.current })
          const to = items.findIndex(function (value) { return value.key === item.key })
          if (from >= 0 && to >= 0) {
            const slice = items.slice(Math.min(from, to), Math.max(from, to) + 1)
            const merged = additive ? selectionRef.current.slice() : []
            slice.forEach(function (value) {
              if (!merged.some(function (seen) { return seen.key === value.key })) merged.push(value)
            })
            setSelectionNow(merged)
            return
          }
        }
        if (additive) {
          const next = isSelectedKey(item.key)
            ? selectionRef.current.filter(function (value) { return value.key !== item.key })
            : selectionRef.current.concat([item])
          setSelectionNow(next)
          selectAnchorRef.current = item.key
          return
        }
        setSelectionNow([item])
        selectAnchorRef.current = item.key
      }

      // 在空白处按住左键拖动出选择框，命中的条目实时并入选区。
      function beginMarquee(event) {
        if (event.button !== 0) return
        const target = event.target
        if (target !== null && target.closest !== undefined && target.closest('button, input, textarea, .dtn-menu, .dtn-preview, .dtn-prio-menu, .dtn-grip') !== null) return
        marqueeMovedRef.current = false
        const startX = event.clientX
        const startY = event.clientY
        const additive = event.ctrlKey === true || event.metaKey === true
        const base = additive ? selectionRef.current.slice() : []
        const host = event.currentTarget !== null && event.currentTarget !== undefined && event.currentTarget.closest !== undefined
          ? event.currentTarget.closest('.dtn-root')
          : null
        const scope = host !== null && host !== undefined ? host : document
        let moved = false
        const move = function (moveEvent) {
          const rect = {
            x: Math.min(startX, moveEvent.clientX),
            y: Math.min(startY, moveEvent.clientY),
            w: Math.abs(moveEvent.clientX - startX),
            h: Math.abs(moveEvent.clientY - startY),
          }
          if (!moved && rect.w < 3 && rect.h < 3) return
          moved = true
          marqueeMovedRef.current = true
          setMarquee(rect)
          const nodes = Array.prototype.slice.call(scope.querySelectorAll('[data-select-key]'))
          const merged = base.slice()
          nodes.forEach(function (node) {
            const box = node.getBoundingClientRect()
            const hit = box.left < rect.x + rect.w && box.right > rect.x && box.top < rect.y + rect.h && box.bottom > rect.y
            if (!hit) return
            const item = itemOfElement(node)
            if (item === null) return
            if (!merged.some(function (seen) { return seen.key === item.key })) merged.push(item)
          })
          setSelectionNow(merged)
        }
        const up = function () {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          setMarquee(null)
          if (!moved && !additive) setSelectionNow([])
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }

      function batchItems() {
        return batchMenu === null ? [] : batchMenu.items
      }

      function batchTodos() {
        const seen = {}
        return batchItems().filter(function (item) {
          if (item.type !== 'todo') return false
          const key = item.groupKey + ':' + item.id
          if (seen[key] === true) return false
          seen[key] = true
          return true
        })
      }

      function batchFolders() {
        return batchItems().filter(function (item) { return item.type === 'folder' })
      }

      function itemLabel(item) {
        const group = findLiveGroup(item.groupKey)
        if (group === null || group === undefined) return ''
        if (item.type === 'todo') {
          const todo = (Array.isArray(group.todos) ? group.todos : []).find(function (value) { return value.id === item.id })
          return todo === undefined ? '' : String(todo.title || '')
        }
        const folder = findFolder(Array.isArray(group.folders) ? group.folders : [], item.id)
        return folder === null ? '' : String(folder.name || folderLabel(folder.id))
      }

      function openBatchMenu(event, items) {
        if (event === null || event === undefined) return
        event.preventDefault()
        event.stopPropagation()
        const list = Array.isArray(items) ? items.slice() : []
        if (list.length === 0) return
        setFolderMenu(null)
        setTodoMenu(null)
        setTreeMenu(null)
        setSubOpen('')
        setBatchMenu({ x: event.clientX, y: event.clientY, items: list })
      }

      function closeBatchMenu() {
        setBatchMenu(null)
        setSubOpen('')
      }

      function batchFolderOptions() {
        const groups = []
        batchTodos().forEach(function (item) {
          if (groups.some(function (group) { return group.key === item.groupKey })) return
          const group = findLiveGroup(item.groupKey)
          if (group !== null && group !== undefined) groups.push(group)
        })
        const seen = {}
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

      // 「批量管理收录」只列真实文件夹：主归属是位置，不是可勾选的收录关系。