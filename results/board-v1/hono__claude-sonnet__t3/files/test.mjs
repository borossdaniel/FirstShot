import { app } from './solution.mjs'

const checks = []

function assert(name, cond) {
  checks.push({ name, cond })
  console.log(cond ? `PASS: ${name}` : `FAIL: ${name}`)
}

const health = await app.request('/health')
assert('health status 200', health.status === 200)
assert('health body', JSON.stringify(await health.json()) === JSON.stringify({ status: 'ok' }))

const echoBody = { foo: 'bar', n: 42 }
const echo = await app.request('/echo', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(echoBody),
})
assert('echo status 201', echo.status === 201)
assert('echo body', JSON.stringify(await echo.json()) === JSON.stringify(echoBody))

const unauth = await app.request('/users/42')
assert('unauth status 401', unauth.status === 401)
assert('unauth body', JSON.stringify(await unauth.json()) === JSON.stringify({ error: 'unauthorized' }))

const auth = await app.request('/users/42', { headers: { 'x-api-key': 'secret' } })
assert('auth status 200', auth.status === 200)
assert('auth body', JSON.stringify(await auth.json()) === JSON.stringify({ id: '42' }))

const wrongKey = await app.request('/users/42', { headers: { 'x-api-key': 'nope' } })
assert('wrongKey status 401', wrongKey.status === 401)

const notFound = await app.request('/does-not-exist')
assert('notFound status 404', notFound.status === 404)
assert('notFound body', JSON.stringify(await notFound.json()) === JSON.stringify({ error: 'not found' }))

const failed = checks.filter((c) => !c.cond)
if (failed.length) {
  console.error(`${failed.length} check(s) failed`)
  process.exit(1)
} else {
  console.log('All checks passed')
}
