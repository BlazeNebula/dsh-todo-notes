/**
 * HTTP 层：/dsh-todo-notes/api 的读写路由。
 */
import { buildGroupsPayload, findTodoBody } from './groups.js'
import { handleWrite } from './write.js'

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(body)
}

/** 读取 JSON 请求体。 */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1024 * 1024) request.destroy()
    })
    request.on('end', () => {
      try {
        resolve(raw === '' ? {} : JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    request.on('error', reject)
  })
}


async function handleApi(request, response) {
  try {
    if (request.method === 'POST') {
      const body = await readJsonBody(request)
      const cwd = typeof body.cwd === 'string' ? body.cwd : ''
      const result = await handleWrite(body, cwd)
      sendJson(response, result.ok ? 200 : 400, result)
      return
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { ok: false, error: '仅支持 GET / POST' })
      return
    }
    const url = new URL(request.url || '/', 'http://localhost')
    const what = url.searchParams.get('what') || 'groups'
    const query = {
      cwd: url.searchParams.get('cwd') || '',
      session: url.searchParams.get('session') || '',
      sessionTitle: url.searchParams.get('sessionTitle') || '',
    }
    if (what === 'groups') {
      sendJson(response, 200, await buildGroupsPayload(query))
      return
    }
    if (what === 'todo') {
      const id = url.searchParams.get('id') || ''
      if (id === '') {
        sendJson(response, 400, { ok: false, error: '缺少 id' })
        return
      }
      const found = await findTodoBody(id, query)
      if (found === null) {
        sendJson(response, 404, { ok: false, error: '没有找到该条目' })
        return
      }
      sendJson(response, 200, {
        ok: true,
        id,
        title: found.summary.title,
        status: found.summary.status,
        priority: found.summary.priority,
        source: found.summary.source,
        primaryFolder: found.summary.primaryFolder,
        created: found.summary.created,
        updated: found.summary.updated,
        groupTitle: found.group.title,
        groupKind: found.group.kind,
        markdown: found.body,
        meta: found.meta,
      })
      return
    }
    sendJson(response, 404, { ok: false, error: '未知的查询类型' })
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}


export { handleApi }
