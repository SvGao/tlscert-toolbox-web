import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import api from './src/routes/api.js';
import download from './src/routes/download.js';
import { startJanitor, TTL_MS } from './src/store.js';
import { opensslVersion } from './src/services/openssl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// Where the built React app lives (copied here in the Docker image).
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, 'public');

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, openssl: await opensslVersion(), linkTtlMs: TTL_MS });
});

// API + one-time downloads.
app.use('/api', api);
app.use('/download', download);

// Serve the frontend from the same origin (single container, no CORS needed).
app.use(express.static(STATIC_DIR));
// SPA fallback for any non-API route.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/download')) return next();
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

startJanitor();

app.listen(PORT, () => {
  console.log(`cert-toolbox listening on :${PORT} (UI + API)`);
});
