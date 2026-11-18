    // ------------------------------------------------------------ 本地化（UI 文案）

    // 命名空间与 DSH 的 locale 服务共用；字典必须同时提供 zh 与 en 两个基线语言，
    // 其余语言由 `ctx.locale.addLanguage` 的插件按回退链补齐。
    const I18N_NS = 'dsh-todo-notes'

    // 键名用英文语义名，中文为源文案（也是没有 locale 服务时的回退）。
    const I18N_ZH = {
      appTitle: 'TODO 便签',

      settingsIntro: '调整完成状态的外观与优先级颜色。改完点“保存”，设置会立即应用到所有面板。',
      settingsLoading: '读取设置…',
      settingsReset: '恢复默认',
      settingsSaving: '保存中…',
      settingsSave: '保存',
      settingsSaved: '已保存',
      settingsLoadFailed: '读取设置失败',
      settingsLoadFailedDetail: '读取设置失败：{detail}',
      settingsSaveFailedDetail: '保存失败：{detail}',
      settingsUnknownError: '未知错误',

      previewLight: '浅色主题',
      previewDark: '深色主题',
      previewOpen: '未完成的条目',
      previewDone: '已完成的条目',
      previewPartial: '半完成、等待确认的条目',

      sectionAppearance: '状态外观',
      doneLabel: '已完成',
      doneHint: '整行变淡，便于把注意力留在未完成项上',
      partialLabel: '半完成',
      partialHint: '智能体已勾选、等待你确认的条目',

      sectionPriority: '优先级颜色',
      priorityHint: 'T0 最高，T9 最低。T0 默认跟随 DSH 错误色；10 档都可以点色块或用取色器改。',

      sectionAgent: '智能体上下文',
      injectLabel: '每轮注入当前会话的智能体 TODO',
      injectHint: '只注入会话级、由智能体创建且未完成的条目；默认开启',
      minPriorityLabel: '注入最低优先级',
      minPriorityHint: '只注入该优先级及更高的条目（T0 最高）',
      detailLabel: '注入颗粒度',
      detailHint: '控制正文随标题注入多少内容',
      detailTitle: '仅 TODO 条目标题',
      detailHeadings: 'TODO 条目标题 + 所有正文 Markdown 标题',
      detailBody200: '条目标题 + 正文标题 + 正文前 200 行',
      maxItemsLabel: '单次最多注入条目数',
      maxItemsHint: '超过上限的条目不会进入本轮上下文，默认 20 条',
      itemsUnit: '条',

      writePolicyLabel: '智能体存写（写入、修改、勾选、删除）行为',
      writePolicyHint: '决定智能体调用工具时是否放行、是否先进入 DSH 审批',
      policyDeny: '完全拒绝',
      policyAsk: '需要审批',
      policyAgentOnly: '仅放行由智能体创建的条目',
      policyAllowAll: '放行所有条目',

      sectionEditing: '编辑与保存',
      autosaveLabel: '正文自动保存',
      autosaveHint: '停止输入后等待多久保存；标题使用同一个间隔',
      secondsUnit: '秒',
      titleMaxLabel: '标题最大长度',
      titleMaxHint: '手动改名与智能体创建、改名都受此限制；超出部分会被截掉，默认 30 个字',
      charsUnit: '字',
      animationsLabel: '启用 CSS 动画',
      animationsHint: '关闭后收展、气泡与悬停过渡都不再播放',
    }

    const I18N_EN = {
      appTitle: 'TODO Notes',

      settingsIntro: 'Adjust how completed states and priority colors look. Click "Save" to apply the changes to every panel immediately.',
      settingsLoading: 'Loading settings…',
      settingsReset: 'Restore defaults',
      settingsSaving: 'Saving…',
      settingsSave: 'Save',
      settingsSaved: 'Saved',
      settingsLoadFailed: 'Could not load settings',
      settingsLoadFailedDetail: 'Could not load settings: {detail}',
      settingsSaveFailedDetail: 'Could not save: {detail}',
      settingsUnknownError: 'Unknown error',

      previewLight: 'Light theme',
      previewDark: 'Dark theme',
      previewOpen: 'Open item',
      previewDone: 'Completed item',
      previewPartial: 'Half-done item awaiting your confirmation',

      sectionAppearance: 'State appearance',
      doneLabel: 'Completed',
      doneHint: 'The whole row fades so attention stays on open items',
      partialLabel: 'Half-done',
      partialHint: 'Items an agent checked off, waiting for your confirmation',

      sectionPriority: 'Priority colors',
      priorityHint: 'T0 is highest, T9 lowest. T0 follows the DSH error color by default; all ten can be changed by clicking a swatch or with the color picker.',

      sectionAgent: 'Agent context',
      injectLabel: 'Inject this session’s agent TODOs every step',
      injectHint: 'Only session-scope, agent-created, unfinished items are injected; on by default',
      minPriorityLabel: 'Minimum priority',
      minPriorityHint: 'Only items at this priority or higher are injected (T0 is highest)',
      detailLabel: 'Injection detail',
      detailHint: 'How much body text accompanies each title',
      detailTitle: 'Titles only',
      detailHeadings: 'Titles + every Markdown heading in the body',
      detailBody200: 'Titles + body headings + first 200 lines',
      maxItemsLabel: 'Max items per step',
      maxItemsHint: 'Items beyond the cap stay out of this step’s context; default 20',
      itemsUnit: 'items',

      writePolicyLabel: 'Agent write behavior (create, update, check, delete)',
      writePolicyHint: 'Whether agent tool calls are allowed, and whether they go through DSH approval first',
      policyDeny: 'Deny everything',
      policyAsk: 'Require approval',
      policyAgentOnly: 'Only agent-created entries',
      policyAllowAll: 'Allow all entries',

      sectionEditing: 'Editing and saving',
      autosaveLabel: 'Body autosave',
      autosaveHint: 'How long to wait after typing stops; titles use the same interval',
      secondsUnit: 'sec',
      titleMaxLabel: 'Max title length',
      titleMaxHint: 'Applies to manual renames and to agent creates and renames; extra characters are cut. Default 30',
      charsUnit: 'chars',
      animationsLabel: 'Enable CSS animations',
      animationsHint: 'When off, expand, collapse, bubble and hover transitions stop playing',
    }

    function i18nInterpolate(text, params) {
      if (params === undefined || params === null) return text
      return String(text).replace(/\{(\w+)\}/g, function (match, key) {
        const value = params[key]
        return value === undefined || value === null ? match : String(value)
      })
    }

    // 默认回退到中文源文案；apply 时若宿主提供 locale 服务则换成绑定函数。
    let tr = function (key, params) {
      const text = I18N_ZH[key] !== undefined ? I18N_ZH[key] : key
      return i18nInterpolate(text, params)
    }
