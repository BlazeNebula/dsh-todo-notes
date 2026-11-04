/**
 * dsh-todo-notes —— 浏览器半。
 *
 * 三区浮动便签面板：用户级 / 工作区级 / 会话级。
 * 首版只读：展示分组、文件夹结构、条目摘要，点击条目在侧边打开 markdown 预览。
 */
window.__ModuleLoader__.load({
  id: 'dsh-todo-notes',
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    'use strict'

    const React = require('react')
    const h = React.createElement

    const ROUTE = '/dsh-todo-notes/api'
    const PRIMARY = '__primary__'
    const LS_PANEL = 'dsh.todo-notes.panel.pos.v1'
    const LS_PREVIEW = 'dsh.todo-notes.preview.pos.v1'
    const LS_COLLAPSED = 'dsh.todo-notes.collapsed.v1'
    const LS_SECTIONS = 'dsh.todo-notes.sections.v1'
    const LS_WIDTH = 'dsh.todo-notes.panel.width.v1'
    const LS_HEIGHT = 'dsh.todo-notes.panel.height.v1'
    const LS_MODE = 'dsh.todo-notes.mode.v1'
    // 浮动面板与右侧栏两个实例之间的同步信号：任一侧写入成功后广播一次。
    const SYNC_BUS = typeof EventTarget === 'function' ? new EventTarget() : null
    // 面板最窄与 DSH 侧边栏一致（264），收起时也用这个宽度。
    const MIN_PANEL_WIDTH = 264

    const CSS = `
.dtn-root {
  position: fixed;
  z-index: 2147482500;
  width: 480px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  color: var(--dsw-alias-label-primary, #e8e8ea);
  background: var(--dsw-alias-bg-base, #18181a);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,.42);
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  overflow: hidden;}
.dtn-root.dtn-collapsed { width: 264px; }
.dtn-root.dtn-hidden { display: none; }
.dtn-root.dtn-embedded {
  position: static;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
.dtn-root.dtn-embedded .dtn-head { cursor: default; background: transparent; }
.dtn-root.dtn-embedded .dtn-body { max-height: none; flex: 1; }
.dtn-resize { position: absolute; z-index: 3; }
.dtn-resize-br {
  right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 0 55%, var(--dsw-alias-border-l2, #3a3a40) 55% 62%, transparent 62% 72%, var(--dsw-alias-border-l2, #3a3a40) 72% 79%, transparent 79%);
  opacity: .8;
}
.dtn-resize-br:hover { opacity: 1; background: var(--dsw-alias-brand-primary, #4d9cff); }
.dtn-resize-r { top: 12px; right: -3px; bottom: 12px; width: 6px; cursor: ew-resize; }
.dtn-resize-l { top: 12px; left: -3px; bottom: 12px; width: 6px; cursor: ew-resize; }
.dtn-resize-t { left: 12px; right: 12px; top: -3px; height: 6px; cursor: ns-resize; }
.dtn-resize-b { left: 12px; right: 12px; bottom: -3px; height: 6px; cursor: ns-resize; }
.dtn-icon { flex: none; display: block; color: inherit; }
.dtn-folder-icon { display: inline-flex; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--dsw-alias-bg-layer-1, #232328);
  border-bottom: 1px solid var(--dsw-alias-border-l1, #2e2e34);
  cursor: grab;
  user-select: none;
}
.dtn-root.dtn-collapsed .dtn-head { border-bottom: none; }
.dtn-head:active { cursor: grabbing; }
.dtn-logo { color: var(--dsw-alias-brand-primary, #4d9cff); font-size: 14px; }
.dtn-title { font-weight: 600; letter-spacing: .02em; }
.dtn-count { color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 12px; }
.dtn-actions { display: flex; gap: 4px; margin-left: auto; }
.dtn-btn {
  appearance: none; border: none; background: transparent;
  color: var(--dsw-alias-label-secondary, #a3a3ab);
  width: 24px; height: 24px; border-radius: 6px; cursor: pointer;
  font-size: 14px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0;
}
.dtn-btn:hover { background: var(--dsw-alias-bg-layer-2, #2b2b31); color: var(--dsw-alias-label-primary, #e8e8ea); }
.dtn-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
.dtn-sec {
  background: transparent;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--dsw-alias-border-l1, #2e2e34);
}
.dtn-sec:last-child {
  border-bottom: none;
}
.dtn-sec-head {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px 7px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--dsw-alias-border-l1, #2e2e34);
}
.dtn-sec-head:hover { background: var(--dsw-alias-bg-layer-1, #232328); }
.dtn-sec-caret { display: inline-flex; align-items: center; color: var(--dsw-alias-label-secondary, #a3a3ab); width: 14px; flex: none; }
.dtn-sec-name { font-weight: 600; font-size: 12.5px; }
.dtn-sec-body { overflow: visible; padding: 6px 6px 10px; }
.dtn-empty { color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 12px; padding: 10px 8px; }
.dtn-group { border-radius: 8px; margin-bottom: 4px; }
.dtn-group-head {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: 6px; cursor: pointer;
  color: var(--dsw-alias-label-secondary, #a3a3ab);
}
.dtn-group-head:hover { background: var(--dsw-alias-bg-layer-1, #232328); }
.dtn-group-head.dtn-current { color: var(--dsw-alias-label-primary, #e8e8ea); }
.dtn-group-caret { display: inline-flex; align-items: center; width: 14px; flex: none; }
.dtn-group-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtn-group-count { margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-current-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dsw-alias-brand-primary, #4d9cff); flex: none; }
.dtn-group-body { padding: 2px 4px 6px 12px; }
.dtn-folder { margin: 1px 0; }
.dtn-folder-head {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 5px; border-radius: 5px; cursor: pointer;
  color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 12px;
}
.dtn-folder-head:hover { background: var(--dsw-alias-bg-layer-1, #232328); }
.dtn-folder-caret { display: inline-flex; align-items: center; width: 14px; flex: none; }
.dtn-folder-name { display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtn-folder-count { margin-left: auto; font-size: 10.5px; }
.dtn-todo {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 6px; border-radius: 6px; cursor: pointer;
  color: var(--dsw-alias-label-primary, #e8e8ea);
  font-size: 12.5px; line-height: 1.35;
  border-bottom: 1px dashed var(--dsw-alias-border-l1, #2e2e34);
  transition: opacity 180ms ease, background 180ms ease;
}
.dtn-todo:hover { background: var(--dsw-alias-bg-layer-1, #232328); }
.dtn-todo.dtn-done { opacity: .35; }
.dtn-todo.dtn-drop { background: var(--dsw-alias-bg-layer-2, #2b2b31); }
.dtn-todo.dtn-drop-target,
.dtn-folder-head.dtn-drop-target,
.dtn-group-head.dtn-drop-target {
  outline: 1px dashed var(--dsw-alias-brand-primary, #4d9cff);
  outline-offset: -1px;
  border-radius: 6px;
}
.dtn-check {
  flex: none; width: 14px; height: 14px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  border-radius: 4px; background: transparent; cursor: pointer;
  color: var(--dsw-alias-state-success-primary, #4cc38a);
  font-size: 10px; line-height: 1;
}
.dtn-check.dtn-check-on { border-color: var(--dsw-alias-state-success-primary, #4cc38a); }
.dtn-todo-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dtn-grip {
  flex: none; width: 14px; height: 15px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-label-secondary, #a3a3ab); opacity: 0; cursor: grab;
}
.dtn-todo:hover .dtn-grip, .dtn-folder-head:hover .dtn-grip { opacity: .8; }
.dtn-grip:active { cursor: grabbing; }
.dtn-tag {
  flex: none; font-size: 9.5px; line-height: 1; padding: 1px 5px; border-radius: 4px;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  color: var(--dsw-alias-label-secondary, #a3a3ab);
}
.dtn-tag.dtn-ai {
  color: var(--dsw-alias-brand-primary, #4d9cff);
  border-color: var(--dsw-alias-brand-primary, #4d9cff);
}
.dtn-ai-chip { flex: none; display: inline-flex; align-items: center; color: var(--dsw-alias-brand-primary, #4d9cff); }
.dtn-prio {
  flex: none; font-size: 9.5px; line-height: 1; padding: 1px 5px; border-radius: 4px;
  color: var(--dsw-alias-label-secondary, #a3a3ab);
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  font-weight: 600;
}
.dtn-error { color: var(--dsw-alias-state-error-primary, #e06c6c); font-size: 12px; padding: 8px 10px; }
.dtn-fold {
  overflow: hidden; max-height: 2000px; opacity: 1;
  transition: max-height 180ms ease, opacity 180ms ease;
}
.dtn-fold.dtn-fold-off { max-height: 0; opacity: 0; pointer-events: none; }
.dtn-copy {
  flex: none; padding: 1px 3px; border: none; background: transparent;
  color: var(--dsw-alias-label-secondary, #a3a3ab); cursor: pointer;
  display: inline-flex; align-items: center; border-radius: 4px;
}
.dtn-copy:hover { color: var(--dsw-alias-label-primary, #e8e8ea); background: var(--dsw-alias-bg-layer-2, #2b2b31); }
.dtn-sec-head .dtn-sec-add { margin-left: 6px; }
.dtn-rename {
  flex: 1; min-width: 0; height: 20px; padding: 0 5px;
  font-size: 12px; color: var(--dsw-alias-label-primary, #e8e8ea);
  background: var(--dsw-alias-bg-layer-2, #2b2b31);
  border: 1px solid var(--dsw-alias-brand-primary, #4d9cff);
  border-radius: 4px; outline: none;
}
.dtn-menu {
  position: fixed; z-index: 2147482502; min-width: 148px; padding: 5px;
  background: var(--dsw-alias-bg-overlay, #242429);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  display: flex; flex-direction: column;
}
.dtn-menu-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 9px;
  font-size: 12px; text-align: left; color: var(--dsw-alias-label-primary, #e8e8ea);
  background: transparent; border: none; border-radius: 6px; cursor: pointer;
  position: relative;
}
.dtn-menu-item .dtn-icon { color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-menu-check { width: 14px; flex: none; color: var(--dsw-alias-brand-primary, #4d9cff); font-size: 12px; }
.dtn-menu-item:hover { background: var(--dsw-alias-bg-layer-2, #2b2b31); }
.dtn-menu-item-off,
.dtn-menu-item-off:hover { background: transparent; color: var(--dsw-alias-label-secondary, #9a9aa3); opacity: .45; cursor: default; }
.dtn-menu-item.dtn-danger { color: var(--dsw-alias-state-error-primary, #e55353); }
.dtn-menu-item.dtn-danger .dtn-icon { color: inherit; }
.dtn-menu-item.dtn-warn { color: var(--dsw-alias-state-warn-primary, #d9a441); }
.dtn-menu-item.dtn-warn .dtn-icon { color: inherit; }
.dtn-menu-sep { height: 1px; margin: 4px 2px; background: var(--dsw-alias-border-l1, #2c2c31); }
.dtn-menu-arrow { margin-left: auto; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-submenu {
  display: none; position: absolute; left: 100%; top: -5px;
  min-width: 160px; max-height: 60vh; overflow: auto; padding: 5px;
  background: var(--dsw-alias-bg-overlay, #242429);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  flex-direction: column;
}
.dtn-has-sub:hover > .dtn-submenu { display: flex; }
.dtn-prio {
  flex: none; height: 20px; padding: 0 4px; margin-left: 2px;
  font-size: 11px; line-height: 20px; text-align: center;
  color: var(--dsw-alias-label-secondary, #a3a3ab);
  background: transparent; border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  border-radius: 4px; outline: none; cursor: pointer;
  -webkit-appearance: none; appearance: none;
}
.dtn-prio:hover { color: var(--dsw-alias-label-primary, #e8e8ea); border-color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-prio option { background: var(--dsw-alias-bg-overlay, #242429); color: var(--dsw-alias-label-primary, #e8e8ea); }
.dtn-rename-todo { flex: 1 1 auto; min-width: 0; margin-left: 6px; }
.dtn-bubble {
  position: fixed; z-index: 2147482501; pointer-events: none;
  padding: 3px 8px; border-radius: 999px; font-size: 11px; white-space: nowrap;
  color: var(--dsw-alias-label-primary, #e8e8ea);
  background: var(--dsw-alias-bg-overlay, #303036);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  animation: dtn-bubble-up 1000ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
@keyframes dtn-bubble-up {
  0% { opacity: 0; transform: translate(-50%, 6px); }
  12% { opacity: 1; transform: translate(-50%, 0); }
  72% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 0); }
}

.dtn-batch {
  width: 440px; height: 320px;
}
.dtn-batch .dtn-preview-body { display: flex; flex-direction: column; gap: 8px; overflow: hidden; flex: 1; min-height: 0; }
.dtn-batch-hint { font-size: 11px; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-batch-field {
  display: flex; flex: 1; min-height: 0; overflow: hidden;
  background: var(--dsw-alias-bg-layer-2, #2a2a30);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40); border-radius: 6px;
}
.dtn-batch-gutter {
  flex: none; padding: 8px 6px; overflow: hidden;
  color: var(--dsw-alias-label-secondary, #a3a3ab);
  font: 12.5px/1.6 ui-monospace, "Cascadia Mono", Consolas, monospace;
  text-align: right; user-select: none;
}
.dtn-batch-line { padding: 0; white-space: pre; }
.dtn-batch-field:focus-within { border-color: var(--dsw-alias-brand-primary, #4d9cff); }
.dtn-batch-input {
  box-sizing: border-box; flex: 1; min-height: 0; width: 100%; resize: none; padding: 8px;
  font: 12.5px/1.6 ui-monospace, "Cascadia Mono", Consolas, monospace;
  white-space: pre; overflow-x: auto; overflow-y: auto;
  color: var(--dsw-alias-label-primary, #e8e8ea);
  background: transparent;
  border: none; border-radius: 0; outline: none;
}
.dtn-batch-actions { display: flex; justify-content: flex-end; gap: 8px; }
.dtn-preview-btn {
  height: 26px; padding: 0 12px; font-size: 12px; cursor: pointer;
  color: var(--dsw-alias-label-primary, #e8e8ea);
  background: var(--dsw-alias-bg-layer-2, #2a2a30);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40); border-radius: 6px;
}
.dtn-preview-btn:hover { background: var(--dsw-alias-bg-layer-1, #323238); }
.dtn-preview-btn-primary { color: var(--dsw-alias-label-primary-inverted, #18181a); background: var(--dsw-alias-brand-primary, #4d9cff); border-color: transparent; font-weight: 600; }
.dtn-preview-btn-primary:hover { filter: brightness(1.08); }

.dtn-preview {
  position: fixed; z-index: 2147482499; width: 440px;
  max-width: calc(100vw - 24px); max-height: 72vh;
  display: flex; flex-direction: column;
  color: var(--dsw-alias-label-primary, #e8e8ea);
  background: var(--dsw-alias-bg-base, #18181a);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,.42);
  font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  overflow: hidden;
  transition: opacity 180ms ease, transform 180ms ease;
}
.dtn-preview.dtn-preview-off { opacity: 0; transform: translateY(6px); pointer-events: none; }
.dtn-preview-head {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: var(--dsw-alias-bg-layer-1, #232328);
  border-bottom: 1px solid var(--dsw-alias-border-l1, #2e2e34);
  cursor: grab; user-select: none;
}
.dtn-preview-title { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtn-preview-meta {
  display: flex; flex-wrap: wrap; gap: 8px;
  padding: 7px 12px; font-size: 11px;
  color: var(--dsw-alias-label-secondary, #a3a3ab);
  border-bottom: 1px solid var(--dsw-alias-border-l1, #2e2e34);
}
.dtn-preview-body { overflow: auto; padding: 10px 14px 16px; }
.dtn-preview.dtn-batch { width: 440px; height: 320px; }
.dtn-batch .dtn-preview-body { display: flex; flex-direction: column; gap: 8px; }
.dtn-md h1, .dtn-md h2, .dtn-md h3, .dtn-md h4 { margin: 12px 0 6px; line-height: 1.3; }
.dtn-md h1 { font-size: 18px; } .dtn-md h2 { font-size: 16px; } .dtn-md h3 { font-size: 14px; }
.dtn-md h4, .dtn-md h5, .dtn-md h6 { font-size: 13px; }
.dtn-md p { margin: 6px 0; }
.dtn-md ul, .dtn-md ol { margin: 6px 0; padding-left: 20px; }
.dtn-md li { margin: 2px 0; }
.dtn-md blockquote {
  margin: 8px 0; padding: 2px 10px;
  border-left: 3px solid var(--dsw-alias-border-l2, #3a3a40);
  color: var(--dsw-alias-label-secondary, #a3a3ab);
}
.dtn-md pre {
  margin: 8px 0; padding: 9px 10px; overflow: auto;
  background: var(--dsw-alias-bg-layer-2, #2b2b31);
  border: 1px solid var(--dsw-alias-border-l1, #2e2e34);
  border-radius: 7px; font-size: 12px; line-height: 1.45;
}
.dtn-md code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }
.dtn-md p code, .dtn-md li code {
  padding: 1px 4px; border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2, #2b2b31);
}
.dtn-md a { color: var(--dsw-alias-brand-primary, #4d9cff); text-decoration: none; }
.dtn-md a:hover { text-decoration: underline; }
.dtn-md hr { border: none; border-top: 1px solid var(--dsw-alias-border-l1, #2e2e34); margin: 12px 0; }
`

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
        y: Math.min(Math.max(top, pos.y), Math.max(top, viewHeight - Math.min(height, 80))),
      }
    }

    // 简易 markdown 渲染：标题、列表、引用、代码块、分隔线、行内样式。
    function inlineNodes(text) {
      const nodes = []
      let rest = String(text === undefined || text === null ? '' : text)
      let guard = 0
      while (rest.length > 0 && guard < 800) {
        guard += 1
        const patterns = [
          { re: /^`([^`]+)`/, kind: 'code' },
          { re: /^\*\*([^*]+)\*\*/, kind: 'strong' },
          { re: /^\*([^*]+)\*/, kind: 'em' },
          { re: /^\[([^\]]+)\]\(([^)]+)\)/, kind: 'link' },
        ]
        let matched = false
        for (let i = 0; i < patterns.length; i += 1) {
          const hit = patterns[i].re.exec(rest)
          if (hit === null) continue
          matched = true
          if (patterns[i].kind === 'code') nodes.push(h('code', { key: nodes.length }, hit[1]))
          else if (patterns[i].kind === 'strong') nodes.push(h('strong', { key: nodes.length }, hit[1]))
          else if (patterns[i].kind === 'em') nodes.push(h('em', { key: nodes.length }, hit[1]))
          else nodes.push(h('a', { key: nodes.length, href: hit[2], target: '_blank', rel: 'noreferrer' }, hit[1]))
          rest = rest.slice(hit[0].length)
          break
        }
        if (matched) continue
        const next = rest.search(/[`*[]/)
        if (next < 0) {
          nodes.push(rest)
          rest = ''
        } else if (next === 0) {
          nodes.push(rest[0])
          rest = rest.slice(1)
        } else {
          nodes.push(rest.slice(0, next))
          rest = rest.slice(next)
        }
      }
      return nodes
    }

    function renderMarkdown(text) {
      const lines = String(text === undefined || text === null ? '' : text).split(/\r?\n/)
      const blocks = []
      let index = 0
      let key = 0
      const isFence = (line) => /^```/.test(line.trim())
      const isHeading = (line) => /^(#{1,6})\s+/.test(line)
      const isUl = (line) => /^\s*[-*+]\s+/.test(line)
      const isOl = (line) => /^\s*\d+[.)]\s+/.test(line)
      const isQuote = (line) => /^\s*>\s?/.test(line)
      const isRule = (line) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
      while (index < lines.length) {
        const line = lines[index]
        if (line.trim() === '') {
          index += 1
          continue
        }
        if (isFence(line)) {
          const lang = line.trim().slice(3).trim()
          const code = []
          index += 1
          while (index < lines.length && !isFence(lines[index])) {
            code.push(lines[index])
            index += 1
          }
          index += 1
          blocks.push(
            h('pre', { key: key++, className: 'dtn-md-pre' },
              h('code', { className: lang === '' ? undefined : 'language-' + lang }, code.join('\n'))),
          )
          continue
        }
        if (isHeading(line)) {
          const hit = /^(#{1,6})\s+(.*)$/.exec(line)
          const level = hit[1].length
          blocks.push(h('h' + level, { key: key++ }, inlineNodes(hit[2])))
          index += 1
          continue
        }
        if (isUl(line)) {
          const items = []
          while (index < lines.length && isUl(lines[index])) {
            items.push(lines[index].replace(/^\s*[-*+]\s+/, ''))
            index += 1
          }
          blocks.push(h('ul', { key: key++ }, items.map((item, itemIndex) => h('li', { key: itemIndex }, inlineNodes(item)))))
          continue
        }
        if (isOl(line)) {
          const items = []
          while (index < lines.length && isOl(lines[index])) {
            items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''))
            index += 1
          }
          blocks.push(h('ol', { key: key++ }, items.map((item, itemIndex) => h('li', { key: itemIndex }, inlineNodes(item)))))
          continue
        }
        if (isQuote(line)) {
          const quote = []
          while (index < lines.length && isQuote(lines[index])) {
            quote.push(lines[index].replace(/^\s*>\s?/, ''))
            index += 1
          }
          blocks.push(h('blockquote', { key: key++ }, renderMarkdown(quote.join('\n'))))
          continue
        }
        if (isRule(line)) {
          blocks.push(h('hr', { key: key++ }))
          index += 1
          continue
        }
        const paragraph = []
        while (
          index < lines.length &&
          lines[index].trim() !== '' &&
          !isFence(lines[index]) &&
          !isHeading(lines[index]) &&
          !isUl(lines[index]) &&
          !isOl(lines[index]) &&
          !isQuote(lines[index]) &&
          !isRule(lines[index])
        ) {
          paragraph.push(lines[index])
          index += 1
        }
        blocks.push(h('p', { key: key++ }, inlineNodes(paragraph.join(' '))))
      }
      return blocks
    }

    function sourceLabel(source) {
      return typeof source === 'string' && source !== '' && source !== 'user' ? '由智能体创建' : ''
    }

    // 优先级颜色：T0 用主题的 warn 色，T1~T9 用 ColorBrewer 的 YlGnBu 9 档顺序色阶
    // （浅黄 → 绿 → 蓝 → 深蓝），亮度递减，没有红色中段；最后两档在 B 通道各 +5/+10，
    // 提高深色背景上的可读性，亮度仍低于倒数第三档。
    const PRIO_PALETTE = [
      'var(--dsw-alias-state-warn-primary, #d9a441)',
      '#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4',
      '#1d91c0', '#225ea8', '#26369a', '#103ab0',
    ]

    function prioColor(priority) {
      const value = typeof priority === 'number' && priority >= 0 ? Math.min(9, Math.floor(priority)) : 1
      return PRIO_PALETTE[value]
    }

    function sortTodosForView(list) {
      return (Array.isArray(list) ? list.slice() : []).sort(function (a, b) {
        const ad = a.status === 'done' ? 1 : 0
        const bd = b.status === 'done' ? 1 : 0
        if (ad !== bd) return ad - bd
        const ap = typeof a.priority === 'number' ? a.priority : 0
        const bp = typeof b.priority === 'number' ? b.priority : 0
        if (ap !== bp) return ap - bp
        return String(a.created || '').localeCompare(String(b.created || ''))
      })
    }

    function isAiSource(source) {
      return typeof source === 'string' && source !== '' && source !== 'user'
    }

    function folderLabel(folderId) {
      return folderId === PRIMARY ? '无文件夹' : String(folderId)
    }

    // 图标统一用 NaiveUI 推荐的 vicons 图标库：界面图标取 Ionicons 5（@vicons/ionicons5），
    // 智能体标记取 Material Design Icons 的 robot-outline。路径静态内联，运行时不联网。
    const ICONS = {
      chevronDown: { box: 512, paths: [{ d: 'M112 184l144 144 144-144', width: 48 }] },
      chevronRight: { box: 512, paths: [{ d: 'M184 112l144 144-144 144', width: 48 }] },
      chevronUp: { box: 512, paths: [{ d: 'M112 328l144-144 144 144', width: 48 }] },
      folder: {
        box: 512,
        paths: [{
          d: 'M440 432H72a40 40 0 01-40-40V120a40 40 0 0140-40h75.89a40 40 0 0122.19 6.72l27.84 18.56a40 40 0 0022.19 6.72H440a40 40 0 0140 40v240a40 40 0 01-40 40zM32 192h448',
          width: 32,
        }],
      },
      grip: { box: 512, paths: [{ d: 'M96 256h320M96 176h320M96 336h320', width: 32 }] },
      copy: {
        box: 512,
        paths: [
          { d: 'M185 128h279a57 57 0 0157 57v279a57 57 0 01-57 57H185a57 57 0 01-57-57V185a57 57 0 0157-57z', width: 32 },
          { d: 'M383.5 128l.5-24a56.16 56.16 0 00-56-56H112a64.19 64.19 0 00-64 64v216a56.16 56.16 0 0056 56h24', width: 32 },
        ],
      },
      add: { box: 512, paths: [{ d: 'M256 112v288M400 256H112', width: 32 }] },
      // 显示到右侧栏：左列 + 右列的分栏图形。
      panelRight: { box: 24, filled: true, paths: [{ d: 'M3 4H21V20H3V4M5 6V18H10V6H5M12 6V18H19V6H12Z' }] },
      // 切回浮动面板：从右列浮出的小窗图形。
      panelFloat: { box: 24, filled: true, paths: [{ d: 'M3 3H21V21H3V3M5 5V7H19V5H5M5 9V19H19V9H5M7 11H17V17H7V11Z' }] },
      close: { box: 512, paths: [{ d: 'M368 368L144 144M368 144L144 368', width: 32 }] },
      addBatch: {
        box: 512,
        paths: [
          { d: 'M435.13 176H76.87A28.87 28.87 0 0048 204.87v198.26A28.87 28.87 0 0076.87 432h358.26A28.87 28.87 0 00464 403.13V204.87A28.87 28.87 0 00435.13 176z', width: 32 },
          { d: 'M144 80h224', width: 32 },
          { d: 'M112 128h288', width: 32 },
        ],
      },
      folderAdd: {
        box: 24,
        filled: true,
        paths: [{ d: 'M10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4M16 10V12H19V14H16V17H14V14H11V12H14V10H16Z' }],
      },
      edit: {
        box: 512,
        paths: [
          { d: 'M384 224v184a40 40 0 01-40 40H104a40 40 0 01-40-40V168a40 40 0 0140-40h167.48', width: 32 },
          { d: 'M459.94 53.25a16.06 16.06 0 00-23.22-.56L424.35 65a8 8 0 000 11.31l11.34 11.32a8 8 0 0011.34 0l12.06-12c6.1-6.09 6.67-16.01.85-22.38zM399.34 90L218.82 270.2a9 9 0 00-2.31 3.93L208.16 299a3.91 3.91 0 004.86 4.86l24.85-8.35a9 9 0 003.93-2.31L422 112.66a9 9 0 000-12.66l-9.95-10a9 9 0 00-12.71 0z', width: 32 },
        ],
      },
      trash: {
        box: 512,
        paths: [
          { d: 'M112 112l20 320c.95 18.49 14.4 32 32 32h184c17.67 0 30.87-13.51 32-32l20-320', width: 32 },
          { d: 'M80 112h352', width: 32 },
          { d: 'M192 112V72a23.93 23.93 0 0124-24h80a23.93 23.93 0 0124 24v40M256 176v224M184 176l8 224M328 176l-8 224', width: 32 },
        ],
      },
      robot: {
        box: 24,
        filled: true,
        paths: [{
          d: 'M17.5 15.5C17.5 16.61 16.61 17.5 15.5 17.5S13.5 16.61 13.5 15.5 14.4 13.5 15.5 13.5 17.5 14.4 17.5 15.5M8.5 13.5C7.4 13.5 6.5 14.4 6.5 15.5S7.4 17.5 8.5 17.5 10.5 16.61 10.5 15.5 9.61 13.5 8.5 13.5M23 15V18C23 18.55 22.55 19 22 19H21V20C21 21.11 20.11 22 19 22H5C3.9 22 3 21.11 3 20V19H2C1.45 19 1 18.55 1 18V15C1 14.45 1.45 14 2 14H3C3 10.13 6.13 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2S14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C17.87 7 21 10.13 21 14H22C22.55 14 23 14.45 23 15M21 16H19V14C19 11.24 16.76 9 14 9H10C7.24 9 5 11.24 5 14V16H3V17H5V20H19V17H21V16Z',
        }],
      },
    }

    function icon(name, size) {
      const spec = ICONS[name]
      const px = size === undefined ? 12 : size
      if (spec === undefined) return null
      return h(
        'svg',
        {
          width: px,
          height: px,
          viewBox: '0 0 ' + spec.box + ' ' + spec.box,
          fill: 'none',
          className: 'dtn-icon',
          'aria-hidden': 'true',
        },
        spec.paths.map(function (path, index) {
          return h('path', {
            key: index,
            d: path.d,
            fill: spec.filled === true ? 'currentColor' : 'none',
            stroke: spec.filled === true ? 'none' : 'currentColor',
            strokeWidth: spec.filled === true ? 0 : (path.width || 32),
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          })
        }),
      )
    }

    // ------------------------------------------------------------ 组件

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
      const [sections, setSections] = React.useState(function () {
        const stored = readStored(LS_SECTIONS, null)
        return stored !== null && typeof stored === 'object' ? stored : { user: false, workspace: false, session: false }
      })
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState('')
      const [openGroups, setOpenGroups] = React.useState({})
      const [openFolders, setOpenFolders] = React.useState({})
      const [preview, setPreview] = React.useState(null)
      const [previewData, setPreviewData] = React.useState(null)
      const [previewError, setPreviewError] = React.useState('')
      const [previewPos, setPreviewPos] = React.useState(function () {
        return clampPos(readStored(LS_PREVIEW, defaultPreviewPos(storedPanel)), 440, 200)
      })
      const dragMoved = React.useRef(false)
      const [bubble, setBubble] = React.useState(null)
      const [version, setVersion] = React.useState(0)
      const [flashKey, setFlashKey] = React.useState('')
      const [dropKey, setDropKey] = React.useState('')
      const [editingFolder, setEditingFolder] = React.useState(null)
      const [folderMenu, setFolderMenu] = React.useState(null)
      const [editingTodo, setEditingTodo] = React.useState(null)
      const [todoMenu, setTodoMenu] = React.useState(null)
      const [batchCreate, setBatchCreate] = React.useState(null)
      const [batchPos, setBatchPos] = React.useState(null)
      const hoverTimer = React.useRef(null)
      const closeTimer = React.useRef(null)
      const bubbleTimer = React.useRef(null)
      const folderClickTimer = React.useRef(null)
      const checkClickTimer = React.useRef(null)
      const dragPayloadKey = React.useRef('')
      const previewRect = React.useRef(null)
      const previewRef = React.useRef(null)
      const batchGutterRef = React.useRef(null)
      const rowRectsRef = React.useRef({})
      const animateOrderRef = React.useRef(false)

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
          if (bubbleTimer.current !== null) clearTimeout(bubbleTimer.current)
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

      // 拖拽只在源便签组内有效：鼠标移到其它组或面板外时，光标直接显示禁止。
      React.useEffect(function () {
        const onDragOver = function (event) {
          if (dragPayloadKey.current === '') return
          const target = event.target
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
          fetch(ROUTE + '?' + query, { headers: { accept: 'application/json' } })
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status)
              return response.json()
            })
            .then(function (payload) {
              if (!alive) return
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
        fetch(ROUTE + '?what=todo&id=' + encodeURIComponent(preview.id) + '&cwd=' + encodeURIComponent(cwd) + '&session=' + encodeURIComponent(sessionId), {
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

      function startDrag(event, kind) {
        if (event.button !== 0) return
        const target = event.target
        if (target !== null && typeof target.closest === 'function' && target.closest('button') !== null) return
        event.preventDefault()
        dragMoved.current = false
        const startX = event.clientX
        const startY = event.clientY
        const base = kind === 'main' ? panelPos : kind === 'batch' ? (batchPos || (batchCreate !== null && batchCreate.pos) || { x: 12, y: 64 }) : previewPos
        const setter = kind === 'main' ? setPanelPos : kind === 'batch' ? setBatchPos : setPreviewPos
        const widthOf = kind === 'main' ? (collapsed ? 300 : panelWidth) : 440
        const move = function (moveEvent) {
          if (Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3) dragMoved.current = true
          setter(
            clampPos(
              { x: base.x + moveEvent.clientX - startX, y: base.y + moveEvent.clientY - startY },
              widthOf,
              200,
              kind === 'main' ? 56 : undefined,
            ),
          )
        }
        const up = function () {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
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
        const panelRight = panelPos.x + (collapsed ? 300 : panelWidth)
        const spaceRight = window.innerWidth - panelRight - margin
        const spaceLeft = panelPos.x - margin
        let x
        if (spaceRight >= width) x = panelRight + margin
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
        setCollapsed(function (value) {
          writeStored(LS_COLLAPSED, !value)
          if (value && mode === 'sidebar') {
            // 从收起态展开 = 回到浮动面板，同时收起右侧栏，避免两处都占着。
            applyMode('float')
            if (typeof props.closeSidebar === 'function') props.closeSidebar()
          }
          return !value
        })
      }

      // 面板 → 右侧栏：收起浮动面板，并让宿主打开右侧栏里的 TODO 页签。
      function showInSidebar() {
        applyMode('sidebar')
        setCollapsed(true)
        writeStored(LS_COLLAPSED, true)
        if (typeof props.openSidebar === 'function') props.openSidebar(sessionId)
      }

      // 右侧栏 → 浮动面板：恢复浮动面板并关掉右侧栏。
      function showFloating() {
        applyMode('float')
        setCollapsed(false)
        writeStored(LS_COLLAPSED, false)
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

      // 在鼠标上方冒出一个提示（减去光标高度，避免挡住指针），约 1s 后淡出。
      function showBubble(text, event) {
        if (event === null || event === undefined) return
        const x = typeof event.clientX === 'number' ? event.clientX : 0
        const y = (typeof event.clientY === 'number' ? event.clientY : 0) - 40
        setBubble({ text: text, x: x, y: y, nonce: Date.now() })
        if (bubbleTimer.current !== null) clearTimeout(bubbleTimer.current)
        bubbleTimer.current = setTimeout(function () {
          bubbleTimer.current = null
          setBubble(null)
        }, 900)
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

      function onTodoDragStart(event, group, todo) {
        dragPayloadKey.current = group.key
        setDragData(event, { kind: 'todo', key: group.key, id: todo.id, folder: typeof todo.primaryFolder === 'string' && todo.primaryFolder !== '' ? todo.primaryFolder : PRIMARY, priority: typeof todo.priority === 'number' ? todo.priority : 1 })
      }

      function onTodoDrop(event, group, target) {
        if (event !== null && event.preventDefault !== undefined) event.preventDefault()
        const payload = dragData(event)
        dragPayloadKey.current = ''
        if (payload === null || payload.kind !== 'todo' || payload.key !== group.key || payload.id === target.id) return
        const next = Math.max(0, Math.min(9, typeof target.priority === 'number' ? target.priority : 1))
        const folder = typeof target.primaryFolder === 'string' && target.primaryFolder !== '' ? target.primaryFolder : PRIMARY
        const fromFolder = typeof payload.folder === 'string' && payload.folder !== '' ? payload.folder : PRIMARY
        // 只有同一文件夹内的移动才同化优先级；跨文件夹只移动、不改优先级。
        const changed = fromFolder === folder && (payload.priority === undefined || payload.priority !== next)
        const flash = group.key + ':' + payload.id
        postApi({ action: 'moveTodo', key: group.key, id: payload.id, folder: folder })
          .then(function () { return postApi({ action: 'reorder', key: group.key, id: payload.id, folder: folder, beforeId: target.id }) })
          .then(function () { return fromFolder === folder ? postApi({ action: 'priority', key: group.key, id: payload.id, priority: next }) : null })
          .then(function () {
            animateOrderRef.current = true
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

      function onFolderDrop(event, group, target, intoChild) {
        if (event !== null && event.preventDefault !== undefined) event.preventDefault()
        dragPayloadKey.current = ''
        const payload = dragData(event)
        if (payload === null || payload.kind !== 'folder' || payload.key !== group.key || payload.id === target.id) return
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

      function deleteFolder(group, folderId, event) {
        setFolderMenu(null)
        if (folderId === PRIMARY) return
        postApi({ action: 'detachFolder', key: group.key, folder: folderId })
          .then(function () { showBubble('已解除文件夹', event); refresh() })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      function deleteFolderTree(group, folderId, event) {
        setFolderMenu(null)
        if (folderId === PRIMARY) return
        if (!window.confirm('会连同子文件夹里的全部 TODO 一起删除，且不可恢复，确认删除整个文件夹？')) return
        postApi({ action: 'deleteFolderTree', key: group.key, folder: folderId })
          .then(function (result) {
            showBubble('已删除整个文件夹' + (result !== null && result !== undefined && result.count !== undefined ? '（' + result.count + ' 条）' : ''), event)
            refresh()
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      // 拖 TODO 到文件夹头：按住 Ctrl = 额外加入该文件夹；否则移动（主归属改到该文件夹）。
      function onFolderTodoDrop(event, group, folder) {
        if (event !== null && event.preventDefault !== undefined) event.preventDefault()
        dragPayloadKey.current = ''
        const payload = dragData(event)
        if (payload === null || payload.kind !== 'todo' || payload.key !== group.key) return
        const action = event.ctrlKey === true ? 'reference' : 'moveTodo'
        postApi({ action: action, key: group.key, id: payload.id, folder: folder.id })
          .then(function () { showBubble(action === 'reference' ? '已加入' + folderLabel(folder.id) : '已移动到' + folderLabel(folder.id), event); refresh() })
          .catch(function (err) { failWith(event, err) })
      }

      function openFolderMenu(event, group, folder) {
        event.preventDefault()
        event.stopPropagation()
        setFolderMenu({ x: event.clientX, y: event.clientY, groupKey: group.key, group: group, folderId: folder.id })
      }

      // ---------------------------------------------------------- TODO 编辑

      function createTodo(group, event, folderId) {
        postApi({ action: 'createTodo', key: group.key, folder: folderId || PRIMARY })
          .then(function (result) {
            setEditingTodo({ key: group.key, id: result.id, draft: result.title || '新建待办' })
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
        const titles = String(state.value || '').split(/\r?\n/).map(function (line) { return line.trim() }).filter(function (line) { return line !== '' })
        if (titles.length === 0) return
        setBatchCreate(null)
        postApi({ action: 'createTodos', key: state.key, folder: state.folderId, titles: titles })
          .then(function (result) {
            refresh()
            if (result !== null && typeof result === 'object' && typeof result.count === 'number') {
              setVersion(function (value) { return value + 1 })
            }
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
        const title = String(state.draft === undefined || state.draft === null ? '' : state.draft).replace(/\r?\n/g, ' ').trim()
        if (title === '') return
        postApi({ action: 'renameTodo', key: group.key, id: state.id, title: title })
          .then(function () { refresh() })
          .catch(function (err) { failWith(event, err) })
      }

      function cancelRenameTodo() {
        setEditingTodo(null)
      }

      function deleteTodo(group, todoId, event) {
        setTodoMenu(null)
        if (!window.confirm('删除后不可恢复，确认删除这条 TODO？')) return
        postApi({ action: 'deleteTodo', key: group.key, id: todoId })
          .then(function () { refresh() })
          .catch(function (err) { failWith(event, err) })
      }

      function openTodoMenu(event, group, todo) {
        event.preventDefault()
        event.stopPropagation()
        setTodoMenu({ x: event.clientX, y: event.clientY, groupKey: group.key, group: group, todoId: todo.id })
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
            refresh()
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      // 右键「管理收录」：勾选/取消某条 TODO 与各文件夹的收录关系。
      function toggleTodoReference(group, todo, folderId, event) {
        const lists = group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {}
        const list = Array.isArray(lists[folderId]) ? lists[folderId] : []
        const joined = list.indexOf(todo.id) >= 0
        postApi({ action: joined ? 'removeReference' : 'reference', key: group.key, id: todo.id, folder: folderId })
          .then(function () {
            showBubble(joined ? '已取消收录到' + folderLabel(folderId) : '已收录到' + folderLabel(folderId), event)
            refresh()
          })
          .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
      }

      function todoJoined(group, todo, folderId) {
        const lists = group.folderTodos !== null && typeof group.folderTodos === 'object' ? group.folderTodos : {}
        return Array.isArray(lists[folderId]) && lists[folderId].indexOf(todo.id) >= 0
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

      // 点击菜单外部或按 Esc 关闭文件夹/条目右键菜单。
      React.useEffect(function () {
        if (folderMenu === null && todoMenu === null) return undefined
        const onDown = function () { setFolderMenu(null); setTodoMenu(null) }
        const onKey = function (event) { if (event.key === 'Escape') { setFolderMenu(null); setTodoMenu(null) } }
        window.addEventListener('pointerdown', onDown)
        window.addEventListener('keydown', onKey)
        return function () {
          window.removeEventListener('pointerdown', onDown)
          window.removeEventListener('keydown', onKey)
        }
      }, [folderMenu, todoMenu])

      function renderTodoRow(group, todo) {
        const isDone = todo.status === 'done'
        const rowKey = group.key + ':' + todo.id
        const renamingTodo = editingTodo !== null && editingTodo !== undefined && editingTodo.key === group.key && editingTodo.id === todo.id
        return h(
          'div',
          {
            key: rowKey,
            'data-todo-id': todo.id,
            className: 'dtn-todo' + (isDone ? ' dtn-done' : '') + (flashKey === rowKey ? ' dtn-drop' : '') + (dropKey === rowKey ? ' dtn-drop-target' : ''),
            title: todo.title,
            draggable: !renamingTodo,
            onDragStart: function (event) { onTodoDragStart(event, group, todo) },
            onDragOver: function (event) {
              if (event !== null && event.preventDefault !== undefined) event.preventDefault()
              if (dragPayloadKey.current !== group.key) return
              if (dropKey !== rowKey) setDropKey(rowKey)
            },
            onDragLeave: function () { if (dropKey === rowKey) setDropKey('') },
            onDragEnd: function () { dragPayloadKey.current = ''; setDropKey('') },
            onDrop: function (event) { setDropKey(''); onTodoDrop(event, group, todo) },
            onContextMenu: function (event) { openTodoMenu(event, group, todo) },
            onClick: function (event) {
              if (editingTodo !== null && editingTodo !== undefined && editingTodo.key === group.key && editingTodo.id === todo.id) return
              const rect = event !== null && event.currentTarget !== null ? event.currentTarget.getBoundingClientRect() : null
              openPreview(group, todo, rect)
            },
            onMouseEnter: function (event) { hoverPreview(group, todo, event) },
            onMouseLeave: leavePreview,
          },
          h(
            'button',
            {
              type: 'button',
              className: 'dtn-check' + (isDone ? ' dtn-check-on' : ''),
              title: isDone ? '取消完成' : '双击勾选完成',
              onClick: function (event) {
                event.stopPropagation()
                if (isDone) {
                  postApi({ action: 'reopen', key: group.key, id: todo.id })
                    .then(refresh)
                    .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                  return
                }
                if (checkClickTimer.current !== null) clearTimeout(checkClickTimer.current)
                const x = event.clientX
                const y = event.clientY
                checkClickTimer.current = setTimeout(function () {
                  checkClickTimer.current = null
                  showBubble('双击以确认勾选完成', { clientX: x, clientY: y })
                }, 100)
              },
              onDoubleClick: function (event) {
                event.stopPropagation()
                if (checkClickTimer.current !== null) {
                  clearTimeout(checkClickTimer.current)
                  checkClickTimer.current = null
                }
                if (!isDone) {
                  postApi({ action: 'complete', key: group.key, id: todo.id })
                    .then(refresh)
                    .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                }
              },
            },
            isDone ? '✓' : '',
          ),
          h(
            'select',
            {
              className: 'dtn-prio',
              style: { color: prioColor(todo.priority) },
              title: '优先级 T0 最高',
              value: String(typeof todo.priority === 'number' ? todo.priority : 1),
              onClick: function (event) { event.stopPropagation() },
              onPointerDown: function (event) { event.stopPropagation() },
              onChange: function (event) {
                const value = Number(event.currentTarget.value)
                postApi({ action: 'priority', key: group.key, id: todo.id, priority: value })
                  .then(function () {
                    animateOrderRef.current = true
                    showBubble('已调整优先级为T' + value, event)
                    refresh()
                  })
                  .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
              },
            },
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (value) {
              return h('option', { key: value, value: String(value), style: { color: prioColor(value) } }, 'T' + value)
            }),
          ),
          editingTodo !== null && editingTodo !== undefined && editingTodo.key === group.key && editingTodo.id === todo.id
            ? h('input', {
                className: 'dtn-rename dtn-rename-todo',
                value: editingTodo.draft,
                autoFocus: true,
                onClick: function (event) { event.stopPropagation() },
                onPointerDown: function (event) { event.stopPropagation() },
                onChange: function (event) {
                  const value = event.currentTarget.value
                  setEditingTodo(function (state) { return state === null ? null : { key: state.key, id: state.id, draft: value } })
                },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') { event.preventDefault(); commitRenameTodo(group, event) }
                  else if (event.key === 'Escape') { event.preventDefault(); cancelRenameTodo() }
                },
                onBlur: function (event) { commitRenameTodo(group, event) },
              })
            : h('span', {
                className: 'dtn-todo-title',
                style: { color: prioColor(todo.priority) },
                title: '双击重命名，右键更多',
                onDoubleClick: function (event) { event.stopPropagation(); startRenameTodo(group, todo) },
              }, todo.title),
          isAiSource(todo.source)
            ? h('span', { className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13))
            : null,
          h('span', { className: 'dtn-grip', title: '拖动调整优先级' }, icon('grip')),
        )
      }

      function todosForFolder(group, folderId) {
        const ids = group.folderTodos !== null && typeof group.folderTodos === 'object' && Array.isArray(group.folderTodos[folderId]) ? group.folderTodos[folderId] : []
        const rows = ids
          .map(function (id) {
            for (let i = 0; i < group.todos.length; i += 1) {
              if (group.todos[i].id === id) return group.todos[i]
            }
            return null
          })
          .filter(function (item) { return item !== null })
        const rank = {}
        ids.forEach(function (id, index) { rank[id] = index })
        rows.sort(function (a, b) {
          const ad = a.status === 'done' ? 1 : 0
          const bd = b.status === 'done' ? 1 : 0
          if (ad !== bd) return ad - bd
          const ap = typeof a.priority === 'number' ? a.priority : 1
          const bp = typeof b.priority === 'number' ? b.priority : 1
          if (ap !== bp) return ap - bp
          const ra = rank[a.id] === undefined ? -1 : rank[a.id]
          const rb = rank[b.id] === undefined ? -1 : rank[b.id]
          if (ra >= 0 && rb >= 0 && ra !== rb) return ra - rb
          return String(a.created || '').localeCompare(String(b.created || ''))
        })
        return rows
      }

      function renderFolder(group, folder, depth) {
        if (folder === null || typeof folder !== 'object' || typeof folder.id !== 'string') return null
        const folderKey = group.key + '/' + folder.id
        const todos = todosForFolder(group, folder.id)
        const folderOpen = openFolders[folderKey] === true || (openFolders[folderKey] === undefined && depth === 0)
        const children = Array.isArray(folder.children) ? folder.children : []
        const renaming = editingFolder !== null && editingFolder !== undefined && editingFolder.key === group.key && editingFolder.folderId === folder.id
        return h(
          'div',
          { key: folderKey, className: 'dtn-folder', style: depth > 0 ? { marginLeft: '10px' } : undefined },
          h(
            'div',
            {
              className: 'dtn-folder-head' + (dropKey === folderKey ? ' dtn-drop-target' : ''),
              onClick: function (event) {
                if (renaming) return
                if (event.detail > 1) return
                if (folderClickTimer.current !== null) clearTimeout(folderClickTimer.current)
                folderClickTimer.current = setTimeout(function () {
                  folderClickTimer.current = null
                  toggleFolder(folderKey)
                }, 100)
              },
              onDoubleClick: function (event) {
                event.stopPropagation()
                if (folderClickTimer.current !== null) {
                  clearTimeout(folderClickTimer.current)
                  folderClickTimer.current = null
                }
                startRenameFolder(group, folder)
              },
              onContextMenu: function (event) { openFolderMenu(event, group, folder) },
              draggable: true,
              onDragStart: function (event) { onFolderDragStart(event, group, folder) },
              onDragOver: function (event) {
                if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                if (dragPayloadKey.current !== group.key) return
                if (dropKey !== folderKey) setDropKey(folderKey)
              },
              onDragLeave: function () { if (dropKey === folderKey) setDropKey('') },
              onDragEnd: function () { dragPayloadKey.current = ''; setDropKey('') },
              onDrop: function (event) {
                setDropKey('')
                const payload = dragData(event)
                if (payload !== null && payload.kind === 'todo') {
                  onFolderTodoDrop(event, group, folder)
                  return
                }
                const rect = event.currentTarget.getBoundingClientRect()
                // 指针在文件夹行下半部分视为「紧跟其后、成为子文件夹」；否则按同级插到它后面。
                const intoChild = event.clientY > rect.top + rect.height * 0.6
                onFolderDrop(event, group, folder, intoChild)
              },
            },
            h('span', { className: 'dtn-folder-caret' }, folderOpen ? icon('chevronDown') : icon('chevronRight')),
            renaming
              ? h('input', {
                  className: 'dtn-rename',
                  value: editingFolder.draft,
                  autoFocus: true,
                  onClick: function (event) { event.stopPropagation() },
                  onPointerDown: function (event) { event.stopPropagation() },
                  onChange: function (event) {
                    const value = event.currentTarget.value
                    setEditingFolder(function (state) { return state === null ? null : { key: state.key, folderId: state.folderId, draft: value } })
                  },
                  onKeyDown: function (event) {
                    if (event.key === 'Enter') { event.preventDefault(); commitRenameFolder(group, event) }
                    else if (event.key === 'Escape') { event.preventDefault(); cancelRenameFolder() }
                  },
                  onBlur: function (event) { commitRenameFolder(group, event) },
                })
              : h(
                  'span',
                  {
                    className: 'dtn-folder-name',
                    title: '双击重命名，右键更多',
                  },
                  h('span', { className: 'dtn-folder-icon' }, icon('folder')),
                  folder.name || folderLabel(folder.id),
                ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-copy',
                title: '在此文件夹新建 TODO',
                onClick: function (event) { event.stopPropagation(); createTodo(group, event, folder.id) },
              },
              icon('add'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-copy',
                title: '在此文件夹批量新建 TODO',
                onClick: function (event) { event.stopPropagation(); openBatchCreate(group, event, folder.id) },
              },
              icon('addBatch'),
            ),
            h('span', { className: 'dtn-folder-count' }, String(todos.length)),
            h('span', { className: 'dtn-grip' }, icon('grip')),
          ),
          h(
            'div',
            { className: 'dtn-fold' + (folderOpen ? '' : ' dtn-fold-off') },
            children.map(function (child) { return renderFolder(group, child, depth + 1) }),
            todos.map(function (todo) { return renderTodoRow(group, todo) }),
          ),
        )
      }

      function todoFolderHasItems(folder) {
        return Array.isArray(folder.children) && folder.children.length > 0
      }

      function groupPrimary(group) {
        const folders = Array.isArray(group.folders) ? group.folders : []
        for (let i = 0; i < folders.length; i += 1) {
          if (folders[i] !== null && typeof folders[i] === 'object' && folders[i].id === PRIMARY) return folders[i]
        }
        return null
      }

      function renderPrimaryChildren(group) {
        const primary = groupPrimary(group)
        const children = primary !== null && Array.isArray(primary.children) ? primary.children : []
        return children.map(function (child) { return renderFolder(group, child, 0) })
      }

      function renderTopFolders(group) {
        const folders = Array.isArray(group.folders) ? group.folders : []
        return folders
          .filter(function (folder) { return folder !== null && typeof folder === 'object' && folder.id !== PRIMARY })
          .map(function (folder) { return renderFolder(group, folder, 0) })
      }

      function renderGroup(group, hideHead) {
        if (group === null || typeof group !== 'object' || typeof group.key !== 'string') return null
        const explicit = openGroups[group.key]
        const groupOpen = hideHead === true || (explicit === undefined ? group.current === true : explicit === true)
        const current = group.current === true
        return h(
          'div',
          Object.assign(
            { key: group.key, className: 'dtn-group' + (hideHead === true && dropKey === 'group:' + group.key ? ' dtn-drop-target' : ''), 'data-dtn-group': group.key },
            hideHead === true
              ? {
                  onDragOver: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    if (dragPayloadKey.current !== group.key) return
                    if (dropKey !== 'group:' + group.key) setDropKey('group:' + group.key)
                  },
                  onDragLeave: function () { if (dropKey === 'group:' + group.key) setDropKey('') },
                  onDrop: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    setDropKey('')
                    const payload = dragData(event)
                    dragPayloadKey.current = ''
                    if (payload === null || payload.key !== group.key) return
                    if (payload.kind === 'todo') {
                      postApi({ action: 'moveTodo', key: group.key, id: payload.id, folder: PRIMARY })
                        .then(function () { showBubble('已归入无文件夹', event); refresh() })
                        .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                    } else if (payload.kind === 'folder') {
                      moveFolderToPrimary(group, payload.id, event)
                    }
                  },
                }
              : {},
          ),
          hideHead === true
            ? null
            : h(
                'div',
                {
                  className: 'dtn-group-head' + (current ? ' dtn-current' : '') + (dropKey === 'group:' + group.key ? ' dtn-drop-target' : ''),
                  onClick: function () { toggleGroup(group.key) },
                  title: group.subtitle || group.title,
                  onDragOver: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    if (dragPayloadKey.current !== group.key) return
                    if (dropKey !== 'group:' + group.key) setDropKey('group:' + group.key)
                  },
                  onDragLeave: function () { if (dropKey === 'group:' + group.key) setDropKey('') },
                  onDrop: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    setDropKey('')
                    const payload = dragData(event)
                    dragPayloadKey.current = ''
                    if (payload === null || payload.key !== group.key) return
                    if (payload.kind === 'todo') {
                      postApi({ action: 'moveTodo', key: group.key, id: payload.id, folder: PRIMARY })
                        .then(function () { showBubble('已归入无文件夹', event); refresh() })
                        .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                    } else if (payload.kind === 'folder') {
                      moveFolderToPrimary(group, payload.id, event)
                    }
                  },
                },
                h('span', { className: 'dtn-group-caret' }, groupOpen ? icon('chevronDown') : icon('chevronRight')),
                h('span', { className: 'dtn-group-name' }, group.title || '未命名组'),
                group.kind === 'workspace' || group.kind === 'session'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dtn-copy',
                        title: group.kind === 'workspace' ? '复制工作区路径' : '复制 Session ID',
                        onClick: function (event) {
                          event.stopPropagation()
                          copyGroup(group, event, group.kind === 'workspace' ? '已复制工作区路径' : '已复制SessionID')
                        },
                      },
                      icon('copy'),
                    )
                  : null,
                group.kind === 'workspace' || group.kind === 'session'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dtn-copy',
                        title: '新建文件夹',
                        onClick: function (event) {
                          event.stopPropagation()
                          createFolder(group, event)
                        },
                      },
                      icon('folderAdd'),
                    )
                  : null,
                group.kind === 'workspace' || group.kind === 'session'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dtn-copy',
                        title: '新建 TODO',
                        onClick: function (event) {
                          event.stopPropagation()
                          createTodo(group, event)
                        },
                      },
                      icon('add'),
                    )
                  : null,
                group.kind === 'workspace' || group.kind === 'session'
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'dtn-copy',
                        title: '批量新建 TODO',
                        onClick: function (event) {
                          event.stopPropagation()
                          openBatchCreate(group, event)
                        },
                      },
                      icon('addBatch'),
                    )
                  : null,
                h('span', { className: 'dtn-group-count' }, String(group.count === undefined ? 0 : group.count)),
              ),
          h(
            'div',
            { className: 'dtn-group-body dtn-fold' + (groupOpen ? '' : ' dtn-fold-off') },
            // 主归属是默认容器，不单独显示成文件夹；它的条目直接列在组里。
            todosForFolder(group, PRIMARY).map(function (todo) { return renderTodoRow(group, todo) }),
            renderPrimaryChildren(group),
            renderTopFolders(group),
            renderLooseTodos(group),
          ),
        )
      }

      function renderLooseTodos(group) {
        const referenced = {}
        if (group.folderTodos !== null && typeof group.folderTodos === 'object') {
          Object.keys(group.folderTodos).forEach(function (folderId) {
            const ids = group.folderTodos[folderId]
            if (Array.isArray(ids)) ids.forEach(function (id) { referenced[id] = true })
          })
        }
        const loose = sortTodosForView((group.todos || []).filter(function (todo) { return referenced[todo.id] !== true }))
        if (loose.length === 0) return null
        return h(
          'div',
          { className: 'dtn-loose' },
          h(
            'div',
            { className: 'dtn-folder-head' },
            h('span', { className: 'dtn-folder-caret' }),
            h('span', { className: 'dtn-folder-name' }, h('span', { className: 'dtn-folder-icon' }, icon('folder')), '未归类'),
          ),
          loose.map(function (todo) { return renderTodoRow(group, todo) }),
        )
      }

      function renderSection(kind, label, groups) {
        const sectionCollapsed = sections[kind] === true
        return h(
          'div',
          { key: kind, className: 'dtn-sec' },
          h(
            'div',
            { className: 'dtn-sec-head', onClick: function () { toggleSection(kind) } },
            h('span', { className: 'dtn-sec-caret' }, sectionCollapsed ? icon('chevronRight') : icon('chevronDown')),
            h('span', { className: 'dtn-sec-name' }, label),
            kind === 'user' && groups.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-copy dtn-sec-add',
                    title: '新建文件夹',
                    onClick: function (event) {
                      event.stopPropagation()
                      createFolder(groups[0], event)
                    },
                  },
                  icon('folderAdd'),
                )
              : null,
            kind === 'user' && groups.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-copy dtn-sec-add',
                    title: '新建 TODO',
                    onClick: function (event) {
                      event.stopPropagation()
                      createTodo(groups[0], event)
                    },
                  },
                  icon('add'),
                )
              : null,
            kind === 'user' && groups.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-copy dtn-sec-add',
                    title: '批量新建 TODO',
                    onClick: function (event) {
                      event.stopPropagation()
                      openBatchCreate(groups[0], event)
                    },
                  },
                  icon('addBatch'),
                )
              : null,
          ),
          h(
            'div',
            { className: 'dtn-sec-body dtn-fold' + (sectionCollapsed ? ' dtn-fold-off' : '') },
            groups.length === 0
              ? h('div', { className: 'dtn-empty' }, '暂无便签组')
              : groups.map(function (group) { return renderGroup(group, kind === 'user') }),
          ),
        )
      }

      const userGroups = data !== null && data.user !== null && data.user !== undefined ? [data.user] : []
      const workspaceGroups = data !== null && Array.isArray(data.workspaces) ? data.workspaces : []
      const sessionGroups = data !== null && Array.isArray(data.sessions) ? data.sessions : []
      const totalOpen =
        userGroups.concat(workspaceGroups).concat(sessionGroups).reduce(function (sum, group) {
          return sum + (typeof group.count === 'number' ? group.count : 0)
        }, 0)

      const panel = h(
        'div',
        {
          className:
            'dtn-root' +
            (collapsed ? ' dtn-collapsed' : '') +
            (embedded ? ' dtn-embedded' : '') +
            (embedded && mode !== 'sidebar' ? ' dtn-hidden' : ''),
          style: embedded
            ? {}
            : {
                left: panelPos.x + 'px',
                top: panelPos.y + 'px',
                width: collapsed ? undefined : panelWidth + 'px',
                height: collapsed || panelHeight === null ? undefined : panelHeight + 'px',
              },
        },
        h(
          'div',
          {
            className: 'dtn-head',
            onPointerDown: embedded ? undefined : function (event) { startDrag(event, 'main') },
            onClick: embedded
              ? undefined
              : function (event) {
                  // 拖动结束后的 click 不算收展。
                  if (dragMoved.current) {
                    dragMoved.current = false
                    return
                  }
                  if (event.target !== null && typeof event.target.closest === 'function' && event.target.closest('button') !== null) return
                  toggleCollapsed()
                },
          },
          h('span', { className: 'dtn-logo' }, '▤'),
          h('span', { className: 'dtn-title' }, 'TODO 便签'),
          h('span', { className: 'dtn-count' }, data === null ? '加载中…' : totalOpen + ' 条未完成'),
          h(
            'div',
            { className: 'dtn-actions' },
            embedded
              ? h(
                  'button',
                  { type: 'button', className: 'dtn-btn', title: '切回浮动面板', onClick: function (event) { event.stopPropagation(); showFloating() } },
                  icon('panelFloat'),
                )
              : h(
                  'button',
                  { type: 'button', className: 'dtn-btn', title: '显示到右侧栏', onClick: function (event) { event.stopPropagation(); showInSidebar() } },
                  icon('panelRight'),
                ),
            embedded
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-btn',
                    title: collapsed ? '展开面板' : '折叠面板',
                    onClick: toggleCollapsed,
                  },
                  collapsed ? icon('chevronDown') : icon('chevronUp'),
                ),
          ),
        ),
        collapsed && !embedded
          ? null
          : h(
              'div',
              { className: 'dtn-body' },
              error !== '' ? h('div', { className: 'dtn-error' }, '读取失败：' + error) : null,
              renderSection('user', '用户级TODO', userGroups),
              renderSection('workspace', '工作区级TODO', workspaceGroups),
              renderSection('session', '会话级TODO', sessionGroups),
            ),
        collapsed || embedded
          ? null
          : [
              h('div', { key: 'r-r', className: 'dtn-resize dtn-resize-r', title: '拖动调整宽度', onPointerDown: function (event) { beginResize(event, 'r') } }),
              h('div', { key: 'r-l', className: 'dtn-resize dtn-resize-l', title: '拖动调整宽度', onPointerDown: function (event) { beginResize(event, 'l') } }),
              h('div', { key: 'r-t', className: 'dtn-resize dtn-resize-t', title: '拖动调整高度', onPointerDown: function (event) { beginResize(event, 't') } }),
              h('div', { key: 'r-b', className: 'dtn-resize dtn-resize-b', title: '拖动调整高度', onPointerDown: function (event) { beginResize(event, 'b') } }),
              h('div', { key: 'r-br', className: 'dtn-resize dtn-resize-br', title: '拖动调整大小', onPointerDown: function (event) { beginResize(event, 'br') } }),
            ],
      )

      const previewPanel = h(
        'div',
        {
          className: 'dtn-preview' + (preview === null ? ' dtn-preview-off' : ''),
          style: { left: previewPos.x + 'px', top: previewPos.y + 'px' },
          ref: previewRef,
          onMouseEnter: cancelClose,
          onMouseLeave: leavePreview,
        },
        preview === null
          ? null
          : [
              h(
                'div',
                { key: 'head', className: 'dtn-preview-head', onPointerDown: function (event) { startDrag(event, 'preview') } },
                h('span', { className: 'dtn-preview-title' }, previewData !== null && typeof previewData.title === 'string' ? previewData.title : preview.title),
                h(
                  'div',
                  { className: 'dtn-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dtn-btn',
                      title: '关闭预览',
                      onClick: closePreview,
                    },
                    icon('close'),
                  ),
                ),
              ),
              h(
                'div',
                { key: 'meta', className: 'dtn-preview-meta' },
                previewData !== null
                  ? [
                      h('span', { key: 'status' }, previewData.status === 'done' ? '已完成' : '未完成'),
                      isAiSource(previewData.source)
                        ? h('span', { key: 'source', className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13))
                        : null,
                      h('span', { key: 'folder' }, '无文件夹：' + folderLabel(previewData.primaryFolder)),
                      h('span', { key: 'priority', style: { color: prioColor(previewData.priority) } }, '优先级 T' + (typeof previewData.priority === 'number' ? previewData.priority : 1)),
                      previewData.created !== '' ? h('span', { key: 'created' }, '创建 ' + previewData.created) : null,
                    ]
                  : [h('span', { key: 'loading' }, '加载中…')],
              ),
              h(
                'div',
                { key: 'body', className: 'dtn-preview-body dtn-md' },
                previewError !== ''
                  ? h('div', { className: 'dtn-error' }, '读取失败：' + previewError)
                  : previewData === null
                    ? h('div', { className: 'dtn-empty' }, '加载中…')
                    : renderMarkdown(previewData.markdown),
              ),
            ],
      )

      const bubbleNode = bubble === null
        ? null
        : h(
            'div',
            {
              key: 'bubble-' + bubble.nonce,
              className: 'dtn-bubble',
              style: { left: bubble.x + 'px', top: bubble.y + 'px' },
            },
            bubble.text,
          )

      const menuFolder = folderMenu === null ? null : findFolder(folderMenu.group.folders, folderMenu.folderId)
      const folderMenuNode = folderMenu === null || menuFolder === null
        ? null
        : h(
            'div',
            {
              key: 'folder-menu',
              className: 'dtn-menu',
              style: { left: folderMenu.x + 'px', top: folderMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); startRenameFolder(folderMenu.group, menuFolder) },
              },
              icon('edit'),
              '重命名',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'div',
              { className: 'dtn-menu-item dtn-has-sub' },
              icon('folder'),
              '移动到',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-menu-item',
                    onClick: function (event) { event.stopPropagation(); moveFolderTo(folderMenu.group, menuFolder.id, PRIMARY, event) },
                  },
                  icon('folder'),
                  folderLabel(PRIMARY),
                ),
                folderOptions(folderMenu.group).map(function (opt) {
                  const disabled = opt.id === menuFolder.id || folderContains(menuFolder, opt.id)
                  return h(
                    'button',
                    {
                      key: opt.id,
                      type: 'button',
                      className: 'dtn-menu-item' + (disabled ? ' dtn-menu-item-off' : ''),
                      disabled: disabled,
                      style: { paddingLeft: (10 + (opt.depth + 1) * 14) + 'px' },
                      onClick: function (event) {
                        event.stopPropagation()
                        if (disabled) return
                        moveFolderTo(folderMenu.group, menuFolder.id, opt.id, event)
                      },
                    },
                    icon('folder'),
                    opt.label,
                  )
                }),
              ),
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item dtn-warn',
                onClick: function (event) { event.stopPropagation(); deleteFolder(folderMenu.group, menuFolder.id, event) },
              },
              icon('folder'),
              '解除文件夹',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item dtn-danger',
                onClick: function (event) { event.stopPropagation(); deleteFolderTree(folderMenu.group, menuFolder.id, event) },
              },
              icon('trash'),
              '删除整个文件夹',
            ),
          )

      const menuTodo = todoMenu === null ? null : (Array.isArray(todoMenu.group.todos) ? todoMenu.group.todos : []).find(function (todo) { return todo.id === todoMenu.todoId })
      const todoMenuNode = todoMenu === null || menuTodo === null
        ? null
        : h(
            'div',
            {
              key: 'todo-menu',
              className: 'dtn-menu',
              style: { left: todoMenu.x + 'px', top: todoMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); startRenameTodo(todoMenu.group, menuTodo) },
              },
              icon('edit'),
              '重命名',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'div',
              { className: 'dtn-menu-item dtn-has-sub' },
              icon('folder'),
              '移动到',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-menu-item',
                    onClick: function (event) { event.stopPropagation(); moveTodoToFolder(todoMenu.group, menuTodo.id, PRIMARY, event) },
                  },
                  icon('folder'),
                  folderLabel(PRIMARY),
                ),
                folderOptions(todoMenu.group).map(function (opt) {
                  return h(
                    'button',
                    {
                      key: opt.id,
                      type: 'button',
                      className: 'dtn-menu-item',
                      style: { paddingLeft: (10 + (opt.depth + 1) * 14) + 'px' },
                      onClick: function (event) { event.stopPropagation(); moveTodoToFolder(todoMenu.group, menuTodo.id, opt.id, event) },
                    },
                    icon('folder'),
                    opt.label,
                  )
                }),
              ),
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'div',
              { className: 'dtn-menu-item dtn-has-sub' },
              icon('folder'),
              '管理收录',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' },
                folderOptions(todoMenu.group).map(function (opt) {
                  const joined = todoJoined(todoMenu.group, menuTodo, opt.id)
                  return h(
                    'button',
                    {
                      key: opt.id,
                      type: 'button',
                      className: 'dtn-menu-item',
                      style: { paddingLeft: (10 + (opt.depth + 1) * 14) + 'px' },
                      onClick: function (event) { event.stopPropagation(); toggleTodoReference(todoMenu.group, menuTodo, opt.id, event) },
                    },
                    h('span', { className: 'dtn-menu-check' }, joined ? '☑' : '☐'),
                    opt.label,
                  )
                }),
              ),
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item dtn-danger',
                onClick: function (event) { event.stopPropagation(); deleteTodo(todoMenu.group, menuTodo.id, event) },
              },
              icon('trash'),
              '删除',
            ),
          )

      const batchPanelPos = batchCreate !== null ? (batchPos || batchCreate.pos) : (batchPos || placePreview(null, 320))
      const batchNode = h(
        'div',
        {
          key: 'batch',
          className: 'dtn-preview dtn-batch' + (batchCreate === null ? ' dtn-preview-off' : ''),
          style: { left: batchPanelPos.x + 'px', top: batchPanelPos.y + 'px' },
          onPointerDown: function (event) { event.stopPropagation() },
        },
        batchCreate === null
          ? null
          : [
              h(
                'div',
                { key: 'head', className: 'dtn-preview-head', onPointerDown: function (event) { startDrag(event, 'batch') } },
                h('span', { className: 'dtn-preview-title' }, '批量新建 TODO'),
                h(
                  'div',
                  { className: 'dtn-actions' },
                  h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { closeBatchCreate() } }, icon('close')),
                ),
              ),
              h(
                'div',
                { key: 'body', className: 'dtn-preview-body' },
                h('div', { className: 'dtn-batch-hint' }, '每行一条，确认后按行创建'),
                h(
                  'div',
                  { className: 'dtn-batch-field' },
                  h(
                    'div',
                    { className: 'dtn-batch-gutter', ref: batchGutterRef },
                    String(batchCreate.value || '').split(/\r?\n/).map(function (line, index) {
                      return h('div', { key: index, className: 'dtn-batch-line' }, String(index + 1))
                    }),
                  ),
                  h('textarea', {
                    className: 'dtn-batch-input',
                    value: batchCreate.value,
                    autoFocus: true,
                    wrap: 'off',
                    placeholder: '第一件事\n第二件事',
                    onScroll: function (event) {
                      if (batchGutterRef.current !== null) batchGutterRef.current.scrollTop = event.currentTarget.scrollTop
                    },
                    onChange: function (event) {
                      const value = event.currentTarget.value
                      setBatchCreate(function (state) { return state === null ? null : { key: state.key, group: state.group, folderId: state.folderId, value: value, pos: state.pos } })
                    },
                  }),
                ),
                h(
                  'div',
                  { className: 'dtn-batch-actions' },
                  h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { closeBatchCreate() } }, '取消'),
                  h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-primary', onClick: function () { confirmBatchCreate() } }, '确认'),
                ),
              ),
            ],
      )

      return h(React.Fragment, null, panel, previewPanel, bubbleNode, folderMenuNode, todoMenuNode, batchNode)
    }

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
