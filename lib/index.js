/**
 * dsh-todo-notes —— Host 半入口。
 *
 * 组装数据层、HTTP 路由与 Agent 工具，并导出 DSH 设置表单的 Config。
 */
import z from '@deepseek-ai/schemastery'
import { ROUTE } from './core/paths.js'
import { handleApi } from './core/http.js'
import { listTool, readTool, writeTools } from './core/tools.js'
import { setRuntimeConfig } from './core/runtime.js'

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
}
