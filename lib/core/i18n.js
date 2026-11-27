/**
 * 宿主端文案：只覆盖用户会看到的部分（审批理由、拒批、策略拒绝）。
 *
 * 语言取自 DSH 的 locale 设置（设置页「语言」写入 locale.preference），
 * 读不到时回退中文。工具描述与结果文案仍保持中文：模型读懂中文没有障碍，
 * 而这些结果句与中文面板混排时更容易读。
 */
const CACHE_TTL_MS = 30000

const DICT = {
  zh: {
    scopeUser: '用户级',
    scopeWorkspace: '工作区级',
    scopeSession: '会话级',
    approveCreate: '创建 TODO「{title}」（{scope}）',
    approveUpdate: '修改 TODO「{title}」的{changes}',
    approveDelete: '删除 TODO「{title}」',
    approveToggle: '勾选 TODO「{title}」',
    approveUntoggle: '取消勾选 TODO「{title}」',
    changeTitle: '标题',
    changeBody: '正文',
    changePriority: '优先级 T{level}',
    changePartial: '中间态（待人工确认）',
    changeUncheck: '取消勾选',
    changeFolder: '文件夹',
    refuseMissingApproval: '当前 DSH 没有提供审批服务，写操作已取消。',
    refuseDenied: 'DSH 审批未通过，写操作已取消。',
    refuseError: '审批请求失败，写操作已取消。',
    policyDeny: '当前设置「完全拒绝」不允许智能体写入。',
    policyAgentOnly: '当前设置只放行智能体创建的条目；这条由用户手动创建，请让用户在面板里修改。',
  },
  en: {
    scopeUser: 'user level',
    scopeWorkspace: 'workspace level',
    scopeSession: 'session level',
    approveCreate: 'Create TODO "{title}" ({scope})',
    approveUpdate: 'Update TODO "{title}": {changes}',
    approveDelete: 'Delete TODO "{title}"',
    approveToggle: 'Check off TODO "{title}"',
    approveUntoggle: 'Uncheck TODO "{title}"',
    changeTitle: 'title',
    changeBody: 'body',
    changePriority: 'priority T{level}',
    changePartial: 'half-done (awaiting confirmation)',
    changeUncheck: 'uncheck',
    changeFolder: 'folder',
    refuseMissingApproval: 'This DSH offers no approval service, so the write was cancelled.',
    refuseDenied: 'DSH approval was not granted, so the write was cancelled.',
    refuseError: 'The approval request failed, so the write was cancelled.',
    policyDeny: 'The current "deny" setting does not allow agent writes.',
    policyAgentOnly: 'The current setting only allows entries an agent created; this one was written by the user, so edit it in the panel.',
  },
}

let cached = { at: 0, lang: 'en' }

/** 从 locale 设置读出当前语言；读取失败或未设置时回退中文。 */
async function languageOf(ctx) {
  const now = Date.now()
  if (now - cached.at < CACHE_TTL_MS) return cached.lang
  let lang = 'en'
  try {
    const settings = typeof ctx.get === 'function' ? ctx.get('settings') : ctx.settings
    if (settings !== null && settings !== undefined && typeof settings.describe === 'function') {
      const described = settings.describe({ redactSecrets: true })
      const locale = Array.isArray(described) ? described.find((item) => item !== null && item.ns === 'locale') : undefined
      const preference = locale !== null && locale !== undefined && locale.value !== null && locale.value !== undefined && typeof locale.value.preference === 'string'
        ? locale.value.preference
        : ''
      if (preference !== '') lang = preference.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
    }
  } catch {
    lang = 'en'
  }
  cached = { at: now, lang }
  return lang
}

function t(lang, key, params) {
  const dict = DICT[lang] !== undefined ? DICT[lang] : DICT.zh
  const text = dict[key] !== undefined ? dict[key] : key
  if (params === undefined || params === null) return text
  return String(text).replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name]
    return value === undefined || value === null ? match : String(value)
  })
}

export { languageOf, t }
