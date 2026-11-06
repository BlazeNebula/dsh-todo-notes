    // ------------------------------------------------------------ 插件入口

    function injectStyles() {
      const style = document.createElement('style')
      style.setAttribute('data-dsh-todo-notes', '')
      style.textContent = CSS
      document.head.appendChild(style)
      return function () {
        style.remove()
      }
    }

    exports.name = 'dsh-todo-notes'
    exports.inject = ['slots']
    exports.apply = function apply(ctx) {
      ctx.effect(function () { return injectStyles() }, 'dsh-todo-notes: styles')

      const host = {
        openSidebar: function (sessionId) {
          try {
            if (ctx.layout !== undefined && ctx.layout !== null && typeof ctx.layout.openRightbar === 'function') ctx.layout.openRightbar(true, false)
          } catch (error) { /* 右侧栏打开失败不阻断浮动面板 */ }
          try {
            const service = typeof ctx.get === 'function' ? ctx.get('sidebarRight') : ctx.sidebarRight
            if (service !== undefined && service !== null && typeof service.openTabIn === 'function' && typeof sessionId === 'string' && sessionId !== '') {
              service.openTabIn(sessionId, 'todo-notes', {})
            }
          } catch (error) { /* 页签打不开时保持面板收起，用户可点左上角恢复 */ }
        },
        closeSidebar: function () {
          try {
            if (ctx.layout !== undefined && ctx.layout !== null && typeof ctx.layout.closeRightbar === 'function') ctx.layout.closeRightbar()
          } catch (error) { /* 忽略 */ }
        },
        openSession: function (sessionId) {
          if (typeof sessionId !== 'string' || sessionId === '') return false
          try {
            const service = typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : ctx.uiWorkspace
            if (service !== undefined && service !== null && typeof service.openSession === 'function') {
              service.openSession(sessionId)
              return true
            }
          } catch (error) { /* 导航失败时退回提示 */ }
          return false
        },
      }
      function wrap(extra) {
        return function Wrapped(props) {
          return h(TodoNotes, Object.assign({}, props, extra))
        }
      }

      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register(
          { name: 'shell.overlay', id: 'todo-notes', order: 45, label: 'TODO 便签' },
          wrap(host),
        )
      })
      ctx.slots.inject('sidebar.right.pane.tab', function () {
        return ctx.slots.register(
          { name: 'sidebar.right.pane.tab', key: 'todo-notes' },
          wrap(Object.assign({ embedded: true }, host)),
        )
      })

      const registerTabs = function (tabs) {
        if (tabs === undefined || tabs === null || typeof tabs.register !== 'function') return
        ctx.effect(function () {
          return tabs.register({
            id: 'todo-notes',
            kind: 'todo-notes',
            priority: 'builtin',
            keepMounted: true,
            title: function () { return 'TODO 便签' },
            canOpen: function (address) { return address === 'todo-notes://panel' },
          })
        }, 'dsh-todo-notes: right sidebar tab type')
      }
      const tabsNow = typeof ctx.get === 'function' ? ctx.get('sidebarRightTabs') : ctx.sidebarRightTabs
      if (tabsNow !== undefined && tabsNow !== null) registerTabs(tabsNow)
      else if (typeof ctx.inject === 'function') {
        ctx.inject(['sidebarRightTabs'], function (child) {
          const tabs = typeof child.get === 'function' ? child.get('sidebarRightTabs') : child.sidebarRightTabs
          registerTabs(tabs)
        })
      }
    }

    return module.exports
  },
})