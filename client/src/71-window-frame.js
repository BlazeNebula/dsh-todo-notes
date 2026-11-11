    // 共用窗口壳：主面板与保留浮窗共用同一套头部拖拽、点击收展、悬停临时展开、
    // 四边缩放、收展过渡与“被交互就置顶”的焦点层级。
    const WINDOW_FOCUS_EVENT = 'dtn-window-focus'
    let activeWindowKey = 'main'

    function focusWindowFrame(key) {
      activeWindowKey = key
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent(WINDOW_FOCUS_EVENT, { detail: key }))
      }
    }

    function WindowFrame(props) {
      const collapsed = props.collapsed === true && props.expanded !== true
      const [focused, setFocused] = React.useState(activeWindowKey === props.windowKey)
      React.useEffect(function () {
        if (typeof window === 'undefined') return undefined
        const onFocus = function (event) {
          setFocused(event.detail === props.windowKey)
        }
        window.addEventListener(WINDOW_FOCUS_EVENT, onFocus)
        return function () { window.removeEventListener(WINDOW_FOCUS_EVENT, onFocus) }
      }, [props.windowKey])
      const head = h(
        'div',
        {
          className: (props.headClassName || 'dtn-head') + ' dtn-window-head',
          onPointerDown: props.onDragStart,
          onClick: props.onHeadClick,
        },
        props.head,
      )
      const body = h(
        'div',
        { className: 'dtn-body-wrap' + (props.bodyWrapClassName ? ' ' + props.bodyWrapClassName : '') },
        h(
          'div',
          {
            className: (props.bodyClassName || 'dtn-body') + ' dtn-window-body',
            onPointerDown: props.onBodyPointerDown,
          },
          props.children,
        ),
      )
      const handles = collapsed || props.resizeDirs === null || props.resizeDirs === undefined
        ? null
        : props.resizeDirs.map(function (dir) {
            return h('div', {
              key: 'resize-' + dir,
              className: 'dtn-resize dtn-resize-' + dir,
              title: dir === 'br' ? '拖动调整大小' : dir === 'l' || dir === 'r' ? '拖动调整宽度' : '拖动调整高度',
              onPointerDown: function (event) { props.onResize(event, dir) },
            })
          })
      const style = Object.assign({}, props.style, {
        zIndex: focused
          ? props.zIndexActive !== undefined ? props.zIndexActive : 2147482512
          : props.zIndex !== undefined ? props.zIndex : 2147482510,
      })
      return h(
        'div',
        {
          ref: props.rootRef,
          'data-dtn-pin': props.pinId,
          className: props.className + (collapsed ? ' dtn-collapsed' : '') + (focused ? ' dtn-window-focused' : ''),
          style: style,
          onPointerDown: function (event) {
            activeWindowKey = props.windowKey
            if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
              window.dispatchEvent(new CustomEvent(WINDOW_FOCUS_EVENT, { detail: props.windowKey }))
            }
            if (props.onFocus !== undefined) props.onFocus(event)
          },
          onMouseEnter: props.onHoverEnter,
          onMouseLeave: props.onHoverLeave,
        },
        head,
        body,
        handles,
      )
    }
