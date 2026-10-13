// Draft client poller for the live results route (pure JS so it can be tested in Node and reused by a React hook).
// States: idle | live | stale | error. Keeps the last good payload on any failure. Never moves counts backwards.
export function createPoller({ url, fetchImpl = fetch, now = () => Date.now(), staleAfterMs = 180000, onState = () => {} }) {
  let last = null, lastOkAt = 0, failures = 0, state = 'idle', lastError = null
  const emit = () => onState(snapshot())
  const snapshot = () => ({ state, data: last, failures, lastError, ageMs: lastOkAt ? now() - lastOkAt : null })
  function accept(p) {
    if (!p || p.available === false) return 'not_available'
    if (p.schema !== 1 || p.election !== 'k26') return 'bad_schema'
    if (!Number.isInteger(p.ballots_counted) || !(p.ballots_total > 0) || p.ballots_counted > p.ballots_total) return 'bad_counts'
    if (last && p.ballots_counted < last.ballots_counted) return 'older_than_shown'
    return null
  }
  async function tick() {
    try {
      const res = await fetchImpl(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('http_' + res.status)
      const p = await res.json()
      const bad = accept(p)
      if (bad === 'not_available') { lastError = bad } // nothing published yet: keep waiting, not an error
      else if (bad) throw new Error(bad)
      else { last = p; lastOkAt = now(); failures = 0; lastError = null }
    } catch (e) { failures++; lastError = String(e.message || e) }
    if (!last) state = failures >= 3 ? 'error' : 'idle'
    else state = (now() - lastOkAt > staleAfterMs) ? 'stale' : 'live'
    emit(); return snapshot()
  }
  // next delay: 30s normally, backing off to 120s on repeated failures. Pause when tab hidden is the caller's job.
  const nextDelayMs = () => Math.min(120000, 30000 * (1 + Math.min(failures, 3)))
  return { tick, snapshot, nextDelayMs }
}
