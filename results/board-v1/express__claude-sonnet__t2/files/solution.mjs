import express from 'express';

export function createApp() {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/files/*splat', (req, res) => {
    const path = Array.isArray(req.params.splat)
      ? req.params.splat.join('/')
      : req.params.splat;
    res.json({ path });
  });

  app.get('/boom', async (req, res) => {
    throw new Error('boom');
  });

  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
  });

  return app;
}
