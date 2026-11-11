/**
 * dsh-todo-notes —— Host 半入口。
 *
 * 组装数据层、HTTP 路由与 Agent 工具，并导出 DSH 设置表单的 Config。
 */
import z from '@deepseek-ai/schemastery'
import { randomUUID } from 'node:crypto'
import { ROUTE } from './core/paths.js'
import { handleApi } from './core/http.js'
import { listTool, readTool, writeTools } from './core/tools.js'
import { setRuntimeConfig } from './core/runtime.js'
import { loadSessionTodos } from './core/groups.js'
import { readUiSettings } from './core/ui-settings.js'

export const name = 'dsh-todo-notes'
export const inject = ['tools', 'webServer']

/** 插件设置：在 DSH 设置页自动渲染成表单。 */
export const Config = z.object({
  agentWriteUserTodos: z
    .boolean()
    .default(false)
    .description('允许智能体通过工具改写、勾选或删除用户手写的 TODO。默认关闭；开启后每次写入仍需 DSH 审批。'),
  bodyAutosaveMs: z
    .number()
    .min(1000)
    .max(60000)
    .default(5000)
    .description('预览面板正文编辑停止输入后，等待多久自动保存（毫秒）。'),
})

export function apply(ctx, config) {
  const settings = {
    agentWriteUserTodos:
      config !== null && config !== undefined && typeof config === 'object' && config.agentWriteUserTodos === true,
    bodyAutosaveMs:
      config !== null && config !== undefined && typeof config === 'object' ? config.bodyAutosaveMs : undefined,
  }
  setRuntimeConfig(settings)

  ctx.inject(['tools'], (toolsCtx) => {
    const tools = toolsCtx.get('tools')
    toolsCtx.effect(() => tools.register(listTool), 'dsh-todo-notes: tool todo_notes_list')
    toolsCtx.effect(() => tools.register(readTool), 'dsh-todo-notes: tool todo_notes_read')
    for (const tool of writeTools(ctx, settings)) {
      toolsCtx.effect(() => tools.register(tool), 'dsh-todo-notes: tool ' + tool.name)
    }
  })
  ctx.inject(['webServer'], (hostCtx) => {
    hostCtx.effect(
      () => hostCtx.webServer.register({ kind: 'prefix', path: ROUTE, handler: handleApi }),
      'dsh-todo-notes: web route',
    )
  })

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision === null || decision === undefined || decision.kind !== 'enter') return decision
    if (payload.step > 1) return decision
    try {
      const ui = await readUiSettings()
      if (ui.injectAgentTodos !== true) return decision
      const todos = await loadSessionTodos(String(payload.agent.id || ''))
      const picked = todos.filter((todo) => {
        const source = String(todo.source || '')
        if (!source.startsWith('session:')) return false
        if (todo.status === 'done') return false
        const priority = typeof todo.priority === 'number' ? todo.priority : 1
        return priority <= ui.injectMinPriority
      })
      if (picked.length === 0) return decision
      const lines = ['【TODO 便签】当前会话中由智能体创建、尚未完成的条目（供参考，不必逐条复述）：']
      for (const todo of picked.slice(0, ui.injectMaxItems)) {
        lines.push('- T' + (typeof todo.priority === 'number' ? todo.priority : 1) + ' ' + String(todo.title || '').replace(/\s+/g, ' ').slice(0, 120))
        if (ui.injectDetail === 'headings' || ui.injectDetail === 'body200') {
          const body = String(todo.markdown || '')
          const headings = body.split('\n').filter((line) => /^#{1,6}\s+/.test(line.trim())).slice(0, 8)
          for (const heading of headings) lines.push('  ' + heading.trim().slice(0, 100))
          if (ui.injectDetail === 'body200') {
            const rows = body
              .split('\n')
              .slice(0, 200)
              .filter((line) => !/^#{1,6}\s+/.test(line.trim()))
            const text = rows.join('\n').trim()
            if (text !== '') lines.push('  ' + text.slice(0, 1200).replace(/\n/g, '\n  '))
          }
        }
      }
      const content = decision.messages.slice()
      content.push({ id: randomUUID(), role: 'user', content: [{ type: 'text', text: lines.join('\n') }] })
      return Object.assign({}, decision, { messages: content })
    } catch {
      return decision
    }
  })
}
