import { execFile } from 'child_process';

const OPENSSL = process.env.OPENSSL_BIN || 'openssl';

/**
 * Run openssl with an argument array (never a shell string, so user input
 * cannot inject shell metacharacters). Passphrases are passed via the
 * environment (env:VAR) so they never appear in the process argument list.
 */
export function openssl(args, { input, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      OPENSSL,
      args,
      {
        maxBuffer: 20 * 1024 * 1024,
        env: { ...process.env, ...env },
      },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || '').toString().trim();
          reject(new Error(msg || 'openssl command failed'));
          return;
        }
        resolve({ stdout, stderr });
      }
    );
    if (input !== undefined) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

export async function opensslVersion() {
  try {
    const { stdout } = await openssl(['version']);
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}
