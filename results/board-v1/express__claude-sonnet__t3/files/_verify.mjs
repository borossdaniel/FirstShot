import { createApp } from './solution.mjs';

const app = createApp();
const server = app.listen(0, async () => {
  const port = server.address().port;
  const base = `http://localhost:${port}`;

  const checks = [
    ['GET', '/health', 200, { status: 'ok' }],
    ['GET', '/files/a/b/c.txt', 200, { path: 'a/b/c.txt' }],
    ['GET', '/boom', 500, { error: 'boom' }],
  ];

  let allPass = true;
  for (const [method, path, expectedStatus, expectedBody] of checks) {
    const res = await fetch(base + path, { method });
    const body = await res.json();
    const pass = res.status === expectedStatus && JSON.stringify(body) === JSON.stringify(expectedBody);
    if (!pass) allPass = false;
    console.log(`${method} ${path} -> status ${res.status}, body ${JSON.stringify(body)} :: ${pass ? 'PASS' : 'FAIL (expected ' + expectedStatus + ' ' + JSON.stringify(expectedBody) + ')'}`);
  }

  server.close(() => {
    process.exit(allPass ? 0 : 1);
  });
});
