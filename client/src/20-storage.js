    // ------------------------------------------------------------ 工具函数

    function readStored(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key)
        if (raw === null) return fallback
        return JSON.parse(raw)
      } catch (error) {
        return fallback
      }
    }

    function writeStored(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch (error) {
        /* 忽略存储失败 */
      }
    }

    function defaultPanelPos() {
      const width = typeof window === 'undefined' ? 1440 : window.innerWidth
      return { x: Math.max(12, width - 504), y: 64 }
    }

    function defaultPreviewPos(panelPos) {
      return { x: Math.max(12, panelPos.x - 460), y: panelPos.y }
    }

    function clampPos(pos, width, height, minY) {
      const viewWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
      const viewHeight = typeof window === 'undefined' ? 900 : window.innerHeight
      // 面板不能被拖到 DSH 窗口标题块上，因此面板的最小 top 比预览更大。
      const top = typeof minY === 'number' ? minY : 8
      return {
        x: Math.min(Math.max(8, pos.x), Math.max(8, viewWidth - width - 8)),
        y: Math.min(Math.max(top, pos.y), Math.max(top, viewHeight - height - 8)),
      }
    }

    // 简易 markdown 渲染：标题、列表、引用、代码块、分隔线、行内样式。