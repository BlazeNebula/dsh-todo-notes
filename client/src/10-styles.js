    const CSS = `
.dtn-root {
  position: fixed;
  z-index: 2147482500;
  width: 480px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
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
.dtn-group-body { padding: 2px 4px 6px 12px; }
.dtn-folder { margin: 1px 0; }
.dtn-folder-head {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 5px; border-radius: 5px; cursor: pointer;
  color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 12px;
}
.dtn-folder-head:hover { background: var(--dsw-alias-bg-layer-1, #232328); }
.dtn-folder-name { display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 65%, transparent); }
.dtn-folder-count { margin-left: auto; font-size: 10.5px; }
.dtn-todo {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 0 3px 6px; border-radius: 6px; cursor: pointer;
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
.dtn-check.dtn-check-partial {
  border-color: var(--dsw-alias-state-warn-primary, #d6a63c);
  color: var(--dsw-alias-state-warn-primary, #d6a63c);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d6a63c) 18%, transparent);
}
.dtn-todo.dtn-partial { opacity: var(--dtn-partial-opacity, .75); }
.dtn-todo-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dtn-grip {
  flex: none; width: 28px; height: 18px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-label-secondary, #a3a3ab); opacity: 0; cursor: grab;
}
.dtn-todo:hover .dtn-grip, .dtn-folder-head:hover .dtn-grip { opacity: .8; }
.dtn-grip:active { cursor: grabbing; }
.dtn-selected,
.dtn-selected:hover {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d9cff) 16%, transparent);
}
.dtn-marquee {
  position: fixed;
  z-index: 2147482500;
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
  position: fixed; z-index: 2147482502; min-width: 148px; padding: 5px;
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
.dtn-prio option { background: var(--dsw-alias-bg-overlay, #242429); color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent); }
.dtn-prio-menu {
  position: fixed; z-index: 2147482502; display: flex; flex-direction: column;
  padding: 4px; border-radius: 8px;
  background: var(--dsw-alias-bg-overlay, #242429);
  border: 1px solid rgba(255, 255, 255, 0.06);
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
  position: fixed; z-index: 2147482501; pointer-events: none;
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
  position: fixed; z-index: 2147482499; width: 440px;
  max-width: calc(100vw - 24px); max-height: 72vh;
  display: flex; flex-direction: column;
  color: color-mix(in srgb, var(--dsw-alias-label-primary, #e8e8ea) 80%, transparent);
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
.dtn-preview.dtn-pin { z-index: 2147482400; }
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
.tns-preview { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: var(--dsw-alias-bg-layer-1, #232327); }
.tns-preview-label { margin-bottom: 6px; color: var(--dsw-alias-label-secondary, #a3a3ab); font-size: 11px; }
.tns-preview-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.tns-preview-check { width: 14px; color: var(--dsw-alias-label-secondary, #a3a3ab); }
.tns-preview-prio { font-weight: 600; font-size: 11px; }
.tns-colors { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin-top: 10px; }
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
.tns-color-chip { width: 18px; height: 18px; border-radius: 5px; border: 1px solid var(--dsw-alias-border-l2, #3a3a41); }
.tns-actions { display: flex; align-items: center; gap: 10px; padding-top: 4px; }
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
