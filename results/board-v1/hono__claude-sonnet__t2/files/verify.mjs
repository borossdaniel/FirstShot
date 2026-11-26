import { app } from './solution.mjs'

const assertEqual = (actual, expected, msg) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    console.error(`FAIL: ${msg} — expected ${e}, got ${a}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${msg}`)
  }
}

// 1. GET /health
{
  const res = await app.request('/health')
  assertEqual(res.status, 200, 'health status')
  assertEqual(await res.json(), { status: 'ok' }, 'health body')
}

// 2. POST /echo
{
  const payload = { foo: 'bar', n: 42 }
  const res = await app.request('/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  assertEqual(res.status, 201, 'echo status')
  assertEqual(await res.json(), payload, 'echo body')
}

// 3. GET /users/:id — unauthorized
{
  const res = await app.request('/users/123')
  assertEqual(res.status, 401, 'users unauthorized status')
  assertEqual(await res.json(), { error: 'unauthorized' }, 'users unauthorized body')
}

// 3b. GET /users/:id — wrong key
{
  const res = await app.request('/users/123', { headers: { 'x-api-key': 'wrong' } })
  assertEqual(res.status, 401, 'users wrong key status')
}

// 3c. GET /users/:id — authorized
{
  const res = await app.request('/users/123', { headers: { 'x-api-key': 'secret' } })
  assertEqual(res.status, 200, 'users authorized status')
  assertEqual(await res.json(), { id: '123' }, 'users authorized body')
}

// 4. unknown route
{
  const res = await app.request('/nope')
  assertEqual(res.status, 404, 'not found status')
  assertEqual(await res.json(), { error: 'not found' }, 'not found body')
}

if (!process.exitCode) {
  console.log('\nAll checks passed.')
}
