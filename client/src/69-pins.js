    // ------------------------------------------------------------ 可保留浮窗
    // 预览、批量新建、批量重命名都在被拖动后变成独立窗口：各自保存位置与内容，
    // 新窗口不会覆盖旧窗口；刷新 DSH 后按持久化数据恢复。

    function sanitizePinnedWindows(raw) {
      if (!Array.isArray(raw)) return []
      const kinds = { preview: true, batchCreate: true, batchRename: true }
      const list = []
      for (let i = 0; i < raw.length; i += 1) {
        const item = raw[i]
        if (item === null || typeof item !== 'object') continue
        if (kinds[item.kind] !== true) continue
        if (typeof item.id !== 'string' || item.id === '') continue
        const pos = item.pos !== null && typeof item.pos === 'object' ? item.pos : { x: 12, y: 64 }
        const ratio = item.ratio === true || item.ratio === 1
        const viewWidth = typeof window === 'undefined' ? 0 : window.innerWidth
        const viewHeight = typeof window === 'undefined' ? 0 : window.innerHeight
        const point = ratio
          ? {
              x: (Number(pos.x) || 0) * (viewWidth > 0 ? viewWidth : 1280),
              y: (Number(pos.y) || 0) * (viewHeight > 0 ? viewHeight : 800),
            }
          : { x: Number(pos.x) || 12, y: Number(pos.y) || 64 }
        const base = {
          id: item.id,
          kind: item.kind,
          pos: clampPos(point, 440, 200, 56),
          width: Number(item.width) > 0 ? Math.max(320, Math.min((viewWidth || 1280) - 24, Number(item.width))) : undefined,
          height: Number(item.height) > 0 ? Math.max(120, Math.min((viewHeight || 800) - 48, Number(item.height))) : undefined,
          collapsed: item.collapsed === true,
        }
        if (item.kind === 'preview') {
          list.push(Object.assign(base, {
            todoId: typeof item.todoId === 'string' ? item.todoId : '',
            groupKey: typeof item.groupKey === 'string' ? item.groupKey : '',
            title: typeof item.title === 'string' ? item.title : 'TODO',
            markdown: typeof item.markdown === 'string' ? item.markdown : '',
            draft: typeof item.draft === 'string' ? item.draft : (typeof item.markdown === 'string' ? item.markdown : ''),
            meta: item.meta !== null && typeof item.meta === 'object' ? item.meta : null,
            editing: item.editing === true,
            editHeight: Number(item.editHeight) > 0 ? Number(item.editHeight) : undefined,
            loading: false,
            loaded: true,
            error: typeof item.error === 'string' ? item.error : '',
          }))
          continue
        }
        if (item.kind === 'batchCreate') {
          list.push(Object.assign(base, {
            groupKey: typeof item.groupKey === 'string' ? item.groupKey : '',
            folderId: typeof item.folderId === 'string' && item.folderId !== '' ? item.folderId : PRIMARY,
            value: typeof item.value === 'string' ? item.value : '',
          }))
          continue
        }
        list.push(Object.assign(base, {
          items: Array.isArray(item.items) ? item.items : [],
          value: typeof item.value === 'string' ? item.value : '',
        }))
      }
      return list
    }

    // 位置按视口比例持久化：换分辨率或窗口大小后仍在相近位置出现。
    function serializePinnedWindows(list) {
      const viewWidth = window.innerWidth > 0 ? window.innerWidth : 1280
      const viewHeight = window.innerHeight > 0 ? window.innerHeight : 800
      return list.map(function (win) {
        return Object.assign({}, win, {
          pos: { x: win.pos.x / viewWidth, y: win.pos.y / viewHeight },
          ratio: true,
        })
      })
    }

    // 右侧栏实例不渲染浮窗：它新建窗口时把数据交给浮动面板实例，避免同一窗口渲染两份。
    function emitPinnedWindow(win) {
      if (embedded !== true || SYNC_BUS === null || typeof CustomEvent !== 'function') return false
      SYNC_BUS.dispatchEvent(new CustomEvent('pin-open', { detail: win }))
      return true
    }

    // 标题改名后同时更新面板数据、临时预览与已保留的窗口，不依赖下一次轮询。
    function syncTodoTitle(groupKey, todoId, title) {
      patchBoardTitle(groupKey, todoId, title)
      setPreviewData(function (current) {
        if (current === null || current === undefined || current.id !== todoId) return current
        return Object.assign({}, current, { title: title })
      })
      setPinned(function (list) {
        return list.map(function (win) {
          if (win.todoId !== todoId || win.groupKey !== groupKey) return win
          if (win.editing === true) return Object.assign({}, win, { title: title })
          return Object.assign({}, win, { title: title, renameDraft: undefined })
        })
      })
      if (SYNC_BUS !== null && typeof CustomEvent === 'function') {
        SYNC_BUS.dispatchEvent(new CustomEvent('todo-title', { detail: { groupKey: groupKey, todoId: todoId, title: title } }))
      }
    }

    function nextPinId() {
      return 'w' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1296).toString(36)
    }

    function updatePin(id, patch) {
      setPinned(function (list) {
        return list.map(function (item) { return item.id === id ? Object.assign({}, item, patch) : item })
      })
    }

    function removePin(id) {
      if (pinSaveTimers.current[id] !== undefined) {
        window.clearTimeout(pinSaveTimers.current[id])
        delete pinSaveTimers.current[id]
      }
      if (pinTitleTimers.current[id] !== undefined) {
        window.clearTimeout(pinTitleTimers.current[id])
        delete pinTitleTimers.current[id]
      }
      setPinned(function (list) { return list.filter(function (item) { return item.id !== id }) })
    }

    // 把改名结果直接写回面板数据，避免只靠下一次拉取才更新。
    function patchBoardTitle(groupKey, todoId, title) {
      setData(function (current) {
        if (current === null || typeof current !== 'object') return current
        let changed = false
        const apply = function (group) {
          if (group === null || typeof group !== 'object') return group
          if (group.key !== groupKey || !Array.isArray(group.todos)) return group
          let touched = false
          const todos = group.todos.map(function (todo) {
            if (todo === null || typeof todo !== 'object' || todo.id !== todoId) return todo
            if (todo.title === title) return todo
            touched = true
            return Object.assign({}, todo, { title: title })
          })
          if (!touched) return group
          changed = true
          return Object.assign({}, group, { todos: todos })
        }
        const next = Object.assign({}, current, {
          user: apply(current.user),
          workspaces: Array.isArray(current.workspaces) ? current.workspaces.map(apply) : current.workspaces,
          sessions: Array.isArray(current.sessions) ? current.sessions.map(apply) : current.sessions,
        })
        return changed ? next : current
      })
    }

    // 只对「同一个条目」复用已保留的预览窗：置顶并整块高亮一次，内容保持不动。
    function reusePreviewPin(group, todo) {
      const candidate = pinnedRef.current.filter(function (item) {
        return item.kind === 'preview' && item.todoId === todo.id && item.groupKey === group.key
      }).slice(-1)[0]
      if (candidate === undefined) return false
      // 只抬高层级，不做内容重载，也不改变窗口顺序。
      setFocusPin(candidate.id)
      setPulsePin(candidate.id)
      window.setTimeout(function () {
        setPulsePin(function (value) { return value === candidate.id ? '' : value })
      }, 420)
      return true
    }

    function pinFromPreview(startEditing) {
      if (preview === null) return ''
      const data = previewData
      const id = nextPinId()
      setFocusPin(id)
      const win = {
        id: id,
        kind: 'preview',
        pos: { x: previewPos.x, y: previewPos.y },
        todoId: preview.id,
        groupKey: preview.groupKey,
        title: data !== null && typeof data.title === 'string' ? data.title : preview.title,
        markdown: data !== null && typeof data.markdown === 'string' ? data.markdown : '',
        draft: data !== null && typeof data.markdown === 'string' ? data.markdown : '',
        meta: data === null ? null : {
          status: data.status,
          priority: data.priority,
          source: data.source,
          primaryFolder: data.primaryFolder,
          created: data.created,
        },
        editing: startEditing === true,
        loading: data === null,
        loaded: data !== null,
        error: '',
      }
      if (emitPinnedWindow(win)) {
        closePreview()
        return id
      }
      setPinned(function (list) {
        return list.concat([win])
      })
      closePreview()
      return id
    }

    function pinFromBatchCreate() {
      if (batchCreate === null) return ''
      const pos = batchPos || batchCreate.pos
      const id = nextPinId()
      setFocusPin(id)
      const win = {
        id: id,
        kind: 'batchCreate',
        pos: { x: pos.x, y: pos.y },
        groupKey: batchCreate.key,
        folderId: batchCreate.folderId,
        value: batchCreate.value,
      }
      setBatchCreate(null)
      if (emitPinnedWindow(win)) return id
      setPinned(function (list) {
        return list.concat([win])
      })
      return id
    }

    function pinFromBatchRename() {
      if (batchRename === null) return ''
      const pos = batchRename.pos
      const id = nextPinId()
      setFocusPin(id)
      const win = {
        id: id,
        kind: 'batchRename',
        pos: { x: pos.x, y: pos.y },
        items: batchRename.items.map(function (item) {
          return { groupKey: item.groupKey, id: item.id, type: item.type, title: item.title }
        }),
        value: batchRename.value,
      }
      setBatchRename(null)
      if (emitPinnedWindow(win)) return id
      setPinned(function (list) {
        return list.concat([win])
      })
      return id
    }

    // 拖动后转换成一个保留窗口；没有真正移动时保持原来的临时窗口行为。
    function startWindowMove(event, sourceKind) {
      if (event.button !== 0) return
      if (event.target !== null && event.target !== undefined && event.target.closest !== undefined && event.target.closest('button') !== null) return
      const startX = event.clientX
      const startY = event.clientY
      let origin = { x: previewPos.x, y: previewPos.y }
      if (sourceKind === 'batchCreate') origin = batchPos || (batchCreate !== null ? batchCreate.pos : { x: 12, y: 64 })
      if (sourceKind === 'batchRename' && batchRename !== null) origin = batchRename.pos
      let pinId = ''
      const move = function (next) {
        if (pinId === '') {
          if (Math.abs(next.clientX - startX) < 4 && Math.abs(next.clientY - startY) < 4) return
          pinId = sourceKind === 'preview' ? pinFromPreview() : sourceKind === 'batchCreate' ? pinFromBatchCreate() : pinFromBatchRename()
          if (pinId === '') return
        }
        const pos = clampPos({
          x: origin.x + (next.clientX - startX),
          y: origin.y + (next.clientY - startY),
        }, 440, 200)
        updatePin(pinId, { pos: pos })
      }
      const up = function () {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      event.preventDefault()
    }

    // 保留浮窗复用主面板的缩放逻辑，只在自己的窗口数据上更新宽高与位置。
    function beginPinResize(event, id, dir) {
      const win = pinnedRef.current.find(function (item) { return item.id === id })
      if (win === undefined) return
      const root = event.currentTarget !== null && event.currentTarget.closest !== undefined ? event.currentTarget.closest('.dtn-pin') : null
      const viewWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
      const viewHeight = typeof window === 'undefined' ? 800 : window.innerHeight
      startBoxResize(event, {
        dir: dir || 'br',
        x: win.pos.x,
        y: win.pos.y,
        width: win.width || (root !== null ? root.offsetWidth : 440),
        height: win.height || (root !== null ? root.offsetHeight : 320),
        minWidth: 320,
        maxWidth: Math.max(320, viewWidth - 24),
        minHeight: 120,
        maxHeight: Math.max(120, viewHeight - 48),
        minY: 56,
        onStart: function () { setFocusPin(id) },
        onChange: function (next) {
          updatePin(id, {
            width: next.width,
            height: next.height,
            pos: clampPos({ x: next.x, y: next.y }, next.width, 120, 56),
          })
        },
      })
    }

    function dragPinWindow(event, id) {
      if (event.button !== 0) return
      if (event.target !== null && event.target !== undefined && event.target.closest !== undefined && event.target.closest('button') !== null) return
      const win = pinnedRef.current.find(function (item) { return item.id === id })
      if (win === undefined) return
      const startX = event.clientX
      const startY = event.clientY
      const origin = win.pos
      pinDragMoved.current = false
      const move = function (next) {
        if (Math.abs(next.clientX - startX) > 3 || Math.abs(next.clientY - startY) > 3) pinDragMoved.current = true
        const pos = clampPos({
          x: origin.x + (next.clientX - startX),
          y: origin.y + (next.clientY - startY),
        }, win.width || 440, win.height || 320, 56)
        updatePin(id, { pos: pos })
      }
      const up = function () {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      event.preventDefault()
    }

    function bodyAutosaveDelay() {
      const value = data !== null && data.config !== null && data.config !== undefined ? Number(data.config.bodyAutosaveMs) : NaN
      return Number.isFinite(value) && value >= 1000 ? Math.min(60000, Math.round(value)) : 5000
    }

    function savePinBody(id) {
      const win = pinnedRef.current.find(function (item) { return item.id === id })
      if (win === undefined || win.kind !== 'preview' || win.editing !== true) return
      postApi({ action: 'saveTodoBody', key: win.groupKey, id: win.todoId, body: win.draft })
        .then(function () {
          updatePin(id, { markdown: win.draft })
          showBubble('正文已保存', { clientX: win.pos.x + 160, clientY: win.pos.y + 14 })
        })
        .catch(function (failure) {
          showBubble('保存失败：' + String(failure && failure.message ? failure.message : failure), {
            clientX: win.pos.x + 160,
            clientY: win.pos.y + 14,
          })
        })
    }

    function savePinTitle(id) {
      const win = pinnedRef.current.find(function (item) { return item.id === id })
      if (win === undefined || win.kind !== 'preview') return
      const raw = String(win.renameDraft !== undefined && win.renameDraft !== null ? win.renameDraft : win.title).trim()
      const clamped = clampTitleDraft(raw)
      const title = clamped.text
      if (title === '' || title === win.title) {
        updatePin(id, { renameDraft: clamped.truncated ? title : undefined })
        return
      }
      if (clamped.truncated) updatePin(id, { renameDraft: title })
      postApi({ action: 'renameTodo', key: win.groupKey, id: win.todoId, title: title })
        .then(function () {
          updatePin(id, { title: title, renameDraft: undefined })
          syncTodoTitle(win.groupKey, win.todoId, title)
          refresh()
          showBubble(clamped.truncated ? '标题最多 ' + clamped.limit + ' 个字，已截断并保存' : '标题已保存', { clientX: win.pos.x + 160, clientY: win.pos.y + 14 })
        })
        .catch(function (failure) {
          showBubble('标题保存失败：' + String(failure && failure.message ? failure.message : failure), {
            clientX: win.pos.x + 160,
            clientY: win.pos.y + 14,
          })
        })
    }

    function schedulePinTitleSave(id) {
      if (pinTitleTimers.current[id] !== undefined) window.clearTimeout(pinTitleTimers.current[id])
      pinTitleTimers.current[id] = window.setTimeout(function () {
        delete pinTitleTimers.current[id]
        savePinTitle(id)
      }, bodyAutosaveDelay())
    }

    function schedulePinSave(id) {
      if (pinSaveTimers.current[id] !== undefined) window.clearTimeout(pinSaveTimers.current[id])
      pinSaveTimers.current[id] = window.setTimeout(function () {
        delete pinSaveTimers.current[id]
        savePinBody(id)
      }, bodyAutosaveDelay())
    }

    function editAutoHeight(draft) {
      const lines = String(draft || '').split('\n').length
      return Math.min(560, Math.max(120, lines * 20 + 18))
    }

    function togglePinEditing(id) {
      const win = pinnedRef.current.find(function (item) { return item.id === id })
      if (win === undefined) return
      if (win.editing === true) {
        if (pinSaveTimers.current[id] !== undefined) {
          window.clearTimeout(pinSaveTimers.current[id])
          delete pinSaveTimers.current[id]
        }
        if (pinTitleTimers.current[id] !== undefined) {
          window.clearTimeout(pinTitleTimers.current[id])
          delete pinTitleTimers.current[id]
        }
        savePinTitle(id)
        savePinBody(id)
        updatePin(id, { editing: false })
        return
      }
      updatePin(id, { editing: true, draft: win.markdown, renameDraft: win.title })
    }

    function confirmPinBatchCreate(id) {
      const win = pinnedRef.current.find(function (item) { return item.id === id })
      if (win === undefined) return
      let truncatedLimit = 0
      const titles = String(win.value || '').split(/\r?\n/).map(function (line) {
        const clamped = clampTitleDraft(line.trim())
        if (clamped.truncated) truncatedLimit = clamped.limit
        return clamped.text
      }).filter(function (line) { return line !== '' })
      if (titles.length === 0) {
        showBubble('没有可创建的内容', { clientX: win.pos.x + 120, clientY: win.pos.y + 14 })
        return
      }
      postApi({ action: 'createTodos', key: win.groupKey, folder: win.folderId, titles: titles })
        .then(function () {
          removePin(id)
          animatePendingRef.current = true
          refresh()
          if (truncatedLimit > 0) {
            showBubble('标题最多 ' + truncatedLimit + ' 个字，超出部分已截断', { clientX: win.pos.x + 120, clientY: win.pos.y + 14 })
          }
          showBubble('已创建 ' + titles.length + ' 条 TODO', { clientX: win.pos.x + 120, clientY: win.pos.y + 14 })
        })
        .catch(function (failure) {
          showBubble('创建失败：' + String(failure && failure.message ? failure.message : failure), {
            clientX: win.pos.x + 120,
            clientY: win.pos.y + 14,
          })
        })
    }

    function confirmPinBatchRename(id) {
      const win = pinnedRef.current.find(function (item) { return item.id === id })
      if (win === undefined) return
      const names = String(win.value || '').split('\n')
      const tasks = []
      const folderRenames = {}
      win.items.forEach(function (item, index) {
        const name = String(names[index] === undefined ? '' : names[index]).trim()
        if (name === '') return
        if (item.type === 'todo') {
          tasks.push(function () { return postApi({ action: 'renameTodo', key: item.groupKey, id: item.id, title: name }) })
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
      if (tasks.length === 0) {
        removePin(id)
        return
      }
      runSequential(tasks)
        .then(function () {
          removePin(id)
          setSelectionNow([])
          animatePendingRef.current = true
          refresh()
          showBubble('批量重命名已完成', { clientX: win.pos.x + 120, clientY: win.pos.y + 14 })
        })
        .catch(function (failure) {
          showBubble('重命名失败：' + String(failure && failure.message ? failure.message : failure), {
            clientX: win.pos.x + 120,
            clientY: win.pos.y + 14,
          })
        })
    }
