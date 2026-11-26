import { app } from './solution.mjs'

const results = []

async function check(name, res, expectedStatus, expectedBody) {
  const status = res.status
  const body = await res.json()
  const ok = status === expectedStatus && JSON.stringify(body) === JSON.stringify(expectedBody)
  results.push({ name, ok, status, body })
}

await check('health', await app.request('/health'), 200, { status: 'ok' })

await check(
  'echo',
  await app.request('/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ foo: 'bar', n: 1 }),
  }),
  201,
  { foo: 'bar', n: 1 }
)

await check(
  'users unauthorized (missing key)',
  await app.request('/users/42'),
  401,
  { error: 'unauthorized' }
)

await check(
  'users unauthorized (wrong key)',
  await app.request('/users/42', { headers: { 'x-api-key': 'nope' } }),
  401,
  { error: 'unauthorized' }
)

await check(
  'users authorized',
  await app.request('/users/42', { headers: { 'x-api-key': 'secret' } }),
  200,
  { id: '42' }
)

await check('not found', await app.request('/does-not-exist'), 404, { error: 'not found' })

let allOk = true
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name} status=${r.status} body=${JSON.stringify(r.body)}`)
  if (!r.ok) allOk = false
}

process.exit(allOk ? 0 : 1)
