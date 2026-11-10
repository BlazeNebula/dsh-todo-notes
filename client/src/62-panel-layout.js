      function panelLeftOf(pos, width, collapsedNow) {
        if (typeof window === 'undefined') return pos.x
        const center = pos.x + width / 2
        const renderedWidth = collapsedNow ? MIN_PANEL_WIDTH : width
        const raw = center - renderedWidth / 2
        return Math.max(8, Math.min(raw, window.innerWidth - renderedWidth - 8))
      }

      function startDrag(event, kind) {
        if (event.button !== 0) return
        const target = event.target
        if (target !== null && typeof target.closest === 'function' && target.closest('button') !== null) return
        event.preventDefault()
        dragMoved.current = false
        const startX = event.clientX
        const startY = event.clientY
        const mainCollapsed = kind === 'main' && collapsed && !(hoverOpen && !embedded)
        const centerOffset = mainCollapsed ? (panelWidth - MIN_PANEL_WIDTH) / 2 : 0
        const base = kind === 'main'
          ? { x: panelPos.x + centerOffset, y: panelPos.y }
          : kind === 'batch' ? (batchPos || (batchCreate !== null && batchCreate.pos) || { x: 12, y: 64 }) : previewPos
        const setter = kind === 'main' ? setPanelPos : kind === 'batch' ? setBatchPos : setPreviewPos
        const widthOf = kind === 'main' ? (mainCollapsed ? MIN_PANEL_WIDTH : panelWidth) : 440
        if (kind === 'main') setDragging(true)
        const move = function (moveEvent) {
          if (Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3) dragMoved.current = true
          const next = clampPos(
            { x: base.x + moveEvent.clientX - startX, y: base.y + moveEvent.clientY - startY },
            widthOf,
            200,
            kind === 'main' ? 56 : undefined,
          )
          if (mainCollapsed) next.x = next.x - centerOffset
          setter(next)
        }
        const up = function () {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          if (kind === 'main') setDragging(false)
          if (kind === 'main' || kind === 'preview') {
            setter(function (value) {
              writeStored(kind === 'main' ? LS_PANEL : LS_PREVIEW, value)
              return value
            })
          }
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }

      function toggleSection(kind) {
        setSections(function (value) {
          const next = Object.assign({}, value)
          next[kind] = !(value[kind] === true)
          writeStored(LS_SECTIONS, next)
          return next
        })
      }

      function toggleGroup(key) {
        setOpenGroups(function (value) {
          const next = Object.assign({}, value)
          next[key] = !(value[key] === true)
          return next
        })
      }

      function toggleFolder(key) {
        setOpenFolders(function (value) {
          const next = Object.assign({}, value)
          next[key] = !(value[key] === true)
          return next
        })
      }

      // 收展状态按组键 + 文件夹 id 存放，递归收集整棵子树。
      function collectFolderKeys(groupKey, folder, out) {
        if (folder === null || typeof folder !== 'object' || typeof folder.id !== 'string') return
        out.push(groupKey + '/' + folder.id)
        const children = Array.isArray(folder.children) ? folder.children : []
        for (let i = 0; i < children.length; i += 1) collectFolderKeys(groupKey, children[i], out)
      }

      function setSectionOpen(kind, open) {
        setSections(function (value) {
          const next = Object.assign({}, value)
          next[kind] = !open
          writeStored(LS_SECTIONS, next)
          return next
        })
      }

      // entries: [{ group, withHead, root? }]；root 存在时只作用于该文件夹子树。
      function applyTreeOpen(open, entries) {
        const folderNext = Object.assign({}, openFolders)
        const groupNext = Object.assign({}, openGroups)
        for (let i = 0; i < entries.length; i += 1) {
          const entry = entries[i]
          if (entry.group === null || entry.group === undefined) continue
          if (entry.withHead === true) groupNext[entry.group.key] = open
          const roots = entry.root !== undefined
            ? [entry.root]
            : (Array.isArray(entry.group.folders) ? entry.group.folders : [])
          for (let j = 0; j < roots.length; j += 1) {
            const keys = []
            collectFolderKeys(entry.group.key, roots[j], keys)
            for (let k = 0; k < keys.length; k += 1) folderNext[keys[k]] = open
          }
        }
        setOpenFolders(folderNext)
        setOpenGroups(groupNext)
      }

      function openTreeMenu(event, target) {
        if (event === null || event === undefined) return
        event.preventDefault()
        event.stopPropagation()
        setTreeMenu({ x: event.clientX, y: event.clientY, target: target })
      }

      function toggleTree(target, open) {
        if (target === null || target === undefined) return
        if (target.kind === 'section') {
          setSectionOpen(target.sectionKind, open)
          applyTreeOpen(open, target.groups.map(function (group) {
            return { group: group, withHead: target.sectionKind !== 'user' }
          }))
        } else if (target.kind === 'group') {
          applyTreeOpen(open, [{ group: target.group, withHead: true }])
        } else if (target.kind === 'folder') {
          applyTreeOpen(open, [{ group: target.group, withHead: false, root: target.folder }])
        }
        setTreeMenu(null)
      }

      function rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
      }

      // 两个浮层不重叠：优先把新面板放到目标面板的下方，其次上方，最后换到另一侧。
      function avoidRect(pos, width, height, avoid) {
        if (avoid === null || avoid === undefined) return pos
        const margin = 8
        if (!rectsOverlap({ x: pos.x, y: pos.y, w: width, h: height }, avoid)) return pos
        const below = avoid.y + avoid.h + margin
        const above = avoid.y - height - margin
        let y = pos.y
        if (below + height <= window.innerHeight - margin) y = below
        else if (above >= margin) y = above
        else y = Math.min(Math.max(margin, pos.y), Math.max(margin, window.innerHeight - height - margin))
        let x = pos.x
        if (rectsOverlap({ x: x, y: y, w: width, h: height }, avoid)) {
          const right = avoid.x + avoid.w + margin
          const left = avoid.x - width - margin
          if (right + width <= window.innerWidth - margin) x = right
          else if (left >= margin) x = left
        }
        return {
          x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin)),
          y: y,
        }
      }

      // 预览跟随面板：面板右侧放得下就贴右侧，否则贴左侧；垂直方向优先与条目上边对齐，
      // 下方空间不足时改为下边对齐，最后再夹进视口，并避开另一个浮层。
      function placePreview(rect, height, avoid) {
        const width = 440
        const margin = 8
        // 嵌入右侧栏时，浮层必须落到侧栏外侧（左边），不能压住侧栏本身。
        const sideHost = embedded ? document.querySelector('.dtn-root.dtn-embedded') : null
        const sideRect = sideHost !== null && sideHost !== undefined && typeof sideHost.getBoundingClientRect === 'function'
          ? sideHost.getBoundingClientRect()
          : null
        const panelRight = sideRect !== null && sideRect !== undefined && sideRect.width > 0
          ? sideRect.left
          : panelPos.x + (collapsed ? 300 : panelWidth)
        const spaceRight = window.innerWidth - panelRight - margin
        const spaceLeft = panelPos.x - margin
        let x
        if (sideRect !== null && sideRect !== undefined && sideRect.width > 0) {
          x = panelRight - width - margin
        } else if (spaceRight >= width) x = panelRight + margin
        else if (spaceLeft >= width) x = panelPos.x - width - margin
        else x = spaceRight >= spaceLeft ? panelRight + margin : panelPos.x - width - margin
        x = Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin))
        // 预览高度按内容量出来；没量到之前先用 440 的估值。
        const previewHeight = typeof height === 'number' && height > 0 ? height : 440
        const previewBottom = window.innerHeight - previewHeight - margin
        let y = panelPos.y
        if (rect !== null && typeof rect === 'object' && typeof rect.top === 'number') {
          y = rect.top
          // 条目下方放不下整块预览时，把预览上移，保证下边缘不出视口。
          if (y + previewHeight > window.innerHeight - margin) y = previewBottom
          // 条目贴着视口底部时，至少保证预览顶部可见。
          if (y < margin) y = margin
        }
        y = Math.min(Math.max(margin, y), Math.max(margin, previewBottom))
        return avoidRect({ x: x, y: y }, width, previewHeight, avoid)
      }

      function batchPanelRect() {
        if (batchCreate === null) return null
        const pos = batchPos || batchCreate.pos
        if (pos === null || pos === undefined) return null
        return { x: pos.x, y: pos.y, w: 440, h: 320 }
      }

      function openPreview(group, todo, rect) {
        // 已经有保留的预览窗时，直接复用它：置顶并脉冲一次，不再新开一个预览。
        if (reusePreviewPin(group, todo)) return
        // 同一条目再次点击时保留已加载的正文，避免预览退回到「加载中」。
        const same = preview !== null && preview.id === todo.id
        setPreview({ id: todo.id, groupKey: group.key, title: todo.title })
        if (!same) {
          setPreviewData(null)
          setPreviewError('')
        }
        previewRect.current = rect
        setPreviewPos(placePreview(rect, undefined, batchPanelRect()))
      }

      // 正文渲染完成后按真实内容高度重新落位，预览高度随内容自适应。
      React.useLayoutEffect(function () {
        if (preview === null) return
        const node = previewRef.current
        if (node === null) return
        const height = node.offsetHeight
        if (height <= 0) return
        const next = placePreview(previewRect.current, height, batchPanelRect())
        setPreviewPos(function (value) {
          return Math.abs(value.x - next.x) < 1 && Math.abs(value.y - next.y) < 1 ? value : next
        })
      }, [previewData, preview])

      function cancelClose() {
        if (closeTimer.current !== null) {
          clearTimeout(closeTimer.current)
          closeTimer.current = null
        }
      }

      function closePreview() {
        cancelClose()
        setPreview(null)
        setPreviewData(null)
        setPreviewError('')
      }

      function scheduleClose() {
        cancelClose()
        closeTimer.current = setTimeout(function () {
          closeTimer.current = null
          setPreview(null)
          setPreviewData(null)
          setPreviewError('')
        }, 260)
      }

      // 悬停 120ms 再打开，避免鼠标划过时连续拉取正文。
      function hoverPreview(group, todo, event) {
        if (event === null || event === undefined || event.currentTarget === null) return
        const rect = event.currentTarget.getBoundingClientRect()
        cancelClose()
        if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
        hoverTimer.current = setTimeout(function () {
          hoverTimer.current = null
          openPreview(group, todo, rect)
        }, 120)
      }

      function leavePreview() {
        if (hoverTimer.current !== null) {
          clearTimeout(hoverTimer.current)
          hoverTimer.current = null
        }
        scheduleClose()
      }

      function toggleCollapsed() {
        setHoverOpen(false)
        const next = collapsed !== true
        setCollapsed(next)
        writeStored(LS_COLLAPSED, next)
      }

      // 面板 → 右侧栏：只打开右侧栏里的 TODO 页签，浮动面板保持原状。
      function showInSidebar() {
        applyMode('sidebar')
        if (typeof props.openSidebar === 'function') props.openSidebar(sessionId)
      }

      // 关闭右侧栏；浮动面板保持原状。
      function showFloating() {
        applyMode('float')
        if (typeof props.closeSidebar === 'function') props.closeSidebar()
      }

      function refresh(quiet) {
        setVersion(function (value) { return value + 1 })
        if (quiet !== true && SYNC_BUS !== null) SYNC_BUS.dispatchEvent(new Event('refresh'))
      }

      function postApi(body) {
        return fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign({ cwd: cwd, session: sessionId }, body)),
        }).then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok || (payload !== null && payload !== undefined && payload.ok === false)) {
              throw new Error(payload !== null && payload !== undefined && payload.error ? payload.error : 'HTTP ' + response.status)
            }
            return payload
          })
        })
      }

      // 在鼠标上方冒出一个提示（减去光标高度，避免挡住指针）：停留 1s，再用 2.5s 淡出。
      // 每条提示独立存在：连续操作会并排出现多个，各自计时消失，不互相顶掉。
      function showBubble(text, event) {
        if (event === null || event === undefined) return
        const x = typeof event.clientX === 'number' ? event.clientX : 0
        const y = (typeof event.clientY === 'number' ? event.clientY : 0) - 40
        bubbleSeq.current += 1
        const id = bubbleSeq.current
        setBubbles(function (list) {
          const next = list.concat([{ id: id, text: text, x: x, y: y }])
          return next.length > 6 ? next.slice(next.length - 6) : next
        })
        const timer = setTimeout(function () {
          bubbleTimers.current = bubbleTimers.current.filter(function (entry) { return entry !== timer })
          setBubbles(function (list) {
            return list.filter(function (entry) { return entry.id !== id })
          })
        }, 3500)
        bubbleTimers.current.push(timer)
      }

      // 标题上限来自插件设置（groups 负载的 config.titleMaxLength），默认 30 个字。
      function titleLimitValue() {
        const config = data !== null && data !== undefined && data.config !== null && data.config !== undefined ? data.config : null
        const limit = config !== null ? Number(config.titleMaxLength) : NaN
        return Number.isFinite(limit) && limit > 0 ? Math.round(limit) : 30
      }

      function clampTitleDraft(draft) {
        const limit = titleLimitValue()
        const chars = Array.from(String(draft === null || draft === undefined ? '' : draft))
        if (chars.length <= limit) return { text: chars.join(''), truncated: false, limit: limit }
        return { text: chars.slice(0, limit).join(''), truncated: true, limit: limit }
      }

      // 拖拽落点：直接给 DOM 加高亮类，不经过 React 状态，避免拖拽过程中整行重渲染造成闪烁。
      function markDropTarget(element) {
        if (dropClearTimer.current !== null) {
          window.clearTimeout(dropClearTimer.current)
          dropClearTimer.current = null
        }
        if (dropTargetEl.current !== null && dropTargetEl.current !== element) {
          dropTargetEl.current.classList.remove('dtn-drop-target')
        }
        dropTargetEl.current = element
        if (element !== null && element !== undefined) element.classList.add('dtn-drop-target')
      }

      function leaveDropTarget(element, event) {
        if (dropTargetEl.current !== element) return
        const related = event !== null && event !== undefined ? event.relatedTarget : null
        if (related !== null && related !== undefined && event.currentTarget !== null && event.currentTarget.contains(related)) return
        if (dropClearTimer.current !== null) window.clearTimeout(dropClearTimer.current)
        dropClearTimer.current = window.setTimeout(function () {
          dropClearTimer.current = null
          clearDropTarget()
        }, 90)
      }

      function clearDropTarget() {
        if (dropClearTimer.current !== null) {
          window.clearTimeout(dropClearTimer.current)
          dropClearTimer.current = null
        }
        if (dropTargetEl.current !== null) dropTargetEl.current.classList.remove('dtn-drop-target')
        dropTargetEl.current = null
      }

      function copyText(text) {
        if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
          return navigator.clipboard.writeText(text)
        }
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        try { document.execCommand('copy') } catch (err) { /* 忽略 */ }
        document.body.removeChild(area)
        return Promise.resolve()
      }

      function groupCopyText(group) {
        if (group === null || typeof group !== 'object') return ''
        const owner = group.owner !== null && typeof group.owner === 'object' ? group.owner : {}
        if (group.kind === 'session') {
          const id = typeof owner.sessionId === 'string' && owner.sessionId !== '' ? owner.sessionId : String(group.key || '').slice('session:'.length)
          return 'session-' + id
        }
        if (group.kind === 'workspace') {
          if (typeof owner.cwd === 'string' && owner.cwd !== '') return owner.cwd
          if (typeof group.subtitle === 'string' && group.subtitle !== '') return group.subtitle
        }
        return ''
      }

      function copyGroup(group, event, message) {
        const text = groupCopyText(group)
        if (text === '') return
        copyText(text).then(function () { showBubble(message, event) }).catch(function () {}) 
      }

      function dragData(event) {
        if (event === null || event === undefined || event.dataTransfer === undefined) return null
        try {
          return JSON.parse(event.dataTransfer.getData('text/plain') || 'null')
        } catch (err) {
          return null
        }
      }

      function setDragData(event, payload) {
        if (event === null || event === undefined || event.dataTransfer === undefined) return
        event.dataTransfer.setData('text/plain', JSON.stringify(payload))
        event.dataTransfer.effectAllowed = 'move'
      }

      function onTodoDragStart(event, group, todo, folderId) {
        dragPayloadKey.current = group.key
        const folder = typeof folderId === 'string' && folderId !== '' ? folderId : (typeof todo.primaryFolder === 'string' && todo.primaryFolder !== '' ? todo.primaryFolder : PRIMARY)
        setDragData(event, { kind: 'todo', key: group.key, id: todo.id, folder: folder, priority: typeof todo.priority === 'number' ? todo.priority : 1 })
      }

      function onTodoDrop(event, group, target, folderId) {
        if (event !== null && event.preventDefault !== undefined) event.preventDefault()
        const payload = dragData(event)
        dragPayloadKey.current = ''
        if (payload === null || payload.kind !== 'todo' || payload.key !== group.key || payload.id === target.id) return
        const next = Math.max(0, Math.min(9, typeof target.priority === 'number' ? target.priority : 1))
        const folder = typeof folderId === 'string' && folderId !== '' ? folderId : (typeof target.primaryFolder === 'string' && target.primaryFolder !== '' ? target.primaryFolder : PRIMARY)
        const fromFolder = typeof payload.folder === 'string' && payload.folder !== '' ? payload.folder : PRIMARY
        // 只有同一文件夹内的移动才同化优先级；跨文件夹只移动、不改优先级。
        const changed = fromFolder === folder && (payload.priority === undefined || payload.priority !== next)
        const flash = group.key + ':' + payload.id + ':' + folder
        // 同一文件夹内只是重排，不改归属；跨文件夹才真正移动。
        const move = fromFolder === folder ? Promise.resolve(null) : postApi({ action: 'moveTodo', key: group.key, id: payload.id, folder: folder })
        move
          .then(function () { return postApi({ action: 'reorder', key: group.key, id: payload.id, folder: folder, beforeId: target.id }) })
          .then(function () { return fromFolder === folder ? postApi({ action: 'priority', key: group.key, id: payload.id, priority: next }) : null })
          .then(function () {
            animatePendingRef.current = true
            setFlashKey(flash)
            setTimeout(function () { setFlashKey('') }, 400)
            if (changed) showBubble('已调整优先级为T' + next, event)
            refresh()
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      function onFolderDragStart(event, group, folder) {
        dragPayloadKey.current = group.key
        setDragData(event, { kind: 'folder', key: group.key, id: folder.id })
      }

      // 从树里摘掉一个文件夹节点，返回该节点。
      function detachFolder(nodes, id) {
        for (let i = 0; i < nodes.length; i += 1) {
          if (nodes[i] !== null && typeof nodes[i] === 'object' && nodes[i].id === id) return nodes.splice(i, 1)[0]
          const children = nodes[i] !== null && typeof nodes[i] === 'object' && Array.isArray(nodes[i].children) ? nodes[i].children : null
          if (children !== null) {
            const found = detachFolder(children, id)
            if (found !== null) return found
          }
        }
        return null
      }

      function folderContains(folder, id) {
        if (folder === null || typeof folder !== 'object') return false
        if (folder.id === id) return true
        const children = Array.isArray(folder.children) ? folder.children : []
        for (let i = 0; i < children.length; i += 1) if (folderContains(children[i], id)) return true
        return false
      }

      function findFolder(nodes, id) {
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i]
          if (node !== null && typeof node === 'object' && node.id === id) return node
          const children = node !== null && typeof node === 'object' && Array.isArray(node.children) ? node.children : null
          if (children !== null) {
            const found = findFolder(children, id)
            if (found !== null) return found
          }
        }
        return null
      }

      // 把 moved 插到 target 节点之后（同级）。
      function insertAfterFolder(nodes, targetId, moved) {
        for (let i = 0; i < nodes.length; i += 1) {
          if (nodes[i] !== null && typeof nodes[i] === 'object' && nodes[i].id === targetId) {
            nodes.splice(i + 1, 0, moved)
            return true
          }
          const children = nodes[i] !== null && typeof nodes[i] === 'object' && Array.isArray(nodes[i].children) ? nodes[i].children : null
          if (children !== null && insertAfterFolder(children, targetId, moved)) return true
        }
        return false
      }
