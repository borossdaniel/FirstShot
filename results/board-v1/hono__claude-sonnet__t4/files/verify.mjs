import { app } from './solution.mjs'

const assert = (name, cond) => {
  console.log(cond ? `PASS ${name}` : `FAIL ${name}`)
  if (!cond) process.exitCode = 1
}

let res = await app.request('/health')
assert('GET /health status', res.status === 200)
assert('GET /health body', JSON.stringify(await res.json()) === JSON.stringify({ status: 'ok' }))

res = await app.request('/echo', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ foo: 'bar', n: 1 }),
})
assert('POST /echo status', res.status === 201)
assert('POST /echo body', JSON.stringify(await res.json()) === JSON.stringify({ foo: 'bar', n: 1 }))

res = await app.request('/users/42', { headers: { 'x-api-key': 'secret' } })
assert('GET /users/:id authorized status', res.status === 200)
assert('GET /users/:id authorized body', JSON.stringify(await res.json()) === JSON.stringify({ id: '42' }))

res = await app.request('/users/42', { headers: { 'x-api-key': 'wrong' } })
assert('GET /users/:id unauthorized status', res.status === 401)
assert('GET /users/:id unauthorized body', JSON.stringify(await res.json()) === JSON.stringify({ error: 'unauthorized' }))

res = await app.request('/users/42')
assert('GET /users/:id no header status', res.status === 401)

res = await app.request('/nope')
assert('unknown route status', res.status === 404)
assert('unknown route body', JSON.stringify(await res.json()) === JSON.stringify({ error: 'not found' }))
