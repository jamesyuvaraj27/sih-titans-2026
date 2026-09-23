import express from 'express';
import cors from 'cors';
import { env } from './lib/env.js';
import { api } from './routes.js';

const app = express();

app.use(cors({ origin: [env.webOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.use('/api', api);

// Errors are surfaced with a readable message — a jury demo that shows a blank
// screen is worse than one that shows what went wrong.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.status ?? (err?.name === 'ZodError' ? 400 : 500);
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({
    error: err?.name === 'ZodError' ? 'Invalid request' : (err?.message ?? 'Unexpected error'),
    ...(err?.name === 'ZodError' ? { detail: err.issues } : {}),
  });
});

app.listen(env.port, () => {
  console.log(`SAMIKSHA api → http://localhost:${env.port}/api/health   (ai: ${env.aiProvider})`);
});
