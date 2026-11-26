import { createApp } from "./solution.mjs";

const app = createApp();
const server = app.listen(0, async () => {
  const port = server.address().port;
  const base = `http://localhost:${port}`;

  const health = await fetch(`${base}/health`);
  console.log("GET /health", health.status, await health.json());

  const files = await fetch(`${base}/files/a/b/c.txt`);
  console.log("GET /files/a/b/c.txt", files.status, await files.json());

  const boom = await fetch(`${base}/boom`);
  console.log("GET /boom", boom.status, await boom.json());

  server.close();
});
