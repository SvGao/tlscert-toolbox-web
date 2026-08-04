import express from 'express';
import fs from 'fs';
import { getDownload, consume } from '../store.js';

const router = express.Router();

router.get('/:token', (req, res) => {
  const { entry, error } = getDownload(req.params.token);
  if (error) {
    const status = error === 'not_found' ? 404 : 410;
    const message =
      error === 'expired'
        ? 'This download link has expired.'
        : error === 'already_used'
        ? 'This download link has already been used.'
        : 'Download not found.';
    return res.status(status).json({ error, message });
  }

  res.setHeader('Content-Type', entry.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${entry.fileName}"`);

  const stream = fs.createReadStream(entry.filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
    consume(req.params.token);
  });
  // Destroy the file only once the bytes have actually been flushed.
  stream.on('end', () => consume(req.params.token));
  stream.pipe(res);
});

export default router;
