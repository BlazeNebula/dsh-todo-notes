/**
 * 运行时配置：Host 侧保留当前生效的插件设置，供 HTTP 与工具层读取。
 */
const DEFAULTS = {
  agentWriteUserTodos: false,
  bodyAutosaveMs: 5000,
}

let current = Object.assign({}, DEFAULTS)

function setRuntimeConfig(next) {
  const merged = Object.assign({}, DEFAULTS, current, next !== null && typeof next === 'object' ? next : {})
  const delay = Number(merged.bodyAutosaveMs)
  merged.bodyAutosaveMs = Number.isFinite(delay) ? Math.max(1000, Math.min(60000, Math.round(delay))) : DEFAULTS.bodyAutosaveMs
  merged.agentWriteUserTodos = merged.agentWriteUserTodos === true
  current = merged
  return current
}

function getRuntimeConfig() {
  return Object.assign({}, current)
}

export { setRuntimeConfig, getRuntimeConfig }
