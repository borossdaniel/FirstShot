import express from 'express';

export function createApp() {
  const app = express();
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  // Express 5: wildcards must be named; the value is an array of segments.
  app.get('/files/*filepath', (req, res) => res.json({ path: req.params.filepath.join('/') }));
  // Express 5 forwards rejected promises to the error handler.
  app.get('/boom', async () => {
    throw new Error('boom');
  });
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  return app;
}
