import w from './k26_live_worker.js'
import fs from 'fs'
const kv = new Map(), env = { LIVE_KV: { get: async k => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v) }, UPLOAD_TOKEN: 'TEST-ONLY', ALLOWED_ORIGIN: 'https://smilganir.github.io,https://nirsmilga.com' }
const good = fs.readFileSync(process.argv[2], 'utf8'), P = JSON.parse(good)
const call = (m, path, o = {}) => w.fetch(new Request('https://x.test' + path, { method: m, ...o }), env)
const res = []; const t = (name, got, want) => res.push([got === want ? 'PASS' : 'FAIL', name, got, want])
const auth = { Authorization: 'Bearer TEST-ONLY' }
t('PUT no token', (await call('PUT', '/live/results', { body: good })).status, 401)
t('PUT wrong token', (await call('PUT', '/live/results', { body: good, headers: { Authorization: 'Bearer x' } })).status, 401)
t('PUT garbage', (await call('PUT', '/live/results', { body: '<html>', headers: auth })).status, 400)
t('PUT wrong election', (await call('PUT', '/live/results', { body: JSON.stringify({ ...P, election: 'k25' }), headers: auth })).status, 400)
t('GET before first upload', JSON.parse(await (await call('GET', '/live/results.json', { headers: { Origin: 'https://smilganir.github.io' } })).text()).available, false)
t('PUT good', (await call('PUT', '/live/results', { body: good, headers: auth })).status, 200)
const g = await call('GET', '/live/results.json', { headers: { Origin: 'https://smilganir.github.io' } })
t('GET allowed origin', g.status, 200); t('cache 30s', g.headers.get('Cache-Control'), 'public, max-age=30, s-maxage=30')
t('GET no origin', (await call('GET', '/live/results.json')).status, 403)
t('GET lookalike origin', (await call('GET', '/live/results.json', { headers: { Origin: 'https://smilganir.github.io.evil.com' } })).status, 403)
t('GET referer ok', (await call('GET', '/live/status', { headers: { Referer: 'https://nirsmilga.com/x' } })).status, 200)
t('PUT regression (fewer ballots)', (await call('PUT', '/live/results', { body: JSON.stringify({ ...P, ballots_counted: P.ballots_counted - 5 }), headers: auth })).status, 409)
t('PUT counted>total', (await call('PUT', '/live/results', { body: JSON.stringify({ ...P, ballots_counted: P.ballots_total + 1 }), headers: auth })).status, 400)
t('PUT more ballots ok', (await call('PUT', '/live/results', { body: JSON.stringify({ ...P, ballots_counted: P.ballots_counted + 5, valid_total: P.valid_total + 9 }), headers: auth })).status, 200)
t('prev kept for rollback', JSON.parse(kv.get('prev')).ballots_counted, P.ballots_counted)
t('POST rejected', (await call('POST', '/live/results.json', { headers: { Origin: 'https://smilganir.github.io' } })).status, 405)
for (const r of res) console.log(...r); console.log(res.every(r => r[0] === 'PASS') ? 'ALL PASS' : 'SOME FAIL')
