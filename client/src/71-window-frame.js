    // 共用窗口壳：主面板与保留浮窗共用同一套头部拖拽、点击收展、悬停临时展开、
    // 四边缩放与收展过渡，避免两边各写一份行为。
    function WindowFrame(props) {
      const collapsed = props.collapsed === true && props.expanded !== true
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
      return h(
        'div',
        {
          ref: props.rootRef,
          className: props.className + (collapsed ? ' dtn-collapsed' : ''),
          style: props.style,
          onPointerDown: props.onFocus,
          onMouseEnter: props.onHoverEnter,
          onMouseLeave: props.onHoverLeave,
        },
        head,
        body,
        handles,
      )
    }
