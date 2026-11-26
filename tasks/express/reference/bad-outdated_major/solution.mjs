import express from 'express';
export function createApp() {
  const app = express();
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/files/*', (req, res) => res.json({ path: req.params[0] }));
  app.get('/boom', async (req, res, next) => { try { throw new Error('boom'); } catch (e) { next(e); } });
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  return app;
}
