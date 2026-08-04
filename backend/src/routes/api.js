import express from 'express';
import multer from 'multer';
import { createWorkDir, removeDir, registerDownload } from '../store.js';
import * as ops from '../services/certops.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

// Map produced files (in a work dir) to one-time download descriptors.
function publish(produced) {
  return produced.map((f) => {
    const mime = f.name.endsWith('.pfx')
      ? 'application/x-pkcs12'
      : f.name.endsWith('.der') || f.name.endsWith('.cer')
      ? 'application/pkix-cert'
      : 'application/octet-stream';
    return registerDownload(f.path, f.name, mime);
  });
}

// Remove server filesystem paths and file:// URLs from error text so we
// never leak the temp directory layout to the client.
function sanitize(msg = '') {
  return msg
    .replace(/file:\/\/\/?\S+/g, '<file>')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<path>')
    .replace(/\/[^\s"':]+\/[^\s"':]+/g, '<path>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Wrap a handler so it always gets an isolated work dir that is deleted after.
function withWork(handler) {
  return async (req, res) => {
    const dir = createWorkDir();
    try {
      await handler(req, res, dir);
    } catch (err) {
      res.status(400).json({ error: sanitize(err.message) || 'operation failed' });
    } finally {
      removeDir(dir);
    }
  };
}

/* ---- PFX -> key + cert ---- */
router.post(
  '/pfx/extract',
  upload.single('pfx'),
  withWork(async (req, res, dir) => {
    if (!req.file) throw new Error('Please upload a .pfx file.');
    const stripKeyPass = req.body.stripKeyPass !== 'false';
    const { produced, log } = await ops.extractPfx(dir, req.file.buffer, req.body.password, { stripKeyPass });
    res.json({ files: publish(produced), log });
  })
);

/* ---- key + cert (+ chain) -> PFX ---- */
router.post(
  '/pfx/create',
  upload.fields([{ name: 'key', maxCount: 1 }, { name: 'cert', maxCount: 1 }, { name: 'chain', maxCount: 1 }]),
  withWork(async (req, res, dir) => {
    const key = req.files?.key?.[0];
    const cert = req.files?.cert?.[0];
    const chain = req.files?.chain?.[0];
    if (!key || !cert) throw new Error('Both a private key and a certificate file are required.');
    const { produced, log } = await ops.createPfx(dir, {
      keyBuf: key.buffer,
      certBuf: cert.buffer,
      chainBuf: chain?.buffer,
      exportPassword: req.body.exportPassword,
      keyPassword: req.body.keyPassword,
      legacy: req.body.legacy === 'true',
    });
    res.json({ files: publish(produced), log });
  })
);

/* ---- Format conversion ---- */
router.post(
  '/convert',
  upload.single('cert'),
  withWork(async (req, res, dir) => {
    if (!req.file) throw new Error('Please upload a certificate file.');
    const outForm = (req.body.outForm || 'pem').toLowerCase(); // pem | der
    const outName = req.body.outName || (outForm === 'der' ? 'certificate.der' : 'certificate.crt');
    const { produced, log, detectedInputForm } = await ops.convertCert(dir, req.file.buffer, outForm, outName);
    res.json({ files: publish(produced), log, detectedInputForm });
  })
);

/* ---- Remove key passphrase ---- */
router.post(
  '/key/remove-pass',
  upload.single('key'),
  withWork(async (req, res, dir) => {
    if (!req.file) throw new Error('Please upload a private key file.');
    const { produced, log } = await ops.removeKeyPass(dir, req.file.buffer, req.body.password);
    res.json({ files: publish(produced), log });
  })
);

/* ---- Chain analysis ---- */
router.post(
  '/chain/check',
  upload.fields([{ name: 'cert', maxCount: 1 }, { name: 'chain', maxCount: 1 }]),
  withWork(async (req, res, dir) => {
    const cert = req.files?.cert?.[0];
    const chain = req.files?.chain?.[0];
    if (!cert) throw new Error('Please upload the certificate (leaf) file.');
    const result = await ops.analyzeChain(dir, { leafBuf: cert.buffer, chainBuf: chain?.buffer });
    res.json(result);
  })
);

/* ---- Inspect / decode a certificate ---- */
router.post(
  '/inspect',
  upload.single('cert'),
  withWork(async (req, res, dir) => {
    if (!req.file) throw new Error('Please upload a certificate file.');
    const result = await ops.inspectCert(dir, req.file.buffer);
    res.json(result);
  })
);

/* ---- CSR generation ---- */
router.post(
  '/csr/generate',
  express.json(),
  withWork(async (req, res, dir) => {
    const b = req.body || {};
    const sans = Array.isArray(b.sans) ? b.sans : String(b.sans || '').split(/[\s,]+/).filter(Boolean);
    const { produced, csrText, subject, log } = await ops.generateCsr(dir, {
      commonName: b.commonName,
      organization: b.organization,
      organizationalUnit: b.organizationalUnit,
      locality: b.locality,
      state: b.state,
      country: b.country,
      email: b.email,
      sans,
      keyType: b.keyType,
      keyPassword: b.keyPassword,
    });
    res.json({ files: publish(produced), csrText, subject, log });
  })
);

export default router;
