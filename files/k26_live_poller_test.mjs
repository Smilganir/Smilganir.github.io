import { createPoller } from './k26_live_poller.js'
import fs from 'fs'
const P = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); let t = 0, resp
const mk = () => createPoller({ url: 'u', now: () => t, fetchImpl: async () => resp })
const R = (status, body) => ({ ok: status < 400, status, json: async () => { if (body === 'bad') throw new Error('json'); return body } })
const out = []; const chk = (n, g, w) => out.push([g === w ? 'PASS' : 'FAIL', n, g, w])
let p = mk()
resp = R(200, { available: false }); chk('nothing published yet -> idle', (await p.tick()).state, 'idle')
resp = R(200, P); let s = await p.tick(); chk('good -> live', s.state, 'live'); chk('counted shown', s.data.ballots_counted, P.ballots_counted)
resp = R(403, 'x'); s = await p.tick(); chk('403 keeps last good', s.data.ballots_counted, P.ballots_counted); chk('still live (fresh)', s.state, 'live')
t += 200000; resp = R(500, 'x'); s = await p.tick(); chk('stale after 3+ min without success', s.state, 'stale'); chk('data kept when stale', s.data !== null, true)
resp = R(200, { ...P, ballots_counted: P.ballots_counted - 10 }); s = await p.tick(); chk('older payload rejected', s.data.ballots_counted, P.ballots_counted)
resp = R(200, { ...P, ballots_counted: P.ballots_counted + 50 }); s = await p.tick(); chk('newer accepted, live again', s.state + ':' + s.data.ballots_counted, 'live:' + (P.ballots_counted + 50))
resp = R(200, 'bad'); s = await p.tick(); chk('broken JSON keeps data', s.data.ballots_counted, P.ballots_counted + 50)
resp = R(200, { ...P, election: 'k25' }); s = await p.tick(); chk('wrong election rejected', s.lastError, 'bad_schema')
let q = mk(); resp = R(500, 'x'); for (let i = 0; i < 3; i++) s = await q.tick(); chk('3 failures with no data -> error', s.state, 'error'); chk('backoff 120s', q.nextDelayMs(), 120000)
for (const r of out) console.log(...r); console.log(out.every(r => r[0] === 'PASS') ? 'ALL PASS' : 'SOME FAIL')
