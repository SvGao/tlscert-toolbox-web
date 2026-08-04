import fs from 'fs';
import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';

// Root temp directory for all transient files.
export const TMP_ROOT = process.env.TMP_ROOT || path.join(os.tmpdir(), 'cert-toolbox');

// Lifetime of a download link (ms). Default 1 hour.
export const TTL_MS = Number(process.env.LINK_TTL_MS || 60 * 60 * 1000);

fs.mkdirSync(TMP_ROOT, { recursive: true });

// token -> { filePath, fileName, mime, expiresAt, downloaded }
const registry = new Map();

/**
 * Create an isolated working directory for a single request.
 * Everything openssl reads/writes for that request lives here and is
 * removed as soon as we're done producing the downloadable artifacts.
 */
export function createWorkDir() {
  const dir = path.join(TMP_ROOT, 'work-' + nanoid());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function removeDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/**
 * Register a produced file so it can be downloaded exactly once,
 * and only within TTL_MS. The file is copied into a stable store dir
 * so the caller can safely delete its work directory.
 */
export function registerDownload(srcPath, fileName, mime = 'application/octet-stream') {
  const token = nanoid();
  const storeDir = path.join(TMP_ROOT, 'store');
  fs.mkdirSync(storeDir, { recursive: true });
  const dest = path.join(storeDir, token + '__' + fileName);
  fs.copyFileSync(srcPath, dest);

  registry.set(token, {
    filePath: dest,
    fileName,
    mime,
    expiresAt: Date.now() + TTL_MS,
    downloaded: false,
  });

  return { token, fileName, expiresAt: Date.now() + TTL_MS };
}

export function getDownload(token) {
  const entry = registry.get(token);
  if (!entry) return { error: 'not_found' };
  if (entry.downloaded) return { error: 'already_used' };
  if (Date.now() > entry.expiresAt) {
    destroy(token);
    return { error: 'expired' };
  }
  return { entry };
}

/**
 * Mark used and delete the file from disk. The registry entry is kept
 * (with downloaded=true) so a repeat attempt reports "already used"
 * rather than "not found"; the janitor removes the entry later.
 */
export function consume(token) {
  const entry = registry.get(token);
  if (!entry) return;
  entry.downloaded = true;
  try {
    fs.unlinkSync(entry.filePath);
  } catch {
    /* ignore */
  }
}

export function destroy(token) {
  const entry = registry.get(token);
  if (entry) {
    try {
      fs.unlinkSync(entry.filePath);
    } catch {
      /* ignore */
    }
  }
  registry.delete(token);
}

/** Periodic sweep: remove expired links and orphaned work dirs. */
export function startJanitor() {
  setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of registry.entries()) {
      if (now > entry.expiresAt || entry.downloaded) destroy(token);
    }
    // Sweep stale work directories (anything older than TTL).
    try {
      for (const name of fs.readdirSync(TMP_ROOT)) {
        if (!name.startsWith('work-')) continue;
        const p = path.join(TMP_ROOT, name);
        try {
          const stat = fs.statSync(p);
          if (now - stat.mtimeMs > TTL_MS) removeDir(p);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, 60 * 1000).unref();
}
