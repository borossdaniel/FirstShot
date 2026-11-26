import { serve } from '@hono/node-server'
import { app } from './solution.mjs'

serve({ fetch: app.fetch, port: 3344 }, (info) => {
  console.log(`listening on ${info.port}`)
})
