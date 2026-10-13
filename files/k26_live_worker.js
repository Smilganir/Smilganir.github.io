// DRAFT live-results Worker (separate from workers/data-api/src/worker.js; not deployed).
// Bindings: LIVE_KV (KV namespace), UPLOAD_TOKEN (secret), ALLOWED_ORIGIN (comma list).
// PUT /live/results      Bearer token; body = JSON from k26_convert.py. Validated, regression-guarded, stored.
// GET /live/results.json Origin/Referer allow-list like /data/*; Cache-Control 30s.
// GET /live/status       tiny meta, same allow-list.
const MAX_BYTES = 3_000_000
function eq(a, b) { // constant-time-ish compare
  if (a.length !== b.length) return false
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0
}
function cors(o) { return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET,OPTIONS', Vary: 'Origin' } }
function allowed(request, list) {
  const o = (request.headers.get('Origin') || '').replace(/\/$/, ''), r = request.headers.get('Referer') || ''
  if (o && list.includes(o)) return o
  const hit = list.find(x => r === x || r.startsWith(x + '/'))
  return hit || null
}
function check(p, prev) {
  if (!p || p.schema !== 1 || p.election !== 'k26') return 'bad_schema'
  if (!Number.isInteger(p.ballots_counted) || !Number.isInteger(p.ballots_total) || p.ballots_total < 1) return 'bad_counts'
  if (p.ballots_counted > p.ballots_total) return 'counted_exceeds_total'
  if (!p.localities || typeof p.localities !== 'object') return 'no_localities'
  if (prev && p.ballots_counted < prev.ballots_counted) return 'regression'   // counts only go up
  if (prev && p.valid_total < prev.valid_total) return 'regression_valid'
  return null
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), origins = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
    if (url.pathname === '/live/results' && request.method === 'PUT') {
      const auth = request.headers.get('Authorization') || ''
      if (!env.UPLOAD_TOKEN || !eq(auth, 'Bearer ' + env.UPLOAD_TOKEN)) return new Response('Unauthorized', { status: 401 })
      const text = await request.text()
      if (text.length > MAX_BYTES) return new Response('Too large', { status: 413 })
      let p; try { p = JSON.parse(text) } catch { return new Response('Bad JSON', { status: 400 }) }
      const prevRaw = await env.LIVE_KV.get('latest'); const prev = prevRaw ? JSON.parse(prevRaw) : null
      const err = check(p, prev)
      if (err) return new Response(JSON.stringify({ rejected: err }), { status: err.startsWith('regression') ? 409 : 400 })
      if (prevRaw) await env.LIVE_KV.put('prev', prevRaw)      // one step of rollback
      await env.LIVE_KV.put('latest', text)
      return new Response(JSON.stringify({ ok: true, ballots_counted: p.ballots_counted }), { status: 200 })
    }
    if (request.method !== 'GET' && request.method !== 'OPTIONS') return new Response('Method not allowed', { status: 405 })
    if (url.pathname !== '/live/results.json' && url.pathname !== '/live/status') return new Response('Not found', { status: 404 })
    const o = allowed(request, origins)
    if (!o) return new Response('Forbidden', { status: 403, headers: cors(origins[0] || '') })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(o) })
    const raw = await env.LIVE_KV.get('latest')
    if (!raw) return new Response(JSON.stringify({ available: false }), { status: 200, headers: { ...cors(o), 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15' } })
    let body = raw
    if (url.pathname === '/live/status') { const p = JSON.parse(raw); body = JSON.stringify({ available: true, generated_at: p.generated_at, ballots_counted: p.ballots_counted, ballots_total: p.ballots_total, pct_counted: p.pct_counted }) }
    return new Response(body, { status: 200, headers: { ...cors(o), 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30, s-maxage=30' } })
  },
}
