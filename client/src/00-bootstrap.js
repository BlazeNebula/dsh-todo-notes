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
    const LS_WINDOWS = 'dsh.todo-notes.windows.v1'
    // 浮动面板与右侧栏两个实例之间的同步信号：任一侧写入成功后广播一次。
    const SYNC_BUS = typeof EventTarget === 'function' ? new EventTarget() : null
    // 面板最窄与 DSH 侧边栏一致（264），收起时也用这个宽度。
    const MIN_PANEL_WIDTH = 264
