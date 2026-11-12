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
    // 复用 DSH 自己的 Markdown 渲染组件，会话正文的插件扩展（如 genui）随宿主一起生效。
    let MarkdownText
    try {
      MarkdownText = require('@deepseek-ai/dsh-client-ui-primitives').MarkdownText
    } catch (error) {
      MarkdownText = undefined
    }

    const ROUTE = '/dsh-todo-notes/api'
    const PRIMARY = '__primary__'
    const LS_PANEL = 'dsh.todo-notes.panel.pos.v1'
    const LS_PREVIEW = 'dsh.todo-notes.preview.pos.v1'
    const LS_COLLAPSED = 'dsh.todo-notes.collapsed.v1'
    const LS_SECTIONS = 'dsh.todo-notes.sections.v1'
    const LS_WIDTH = 'dsh.todo-notes.panel.width.v1'
    const LS_HEIGHT = 'dsh.todo-notes.panel.height.v1'
    const LS_MODE = 'dsh.todo-notes.mode.v1'
    const LS_WINDOWS = 'dsh.todo-notes.windows.v1'
    // 浮动面板与右侧栏两个实例之间的同步信号：任一侧写入成功后广播一次。
    const SYNC_BUS = typeof EventTarget === 'function' ? new EventTarget() : null
    // 面板最窄与 DSH 侧边栏一致（264），收起时也用这个宽度。
    const MIN_PANEL_WIDTH = 264

    const CSS = `
.dtn-layer {
  position: fixed; inset: 0; margin: 0; padding: 0; border: 0;
  background: transparent; color: inherit; overflow: visible; pointer-events: none;
}
.dtn-layer > * { pointer-events: auto; }
.dtn-layer .dtn-bubble { pointer-events: none; }
.dtn-root {
  position: fixed;
  z-index: 2147482500;
  width: 480px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  transition: height 190ms cubic-bezier(.22,.61,.36,1);
  color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
  background: var(--dsw-alias-bg-base, #18181a);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,.42);
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  overflow: hidden;
  transition: width 180ms cubic-bezier(.22,.61,.36,1), left 180ms cubic-bezier(.22,.61,.36,1);}
.dtn-root.dtn-collapsed { width: 264px; }
.dtn-root.dtn-resizing { transition: none; }
.dtn-root.dtn-dragging { transition: none; }
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
.dtn-folder-toggle { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 4px; margin-left: -4px; flex: none; border-radius: 4px; color: var(--dsw-alias-label-secondary, #a3a3ab); cursor: pointer; }
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
.dtn-btn:hover { background: var(--dsw-alias-bg-layer-2, #2b2b31); color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent); }
.dtn-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  opacity: 1;
  transition: opacity 140ms ease;
}
.dtn-body-wrap {
  display: grid;
  grid-template-rows: 1fr;
  min-height: 0;
  transition: grid-template-rows 190ms cubic-bezier(.22,.61,.36,1);
}
.dtn-root.dtn-collapsed .dtn-body-wrap { grid-template-rows: 0fr; }
.dtn-root.dtn-collapsed .dtn-body { opacity: 0; pointer-events: none; }
.dtn-root.dtn-embedded .dtn-body-wrap { grid-template-rows: 1fr; }
.dtn-preview .dtn-body-wrap { min-height: 0; }
.dtn-preview.dtn-collapsed .dtn-body-wrap { grid-template-rows: 0fr; }
.dtn-preview.dtn-collapsed .dtn-pin-content { opacity: 0; pointer-events: none; }
.dtn-pin-content { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.dtn-root.dtn-embedded .dtn-body { opacity: 1; pointer-events: auto; }
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
.dtn-sec-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary, #a3a3ab);
  font-variant-numeric: tabular-nums;
}
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
.dtn-group-head.dtn-current { color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent); }
.dtn-group-caret { display: inline-flex; align-items: center; width: 14px; flex: none; }
.dtn-group-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtn-group-count { margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-current-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dsw-alias-brand-primary, #4d9cff); flex: none; }
.dtn-group-body { position: relative; padding: 2px 0 6px 8px; }
/* 便签组也持有一条主线，主归属里的条目与文件夹都挂在这条线上。 */
.dtn-group-body::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 1px;
  background: var(--dsw-alias-border-l1, #2e2e34);
  pointer-events: none;
}
/* 条目与文件夹沿用组标题的水平内缩，保证悬停底色与标题边界对齐。 */
.dtn-todo.dtn-top-level, .dtn-folder.dtn-top-level { margin-left: 0; margin-right: 0; }
.dtn-folder.dtn-nested, .dtn-todo.dtn-indented { position: relative; }
/* 层级竖线由“子内容容器”整段绘制，跨条目连续；8px 缩进在容器内，不额外撑开。 */
.dtn-folder-children { position: relative; padding-left: 8px; }
.dtn-folder-children::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 1px;
  background: var(--dsw-alias-border-l1, #2e2e34);
  pointer-events: none;
}
.dtn-folder { margin: 1px 0; }
.dtn-folder-head {
  position: relative;
  display: flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 5px; cursor: pointer;
  color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 12px;
}
.dtn-folder-head:hover { background: var(--dsw-alias-bg-layer-1, #232328); }
.dtn-folder-name { display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 65%, transparent); }
.dtn-folder-count { margin-left: auto; font-size: 10.5px; }
.dtn-todo {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  padding: 3px 8px 3px 8px; border-radius: 6px; cursor: pointer;
  color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
  font-size: 12.5px; line-height: 1.35;
  border-bottom: 1px dashed var(--dsw-alias-border-l1, #2e2e34);
  transition: opacity 180ms ease, background 180ms ease;
}
.dtn-todo:hover { background: var(--dsw-alias-bg-layer-1, #232328); }
.dtn-todo.dtn-done { opacity: var(--dtn-done-opacity, .35); }
.dtn-todo.dtn-drop { background: var(--dsw-alias-bg-layer-2, #2b2b31); }
.dtn-todo.dtn-drop-target,
.dtn-folder-head.dtn-drop-target,
.dtn-group-head.dtn-drop-target,
.dtn-sec-head.dtn-drop-target {
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
.dtn-check.dtn-check-partial {
  border-color: var(--dsw-alias-state-warn-primary, #d6a63c);
  color: var(--dsw-alias-state-warn-primary, #d6a63c);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d6a63c) 18%, transparent);
}
.dtn-todo.dtn-partial { opacity: var(--dtn-partial-opacity, .67); }
.dtn-todo-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dtn-grip {
  flex: none; width: 0; height: 18px; display: inline-flex; align-items: center; justify-content: center;
  overflow: hidden; color: var(--dsw-alias-label-secondary, #a3a3ab); opacity: 0; cursor: grab;
  transition: width 120ms ease, opacity 120ms ease;
}
.dtn-todo:hover .dtn-grip, .dtn-folder-head:hover .dtn-grip { width: 24px; opacity: .8; }
.dtn-grip:active { cursor: grabbing; }
.dtn-selected,
.dtn-selected:hover {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d9cff) 16%, transparent);
}
.dtn-marquee {
  position: fixed;
  z-index: 2147482525;
  border: 1px dashed var(--dsw-alias-brand-primary, #4d9cff);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d9cff) 9%, transparent);
  border-radius: 2px;
  pointer-events: none;
}
.dtn-menu-item:disabled { opacity: .42; cursor: default; }
.dtn-menu-dim { opacity: .42; }
.dtn-menu-dim > .dtn-submenu { display: none !important; }
.dtn-menu-hide { display: none !important; }
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
.dtn-copy:hover { color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent); background: var(--dsw-alias-bg-layer-2, #2b2b31); }
.dtn-sec-head .dtn-sec-add { margin-left: 6px; }
.dtn-rename {
  flex: 1; min-width: 0; height: 20px; padding: 0 5px;
  font-size: 12px; color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
  background: var(--dsw-alias-bg-layer-2, #2b2b31);
  border: 1px solid var(--dsw-alias-brand-primary, #4d9cff);
  border-radius: 4px; outline: none;
}
.dtn-menu {
  position: fixed; z-index: 2147482530; min-width: 148px; padding: 5px;
  background: var(--dsw-alias-bg-overlay, #242429);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  display: flex; flex-direction: column;
}
.dtn-menu-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 9px;
  font-size: 12px; text-align: left; color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
  background: transparent; border: none; border-radius: 6px; cursor: pointer;
  position: relative;
}
.dtn-confirm { width: 252px; padding: 0; }
.dtn-confirm-text { padding: 10px 12px 6px; font-size: 12px; line-height: 1.55; color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 72%, transparent); }
.dtn-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 6px 10px 10px; }
.dtn-preview-btn-danger { color: #fff; background: var(--dsw-alias-state-error-primary, #e55353); border-color: transparent; font-weight: 600; }
.dtn-preview-btn-danger:hover { filter: brightness(1.08); }
.dtn-menu-item .dtn-icon { color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-menu-check { width: 14px; height: 14px; flex: none; margin: 0 6px 0 0; accent-color: var(--dsw-alias-brand-primary, #4d9cff); }
.dtn-menu-check-row { display: flex; align-items: center; }
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
.dtn-submenu.dtn-submenu-open { display: flex; }
.dtn-submenu.dtn-submenu-left { left: auto; right: 100%; }
.dtn-prio-submenu {
  display: grid; grid-template-columns: repeat(2, minmax(72px, 1fr));
  grid-template-rows: repeat(5, auto); grid-auto-flow: column; gap: 2px;
}
.dtn-prio-choice { gap: 8px; font-variant-numeric: tabular-nums; }
.dtn-prio-dot {
  flex: none; width: 12px; height: 12px; border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.dtn-prio {
  flex: none; height: 20px; padding: 0 4px; margin-left: 2px;
  font-size: 11px; line-height: 20px; text-align: center;
  color: var(--dsw-alias-label-secondary, #a3a3ab);
  background: transparent; border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  border-radius: 4px; outline: none; cursor: pointer;
  -webkit-appearance: none; appearance: none;
}
.dtn-prio:hover { color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent); border-color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-prio option { background: var(--dsw-alias-bg-base, #18181a); color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent); }
.dtn-prio-menu {
  position: fixed; z-index: 2147482530; display: flex; flex-direction: column;
  padding: 4px; border-radius: 8px;
  background: var(--dsw-alias-bg-base, #18181a);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}
.dtn-prio-row { display: flex; gap: 2px; }
.dtn-prio-row + .dtn-prio-row { margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.07); }
.dtn-prio-item {
  width: 29px; height: 24px; padding: 0; border: 0; border-radius: 4px;
  background: transparent; font: 600 11px/1 inherit; cursor: pointer;
}
.dtn-prio-item:hover { background: var(--dsw-alias-bg-layer-2, #2c2c31); }
.dtn-prio-item.dtn-prio-on { background: var(--dsw-alias-bg-layer-2, #2c2c31); }
.dtn-rename-todo { flex: 1 1 auto; min-width: 0; margin-left: 6px; }
.dtn-bubble {
  position: fixed; z-index: 2147482540; pointer-events: none;
  padding: 3px 8px; border-radius: 999px; font-size: 11px; white-space: nowrap;
  color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
  background: var(--dsw-alias-bg-overlay, #303036);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  animation: dtn-bubble-up 3500ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
@keyframes dtn-bubble-up {
  0% { opacity: 0; transform: translate(-50%, 6px); }
  5% { opacity: 1; transform: translate(-50%, 0); }
  29% { opacity: 1; transform: translate(-50%, 0); }
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
  color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
  background: transparent;
  border: none; border-radius: 0; outline: none;
}
.dtn-batch-actions { display: flex; justify-content: flex-end; gap: 8px; }
.dtn-preview-btn {
  height: 26px; padding: 0 12px; font-size: 12px; cursor: pointer;
  color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
  background: var(--dsw-alias-bg-layer-2, #2a2a30);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40); border-radius: 6px;
}
.dtn-preview-btn:hover { background: var(--dsw-alias-bg-layer-1, #323238); }
.dtn-preview-btn-primary { color: var(--dsw-alias-label-primary-inverted, #18181a); background: var(--dsw-alias-brand-primary, #4d9cff); border-color: transparent; font-weight: 600; }
.dtn-preview-btn-primary:hover { filter: brightness(1.08); }

.dtn-preview {
  position: fixed; z-index: 2147482510; width: 440px;
  max-width: calc(100vw - 24px); max-height: 72vh;
  display: flex; flex-direction: column;
  color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
  background: var(--dsw-alias-bg-base, #18181a);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a40);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,.42);
  font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  overflow: hidden;
  transition: opacity 180ms ease, transform 180ms ease, height 190ms cubic-bezier(.22,.61,.36,1);
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
.dtn-pin-type { display: inline-flex; align-items: center; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.dtn-meta-item { display: inline-flex; align-items: center; gap: 4px; }
.dtn-preview.dtn-collapsed { height: auto; }
.dtn-pin-resize {
  position: absolute; right: 0; bottom: 0; width: 14px; height: 14px;
  cursor: nwse-resize; z-index: 2; border-bottom-right-radius: 10px;
  background: linear-gradient(135deg, transparent 50%, var(--dsw-alias-border-l2, #3a3a41) 50%);
}
.dtn-pin-pulse { animation: dtn-pin-pulse 360ms cubic-bezier(0.22, 0.61, 0.36, 1) 1; }
@keyframes dtn-pin-pulse {
  0% { filter: brightness(1); }
  50% { filter: brightness(1.18); }
  100% { filter: brightness(1); }
}
.dtn-edit-body { display: flex; flex-direction: column; gap: 8px; }
.dtn-edit-body .dtn-batch-field { flex: 1 1 auto; min-height: 160px; overflow: visible; }
.dtn-edit-input {
  min-height: 140px; max-height: 62vh; resize: vertical;
  field-sizing: content;
}
.dtn-pin-title-input {
  flex: 1 1 auto; min-width: 0; height: 24px; padding: 0 6px;
  color: var(--dsw-alias-label-primary, #e8e8ea);
  background: var(--dsw-alias-bg-layer-2, #2b2b31);
  border: 1px solid var(--dsw-alias-brand-primary, #4d9cff); border-radius: 5px;
  font-weight: 600; font-size: 13px; line-height: 1.4; font-family: inherit;
}
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

/* ---------------------------------------------------------------- DSH 设置页 */
.tns-page {
  max-width: 680px; padding: 4px 2px 24px;
  color: var(--dsw-alias-label-primary, #e8e8ea);
  font: 13px/1.6 var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
}
.tns-title { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
.tns-desc { margin: 0 0 18px; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.tns-loading { color: var(--dsw-alias-label-secondary, #a3a3ab); padding: 12px 0; }
.tns-error { margin: 0 0 12px; padding: 8px 10px; border-radius: 6px; color: var(--dsw-alias-state-error-primary, #e55353); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e55353) 12%, transparent); }
.tns-section { margin: 0 0 22px; }
.tns-section-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; }
.tns-row { display: flex; align-items: center; gap: 16px; padding: 10px 0; border-top: 1px solid var(--dsw-alias-border-l1, #2e2e34); }
.tns-row:last-of-type { border-bottom: 1px solid var(--dsw-alias-border-l1, #2e2e34); }
.tns-row-text { flex: 1; min-width: 0; }
.tns-label { font-size: 13px; }
.tns-hint { margin: 2px 0 0; color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 12px; }
.tns-opacity { display: flex; align-items: center; gap: 8px; }
.tns-range { width: 180px; accent-color: var(--dsw-alias-brand-primary, #4d9cff); }
.tns-number {
  width: 62px; height: 26px; padding: 0 6px; text-align: right; font: inherit; font-size: 12px;
  color: var(--dsw-alias-label-primary, #e8e8ea); background: var(--dsw-alias-bg-layer-2, #2b2b31);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a41); border-radius: 6px;
}
.tns-unit { color: var(--dsw-alias-label-secondary, #a3a3ab); }
.tns-select {
  height: 28px; padding: 0 8px; font: inherit; font-size: 12px;
  color: var(--dsw-alias-label-primary, #e8e8ea); background: var(--dsw-alias-bg-layer-2, #2b2b31);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a41); border-radius: 6px;
}
.dtn-anim-off .dtn-root *,
.dtn-anim-off .dtn-preview *,
.dtn-anim-off .dtn-bubble * {
  animation: none !important;
  transition: none !important;
}
.tns-check { width: 16px; height: 16px; margin: 0; accent-color: #4d9cff; }
.tns-preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 20px; }
.tns-preview-box { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25)); }
.tns-preview-label { margin-bottom: 6px; color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 11px; }
.tns-preview-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.tns-preview-check { width: 14px; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.tns-preview-prio { font-weight: 600; font-size: 11px; }
.tns-colors { display: flex; gap: 6px 22px; margin-top: 10px; align-items: flex-start; }
.tns-color-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tns-color-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.tns-color-label { width: 26px; color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 12px; }
.tns-color-input {
  width: 28px; height: 26px; padding: 0; border: 1px solid var(--dsw-alias-border-l2, #3a3a41);
  border-radius: 6px; background: transparent; cursor: pointer;
}
.tns-color-input::-webkit-color-swatch-wrapper { padding: 2px; }
.tns-color-input::-webkit-color-swatch { border: none; border-radius: 4px; }
.tns-hex {
  width: 86px; height: 26px; padding: 0 6px; font: 12px/1 ui-monospace, Consolas, monospace;
  color: var(--dsw-alias-label-primary, #e8e8ea); background: var(--dsw-alias-bg-layer-2, #2b2b31);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a41); border-radius: 6px;
}
.tns-actions { display: flex; align-items: center; gap: 10px; padding: 2px 0 12px; }
.tns-btn {
  height: 28px; padding: 0 14px; font: inherit; font-size: 12px; cursor: pointer;
  color: var(--dsw-alias-label-primary, #e8e8ea); background: var(--dsw-alias-bg-layer-2, #2b2b31);
  border: 1px solid var(--dsw-alias-border-l2, #3a3a41); border-radius: 7px;
}
.tns-btn:hover { background: var(--dsw-alias-bg-layer-3, #333339); }
.tns-btn:disabled { opacity: .6; cursor: default; }
.tns-btn-primary { color: #fff; background: #4d9cff; border-color: #4d9cff; }
.tns-btn-primary:hover { background: #66aaff; }
.tns-status { color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 12px; }
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
        y: Math.min(Math.max(top, pos.y), Math.max(top, viewHeight - height - 8)),
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

    // 优先级色相：Tailwind 300/400 色相带，T0 暖金 → T9 紫，按暖到冷排列。
    // 文字明度不写死，而是从主题前景色派生，因此浅色主题自动变深、深色主题自动变亮。
    const PRIO_PALETTE = [
      '#e55353', '#eab308', '#84cc16', '#10b981', '#14b8a6',
      '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
    ]
    let prioOverride = null
    let prioRelativeSupported = null

    // 设置页里的色板用分号分隔，必须是 10 个值；不合法时回退内置色板。
    function applyPriorityPalette(raw) {
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (text === '') {
        prioOverride = null
        return
      }
      const parts = text.split(';').map(function (item) { return item.trim() }).filter(function (item) { return item !== '' })
      prioOverride = parts.length === 10 ? parts : null
    }

    // 十六进制 → OKLCH 的色相与彩度；用于把用户选的颜色换算成着色参数。
    function hexToOklch(hex) {
      const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim())
      if (match === null) return { hue: 220, chroma: 0.09 }
      let body = match[1]
      if (body.length === 3) body = body.split('').map(function (part) { return part + part }).join('')
      const toLinear = function (value) {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
      }
      const r = toLinear(parseInt(body.slice(0, 2), 16))
      const g = toLinear(parseInt(body.slice(2, 4), 16))
      const b = toLinear(parseInt(body.slice(4, 6), 16))
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
      const aa = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
      const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
      let hue = Math.atan2(bb, aa) * 180 / Math.PI
      if (hue < 0) hue += 360
      const chroma = Math.sqrt(aa * aa + bb * bb)
      return { hue: hue.toFixed(1), chroma: Math.max(0.055, Math.min(0.13, chroma)).toFixed(3) }
    }

    function relativeColorAvailable() {
      if (prioRelativeSupported !== null) return prioRelativeSupported
      try {
        prioRelativeSupported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' &&
          CSS.supports('color', 'oklch(from #ffffff calc(l * 0.9) 0.09 200)')
      } catch (error) {
        prioRelativeSupported = false
      }
      return prioRelativeSupported
    }

    function prioInk(hex) {
      if (!relativeColorAvailable()) return hex
      const color = hexToOklch(hex)
      return 'oklch(from var(--dsw-alias-label-primary, #e8e8ea) calc(l * 0.9) ' + color.chroma + ' ' + color.hue + ')'
    }

    function prioColor(priority) {
      const value = typeof priority === 'number' && priority >= 0 ? Math.min(9, Math.floor(priority)) : 1
      const palette = prioOverride === null ? PRIO_PALETTE : prioOverride
      // T0 的默认值是 DSH 错误色；用户改成别的颜色后按用户颜色渲染。
      if (value === 0 && String(palette[0]).trim().toLowerCase() === '#e55353') {
        return 'var(--dsw-alias-state-error-primary, #e55353)'
      }
      return prioInk(palette[value])
    }

    // 排序口径：未勾选 > 中间态（智能体勾选等人工确认）> 已勾选。
    function statusRank(status) {
      if (status === 'done') return 2
      if (status === 'partial') return 1
      return 0
    }

    function sortTodosForView(list) {
      return (Array.isArray(list) ? list.slice() : []).sort(function (a, b) {
        const ad = statusRank(a.status)
        const bd = statusRank(b.status)
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

    // 预览里的时间统一成「YYYY-MM-DD hh:mm:ss:mil」（24 小时制，本地时区）。
    function formatStamp(value) {
      const text = typeof value === 'string' ? value.trim() : ''
      if (text === '') return ''
      const date = new Date(text)
      if (Number.isNaN(date.getTime())) return text
      const pad = function (number, size) {
        let out = String(number)
        while (out.length < size) out = '0' + out
        return out
      }
      return date.getFullYear() + '-' + pad(date.getMonth() + 1, 2) + '-' + pad(date.getDate(), 2) +
        ' ' + pad(date.getHours(), 2) + ':' + pad(date.getMinutes(), 2) + ':' + pad(date.getSeconds(), 2) +
        '.' + pad(date.getMilliseconds(), 3)
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
      // 面板类型与元信息图标：清单、文档、时钟。
      list: {
        box: 24,
        paths: [
          { d: 'M8 6h13M8 12h13M8 18h13', width: 2 },
          { d: 'M3 6h.01M3 12h.01M3 18h.01', width: 2 },
        ],
      },
      fileText: {
        box: 24,
        paths: [
          { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', width: 2 },
          { d: 'M14 2v6h6M8 13h8M8 17h8', width: 2 },
        ],
      },
      clock: {
        box: 24,
        paths: [
          { d: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z', width: 2 },
          { d: 'M12 7v5l3 2', width: 2 },
        ],
      },
      // 优先级：旗杆 + 旗面，线性。
      flag: { box: 24, paths: [{ d: 'M6 3v18M6 4h11l-2 4 2 4H6', width: 2 }] },
      check: { box: 512, paths: [{ d: 'M416 128L192 384l-96-96', width: 48 }] },
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
        box: 512,
        paths: [
          { d: 'M440 432H72a40 40 0 01-40-40V120a40 40 0 0140-40h75.89a40 40 0 0122.19 6.72l27.84 18.56a40 40 0 0022.19 6.72H440a40 40 0 0140 40v240a40 40 0 01-40 40z', width: 32 },
          { d: 'M320 264v96M272 312h96', width: 32 },
        ],
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
        const heightOf = kind === 'main' && panelRef.current !== null ? panelRef.current.offsetHeight : 200
        if (kind === 'main') setDragging(true)
        const move = function (moveEvent) {
          if (Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3) dragMoved.current = true
          const next = clampPos(
            { x: base.x + moveEvent.clientX - startX, y: base.y + moveEvent.clientY - startY },
            widthOf,
            heightOf,
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
        const panelNode = panelRef !== null && panelRef !== undefined ? panelRef.current : null
        const panelRect = panelNode !== null && panelNode !== undefined && typeof panelNode.getBoundingClientRect === 'function'
          ? panelNode.getBoundingClientRect()
          : null
        const panelRight = sideRect !== null && sideRect !== undefined && sideRect.width > 0
          ? sideRect.left
          : panelRect !== null && panelRect !== undefined && panelRect.width > 0
            ? panelRect.right
            : panelPos.x + (collapsed ? MIN_PANEL_WIDTH : panelWidth)
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

      // 拖拽落点：进入元素时点亮一次；离开后延迟 120ms 再熄灭，避免跨子元素/文本节点时闪。
      function markDropTarget(key) {
        if (dropClearTimer.current !== null) {
          window.clearTimeout(dropClearTimer.current)
          dropClearTimer.current = null
        }
        if (dropKey !== key) setDropKey(key)
      }

      function leaveDropTarget(key, event) {
        if (dropKey !== key) return
        const related = event !== null && event !== undefined ? event.relatedTarget : null
        if (related !== null && related !== undefined && event.currentTarget !== null && event.currentTarget.contains(related)) return
        if (dropClearTimer.current !== null) window.clearTimeout(dropClearTimer.current)
        dropClearTimer.current = window.setTimeout(function () {
          dropClearTimer.current = null
          setDropKey('')
        }, 120)
      }

      function clearDropTarget() {
        if (dropClearTimer.current !== null) {
          window.clearTimeout(dropClearTimer.current)
          dropClearTimer.current = null
        }
        setDropKey('')
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
        const payload = { kind: 'todo', key: group.key, id: todo.id, folder: folder, priority: typeof todo.priority === 'number' ? todo.priority : 1 }
        // 多选时把同组的选中条目一起带上，拖拽才会是批量移动。
        const selected = Array.isArray(selectionRef.current) ? selectionRef.current : []
        const ids = selected
          .filter(function (item) { return item !== null && item !== undefined && item.type === 'todo' && item.groupKey === group.key })
          .map(function (item) { return item.id })
        if (ids.length > 1 && ids.indexOf(todo.id) >= 0) payload.ids = ids
        setDragData(event, payload)
      }

      function onTodoDrop(event, group, target, folderId) {
        if (event !== null && event.preventDefault !== undefined) event.preventDefault()
        const payload = dragData(event)
        dragPayloadKey.current = ''
        if (payload === null || payload.kind !== 'todo' || payload.key !== group.key || payload.id === target.id) return
        const next = Math.max(0, Math.min(9, typeof target.priority === 'number' ? target.priority : 1))
        const folder = typeof folderId === 'string' && folderId !== '' ? folderId : (typeof target.primaryFolder === 'string' && target.primaryFolder !== '' ? target.primaryFolder : PRIMARY)
        // 多选拖拽：把选中的条目一起移动到目标文件夹，不做单条重排/优先级同化。
        if (Array.isArray(payload.ids) && payload.ids.length > 1) {
          moveBatchTodos(group, payload.ids, folder, event)
          return
        }
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

      // 主面板与保留浮窗共用的拖动缩放逻辑：只在各自的状态更新与持久化上不同。
      function startBoxResize(event, options) {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        if (typeof options.onStart === 'function') options.onStart()
        const startX = event.clientX
        const startY = event.clientY
        const move = function (moveEvent) {
          const dx = moveEvent.clientX - startX
          const dy = moveEvent.clientY - startY
          let width = options.width
          let height = options.height
          let x = options.x
          let y = options.y
          if (options.dir === 'r' || options.dir === 'br') width = options.width + dx
          if (options.dir === 'l') width = options.width - dx
          if (options.dir === 'b' || options.dir === 'br') height = options.height + dy
          if (options.dir === 't') height = options.height - dy
          width = Math.max(options.minWidth, Math.min(options.maxWidth, width))
          height = Math.max(options.minHeight, Math.min(options.maxHeight, height))
          if (options.dir === 'l') x = options.x + (options.width - width)
          if (options.dir === 't') y = Math.max(options.minY, options.y + (options.height - height))
          options.onChange({ width: width, height: height, x: x, y: y })
        }
        const up = function () {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          if (typeof options.onEnd === 'function') options.onEnd()
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }

      function beginResize(event, dir) {
        if (event.button !== 0) return
        const root = event.currentTarget !== null ? event.currentTarget.parentElement : null
        const startHeight = panelHeight !== null ? panelHeight : (root !== null ? root.offsetHeight : 320)
        const viewHeight = function () { return typeof window === 'undefined' ? 900 : window.innerHeight }
        startBoxResize(event, {
          dir: dir,
          x: panelPos.x,
          y: panelPos.y,
          width: panelWidth,
          height: startHeight,
          minWidth: MIN_PANEL_WIDTH,
          maxWidth: maxPanelWidth(),
          minHeight: 160,
          maxHeight: viewHeight() - 72,
          minY: 56,
          onStart: function () { setResizing(true) },
          onChange: function (next) {
            setPanelWidth(next.width)
            setPanelHeight(next.height)
            setPanelPos(clampPos({ x: next.x, y: next.y }, next.width, 200, 56))
          },
          onEnd: function () {
            setResizing(false)
            setPanelWidth(function (value) {
              writeStored(LS_WIDTH, value)
              return value
            })
            setPanelHeight(function (value) {
              writeStored(LS_HEIGHT, value)
              return value
            })
          },
        })
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
        let chain = Promise.resolve()
        unique.forEach(function (id) {
          chain = chain.then(function () {
            return postApi({ action: 'moveTodo', key: group.key, id: id, folder: folderId })
          })
        })
        chain.then(function () {
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

      function renderTodoRow(group, todo, folderId, indent) {
        const isDone = todo.status === 'done'
        const isPartial = todo.status === 'partial'
        const rowScope = typeof folderId === 'string' && folderId !== '' ? folderId : 'loose'
        const rowKey = group.key + ':' + todo.id + ':' + rowScope
        const rowIndent = typeof indent === 'number' && indent > 0 ? indent : 0
        const selectItem = { key: rowKey, type: 'todo', groupKey: group.key, id: todo.id, folder: rowScope }
        const selected = isSelectedKey(rowKey)
        const renamingTodo = editingTodo !== null && editingTodo !== undefined && editingTodo.key === group.key && editingTodo.id === todo.id
        return h(
          'div',
          {
            key: rowKey,
            'data-todo-id': todo.id,
            'data-select-key': rowKey,
            'data-select-type': 'todo',
            'data-select-group': group.key,
            'data-select-id': todo.id,
            'data-select-folder': rowScope,
            className: 'dtn-todo' + (rowScope === PRIMARY && rowIndent === 0 ? ' dtn-top-level' : '') + (rowIndent > 0 ? ' dtn-indented' : '') + (isDone ? ' dtn-done' : '') + (isPartial ? ' dtn-partial' : '') + (selected ? ' dtn-selected' : '') + (flashKey === rowKey ? ' dtn-drop' : '') + (dropKey === rowKey ? ' dtn-drop-target' : ''),
            style: rowIndent > 0 ? { marginLeft: rowIndent + 'px' } : undefined,
            title: todo.title,
            draggable: !renamingTodo,
            onDragStart: function (event) {
              if (dragArmedRef.current !== true) { event.preventDefault(); return }
              dragArmedRef.current = false
              onTodoDragStart(event, group, todo, folderId)
            },
            onDragEnter: function (event) {
              event.stopPropagation()
              if (dragPayloadKey.current !== group.key) return
              markDropTarget(rowKey)
            },
            onDragOver: function (event) {
              event.stopPropagation()
              if (event !== null && event.preventDefault !== undefined) event.preventDefault()
            },
            onDragLeave: function (event) {
              event.stopPropagation()
              leaveDropTarget(rowKey, event)
            },
            onDragEnd: function () { dragArmedRef.current = false; dragPayloadKey.current = ''; clearDropTarget() },
            onDrop: function (event) { event.stopPropagation(); clearDropTarget(); onTodoDrop(event, group, todo, folderId) },
            onContextMenu: function (event) {
              event.preventDefault()
              event.stopPropagation()
              const multi = selectionRef.current.length > 1 && selectionRef.current.some(function (value) { return value.key === rowKey })
              if (multi) { openBatchMenu(event, selectionRef.current); return }
              clickSelect(selectItem, event)
              openTodoMenu(event, group, todo, folderId)
            },
            onClick: function (event) {
              if (marqueeMovedRef.current === true) { marqueeMovedRef.current = false; return }
              if (editingTodo !== null && editingTodo !== undefined && editingTodo.key === group.key && editingTodo.id === todo.id) return
              if (event.ctrlKey === true || event.metaKey === true || event.shiftKey === true) {
                clickSelect(selectItem, event)
                return
              }
              clickSelect(selectItem, event)
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
              className: 'dtn-check' + (isDone ? ' dtn-check-on' : '') + (isPartial ? ' dtn-check-partial' : ''),
              title: isDone ? '取消完成' : isPartial ? '中间态：点一下确认完成' : '标记完成',
              onClick: function (event) {
                event.stopPropagation()
                const action = isDone ? 'reopen' : 'complete'
                postApi({ action: action, key: group.key, id: todo.id })
                  .then(function () {
                    animatePendingRef.current = true
                    refresh()
                  })
                  .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
              },
            },
            isDone ? '✓' : isPartial ? '–' : '',
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dtn-prio',
              style: { color: prioColor(todo.priority) },
              title: '优先级 T0 最高，点开选择',
              onClick: function (event) { openPrioMenu(event, group, todo) },
            },
            'T' + (typeof todo.priority === 'number' ? todo.priority : 1),
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
                title: '双击文字重命名，右键更多',
              },
              h('span', {
                className: 'dtn-todo-text',
                onDoubleClick: function (event) { event.stopPropagation(); startRenameTodo(group, todo) },
              }, todo.title),
              ),
          isAiSource(todo.source)
            ? h('span', { className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13))
            : null,
          h('span', {
            className: 'dtn-grip',
            title: '按住拖动排序',
            onPointerDown: function (event) { event.stopPropagation(); dragArmedRef.current = true },
            onPointerUp: function () { dragArmedRef.current = false },
            onClick: function (event) { event.stopPropagation() },
          }, icon('grip')),
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
          const ad = statusRank(a.status)
          const bd = statusRank(b.status)
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
        const selectItem = { key: folderKey, type: 'folder', groupKey: group.key, id: folder.id }
        const selected = isSelectedKey(folderKey)
        return h(
          'div',
          { key: folderKey, className: 'dtn-folder' + (depth === 0 ? ' dtn-top-level' : ' dtn-nested') },
          h(
            'div',
            {
              'data-select-key': folderKey,
              'data-select-type': 'folder',
              'data-select-group': group.key,
              'data-select-id': folder.id,
              className: 'dtn-folder-head' + (selected ? ' dtn-selected' : '') + (dropKey === folderKey ? ' dtn-drop-target' : ''),
              onClick: function (event) {
                if (marqueeMovedRef.current === true) { marqueeMovedRef.current = false; return }
                if (renaming) return
                clickSelect(selectItem, event)
                if (event.ctrlKey === true || event.metaKey === true || event.shiftKey === true) return
                // 单击延迟 100ms 再收展；双击重命名会在这之前取消掉，避免先收起再展开。
                if (folderClickTimer.current !== null) window.clearTimeout(folderClickTimer.current)
                folderClickTimer.current = window.setTimeout(function () {
                  folderClickTimer.current = null
                  toggleFolder(folderKey)
                }, 100)
              },
              onContextMenu: function (event) {
                event.preventDefault()
                event.stopPropagation()
                const multi = selectionRef.current.length > 1 && selectionRef.current.some(function (value) { return value.key === folderKey })
                if (multi) { openBatchMenu(event, selectionRef.current); return }
                clickSelect(selectItem, event)
                openFolderMenu(event, group, folder)
              },
              draggable: true,
              onDragStart: function (event) {
                if (dragArmedRef.current !== true) { event.preventDefault(); return }
                dragArmedRef.current = false
                onFolderDragStart(event, group, folder)
              },
              onDragEnter: function (event) {
                event.stopPropagation()
                if (dragPayloadKey.current !== group.key) return
                markDropTarget(folderKey)
              },
              onDragOver: function (event) {
                event.stopPropagation()
                if (event !== null && event.preventDefault !== undefined) event.preventDefault()
              },
              onDragLeave: function (event) {
                event.stopPropagation()
                leaveDropTarget(folderKey, event)
              },
              onDragEnd: function () { dragArmedRef.current = false; dragPayloadKey.current = ''; clearDropTarget() },
              onDrop: function (event) {
                event.stopPropagation()
                clearDropTarget()
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
            h('span', {
              className: 'dtn-folder-toggle',
              title: folderOpen ? '收起文件夹' : '展开文件夹',
              onClick: function (event) { event.stopPropagation(); toggleFolder(folderKey) },
            },
            folderOpen ? icon('chevronDown') : icon('chevronRight'),
            icon('folder')),
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
                    title: '双击文字重命名，右键更多',
                  },
                  h('span', {
                    className: 'dtn-folder-text',
                    onDoubleClick: function (event) {
                      event.stopPropagation()
                      if (folderClickTimer.current !== null) {
                        window.clearTimeout(folderClickTimer.current)
                        folderClickTimer.current = null
                      }
                      startRenameFolder(group, folder)
                    },
                  }, folder.name || folderLabel(folder.id)),
                ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-copy',
                title: '在此文件夹新建子文件夹',
                onClick: function (event) { event.stopPropagation(); createSubFolder(group, folder, event) },
              },
              icon('folderAdd'),
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
            h('span', {
              className: 'dtn-grip',
              title: '按住拖动文件夹',
              onPointerDown: function (event) { event.stopPropagation(); dragArmedRef.current = true },
              onPointerUp: function () { dragArmedRef.current = false },
              onClick: function (event) { event.stopPropagation() },
            }, icon('grip')),
          ),
          h(
            'div',
            { className: 'dtn-fold dtn-folder-children' + (folderOpen ? '' : ' dtn-fold-off') },
            todos.map(function (todo) { return renderTodoRow(group, todo, folder.id, 0) }),
            children.map(function (child) { return renderFolder(group, child, depth + 1) }),
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
                  onDragEnter: function (event) {
                    if (event.target !== event.currentTarget) return
                    if (dragPayloadKey.current !== group.key) return
                    markDropTarget('group:' + group.key)
                  },
                  onDragOver: function (event) {
                    if (event.target !== event.currentTarget) return
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                  },
                  onDragLeave: function (event) {
                    if (event.target !== event.currentTarget) return
                    leaveDropTarget('group:' + group.key, event)
                  },
                  onDrop: function (event) {
                    if (event.target !== event.currentTarget) return
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    clearDropTarget()
                    const payload = dragData(event)
                    dragPayloadKey.current = ''
                    if (payload === null || payload.key !== group.key) return
                    if (payload.kind === 'todo') {
                      if (Array.isArray(payload.ids) && payload.ids.length > 1) {
                        moveBatchTodos(group, payload.ids, PRIMARY, event)
                        return
                      }
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
                  onContextMenu: function (event) { openTreeMenu(event, { kind: 'group', group: group }) },
                  title: group.subtitle || group.title,
                  onDragEnter: function (event) {
                    if (dragPayloadKey.current !== group.key) return
                    markDropTarget('group:' + group.key)
                  },
                  onDragOver: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                  },
                  onDragLeave: function (event) { leaveDropTarget('group:' + group.key, event) },
                  onDrop: function (event) {
                    if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    clearDropTarget()
                    const payload = dragData(event)
                    dragPayloadKey.current = ''
                    if (payload === null || payload.key !== group.key) return
                    if (payload.kind === 'todo') {
                      if (Array.isArray(payload.ids) && payload.ids.length > 1) {
                        moveBatchTodos(group, payload.ids, PRIMARY, event)
                        return
                      }
                      postApi({ action: 'moveTodo', key: group.key, id: payload.id, folder: PRIMARY })
                        .then(function () { showBubble('已归入无文件夹', event); refresh() })
                        .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                    } else if (payload.kind === 'folder') {
                      moveFolderToPrimary(group, payload.id, event)
                    }
                  },
                },
                h('span', { className: 'dtn-group-caret' }, groupOpen ? icon('chevronDown') : icon('chevronRight')),
                h('span', {
                  className: 'dtn-group-name',
                  style: group.current === true && (group.kind === 'workspace' || group.kind === 'session') ? { fontStyle: 'italic' } : undefined,
                  title: (group.subtitle || group.title || '') +
                    (group.current === true && group.kind === 'workspace' ? '（当前工作区）' : group.current === true && group.kind === 'session' ? '（当前会话）' : ''),
                }, group.title || '未命名组'),
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
            todosForFolder(group, PRIMARY).map(function (todo) { return renderTodoRow(group, todo, PRIMARY) }),
            renderLooseTodos(group),
            renderPrimaryChildren(group),
            renderTopFolders(group),
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
            h('span', { className: 'dtn-folder-toggle', style: { cursor: 'default' } }, icon('folder')),
            h('span', { className: 'dtn-folder-name' }, '未归类'),
          ),
          loose.map(function (todo) { return renderTodoRow(group, todo, '') }),
        )
      }

      function renderSection(kind, label, groups) {
        const sectionCollapsed = sections[kind] === true
        return h(
          'div',
          { key: kind, className: 'dtn-sec' },
          h(
            'div',
            Object.assign(
              {
                className: 'dtn-sec-head' + (kind === 'user' && dropKey === 'section:user' ? ' dtn-drop-target' : ''),
                onClick: function () { toggleSection(kind) },
                onContextMenu: function (event) { openTreeMenu(event, { kind: 'section', sectionKind: kind, groups: groups }) },
              },
              kind === 'user' && groups.length > 0
                ? {
                    onDragEnter: function () {
                      if (dragPayloadKey.current === '') return
                      markDropTarget('section:user')
                    },
                    onDragOver: function (event) {
                      if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                    },
                    onDragLeave: function (event) { leaveDropTarget('section:user', event) },
                    onDrop: function (event) {
                      if (event !== null && event.preventDefault !== undefined) event.preventDefault()
                      clearDropTarget()
                      const payload = dragData(event)
                      dragPayloadKey.current = ''
                      if (payload === null || payload.kind !== 'todo' || payload.key !== groups[0].key) return
                      if (Array.isArray(payload.ids) && payload.ids.length > 1) {
                        moveBatchTodos(groups[0], payload.ids, PRIMARY, event)
                        return
                      }
                      postApi({ action: 'moveTodo', key: groups[0].key, id: payload.id, folder: PRIMARY })
                        .then(function () { showBubble('已归入无文件夹', event); refresh() })
                        .catch(function (err) { showBubble('保存失败：' + (err && err.message ? err.message : err), event) })
                    },
                  }
                : {},
            ),
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
            h(
              'span',
              { className: 'dtn-sec-count', title: '该层级 TODO 总数' },
              String(groups.reduce(function (total, group) { return total + (Array.isArray(group.todos) ? group.todos.length : 0) }, 0)),
            ),
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

      React.useEffect(function () {
        if (hoverOpen !== true) return undefined
        const onDown = function (event) {
          // 点击面板外部时收起临时展开；面板内部交给各自控件处理。
          const node = panelRef.current
          if (node !== null && node !== undefined && node.contains(event.target)) return
          setHoverOpen(false)
        }
        window.addEventListener('pointerdown', onDown)
        return function () { window.removeEventListener('pointerdown', onDown) }
      }, [hoverOpen])

      const panelCollapsed = collapsed && !(hoverOpen && !embedded)
      const uiSettings = data !== null && data !== undefined && data.ui !== null && data.ui !== undefined ? data.ui : {}
      const donePercent = typeof uiSettings.doneOpacity === 'number' ? Math.max(0, Math.min(100, uiSettings.doneOpacity)) : 35
      const partialPercent = typeof uiSettings.partialOpacity === 'number' ? Math.max(0, Math.min(100, uiSettings.partialOpacity)) : 67
      const panel = h(
        WindowFrame,
        {
          rootRef: panelRef,
          windowKey: 'main',
          zIndex: 2147482500,
          zIndexActive: 2147482515,
          className:
            'dtn-root' +
            (resizing ? ' dtn-resizing' : '') +
            (dragging ? ' dtn-dragging' : '') +
            (embedded ? ' dtn-embedded' : '') +
            (embedded && mode !== 'sidebar' ? ' dtn-hidden' : ''),
          headClassName: 'dtn-head',
          bodyClassName: 'dtn-body',
          style: Object.assign(
            {
              '--dtn-done-opacity': String(donePercent / 100),
              '--dtn-partial-opacity': String(partialPercent / 100),
            },
            embedded
              ? {}
              : {
                  left: panelLeftOf(panelPos, panelWidth, panelCollapsed) + 'px',
                  top: panelPos.y + 'px',
                  width: panelCollapsed ? undefined : panelWidth + 'px',
                  height: panelCollapsed ? '44px' : panelHeight === null ? undefined : panelHeight + 'px',
                },
          ),
          collapsed: collapsed === true && !embedded,
          expanded: hoverOpen === true && !embedded,
          onHoverEnter: embedded
            ? undefined
            : function () { if (collapsed) setHoverOpen(true) },
          onHoverLeave: embedded ? undefined : function () { if (hoverOpen) setHoverOpen(false) },
          onDragStart: embedded ? undefined : function (event) { startDrag(event, 'main') },
          onHeadClick: embedded
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
          onBodyPointerDown: beginMarquee,
          onResize: beginResize,
          resizeDirs: panelCollapsed || embedded ? null : ['r', 'l', 't', 'b', 'br'],
          head: [
            h('span', { key: 'logo', className: 'dtn-logo' }, icon('list', 14)),
            h('span', { key: 'title', className: 'dtn-title' }, 'TODO 便签'),
            h('span', { key: 'count', className: 'dtn-count' }, data === null ? '加载中…' : totalOpen + ' 条未完成'),
            embedded
              ? null
              : h(
                  'div',
                  { key: 'actions', className: 'dtn-actions' },
                  h(
                    'button',
                    { type: 'button', className: 'dtn-btn', title: '显示到右侧栏', onClick: function (event) { event.stopPropagation(); showInSidebar() } },
                    icon('panelRight'),
                  ),
                  h(
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
          ],
        },
        error !== '' ? h('div', { className: 'dtn-error' }, '读取失败：' + error) : null,
        renderSection('user', '用户级TODO', userGroups),
        renderSection('workspace', '工作区级TODO', workspaceGroups),
        renderSection('session', '会话级TODO', sessionGroups),
      )

      function previewFolderLabel(data) {
        if (data === null || data === undefined) return ''
        return folderDisplayName(preview !== null && preview !== undefined ? preview.groupKey : '', data.primaryFolder)
      }

      const previewPanel = h(
        'div',
        {
          className: 'dtn-preview' + (preview === null ? ' dtn-preview-off' : ''),
          style: { left: previewPos.x + 'px', top: previewPos.y + 'px', zIndex: 2147482514 },
          ref: previewRef,
          onMouseEnter: cancelClose,
          onMouseLeave: leavePreview,
        },
        preview === null
          ? null
          : [
              h(
                'div',
                { key: 'head', className: 'dtn-preview-head', onPointerDown: function (event) { startWindowMove(event, 'preview') } },
                h('span', { className: 'dtn-preview-title' }, previewData !== null && typeof previewData.title === 'string' ? previewData.title : preview.title),
                h(
                  'div',
                  { className: 'dtn-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dtn-btn',
                      title: '编辑正文',
                      onClick: function (event) { event.stopPropagation(); pinFromPreview(true) },
                    },
                    icon('edit'),
                  ),
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
                      h('span', { key: 'status', className: 'dtn-meta-item' }, icon(previewData.status === 'done' ? 'check' : 'clock', 11), previewData.status === 'done' ? '条目已完成' : previewData.status === 'partial' ? '条目待确认' : '条目未完成'),
                      h('span', { key: 'priority', className: 'dtn-meta-item', style: { color: prioColor(previewData.priority) } }, icon('flag', 11), '优先级 T' + (typeof previewData.priority === 'number' ? previewData.priority : 1)),
                      h('span', { key: 'folder', className: 'dtn-meta-item' }, icon('folder', 11), previewFolderLabel(previewData)),
                      previewData.created !== '' ? h('span', { key: 'created', className: 'dtn-meta-item' }, icon('clock', 11), '创建 ' + formatStamp(previewData.created)) : null,
                      isAiSource(previewData.source)
                        ? h('span', { key: 'source', className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13))
                        : null,
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
                    : typeof MarkdownText === 'function' || (MarkdownText !== null && typeof MarkdownText === 'object')
                    ? h(MarkdownText, { text: previewData.markdown, variant: 'body' })
                    : renderMarkdown(previewData.markdown),
              ),
            ],
      )

      const bubbleNodes = bubbles.map(function (entry) {
        return h(
          'div',
          {
            key: 'bubble-' + entry.id,
            className: 'dtn-bubble',
            style: { left: entry.x + 'px', top: entry.y + 'px' },
          },
          entry.text,
        )
      })

      function findLiveGroup(key) {
        if (data === null) return null
        const lists = [data.user].concat(data.workspaces || [], data.sessions || [])
        for (let i = 0; i < lists.length; i += 1) {
          if (lists[i] !== null && lists[i] !== undefined && lists[i].key === key) return lists[i]
        }
        return null
      }

      // 预览类窗口统一用这一处解析文件夹显示名，避免临时预览与保留窗口各写一套。
      function folderDisplayName(groupKey, folderId) {
        const id = typeof folderId === 'string' && folderId !== '' ? folderId : PRIMARY
        if (id === PRIMARY) return '无文件夹'
        const group = findLiveGroup(groupKey)
        const nodes = group === null || group === undefined || !Array.isArray(group.folders) ? [] : group.folders
        const trail = []
        const walk = function (list, path) {
          for (let index = 0; index < list.length; index += 1) {
            const node = list[index]
            if (node === null || node === undefined) continue
            const name = typeof node.name === 'string' && node.name !== '' ? node.name : node.id
            const next = path.concat(name)
            if (node.id === id) {
              trail.push.apply(trail, next)
              return true
            }
            if (Array.isArray(node.children) && walk(node.children, next)) return true
          }
          return false
        }
        walk(nodes, [])
        return trail.length > 0 ? trail.join(' / ') : id
      }

      const menuFolder = folderMenu === null ? null : findFolder((findLiveGroup(folderMenu.group.key) || folderMenu.group).folders, folderMenu.folderId)
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
                onClick: function (event) {
                  event.stopPropagation()
                  applyTreeOpen(false, [{ group: (findLiveGroup(folderMenu.group.key) || folderMenu.group), withHead: false, root: menuFolder }])
                  setFolderMenu(null)
                },
              },
              icon('chevronUp'),
              '全部收起',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  applyTreeOpen(true, [{ group: (findLiveGroup(folderMenu.group.key) || folderMenu.group), withHead: false, root: menuFolder }])
                  setFolderMenu(null)
                },
              },
              icon('chevronDown'),
              '全部展开',
            ),
            h('div', { className: 'dtn-menu-sep' }),
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
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  copyText(menuFolder.name || folderLabel(menuFolder.id)).then(function () {
                    showBubble('已复制标题文本', event)
                    setFolderMenu(null)
                  })
                },
              },
              icon('fileText'),
              '复制标题文本',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  const liveGroup = findLiveGroup(folderMenu.group.key) || folderMenu.group
                  const scope = liveGroup.kind === 'user'
                    ? '用户级'
                    : liveGroup.kind === 'workspace'
                      ? '工作区级 ' + (liveGroup.title || '')
                      : '会话级 ' + (liveGroup.subtitle || liveGroup.title || '')
                  const chain = scope + ' / ' + folderDisplayName(liveGroup.key, folderMenu.folderId)
                  copyText(chain).then(function () {
                    showBubble('已复制层级链文本', event)
                    setFolderMenu(null)
                  })
                },
              },
              icon('copy'),
              '复制层级链文本',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub',
                'data-sub': 'folder-move',
                onPointerEnter: function () { setSubOpen('folder-move') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'folder-move' ? '' : 'folder-move') },
              },
              icon('folder'),
              '移动到',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'folder-move' ? ' dtn-submenu-open' : '') },
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

      const treeMenuNode = treeMenu === null
        ? null
        : h(
            'div',
            {
              key: 'tree-menu',
              className: 'dtn-menu',
              style: { left: treeMenu.x + 'px', top: treeMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); toggleTree(treeMenu.target, false) },
              },
              icon('chevronUp'),
              '全部收起',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); toggleTree(treeMenu.target, true) },
              },
              icon('chevronDown'),
              '全部展开',
            ),
          )

      const todoMenuGroup = todoMenu === null ? null : (findLiveGroup(todoMenu.group.key) || todoMenu.group)
      const menuTodo = todoMenuGroup === null ? null : (Array.isArray(todoMenuGroup.todos) ? todoMenuGroup.todos : []).find(function (todo) { return todo.id === todoMenu.todoId })
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
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub',
                'data-sub': 'todo-prio',
                onPointerEnter: function () { setSubOpen('todo-prio') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'todo-prio' ? '' : 'todo-prio') },
              },
              icon('flag'),
              '设置优先级',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'todo-prio' ? ' dtn-submenu-open' : '') },
                prioChoiceNodes(function (value, event) { setTodoPriority(todoMenuGroup, menuTodo, value, event) }),
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); startRenameTodo(todoMenuGroup, menuTodo) },
              },
              icon('edit'),
              '重命名',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  copyText(menuTodo.title || '').then(function () {
                    showBubble('已复制标题文本', event)
                    setTodoMenu(null)
                  })
                },
              },
              icon('fileText'),
              '复制标题文本',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) {
                  event.stopPropagation()
                  const liveGroup = todoMenuGroup
                  const folderId = todoMenu.folderId !== undefined && todoMenu.folderId !== null ? todoMenu.folderId : menuTodo.primaryFolder
                  const scope = liveGroup.kind === 'user'
                    ? '用户级'
                    : liveGroup.kind === 'workspace'
                      ? '工作区级 ' + (liveGroup.title || '')
                      : '会话级 ' + (liveGroup.subtitle || liveGroup.title || '')
                  const chain = scope + ' / ' + folderDisplayName(liveGroup.key, folderId) + ' / ' + (menuTodo.title || '')
                  copyText(chain).then(function () {
                    showBubble('已复制层级链文本', event)
                    setTodoMenu(null)
                  })
                },
              },
              icon('copy'),
              '复制层级链文本',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub',
                'data-sub': 'todo-move',
                onPointerEnter: function () { setSubOpen('todo-move') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'todo-move' ? '' : 'todo-move') },
              },
              icon('folder'),
              '移动到',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'todo-move' ? ' dtn-submenu-open' : '') },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtn-menu-item',
                    style: { paddingLeft: '10px' },
                    onClick: function (event) { event.stopPropagation(); moveTodoToFolder(todoMenuGroup, menuTodo.id, PRIMARY, event) },
                  },
                  icon('folder'),
                  folderLabel(PRIMARY),
                ),
                folderOptions(todoMenuGroup).map(function (opt) {
                  return h(
                    'button',
                    {
                      key: opt.id,
                      type: 'button',
                      className: 'dtn-menu-item',
                      style: { paddingLeft: (10 + opt.depth * 14) + 'px' },
                      onClick: function (event) { event.stopPropagation(); moveTodoToFolder(todoMenuGroup, menuTodo.id, opt.id, event) },
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
              {
                className: 'dtn-menu-item dtn-has-sub',
                'data-sub': 'todo-collect',
                onPointerEnter: function () { setSubOpen('todo-collect') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'todo-collect' ? '' : 'todo-collect') },
              },
              icon('folder'),
              '管理收录',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'todo-collect' ? ' dtn-submenu-open' : '') },
                collectionOptions(todoMenuGroup).map(function (opt) {
                  const joined = todoJoined(todoMenuGroup, menuTodo, opt.id)
                  return h(
                    'div',
                    {
                      key: opt.id,
                      className: 'dtn-menu-item dtn-menu-check-row',
                      style: { paddingLeft: (10 + opt.depth * 14) + 'px' },
                      onClick: function (event) {
                        event.stopPropagation()
                        if (event.target !== null && event.target !== undefined && event.target.tagName === 'INPUT') return
                        toggleTodoReference(todoMenuGroup, menuTodo, opt.id, event)
                      },
                    },
                    h('input', {
                      type: 'checkbox',
                      className: 'dtn-menu-check',
                      checked: joined,
                      onPointerDown: function (event) { event.stopPropagation() },
                      onClick: function (event) { event.stopPropagation() },
                      onChange: function (event) {
                        event.stopPropagation()
                        const target = event.currentTarget
                        const rect = target !== null && target !== undefined && target.getBoundingClientRect !== undefined ? target.getBoundingClientRect() : null
                        const point = rect === null ? event : { clientX: rect.right, clientY: rect.top }
                        toggleTodoReference(todoMenuGroup, menuTodo, opt.id, point)
                      },
                    }),
                    h('span', { className: 'dtn-menu-label' }, opt.label),
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
                onClick: function (event) { event.stopPropagation(); deleteTodo(todoMenuGroup, menuTodo.id, event) },
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
                { key: 'head', className: 'dtn-preview-head', onPointerDown: function (event) { startWindowMove(event, 'batchCreate') } },
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
      updatePin(id, { editing: true, draft: win.markdown, renameDraft: win.title, editBaseMarkdown: win.markdown, editBaseTitle: win.title })
    }

    function cancelPinEditing(id) {
      const win = pinnedRef.current.find(function (item) { return item.id === id })
      if (win === undefined || win.editing !== true) return
      if (pinSaveTimers.current[id] !== undefined) {
        window.clearTimeout(pinSaveTimers.current[id])
        delete pinSaveTimers.current[id]
      }
      if (pinTitleTimers.current[id] !== undefined) {
        window.clearTimeout(pinTitleTimers.current[id])
        delete pinTitleTimers.current[id]
      }
      const baseMarkdown = typeof win.editBaseMarkdown === 'string' ? win.editBaseMarkdown : win.markdown
      const baseTitle = typeof win.editBaseTitle === 'string' ? win.editBaseTitle : win.title
      const bodyChanged = baseMarkdown !== win.markdown
      const titleChanged = baseTitle !== win.title
      updatePin(id, {
        editing: false,
        draft: undefined,
        renameDraft: undefined,
        markdown: baseMarkdown,
        title: baseTitle,
        editBaseMarkdown: undefined,
        editBaseTitle: undefined,
      })
      if (bodyChanged) {
        postApi({ action: 'saveTodoBody', key: win.groupKey, id: win.todoId, body: baseMarkdown })
          .then(function () { refresh(true) })
          .catch(function (error) { showBubble('撤销失败：' + (error && error.message ? error.message : String(error)), { clientX: win.pos.x + 40, clientY: win.pos.y + 16 }) })
      }
      if (titleChanged) {
        postApi({ action: 'renameTodo', key: win.groupKey, id: win.todoId, title: baseTitle })
          .then(function () { syncTodoTitle(win.groupKey, win.todoId, baseTitle); refresh(true) })
          .catch(function () {})
      }
      showBubble('已撤销编辑', { clientX: win.pos.x + 40, clientY: win.pos.y + 16 })
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

    function pinGutter(draft) {
      return String(draft || '').split('\n').map(function (line, index) {
        return h('div', { key: 'pin-line-' + index, className: 'dtn-batch-line' }, String(index + 1))
      })
    }

    function closePin(win) {
      if (win.kind === 'preview' && win.editing === true && win.draft !== win.markdown) {
        // 关窗前把还没等到自动保存的正文补写一次，避免编辑内容丢失。
        postApi({ action: 'saveTodoBody', key: win.groupKey, id: win.todoId, body: win.draft }).catch(function () {})
      }
      if (win.kind === 'preview' && win.editing === true) {
        const raw = String(win.renameDraft !== undefined && win.renameDraft !== null ? win.renameDraft : win.title).trim()
        const clamped = clampTitleDraft(raw)
        const title = clamped.text
        if (title !== '' && title !== win.title) {
          postApi({ action: 'renameTodo', key: win.groupKey, id: win.todoId, title: title })
            .then(function () { syncTodoTitle(win.groupKey, win.todoId, title) })
            .catch(function () {})
        }
      }
      removePin(win.id)
    }

    // 预览信息里的文件夹名与临时预览共用同一处解析。
    function pinFolderLabel(win) {
      const meta = win.meta
      return folderDisplayName(win.groupKey, meta !== null && meta !== undefined ? meta.primaryFolder : PRIMARY)
    }

    function pinHeadCommon(win) {
      return h('button', {
        type: 'button',
        className: 'dtn-btn',
        title: win.collapsed ? '展开' : '收起',
        onClick: function (event) { event.stopPropagation(); updatePin(win.id, { collapsed: !win.collapsed }) },
      }, icon(win.collapsed ? 'chevronRight' : 'chevronDown'))
    }

    function pinHeadClick(win) {
      return function (event) {
        if (pinDragMoved.current) {
          pinDragMoved.current = false
          return
        }
        if (event.target !== null && event.target !== undefined && event.target.closest !== undefined) {
          if (event.target.closest('button') !== null || event.target.closest('input') !== null) return
        }
        updatePin(win.id, { collapsed: !win.collapsed })
      }
    }

    function pinShell(win, options) {
      const expanded = win.collapsed !== true || hoverPin === win.id
      return h(
        WindowFrame,
        {
          key: win.id,
          pinId: win.id,
          windowKey: win.id,
          zIndex: 2147482510,
          zIndexActive: 2147482512,
          className: options.className + (pulsePin === win.id && win.kind === 'preview' ? ' dtn-pin-pulse' : ''),
          headClassName: options.headClassName,
          bodyClassName: 'dtn-pin-content',
          style: {
            left: win.pos.x + 'px',
            top: win.pos.y + 'px',
            width: win.width ? win.width + 'px' : undefined,
            height: expanded ? (win.height ? win.height + 'px' : undefined) : '40px',
          },
          collapsed: win.collapsed === true,
          expanded: hoverPin === win.id,
          onHoverEnter: function () { if (win.collapsed) setHoverPin(win.id) },
          onHoverLeave: function () { if (hoverPin === win.id) setHoverPin('') },
          onDragStart: function (event) { dragPinWindow(event, win.id) },
          onHeadClick: pinHeadClick(win),
          onResize: function (event, dir) { beginPinResize(event, win.id, dir) },
          resizeDirs: ['r', 'l', 't', 'b', 'br'],
          head: options.head,
        },
        options.body,
      )
    }

    function renderPinPreview(win) {
      const meta = win.meta
      const head = [
        h('span', { className: 'dtn-pin-type', title: '预览' }, icon('fileText', 13)),
        win.editing
          ? h('input', {
              className: 'dtn-pin-title-input',
              value: win.renameDraft !== undefined && win.renameDraft !== null ? win.renameDraft : win.title,
              spellCheck: false,
              onChange: function (event) {
                updatePin(win.id, { renameDraft: event.currentTarget.value })
                schedulePinTitleSave(win.id)
              },
              onPointerDown: function (event) { event.stopPropagation() },
              onKeyDown: function (event) {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                  if (pinTitleTimers.current[win.id] !== undefined) {
                    window.clearTimeout(pinTitleTimers.current[win.id])
                    delete pinTitleTimers.current[win.id]
                  }
                  savePinTitle(win.id)
                }
              },
            })
          : h('span', { className: 'dtn-preview-title' }, win.title),
        h(
          'div',
          { className: 'dtn-actions' },
          h('button', {
            type: 'button',
            className: 'dtn-btn',
            title: win.editing ? '保存并完成编辑' : '编辑正文',
            onClick: function (event) { event.stopPropagation(); togglePinEditing(win.id) },
          }, icon(win.editing ? 'check' : 'edit')),
          h('button', {
            type: 'button',
            className: 'dtn-btn',
            title: win.editing ? '取消编辑并还原内容' : '关闭',
            onClick: function (event) {
              event.stopPropagation()
              if (win.editing === true) cancelPinEditing(win.id)
              else closePin(win)
            },
          }, icon('close')),
          pinHeadCommon(win),
        ),
      ]
      const metaNodes = meta === null || meta === undefined
        ? [h('span', { key: 'loading' }, win.loading ? '加载中…' : '')]
        : [
            h('span', { key: 'status', className: 'dtn-meta-item' }, icon(meta.status === 'done' ? 'check' : 'clock', 11), meta.status === 'done' ? '条目已完成' : meta.status === 'partial' ? '条目待确认' : '条目未完成'),
            h('span', { key: 'priority', className: 'dtn-meta-item', style: { color: prioColor(meta.priority) } }, icon('flag', 11), '优先级 T' + (typeof meta.priority === 'number' ? meta.priority : 1)),
            h('span', { key: 'folder', className: 'dtn-meta-item' }, icon('folder', 11), pinFolderLabel(win)),
            meta.created !== '' ? h('span', { key: 'created', className: 'dtn-meta-item' }, icon('clock', 11), '创建 ' + formatStamp(meta.created)) : null,
            isAiSource(meta.source) ? h('span', { key: 'source', className: 'dtn-ai-chip', title: '该TODO条目由智能体创建' }, icon('robot', 13)) : null,
          ]
      const bodyNodes = [
        h('div', { key: 'meta', className: 'dtn-preview-meta' }, metaNodes),
        win.editing
          ? h(
              'div',
              { key: 'editor', className: 'dtn-preview-body dtn-edit-body' },
              h(
                'div',
                { className: 'dtn-batch-field' },
                h('div', {
                  className: 'dtn-batch-gutter',
                  ref: function (node) { if (node !== null) pinGutterRefs.current[win.id] = node },
                }, pinGutter(win.draft)),
                h('textarea', {
                  className: 'dtn-batch-input dtn-edit-input',
                  value: win.draft,
                  autoFocus: true,
                  wrap: 'off',
                  spellCheck: false,
                  rows: Math.min(24, Math.max(6, String(win.draft || '').split('\n').length)),
                  style: win.editHeight ? { height: win.editHeight + 'px' } : undefined,
                  onPointerDown: function (event) { event.stopPropagation() },
                  onPointerUp: function (event) {
                    // 用户拖动右下角改变过高度后记住它；自动增高仍以内容行数为下限。
                    const height = event.currentTarget.offsetHeight
                    if (Math.abs(height - editAutoHeight(win.draft)) > 8) updatePin(win.id, { editHeight: height })
                  },
                  onScroll: function (event) {
                    const gutter = pinGutterRefs.current[win.id]
                    if (gutter !== undefined && gutter !== null) gutter.scrollTop = event.currentTarget.scrollTop
                  },
                  onChange: function (event) {
                    const value = event.currentTarget.value
                    const minHeight = editAutoHeight(value)
                    const patch = { draft: value }
                    if (win.editHeight && minHeight > win.editHeight) patch.editHeight = minHeight
                    updatePin(win.id, patch)
                    schedulePinSave(win.id)
                  },
                }),
              ),
              win.error !== '' ? h('div', { className: 'dtn-error' }, win.error) : null,
            )
          : h(
              'div',
              { key: 'markdown', className: 'dtn-preview-body dtn-md' },
              win.error !== ''
                ? h('div', { className: 'dtn-error' }, '读取失败：' + win.error)
                : typeof MarkdownText === 'function' || (MarkdownText !== null && typeof MarkdownText === 'object')
                ? h(MarkdownText, { text: win.markdown, variant: 'body' })
                : renderMarkdown(win.markdown),
            ),
      ]
      return pinShell(win, {
        className: 'dtn-preview dtn-pin',
        headClassName: 'dtn-preview-head',
        head: head,
        body: bodyNodes,
      })
    }

    function renderPinBatchCreate(win) {
      const lines = String(win.value || '').split(/\r?\n/)
      const head = [
        h('span', { className: 'dtn-pin-type', title: '批量新建' }, icon('addBatch', 13)),
        h('span', { className: 'dtn-preview-title' }, '批量新建 TODO'),
        h(
          'div',
          { className: 'dtn-actions' },
          h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { removePin(win.id) } }, icon('close')),
          pinHeadCommon(win),
        ),
      ]
      return pinShell(win, {
        className: 'dtn-preview dtn-batch dtn-pin',
        headClassName: 'dtn-preview-head',
        head: head,
        body: h(
          'div',
          { className: 'dtn-preview-body' },
          h('div', { className: 'dtn-batch-hint' }, '每行一条，空行忽略'),
          h(
            'div',
            { className: 'dtn-batch-field' },
            h('div', { className: 'dtn-batch-gutter' }, lines.map(function (line, index) {
              return h('div', { key: 'pin-bc-line-' + index, className: 'dtn-batch-line' }, String(index + 1))
            })),
            h('textarea', {
              className: 'dtn-batch-input',
              value: win.value,
              wrap: 'off',
              onChange: function (event) { updatePin(win.id, { value: event.currentTarget.value }) },
            }),
          ),
          h(
            'div',
            { className: 'dtn-batch-actions' },
            h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { removePin(win.id) } }, '取消'),
            h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-primary', onClick: function () { confirmPinBatchCreate(win.id) } }, '确认'),
          ),
        ),
      })
    }

    function renderPinBatchRename(win) {
      const head = [
        h('span', { className: 'dtn-pin-type', title: '批量重命名' }, icon('edit', 13)),
        h('span', { className: 'dtn-preview-title' }, '批量重命名'),
        h(
          'div',
          { className: 'dtn-actions' },
          h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { removePin(win.id) } }, icon('close')),
          pinHeadCommon(win),
        ),
      ]
      return pinShell(win, {
        className: 'dtn-preview dtn-batch dtn-pin',
        headClassName: 'dtn-preview-head',
        head: head,
        body: h(
          'div',
          { className: 'dtn-preview-body' },
          h('div', { className: 'dtn-batch-hint' }, '行数固定为选中条目数，不能增加或删除换行；清空的行会被跳过'),
          h(
            'div',
            { className: 'dtn-batch-field' },
            h('div', { className: 'dtn-batch-gutter' }, win.items.map(function (item, index) {
              return h('div', { key: 'pin-br-line-' + index, className: 'dtn-batch-line' }, String(index + 1))
            })),
            h('textarea', {
              className: 'dtn-batch-input',
              value: win.value,
              wrap: 'off',
              rows: Math.min(12, Math.max(3, win.items.length)),
              onKeyDown: function (event) { if (event.key === 'Enter') event.preventDefault() },
              onChange: function (event) {
                const value = event.currentTarget.value
                if (String(value).split('\n').length !== win.items.length) return
                updatePin(win.id, { value: value })
              },
            }),
          ),
          h(
            'div',
            { className: 'dtn-batch-actions' },
            h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { removePin(win.id) } }, '取消'),
            h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-primary', onClick: function () { confirmPinBatchRename(win.id) } }, '确认'),
          ),
        ),
      })
    }

    function renderPinnedWindows() {
      return pinned.map(function (win) {
        if (win.kind === 'preview') return renderPinPreview(win)
        if (win.kind === 'batchCreate') return renderPinBatchCreate(win)
        return renderPinBatchRename(win)
      })
    }

      const prioRow = function (values) {
        return h(
          'div',
          { className: 'dtn-prio-row' },
          values.map(function (value) {
            const on = prioMenu !== null && prioMenu !== undefined && prioMenu.priority === value
            return h(
              'button',
              {
                key: value,
                type: 'button',
                className: 'dtn-prio-item' + (on ? ' dtn-prio-on' : ''),
                style: { color: prioColor(value) },
                title: '优先级 T' + value,
                onClick: function (event) { choosePriority(value, event) },
              },
              'T' + value,
            )
          }),
        )
      }
      const prioMenuNode = prioMenu === null
        ? null
        : h(
            'div',
            {
              key: 'prio-menu',
              className: 'dtn-prio-menu',
              style: { left: prioMenu.x + 'px', top: prioMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            prioRow([0, 1, 2, 3, 4]),
            prioRow([5, 6, 7, 8, 9]),
          )

      const batchTodoTotal = batchTodos().length
      const batchFolderTotal = batchFolders().length
      const batchMenuNode = batchMenu === null
        ? null
        : h(
            'div',
            {
              key: 'batch-menu',
              className: 'dtn-menu',
              style: { left: batchMenu.x + 'px', top: batchMenu.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub' + (batchTodoTotal === 0 ? ' dtn-menu-hide' : ''),
                'data-sub': 'batch-prio',
                onPointerEnter: function () { setSubOpen('batch-prio') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'batch-prio' ? '' : 'batch-prio') },
              },
              icon('flag'),
              '批量设置优先级',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'batch-prio' ? ' dtn-submenu-open' : '') },
                prioChoiceNodes(function (value, event) { applyBatchPriority(value, event) }),
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item',
                onClick: function (event) { event.stopPropagation(); openBatchRename() },
              },
              icon('edit'),
              '批量重命名',
            ),
            h('div', { className: 'dtn-menu-sep' + (batchTodoTotal === 0 ? ' dtn-menu-hide' : '') }),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub' + (batchTodoTotal === 0 ? ' dtn-menu-hide' : ''),
                'data-sub': 'batch-move',
                onPointerEnter: function () { setSubOpen('batch-move') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'batch-move' ? '' : 'batch-move') },
              },
              icon('folder'),
              '批量移动到',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'batch-move' ? ' dtn-submenu-open' : '') },
                batchFolderOptions().map(function (opt) {
                  return h(
                    'button',
                    {
                      key: opt.id,
                      type: 'button',
                      className: 'dtn-menu-item',
                      style: { paddingLeft: (10 + opt.depth * 14) + 'px' },
                      onClick: function (event) { event.stopPropagation(); applyBatchMove(opt.id) },
                    },
                    icon('folder'),
                    opt.label,
                  )
                }),
              ),
            ),
            h(
              'div',
              {
                className: 'dtn-menu-item dtn-has-sub' + (batchTodoTotal === 0 ? ' dtn-menu-hide' : ''),
                'data-sub': 'batch-collect',
                onPointerEnter: function () { setSubOpen('batch-collect') },
                onPointerLeave: function () { setSubOpen('') },
                onClick: function (event) { event.stopPropagation(); setSubOpen(subOpen === 'batch-collect' ? '' : 'batch-collect') },
              },
              icon('folder'),
              '批量管理收录',
              h('span', { className: 'dtn-menu-arrow' }, '›'),
              h(
                'div',
                { className: 'dtn-submenu' + (subOpen === 'batch-collect' ? ' dtn-submenu-open' : '') },
                (function () {
                  const total = batchTodos().length
                  return batchCollectFolders().map(function (opt) {
                    const count = batchFolderCount(opt.id)
                    return h(
                      'div',
                      {
                        key: opt.id,
                        className: 'dtn-menu-item dtn-menu-check-row',
                        style: { paddingLeft: (10 + opt.depth * 14) + 'px' },
                        onClick: function (event) {
                          event.stopPropagation()
                          if (event.target !== null && event.target !== undefined && event.target.tagName === 'INPUT') return
                          applyBatchCollectToggle(opt.id)
                        },
                      },
                      h('input', {
                        type: 'checkbox',
                        className: 'dtn-menu-check',
                        checked: total > 0 && count === total,
                        ref: function (node) {
                          if (node !== null && node !== undefined) node.indeterminate = count > 0 && count < total
                        },
                        onPointerDown: function (event) { event.stopPropagation() },
                        onClick: function (event) { event.stopPropagation() },
                        onChange: function (event) { event.stopPropagation(); applyBatchCollectToggle(opt.id) },
                      }),
                      h('span', { className: 'dtn-menu-label' }, opt.label),
                    )
                  })
                })(),
              ),
            ),
            h('div', { className: 'dtn-menu-sep' + (batchFolderTotal === 0 ? ' dtn-menu-hide' : '') }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item' + (batchFolderTotal === 0 ? ' dtn-menu-hide' : ''),
                onClick: function (event) { event.stopPropagation(); applyBatchExpand(false) },
              },
              icon('chevronUp'),
              '批量全部收起',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item' + (batchFolderTotal === 0 ? ' dtn-menu-hide' : ''),
                onClick: function (event) { event.stopPropagation(); applyBatchExpand(true) },
              },
              icon('chevronDown'),
              '批量全部展开',
            ),
            h('div', { className: 'dtn-menu-sep' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtn-menu-item dtn-danger',
                onClick: function (event) { event.stopPropagation(); applyBatchDelete(event) },
              },
              icon('trash'),
              '批量删除',
            ),
          )

      const batchRenameNode = batchRename === null
        ? null
        : h(
            'div',
            {
              key: 'batch-rename',
              className: 'dtn-preview dtn-batch',
              style: { left: batchRename.pos.x + 'px', top: batchRename.pos.y + 'px' },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h(
              'div',
              { className: 'dtn-preview-head', onPointerDown: function (event) { startWindowMove(event, 'batchRename') } },
              h('span', { className: 'dtn-preview-title' }, '批量重命名'),
              h(
                'div',
                { className: 'dtn-actions' },
                h('button', { type: 'button', className: 'dtn-btn', title: '关闭', onClick: function () { setBatchRename(null) } }, icon('close')),
              ),
            ),
            h(
              'div',
              { className: 'dtn-preview-body' },
              h('div', { className: 'dtn-batch-hint' }, '行数固定为选中条目数，不能增加或删除换行；清空的行会被跳过'),
              h(
                'div',
                { className: 'dtn-batch-field' },
                h(
                  'div',
                  { className: 'dtn-batch-gutter', ref: renameGutterRef },
                  batchRename.items.map(function (item, index) {
                    return h('div', { key: 'line-' + index, className: 'dtn-batch-line' }, String(index + 1))
                  }),
                ),
                h('textarea', {
                  className: 'dtn-batch-input',
                  value: batchRename.value,
                  autoFocus: true,
                  wrap: 'off',
                  rows: Math.min(12, Math.max(3, batchRename.items.length)),
                  onKeyDown: function (event) {
                    if (event.key === 'Enter') event.preventDefault()
                  },
                  onScroll: function (event) {
                    if (renameGutterRef.current !== null) renameGutterRef.current.scrollTop = event.currentTarget.scrollTop
                  },
                  onChange: function (event) {
                    const value = event.currentTarget.value
                    // 行数固定：换行既不能新增也不能删掉，否则该次输入整体丢弃。
                    if (String(value).split('\n').length !== batchRename.items.length) return
                    setBatchRename(function (state) { return state === null ? null : { items: state.items, value: value, pos: state.pos } })
                  },
                }),
              ),
              h(
                'div',
                { className: 'dtn-batch-actions' },
                h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { setBatchRename(null) } }, '取消'),
                h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-primary', onClick: confirmBatchRename }, '确认'),
              ),
            ),
          )

      const marqueeNode = marquee === null
        ? null
        : h('div', {
            key: 'marquee',
            className: 'dtn-marquee',
            style: { left: marquee.x + 'px', top: marquee.y + 'px', width: marquee.w + 'px', height: marquee.h + 'px' },
          })

      const confirmNode = confirmDialog === null
        ? null
        : h(
            'div',
            {
              key: 'confirm',
              className: 'dtn-menu dtn-confirm',
              style: {
                left: Math.max(8, Math.min(confirmDialog.x, window.innerWidth - 268)) + 'px',
                top: Math.max(8, Math.min(confirmDialog.y, window.innerHeight - 136)) + 'px',
              },
              onPointerDown: function (event) { event.stopPropagation() },
            },
            h('div', { className: 'dtn-confirm-text' }, confirmDialog.message),
            h(
              'div',
              { className: 'dtn-confirm-actions' },
              h('button', { type: 'button', className: 'dtn-preview-btn', onClick: function () { settleConfirm(false) } }, '取消'),
              h('button', { type: 'button', className: 'dtn-preview-btn dtn-preview-btn-danger', onClick: function () { settleConfirm(true) } }, '确认删除'),
            ),
          )

      const pinnedNodes = embedded ? null : renderPinnedWindows()
      const overlays = [panel, previewPanel, pinnedNodes, bubbleNodes, folderMenuNode, treeMenuNode, todoMenuNode, batchMenuNode, batchRenameNode, marqueeNode, batchNode, prioMenuNode, confirmNode]
      if (embedded) return h(React.Fragment, null, ...overlays)
      // 浮动实例整体放进 popover 顶层，保证不会被 DS Bot 等页面的侧边栏盖住。
      return h('div', { className: 'dtn-layer', popover: 'manual', ref: layerRef }, ...overlays)
    }

    // ------------------------------------------------------------ 设置页（DSH 设置 → 插件 → TODO 便签）

    const UI_DEFAULT_PALETTE = ['#e55353', '#eab308', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6']

    function splitPalette(raw) {
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (text === '') return UI_DEFAULT_PALETTE.slice()
      const parts = text.split(';').map(function (item) { return item.trim() }).filter(function (item) { return item !== '' })
      if (parts.length !== 10) return UI_DEFAULT_PALETTE.slice()
      return parts
    }

    function isHexColor(value) {
      return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    }

    function TodoNotesSettings() {
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [status, setStatus] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [doneOpacity, setDoneOpacity] = React.useState(35)
      const [partialOpacity, setPartialOpacity] = React.useState(67)
      const [palette, setPalette] = React.useState(UI_DEFAULT_PALETTE.slice())
      const [autosaveSec, setAutosaveSec] = React.useState('5')
      const [titleMax, setTitleMax] = React.useState('30')
      const [writePolicy, setWritePolicy] = React.useState('ask')
      const [injectAgentTodos, setInjectAgentTodos] = React.useState(true)
      const [injectMinPriority, setInjectMinPriority] = React.useState(2)
      const [injectDetail, setInjectDetail] = React.useState('headings')
      const [injectMaxItems, setInjectMaxItems] = React.useState('20')
      const [enableAnimations, setEnableAnimations] = React.useState(true)

      function applyUi(ui, config) {
        if (ui === null || ui === undefined) return
        setDoneOpacity(typeof ui.doneOpacity === 'number' ? ui.doneOpacity : 35)
        setPartialOpacity(typeof ui.partialOpacity === 'number' ? ui.partialOpacity : 67)
        setPalette(splitPalette(ui.priorityPalette))
        const delay = ui.bodyAutosaveMs !== null && ui.bodyAutosaveMs !== undefined
          ? ui.bodyAutosaveMs
          : (config !== null && config !== undefined && typeof config.bodyAutosaveMs === 'number' ? config.bodyAutosaveMs : 5000)
        setAutosaveSec(String(Math.max(1, Math.round(delay / 1000))))
        setTitleMax(String(typeof ui.titleMaxLength === 'number' ? ui.titleMaxLength : 30))
        if (ui.agentWritePolicy === 'deny' || ui.agentWritePolicy === 'ask' || ui.agentWritePolicy === 'agent-only' || ui.agentWritePolicy === 'allow-all') {
          setWritePolicy(ui.agentWritePolicy)
        } else {
          setWritePolicy('ask')
        }
        setInjectAgentTodos(ui.injectAgentTodos !== false)
        setInjectMinPriority(typeof ui.injectMinPriority === 'number' ? ui.injectMinPriority : 2)
        setInjectDetail(ui.injectDetail === 'title' || ui.injectDetail === 'body200' ? ui.injectDetail : 'headings')
        setInjectMaxItems(String(typeof ui.injectMaxItems === 'number' ? ui.injectMaxItems : 20))
        setEnableAnimations(ui.enableAnimations !== false)
      }

      React.useEffect(function () {
        let alive = true
        fetch(ROUTE + '?what=uiSettings&ts=' + Date.now(), { cache: 'no-store' })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (!alive) return
            if (payload !== null && payload !== undefined && payload.ok === true) applyUi(payload.ui, payload.config)
            else setError('读取设置失败')
            setLoading(false)
          })
          .catch(function (err) {
            if (!alive) return
            setError('读取设置失败：' + (err !== null && err !== undefined && err.message ? err.message : err))
            setLoading(false)
          })
        return function () { alive = false }
      }, [])

      function patchUi(body) {
        setBusy(true)
        setStatus('')
        return fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (payload !== null && payload !== undefined && payload.ok === true) {
              applyUi(payload.ui, payload.config)
              setStatus('已保存')
            } else {
              setStatus('保存失败：' + (payload !== null && payload !== undefined && payload.error ? payload.error : '未知错误'))
            }
            setBusy(false)
          })
          .catch(function (err) {
            setStatus('保存失败：' + (err !== null && err !== undefined && err.message ? err.message : err))
            setBusy(false)
          })
      }

      function save() {
        const seconds = Math.max(1, Math.min(60, Math.round(Number(autosaveSec) || 5)))
        const maxTitle = Math.max(1, Math.min(200, Math.round(Number(titleMax) || 30)))
        patchUi({
          action: 'saveUiSettings',
          ui: {
            doneOpacity: doneOpacity,
            partialOpacity: partialOpacity,
            priorityPalette: palette.join(';'),
            bodyAutosaveMs: seconds * 1000,
            agentWritePolicy: writePolicy,
            titleMaxLength: maxTitle,
            injectAgentTodos: injectAgentTodos,
            injectMinPriority: injectMinPriority,
            injectDetail: injectDetail,
            injectMaxItems: Math.max(1, Math.min(50, Math.round(Number(injectMaxItems) || 20))),
            enableAnimations: enableAnimations,
          },
        })
      }

      function reset() {
        patchUi({ action: 'resetUiSettings' })
      }

      function setColor(index, value) {
        setPalette(function (list) {
          const next = list.slice()
          next[index] = value
          return next
        })
      }

      function opacityRow(label, hint, value, onChange) {
        return h(
          'div',
          { className: 'tns-row' },
          h(
            'div',
            { className: 'tns-row-text' },
            h('div', { className: 'tns-label' }, label),
            h('div', { className: 'tns-hint' }, hint),
          ),
          h(
            'div',
            { className: 'tns-opacity' },
            h('input', {
              type: 'range', min: 0, max: 100, step: 1, value: value, className: 'tns-range',
              onChange: function (event) { onChange(Number(event.target.value)) },
            }),
            h('input', {
              type: 'number', min: 0, max: 100, value: value, className: 'tns-number',
              onChange: function (event) {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) onChange(Math.max(0, Math.min(100, Math.round(next))))
              },
            }),
            h('span', { className: 'tns-unit' }, '%'),
          ),
        )
      }

      return h(
        'div',
        { className: 'tns-page' },
        h('p', { className: 'tns-desc' }, '调整完成状态的外观与优先级颜色。改完点“保存”，设置会立即应用到所有面板。'),
        loading
          ? h('div', { className: 'tns-loading' }, '读取设置…')
          : h(
              React.Fragment,
              null,
              error !== '' ? h('div', { className: 'tns-error' }, error) : null,
              h(
                'div',
                { className: 'tns-actions' },
                h('button', { type: 'button', className: 'tns-btn', disabled: busy, onClick: reset }, '恢复默认'),
                h('button', { type: 'button', className: 'tns-btn tns-btn-primary', disabled: busy, onClick: save }, busy ? '保存中…' : '保存'),
                status !== '' ? h('span', { className: 'tns-status' }, status) : null,
              ),
              h(
                'div',
                { className: 'tns-preview-grid' },
                [['浅色主题', '#ffffff', '#1f1f24'], ['深色主题', '#1a1a1a', '#e8e8ea']].map(function (theme) {
                  return h(
                    'div',
                    { key: theme[0], className: 'tns-preview-box', style: { background: theme[1], color: theme[2], '--dsw-alias-label-primary': theme[2] } },
                    h('div', { className: 'tns-preview-label' }, theme[0]),
                    h(
                      'div',
                      { className: 'tns-preview-row' },
                      h('span', { className: 'tns-preview-check' }, '☐'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[3]) } }, 'T3'),
                      h('span', null, '未完成的条目'),
                    ),
                    h(
                      'div',
                      { className: 'tns-preview-row', style: { opacity: doneOpacity / 100 } },
                      h('span', { className: 'tns-preview-check' }, '☑'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[1]) } }, 'T1'),
                      h('span', null, '已完成的条目'),
                    ),
                    h(
                      'div',
                      { className: 'tns-preview-row', style: { opacity: partialOpacity / 100 } },
                      h('span', { className: 'tns-preview-check' }, '◐'),
                      h('span', { className: 'tns-preview-prio', style: { color: prioInk(palette[2]) } }, 'T2'),
                      h('span', null, '半完成、等待确认的条目'),
                    ),
                  )
                }),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, '状态外观'),
                opacityRow('已完成', '整行变淡，便于把注意力留在未完成项上', doneOpacity, setDoneOpacity),
                opacityRow('半完成', '智能体已勾选、等待你确认的条目', partialOpacity, setPartialOpacity),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, '优先级颜色'),
                h('p', { className: 'tns-hint' }, 'T0 最高，T9 最低。T0 默认跟随 DSH 错误色；10 档都可以点色块或用取色器改。'),
                h(
                  'div',
                  { className: 'tns-colors' },
                  [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]].map(function (column, columnIndex) {
                    return h(
                      'div',
                      { key: columnIndex, className: 'tns-color-column' },
                      column.map(function (index) {
                        const color = palette[index]
                        return h(
                          'div',
                          { key: index, className: 'tns-color-row' },
                          h('span', { className: 'tns-color-label' }, 'T' + index),
                          h('input', {
                            type: 'color', className: 'tns-color-input', value: isHexColor(color) ? color : '#888888',
                            onChange: function (event) { setColor(index, event.target.value) },
                          }),
                          h('input', {
                            type: 'text', className: 'tns-hex', value: color, spellCheck: false,
                            onChange: function (event) {
                              const next = String(event.target.value).trim()
                              if (next === '' || /^#[0-9a-fA-F]{0,6}$/.test(next)) setColor(index, next)
                            },
                            onBlur: function () {
                              const current = palette[index]
                              if (!isHexColor(current)) setColor(index, UI_DEFAULT_PALETTE[index])
                            },
                          }),
                        )
                      }),
                    )
                  }),
                ),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, '智能体上下文'),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '每轮注入当前会话的智能体 TODO'),
                    h('div', { className: 'tns-hint' }, '只注入会话级、由智能体创建且未完成的条目；默认开启'),
                  ),
                  h('input', {
                    type: 'checkbox', className: 'tns-check', checked: injectAgentTodos,
                    onChange: function (event) { setInjectAgentTodos(event.target.checked === true) },
                  }),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '注入最低优先级'),
                    h('div', { className: 'tns-hint' }, '只注入该优先级及更高的条目（T0 最高）'),
                  ),
                  h(
                    'select',
                    {
                      className: 'tns-select', value: String(injectMinPriority),
                      onChange: function (event) { setInjectMinPriority(Number(event.target.value)) },
                    },
                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (level) {
                      return h('option', { key: level, value: String(level) }, 'T' + level)
                    }),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '注入颗粒度'),
                    h('div', { className: 'tns-hint' }, '控制正文随标题注入多少内容'),
                  ),
                  h(
                    'select',
                    {
                      className: 'tns-select', value: injectDetail,
                      onChange: function (event) { setInjectDetail(event.target.value) },
                    },
                    h('option', { value: 'title' }, '仅TODO条目标题'),
                    h('option', { value: 'headings' }, 'TODO条目标题 + 所有正文 Markdown 标题'),
                    h('option', { value: 'body200' }, '条目标题 + 正文标题 + 正文前200行'),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '单次最多注入条目数'),
                    h('div', { className: 'tns-hint' }, '超过上限的条目不会进入本轮上下文，默认 20 条'),
                  ),
                  h(
                    'div',
                    { className: 'tns-opacity' },
                    h('input', {
                      type: 'number', min: 1, max: 50, value: injectMaxItems, className: 'tns-number',
                      onChange: function (event) { setInjectMaxItems(event.target.value) },
                    }),
                    h('span', { className: 'tns-unit' }, '条'),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '智能体存写（写入、修改、勾选、删除）行为'),
                    h('div', { className: 'tns-hint' }, '决定智能体调用工具时是否放行、是否先进入 DSH 审批'),
                  ),
                  h(
                    'select',
                    {
                      className: 'tns-select', value: writePolicy,
                      onChange: function (event) { setWritePolicy(event.target.value) },
                    },
                    h('option', { value: 'deny' }, '完全拒绝'),
                    h('option', { value: 'ask' }, '需要审批'),
                    h('option', { value: 'agent-only' }, '仅放行由智能体创建的条目'),
                    h('option', { value: 'allow-all' }, '放行所有条目'),
                  ),
                ),
              ),
              h(
                'section',
                { className: 'tns-section' },
                h('h3', { className: 'tns-section-title' }, '编辑与保存'),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '正文自动保存'),
                    h('div', { className: 'tns-hint' }, '停止输入后等待多久保存；标题使用同一个间隔'),
                  ),
                  h(
                    'div',
                    { className: 'tns-opacity' },
                    h('input', {
                      type: 'number', min: 1, max: 60, value: autosaveSec, className: 'tns-number',
                      onChange: function (event) { setAutosaveSec(event.target.value) },
                    }),
                    h('span', { className: 'tns-unit' }, '秒'),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '标题最大长度'),
                    h('div', { className: 'tns-hint' }, '手动改名与智能体创建、改名都受此限制；超出部分会被截掉，默认 30 个字'),
                  ),
                  h(
                    'div',
                    { className: 'tns-opacity' },
                    h('input', {
                      type: 'number', min: 1, max: 200, value: titleMax, className: 'tns-number',
                      onChange: function (event) { setTitleMax(event.target.value) },
                    }),
                    h('span', { className: 'tns-unit' }, '字'),
                  ),
                ),
                h(
                  'div',
                  { className: 'tns-row' },
                  h(
                    'div',
                    { className: 'tns-row-text' },
                    h('div', { className: 'tns-label' }, '启用 CSS 动画'),
                    h('div', { className: 'tns-hint' }, '关闭后收展、气泡与悬停过渡都不再播放'),
                  ),
                  h('input', {
                    type: 'checkbox', className: 'tns-check', checked: enableAnimations,
                    onChange: function (event) { setEnableAnimations(event.target.checked === true) },
                  }),
                ),
              ),
            ),
      )
    }

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
      const localRef = React.useRef(null)
      const [focused, setFocused] = React.useState(activeWindowKey === props.windowKey)
      React.useEffect(function () {
        if (props.expanded !== true || typeof window === 'undefined') return undefined
        const margin = 48
        const onMove = function (event) {
          const node = props.rootRef !== undefined && props.rootRef !== null ? props.rootRef.current : localRef.current
          if (node === null || node === undefined) return
          const rect = node.getBoundingClientRect()
          const inside =
            event.clientX >= rect.left - margin &&
            event.clientX <= rect.right + margin &&
            event.clientY >= rect.top - margin &&
            event.clientY <= rect.bottom + margin
          if (!inside && props.onHoverLeave !== undefined) props.onHoverLeave()
        }
        window.addEventListener('pointermove', onMove)
        return function () { window.removeEventListener('pointermove', onMove) }
      }, [props.expanded])
      React.useEffect(function () {
        if (typeof window === 'undefined') return undefined
        const onMove = function (event) {
          const node = props.rootRef !== undefined && props.rootRef !== null ? props.rootRef.current : localRef.current
          if (node === null || node === undefined || !node.contains(event.target)) return
          if (activeWindowKey === props.windowKey) return
          // 前层窗口的阴影范围仍属于前层，指针在阴影内划过时不抢焦点。
          if (activeWindowKey !== '' && typeof document !== 'undefined') {
            const top = document.querySelector('[data-dtn-window="' + activeWindowKey + '"]')
            if (top !== null && top !== undefined) {
              const rect = top.getBoundingClientRect()
              const margin = 48
              if (
                event.clientX >= rect.left - margin &&
                event.clientX <= rect.right + margin &&
                event.clientY >= rect.top - margin &&
                event.clientY <= rect.bottom + margin
              ) return
            }
          }
          activeWindowKey = props.windowKey
          if (typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent(WINDOW_FOCUS_EVENT, { detail: props.windowKey }))
          }
          if (props.onHoverEnter !== undefined) props.onHoverEnter(event)
        }
        window.addEventListener('pointermove', onMove)
        return function () { window.removeEventListener('pointermove', onMove) }
      }, [props.windowKey])
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
          ref: props.rootRef !== undefined && props.rootRef !== null ? props.rootRef : localRef,
          'data-dtn-pin': props.pinId,
          'data-dtn-window': props.windowKey,
          className: props.className + (collapsed ? ' dtn-collapsed' : '') + (focused ? ' dtn-window-focused' : ''),
          style: style,
          onPointerDown: function (event) {
            activeWindowKey = props.windowKey
            if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
              window.dispatchEvent(new CustomEvent(WINDOW_FOCUS_EVENT, { detail: props.windowKey }))
            }
            if (props.onFocus !== undefined) props.onFocus(event)
          },
          onMouseEnter: function (event) {
            // 阴影仍算前层：从这里进入下层时先不展开，等指针真正离开阴影后由 pointermove 接管。
            if (activeWindowKey !== '' && activeWindowKey !== props.windowKey && typeof document !== 'undefined') {
              const top = document.querySelector('[data-dtn-window="' + activeWindowKey + '"]')
              if (top !== null && top !== undefined) {
                const rect = top.getBoundingClientRect()
                const margin = 48
                if (
                  event.clientX >= rect.left - margin &&
                  event.clientX <= rect.right + margin &&
                  event.clientY >= rect.top - margin &&
                  event.clientY <= rect.bottom + margin
                ) return
              }
            }
            if (props.onHoverEnter !== undefined) props.onHoverEnter(event)
          },
          onMouseLeave: props.onHoverLeave,
        },
        head,
        body,
        handles,
      )
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
      // 与 billion-context 相同的注册方式：设置左侧导航的独立页面 + 插件详情页的配置区。
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'todo-notes', order: 60, label: 'TODO 便签' },
          TodoNotesSettings,
        )
      })
      ctx.slots.inject('plugins.bundle.config', function () {
        return ctx.slots.register(
          { name: 'plugins.bundle.config', key: 'dsh-todo-notes' },
          TodoNotesSettings,
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
