import { buildApp } from './solution.mjs'
import assert from 'node:assert/strict'

async function run() {
  const app = buildApp()

  // Create user - success
  let res = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'Alice', email: 'alice@example.com', password: 'password123' }
  })
  assert.equal(res.statusCode, 201)
  let body = res.json()
  assert.deepEqual(body, { id: 1, name: 'Alice', email: 'alice@example.com' })
  assert.equal(body.password, undefined)

  // Second user
  res = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'Bob', email: 'bob@example.com', password: 'password123' }
  })
  assert.equal(res.statusCode, 201)
  assert.equal(res.json().id, 2)

  // Invalid: short password
  res = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'Bad', email: 'bad@example.com', password: 'short' }
  })
  assert.equal(res.statusCode, 400)

  // Invalid: bad email
  res = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'Bad', email: 'not-an-email', password: 'password123' }
  })
  assert.equal(res.statusCode, 400)

  // Invalid: name too long
  res = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'a'.repeat(51), email: 'x@example.com', password: 'password123' }
  })
  assert.equal(res.statusCode, 400)

  // Invalid: missing field
  res = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'Nopass', email: 'nopass@example.com' }
  })
  assert.equal(res.statusCode, 400)

  // GET by id - success
  res = await app.inject({ method: 'GET', url: '/users/1' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { id: 1, name: 'Alice', email: 'alice@example.com' })

  // GET by id - not found
  res = await app.inject({ method: 'GET', url: '/users/999' })
  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.json(), { error: 'not found' })

  // GET by id - invalid id (not positive integer)
  res = await app.inject({ method: 'GET', url: '/users/0' })
  assert.equal(res.statusCode, 400)

  res = await app.inject({ method: 'GET', url: '/users/abc' })
  assert.equal(res.statusCode, 400)

  res = await app.inject({ method: 'GET', url: '/users/-1' })
  assert.equal(res.statusCode, 400)

  // GET list - default limit
  res = await app.inject({ method: 'GET', url: '/users' })
  assert.equal(res.statusCode, 200)
  body = res.json()
  assert.equal(body.limit, 10)
  assert.equal(body.users.length, 2)

  // GET list - custom limit
  res = await app.inject({ method: 'GET', url: '/users?limit=1' })
  assert.equal(res.statusCode, 200)
  body = res.json()
  assert.equal(body.limit, 1)
  assert.equal(body.users.length, 1)
  assert.equal(body.users[0].id, 1)

  // GET list - limit out of range
  res = await app.inject({ method: 'GET', url: '/users?limit=0' })
  assert.equal(res.statusCode, 400)

  res = await app.inject({ method: 'GET', url: '/users?limit=51' })
  assert.equal(res.statusCode, 400)

  // Fresh app has empty store
  const app2 = buildApp()
  res = await app2.inject({ method: 'GET', url: '/users' })
  assert.deepEqual(res.json(), { limit: 10, users: [] })

  console.log('All tests passed')
  await app.close()
  await app2.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
