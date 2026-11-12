
    function TodoNotes(props) {
      const currentSummary = props.useSessions(function (store) {
        if (store === undefined || store === null) return undefined
        const byId = store.byId
        if (byId === undefined || byId === null) return undefined
        const keys = Object.keys(byId)
        for (let i = 0; i < keys.length; i += 1) {
          const row = byId[keys[i]]
          if (row !== null && typeof row === 'object' && ((row.retainedBy || {}).mainView || 0) > 0) return row
        }
        return undefined
      })
      const cwd = currentSummary !== undefined && currentSummary !== null && typeof currentSummary.cwd === 'string' ? currentSummary.cwd : ''
      const sessionId = currentSummary !== undefined && currentSummary !== null && typeof currentSummary.id === 'string' ? currentSummary.id : ''
      const sessionTitle = currentSummary !== undefined && currentSummary !== null && typeof currentSummary.title === 'string' ? currentSummary.title : ''

      // 浮动面板与右侧栏两个实例共享同一个渲染体：embedded=true 时塞进右侧栏页签。
      const embedded = props.embedded === true
      const [mode, setMode] = React.useState(function () {
        return readStored(LS_MODE, 'float') === 'sidebar' ? 'sidebar' : 'float'
      })
      function applyMode(next) {
        writeStored(LS_MODE, next)
        setMode(next)
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('todo-notes-mode'))
      }
      React.useEffect(function () {
        const onMode = function () { setMode(readStored(LS_MODE, 'float') === 'sidebar' ? 'sidebar' : 'float') }
        if (typeof window !== 'undefined') window.addEventListener('todo-notes-mode', onMode)
        return function () { if (typeof window !== 'undefined') window.removeEventListener('todo-notes-mode', onMode) }
      }, [])
      // 另一侧写入成功后广播 refresh，本实例立刻重拉，不等轮询。
      React.useEffect(function () {
        if (SYNC_BUS === null) return undefined
        const onSync = function () { refresh(true) }
        SYNC_BUS.addEventListener('refresh', onSync)
        return function () { SYNC_BUS.removeEventListener('refresh', onSync) }
      }, [])
      // 标题改名在另一侧发生时，本实例也立刻更新行标题与临时预览，不等轮询。
      React.useEffect(function () {
        if (SYNC_BUS === null) return undefined
        const onTitle = function (event) {
          const detail = event !== null && event !== undefined ? event.detail : null
          if (detail === null || detail === undefined || typeof detail.title !== 'string') return
          patchBoardTitle(detail.groupKey, detail.todoId, detail.title)
          setPreviewData(function (current) {
            if (current === null || current === undefined || current.id !== detail.todoId) return current
            return Object.assign({}, current, { title: detail.title })
          })
        }
        SYNC_BUS.addEventListener('todo-title', onTitle)
        return function () { SYNC_BUS.removeEventListener('todo-title', onTitle) }
      }, [])

      const maxPanelWidth = function () {
        const view = typeof window === 'undefined' ? 1440 : window.innerWidth
        return Math.max(MIN_PANEL_WIDTH, Math.min(720, view - 24))
      }
      const [panelWidth, setPanelWidth] = React.useState(function () {
        const stored = Number(readStored(LS_WIDTH, 0))
        if (!Number.isFinite(stored) || stored < MIN_PANEL_WIDTH) return 480
        return Math.max(MIN_PANEL_WIDTH, Math.min(stored, maxPanelWidth()))
      })
      // null 表示高度随内容自适应；用户拖动右下角后固定为像素高度。
      const [panelHeight, setPanelHeight] = React.useState(function () {
        const stored = Number(readStored(LS_HEIGHT, 0))
        return Number.isFinite(stored) && stored >= 160 ? stored : null
      })
      const storedPanel = React.useState(function () { return clampPos(readStored(LS_PANEL, defaultPanelPos()), panelWidth, 200, 56) })[0]
      const [panelPos, setPanelPos] = React.useState(storedPanel)
      const [collapsed, setCollapsed] = React.useState(function () { return readStored(LS_COLLAPSED, false) === true })
      // 收起状态下的悬停临展：只影响显示，不写入持久状态，点击收展仍按 collapsed 走。
      const [hoverOpen, setHoverOpen] = React.useState(false)
      const [resizing, setResizing] = React.useState(false)
      const [dragging, setDragging] = React.useState(false)
      const viewportSizeRef = React.useRef(
        typeof window === 'undefined' ? { w: 1200, h: 800 } : { w: window.innerWidth, h: window.innerHeight },
      )
      const panelRef = React.useRef(null)
      const layerRef = React.useRef(null)
      const [sections, setSections] = React.useState(function () {
        const stored = readStored(LS_SECTIONS, null)
        return stored !== null && typeof stored === 'object' ? stored : { user: false, workspace: false, session: false }
      })
      const [data, setData] = React.useState(null)
      const animationsOff =
        data !== null &&
        data !== undefined &&
        data.config !== null &&
        data.config !== undefined &&
        data.config.enableAnimations === false
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        document.documentElement.classList.toggle('dtn-anim-off', animationsOff)
        return function () { document.documentElement.classList.remove('dtn-anim-off') }
      }, [animationsOff])
      const [error, setError] = React.useState('')
      const [openGroups, setOpenGroups] = React.useState({})
      const [openFolders, setOpenFolders] = React.useState({})
      const [treeMenu, setTreeMenu] = React.useState(null)
      const [selection, setSelection] = React.useState([])
      const selectionRef = React.useRef([])
      const selectAnchorRef = React.useRef('')
      const marqueeMovedRef = React.useRef(false)
      const [marquee, setMarquee] = React.useState(null)
      const [batchMenu, setBatchMenu] = React.useState(null)
      const [batchRename, setBatchRename] = React.useState(null)
      React.useEffect(function () { selectionRef.current = selection }, [selection])
      // 窗口尺寸变化后，浮动面板按原位置在视口内的比例重新落位。
      React.useEffect(function () {
        const onResize = function () {
          const prev = viewportSizeRef.current
          const next = { w: window.innerWidth, h: window.innerHeight }
          viewportSizeRef.current = next
          if (prev.w <= 0 || prev.h <= 0) return
          setPanelPos(function (pos) {
            const moved = {
              x: Math.round((pos.x * next.w) / prev.w),
              y: Math.round((pos.y * next.h) / prev.h),
            }
            return clampPos(moved, panelWidth, 200, 56)
          })
        }
        window.addEventListener('resize', onResize)
        return function () { window.removeEventListener('resize', onResize) }
      }, [panelWidth])
      // 拖动手柄的按下标记只在本次指针交互内有效，避免残留后从条目其它位置误触发拖动。
      React.useEffect(function () {
        const clear = function () { dragArmedRef.current = false }
        window.addEventListener('pointerup', clear)
        window.addEventListener('pointercancel', clear)
        return function () {
          window.removeEventListener('pointerup', clear)
          window.removeEventListener('pointercancel', clear)
        }
      }, [])
      const [preview, setPreview] = React.useState(null)
      const [previewData, setPreviewData] = React.useState(null)
      const [previewError, setPreviewError] = React.useState('')
      const [previewPos, setPreviewPos] = React.useState(function () {
        return clampPos(readStored(LS_PREVIEW, defaultPreviewPos(storedPanel)), 440, 200)
      })
      // 被拖动后保留下来的浮窗（预览 / 批量新建 / 批量重命名），窗口互相独立并持久化。
      const [pinned, setPinned] = React.useState(function () {
        return sanitizePinnedWindows(readStored(LS_WINDOWS, []))
      })
      const [pulsePin, setPulsePin] = React.useState('')
      const [pulsePanel, setPulsePanel] = React.useState(false)
      const [focusPin, setFocusPin] = React.useState('')
      const [hoverPin, setHoverPin] = React.useState('')
      const pinDragMoved = React.useRef(false)

      // 焦点层级统一交给窗口壳管理；这里只把“新建/复用某个窗”转成一次焦点事件。
      React.useEffect(function () {
        if (focusPin !== '') focusWindowFrame(focusPin)
      }, [focusPin])
      const pinnedRef = React.useRef(pinned)
      const pinSeq = React.useRef(0)
      const pinSaveTimers = React.useRef({})
      const pinTitleTimers = React.useRef({})
      const pinGutterRefs = React.useRef({})
      const pinFetchStarted = React.useRef({})
      const windowsLoadedRef = React.useRef(false)
      React.useEffect(function () {
        pinnedRef.current = pinned
        writeStored(LS_WINDOWS, pinned)
      }, [pinned])
      // 设置页里的外观（色板、透明度）变化后立即生效。
      React.useEffect(function () {
        const ui = data !== null && data !== undefined && data.ui !== null && data.ui !== undefined ? data.ui : {}
        applyPriorityPalette(ui.priorityPalette)
      }, [data])
      // 面板里的勾选、优先级、文件夹变更刷新数据后，同步更新已保留预览窗的信息区。
      React.useEffect(function () {
        if (data === null || data === undefined) return
        setPinned(function (list) {
          let changed = false
          const next = list.map(function (win) {
            if (win.kind !== 'preview') return win
            const group = findLiveGroup(win.groupKey)
            if (group === null || group === undefined) return win
            const todo = (group.todos || []).find(function (item) { return item.id === win.todoId })
            if (todo === undefined) return win
            const meta = {
              status: todo.status,
              priority: todo.priority,
              source: todo.source,
              primaryFolder: todo.primaryFolder,
              created: todo.created,
            }
            if (JSON.stringify(meta) === JSON.stringify(win.meta) && todo.title === win.title) return win
            changed = true
            return Object.assign({}, win, { title: todo.title, meta: meta })
          })
          return changed ? next : list
        })
      }, [data])
      React.useEffect(function () {
        return function () {
          const keys = Object.keys(pinSaveTimers.current)
          for (let i = 0; i < keys.length; i += 1) window.clearTimeout(pinSaveTimers.current[keys[i]])
          pinSaveTimers.current = {}
        }
      }, [])
      // 浏览器 localStorage 按端口隔离，DSH 重启端口可能变化；窗口数据落到插件数据目录。
      React.useEffect(function () {
        if (embedded === true) return undefined
        if (typeof fetch !== 'function') {
          windowsLoadedRef.current = true
          return undefined
        }
        let alive = true
        fetch(ROUTE + '?what=windows&ts=' + Date.now(), { cache: 'no-store', headers: { accept: 'application/json' } })
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.json()
          })
          .then(function (payload) {
            if (!alive) return
            const server = payload !== null && payload !== undefined && Array.isArray(payload.windows)
              ? sanitizePinnedWindows(payload.windows)
              : []
            windowsLoadedRef.current = true
            if (server.length > 0) {
              setPinned(server)
              return
            }
            // 服务端还没有记录时，用本机 localStorage 的记录做一次迁移。
            if (pinnedRef.current.length > 0) {
              fetch(ROUTE, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'saveWindows', windows: serializePinnedWindows(pinnedRef.current) }),
              }).catch(function () {})
            }
          })
          .catch(function () {
            windowsLoadedRef.current = true
          })
        return function () { alive = false }
      }, [])
      // 右侧栏实例新建的浮窗转交给浮动面板实例渲染，避免两份相同窗口。
      React.useEffect(function () {
        if (embedded === true || SYNC_BUS === null) return undefined
        const onPin = function (event) {
          const win = event !== null && event !== undefined ? event.detail : null
          if (win === null || win === undefined || typeof win.id !== 'string') return
          setPinned(function (list) {
            if (list.some(function (item) { return item.id === win.id })) return list
            return list.concat([win])
          })
          setFocusPin(win.id)
        }
        SYNC_BUS.addEventListener('pin-open', onPin)
        return function () { SYNC_BUS.removeEventListener('pin-open', onPin) }
      }, [])
      React.useEffect(function () {
        if (embedded === true) return undefined
        if (windowsLoadedRef.current !== true) return undefined
        const timer = window.setTimeout(function () {
          fetch(ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'saveWindows', windows: serializePinnedWindows(pinned) }),
          }).catch(function () {})
        }, 500)
        return function () { window.clearTimeout(timer) }
      }, [pinned])
      React.useEffect(function () {
        if (typeof fetch !== 'function') return
        const pending = pinned.filter(function (item) { return item.kind === 'preview' && item.loaded !== true })
        pending.forEach(function (item) {
          if (pinFetchStarted.current[item.id] === true) return
          pinFetchStarted.current[item.id] = true
          fetch(ROUTE + '?what=todo&id=' + encodeURIComponent(item.todoId) + '&cwd=' + encodeURIComponent(cwd) + '&session=' + encodeURIComponent(sessionId) + '&ts=' + Date.now(), {
            cache: 'no-store',
            headers: { accept: 'application/json' },
          })
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status)
              return response.json()
            })
            .then(function (payload) {
              setPinned(function (list) {
                return list.map(function (win) {
                  if (win.id !== item.id) return win
                  return Object.assign({}, win, {
                    loaded: true,
                    loading: false,
                    title: typeof payload.title === 'string' ? payload.title : win.title,
                    markdown: typeof payload.markdown === 'string' ? payload.markdown : '',
                    draft: win.draft !== '' ? win.draft : (typeof payload.markdown === 'string' ? payload.markdown : ''),
                    meta: {
                      status: payload.status,
                      priority: payload.priority,
                      source: payload.source,
                      primaryFolder: payload.primaryFolder,
                      created: payload.created,
                    },
                  })
                })
              })
            })
            .catch(function (failure) {
              setPinned(function (list) {
                return list.map(function (win) {
                  return win.id === item.id ? Object.assign({}, win, { loaded: true, loading: false, error: String(failure && failure.message ? failure.message : failure) }) : win
                })
              })
            })
        })
      }, [pinned])
      const dragMoved = React.useRef(false)
      const [bubbles, setBubbles] = React.useState([])
      const bubbleSeq = React.useRef(0)
      const bubbleTimers = React.useRef([])
      const [version, setVersion] = React.useState(0)
      const [flashKey, setFlashKey] = React.useState('')
      const [dropKey, setDropKey] = React.useState('')
      const dropClearTimer = React.useRef(null)
      const [editingFolder, setEditingFolder] = React.useState(null)
      const [folderMenu, setFolderMenu] = React.useState(null)
      const [confirmDialog, setConfirmDialog] = React.useState(null)
      const confirmResolveRef = React.useRef(null)
      const [editingTodo, setEditingTodo] = React.useState(null)
      const [todoMenu, setTodoMenu] = React.useState(null)
      const [prioMenu, setPrioMenu] = React.useState(null)
      const [subOpen, setSubOpen] = React.useState('')
      const [batchCreate, setBatchCreate] = React.useState(null)
      const [batchPos, setBatchPos] = React.useState(null)
      const hoverTimer = React.useRef(null)
      const closeTimer = React.useRef(null)
      const folderClickTimer = React.useRef(null)
      const checkClickTimer = React.useRef(null)
      const dragPayloadKey = React.useRef('')
      const dragArmedRef = React.useRef(false)
      const previewRect = React.useRef(null)
      const previewRef = React.useRef(null)
      const batchGutterRef = React.useRef(null)
      const renameGutterRef = React.useRef(null)
      const rowRectsRef = React.useRef({})
      const animateOrderRef = React.useRef(false)
      const animatePendingRef = React.useRef(false)

      // 排序动画（FLIP）：只在「主观排序」后触发（拖动完成、改优先级），
      // 滚动、缩放窗口等被动重排只更新基准位置，不播放位移动画。
      React.useLayoutEffect(function () {
        const animate = animateOrderRef.current
        animateOrderRef.current = false
        const nodes = document.querySelectorAll('.dtn-root [data-todo-id]')
        const next = {}
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i]
          const id = node.getAttribute('data-todo-id')
          if (id === null || id === '') continue
          next[id] = node.getBoundingClientRect().top
        }
        if (animate) {
          const prev = rowRectsRef.current
          for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i]
            const id = node.getAttribute('data-todo-id')
            if (id === null || id === '' || typeof prev[id] !== 'number') continue
            const delta = prev[id] - next[id]
            if (Math.abs(delta) < 1) continue
            node.style.transition = 'none'
            node.style.transform = 'translateY(' + delta + 'px)'
            const moved = node
            window.requestAnimationFrame(function () {
              moved.style.transition = 'transform 180ms ease'
              moved.style.transform = 'translateY(0)'
            })
          }
        }
        rowRectsRef.current = next
      })

      React.useEffect(function () {
        return function () {
          if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
          if (closeTimer.current !== null) clearTimeout(closeTimer.current)
          for (let i = 0; i < bubbleTimers.current.length; i += 1) clearTimeout(bubbleTimers.current[i])
          bubbleTimers.current = []
          if (folderClickTimer.current !== null) clearTimeout(folderClickTimer.current)
          if (checkClickTimer.current !== null) clearTimeout(checkClickTimer.current)
        }
      }, [])

      const sessionRows = props.useSessions(function (store) {
        return store === undefined || store === null || store.byId === undefined || store.byId === null ? {} : store.byId
      })
      // 同一工作区下的全部会话：会话级区域要按真实会话列组，而不是只列已有便签目录的会话。
      const sessionList = React.useMemo(function () {
        const keys = Object.keys(sessionRows)
        const rows = []
        for (let i = 0; i < keys.length; i += 1) {
          const row = sessionRows[keys[i]]
          if (row === null || typeof row !== 'object') continue
          if (typeof row.cwd !== 'string' || row.cwd !== cwd) continue
          if (typeof row.id !== 'string' || row.id === '') continue
          rows.push({ id: row.id, title: typeof row.title === 'string' ? row.title : '' })
        }
        return rows
      }, [sessionRows, cwd])

      const query = 'what=groups&cwd=' + encodeURIComponent(cwd) + '&session=' + encodeURIComponent(sessionId) + '&sessionTitle=' + encodeURIComponent(sessionTitle) + '&sessions=' + encodeURIComponent(JSON.stringify(sessionList)) + '&v=' + version

      // 窗口尺寸变化时重新夹紧面板与预览的位置，避免越界后拖不回来。
      React.useEffect(function () {
        const currentWidth = function () { return collapsed ? 300 : panelWidth }
        setPanelPos(function (value) { return clampPos(value, currentWidth(), 200, 56) })
        const onResize = function () {
          setPanelWidth(function (value) { return Math.max(MIN_PANEL_WIDTH, Math.min(value, maxPanelWidth())) })
          setPanelPos(function (value) { return clampPos(value, currentWidth(), 200, 56) })
          setPreviewPos(function (value) { return clampPos(value, 440, 200) })
        }
        window.addEventListener('resize', onResize)
        return function () { window.removeEventListener('resize', onResize) }
      }, [collapsed, panelWidth])

      // 浮动实例把整组浮层放进 popover 顶层，避免被其它页面的侧边栏盖住。
      React.useEffect(function () {
        const el = layerRef.current
        if (embedded || el === null || typeof el.showPopover !== 'function') return
        try {
          if (!el.matches(':popover-open')) el.showPopover()
        } catch (error) {}
      }, [embedded])

      // 拖拽只在源便签组内有效：鼠标移到其它组或面板外时，光标直接显示禁止。
      React.useEffect(function () {
        const onDragOver = function (event) {
          if (dragPayloadKey.current === '') return
          const target = event.target
          // 层级标题不在任何便签组里，但用户级标题是合法的落点，不能把 dropEffect 设为 none。
          const sectionEl = target !== null && target.closest !== undefined ? target.closest('.dtn-sec-head') : null
          if (sectionEl !== null) {
            if (event.dataTransfer !== null && event.dataTransfer !== undefined) event.dataTransfer.dropEffect = 'move'
            return
          }
          const groupEl = target !== null && target.closest !== undefined ? target.closest('[data-dtn-group]') : null
          if (groupEl === null || groupEl.getAttribute('data-dtn-group') !== dragPayloadKey.current) {
            if (event.dataTransfer !== null && event.dataTransfer !== undefined) event.dataTransfer.dropEffect = 'none'
          }
        }
        window.addEventListener('dragover', onDragOver, true)
        return function () { window.removeEventListener('dragover', onDragOver, true) }
      }, [])

      React.useEffect(function () {
        if (typeof fetch !== 'function') return undefined
        let alive = true
        const tick = function () {
          fetch(ROUTE + '?' + query + '&ts=' + Date.now(), { cache: 'no-store', headers: { accept: 'application/json' } })
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status)
              return response.json()
            })
            .then(function (payload) {
              if (!alive) return
              // 只有主观排序（拖动、改优先级）后的下一次数据刷新才播放位移动画；
              // 标记必须等到真正的新数据落地时才消费，否则会被中间渲染提前清掉。
              if (animatePendingRef.current) {
                animatePendingRef.current = false
                animateOrderRef.current = true
              }
              setData(payload)
              setError('')
            })
            .catch(function (failure) {
              if (!alive) return
              setError(String(failure && failure.message ? failure.message : failure))
            })
        }
        tick()
        const timer = window.setInterval(tick, 4000)
        return function () {
          alive = false
          window.clearInterval(timer)
        }
      }, [query])

      // 切换会话 / 工作区时：只展开当前组，收起其他组。
      const currentKey = React.useMemo(function () {
        if (data === null) return ''
        const parts = []
        const userGroup = data.user
        if (userGroup !== null && userGroup !== undefined) parts.push('user')
        for (let i = 0; i < (data.workspaces || []).length; i += 1) {
          const group = data.workspaces[i]
          if (group.current === true) parts.push(group.key)
        }
        for (let i = 0; i < (data.sessions || []).length; i += 1) {
          const group = data.sessions[i]
          if (group.current === true) parts.push(group.key)
        }
        return parts.join('|')
      }, [data])

      React.useEffect(function () {
        if (currentKey === '') return
        const next = {}
        const groups = data === null ? [] : [data.user].concat(data.workspaces || []).concat(data.sessions || [])
        for (let i = 0; i < groups.length; i += 1) {
          const group = groups[i]
          if (group === null || group === undefined || typeof group.key !== 'string') continue
          next[group.key] = group.current === true
        }
        setOpenGroups(next)
      }, [currentKey])

      React.useEffect(function () {
        if (preview === null || typeof preview.id !== 'string') return undefined
        let alive = true
        setPreviewData(null)
        setPreviewError('')
        fetch(ROUTE + '?what=todo&id=' + encodeURIComponent(preview.id) + '&cwd=' + encodeURIComponent(cwd) + '&session=' + encodeURIComponent(sessionId) + '&ts=' + Date.now(), {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        })
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.json()
          })
          .then(function (payload) {
            if (alive) setPreviewData(payload)
          })
          .catch(function (failure) {
            if (alive) setPreviewError(String(failure && failure.message ? failure.message : failure))
          })
        return function () {
          alive = false
        }
      }, [preview === null ? '' : preview.id])

      // 收起与展开共用同一个横向中心：收起后的左边缘由中心减去半宽得出。