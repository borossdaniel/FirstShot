import { serve } from '@hono/node-server'
import { app } from './solution.mjs'

const server = serve({ fetch: app.fetch, port: 3999 }, async () => {
  const base = 'http://localhost:3999'
  const results = []

  let r = await fetch(`${base}/health`)
  results.push(['GET /health', r.status, await r.json()])

  r = await fetch(`${base}/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 1, b: 'two' }) })
  results.push(['POST /echo', r.status, await r.json()])

  r = await fetch(`${base}/users/42`)
  results.push(['GET /users/42 (no key)', r.status, await r.json()])

  r = await fetch(`${base}/users/42`, { headers: { 'x-api-key': 'wrong' } })
  results.push(['GET /users/42 (wrong key)', r.status, await r.json()])

  r = await fetch(`${base}/users/42`, { headers: { 'x-api-key': 'secret' } })
  results.push(['GET /users/42 (correct key)', r.status, await r.json()])

  r = await fetch(`${base}/nope`)
  results.push(['GET /nope', r.status, await r.json()])

  for (const [name, status, body] of results) {
    console.log(name, status, JSON.stringify(body))
  }

  server.close()
})
