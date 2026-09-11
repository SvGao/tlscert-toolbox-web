import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { openssl } from './openssl.js';

const PEM_MARKER = '-----BEGIN';

export function isPem(buf) {
  return buf.slice(0, 200).toString('latin1').includes(PEM_MARKER);
}

function write(dir, name, data) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, data);
  return p;
}

/**
 * Some PKCS#12 files produced by older tools use legacy algorithms that
 * OpenSSL 3 refuses to read unless -legacy is supplied. Try modern first,
 * then retry with -legacy.
 */
async function pkcs12Read(baseArgs, env) {
  try {
    return await openssl(baseArgs, { env });
  } catch (e) {
    if (/legacy|unsupported|digital envelope|wrong.*version|mac verify/i.test(e.message)) {
      return await openssl([...baseArgs, '-legacy'], { env });
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* PFX -> key + cert                                                   */
/* ------------------------------------------------------------------ */
export async function extractPfx(dir, pfxBuf, password, { stripKeyPass = true } = {}) {
  const inPfx = write(dir, 'in.pfx', pfxBuf);
  const env = { PW: password || '' };
  const produced = [];
  const log = [];

  const keyPem = path.join(dir, 'key.pem');
  const keyArgs = ['pkcs12', '-in', inPfx, '-nocerts', '-out', keyPem, '-nodes', '-passin', 'env:PW'];
  await pkcs12Read(keyArgs, env);
  log.push('openssl pkcs12 -in cert.pfx -nocerts -out key.pem -nodes');

  const certPem = path.join(dir, 'cert.pem');
  const certArgs = ['pkcs12', '-in', inPfx, '-nokeys', '-out', certPem, '-passin', 'env:PW'];
  await pkcs12Read(certArgs, env);
  log.push('openssl pkcs12 -in cert.pfx -nokeys -out cert.pem');

  produced.push({ path: certPem, name: 'cert.pem' });

  if (stripKeyPass) {
    // Normalize/clean the private key (already decrypted by -nodes above).
    const serverKey = path.join(dir, 'server.key');
    await openssl(['pkey', '-in', keyPem, '-out', serverKey]);
    log.push('openssl rsa -in key.pem -out server.key');
    produced.push({ path: serverKey, name: 'server.key' });
  } else {
    produced.push({ path: keyPem, name: 'key.pem' });
  }

  return { produced, log };
}

/* ------------------------------------------------------------------ */
/* key + cert (+ chain) -> PFX                                         */
/* ------------------------------------------------------------------ */
export async function createPfx(dir, { keyBuf, certBuf, chainBufs = [], exportPassword, keyPassword, legacy }) {
  const key = write(dir, 'in.key', keyBuf);
  const cert = write(dir, 'in.crt', certBuf);
  const out = path.join(dir, 'certificate.pfx');

  const warnings = [];
  const args = ['pkcs12', '-export', '-out', out, '-inkey', key, '-in', cert, '-passout', 'env:OUTPW'];
  const env = { OUTPW: exportPassword || '' };

  if (keyPassword) {
    args.push('-passin', 'env:INPW');
    env.INPW = keyPassword;
  }
  // Intermediates and the root commonly arrive as separate files. Order them
  // leaf -> root and drop anything off the path, so the bundle never carries a
  // certificate from an unrelated chain. -certfile takes one PEM file.
  const chainPem = await orderCaCerts(dir, certBuf, chainBufs, warnings);
  if (chainPem) {
    const chain = write(dir, 'chain.crt', chainPem);
    args.push('-certfile', chain);
  }
  if (legacy) args.push('-legacy');

  try {
    await openssl(args, { env });
  } catch (e) {
    // Retry with legacy if the modern provider rejects the algorithms.
    if (!legacy && /legacy|unsupported|digital envelope/i.test(e.message)) {
      await openssl([...args, '-legacy'], { env });
    } else {
      throw e;
    }
  }

  return {
    produced: [{ path: out, name: 'certificate.pfx' }],
    warnings,
    log: [
      `openssl pkcs12 -export -out certificate.pfx -inkey server.key -in cert.pem${
        chainPem ? ' -certfile chain.crt' : ''
      }${legacy ? ' -legacy' : ''}`,
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Format conversion PEM <-> DER                                       */
/* ------------------------------------------------------------------ */
export async function convertCert(dir, certBuf, outForm /* 'pem' | 'der' */, outName) {
  const inForm = isPem(certBuf) ? 'PEM' : 'DER';
  const inFile = write(dir, 'in.crt', certBuf);
  const out = path.join(dir, outName);

  await openssl(['x509', '-inform', inForm, '-in', inFile, '-outform', outForm.toUpperCase(), '-out', out]);

  return {
    produced: [{ path: out, name: outName }],
    log: [`openssl x509 -inform ${inForm} -in input -outform ${outForm.toUpperCase()} -out ${outName}`],
    detectedInputForm: inForm,
  };
}

/* ------------------------------------------------------------------ */
/* Remove passphrase from a private key                                */
/* ------------------------------------------------------------------ */
export async function removeKeyPass(dir, keyBuf, password, outName = 'server.key') {
  const inKey = write(dir, 'in.key', keyBuf);
  const out = path.join(dir, outName);
  await openssl(['pkey', '-in', inKey, '-out', out, '-passin', 'env:PW'], { env: { PW: password || '' } });
  return {
    produced: [{ path: out, name: outName }],
    log: [`openssl rsa -in key.pem -out ${outName}  (passphrase removed)`],
  };
}

/* ------------------------------------------------------------------ */
/* Inspect a single certificate                                        */
/* ------------------------------------------------------------------ */
export async function inspectCert(dir, certBuf) {
  const inForm = isPem(certBuf) ? 'PEM' : 'DER';
  const inFile = write(dir, 'in.crt', certBuf);
  const { stdout } = await openssl([
    'x509', '-inform', inForm, '-in', inFile, '-noout', '-text', '-fingerprint', '-sha256',
  ]);
  return { text: stdout };
}

/* ------------------------------------------------------------------ */
/* Certificate chain detection                                         */
/* ------------------------------------------------------------------ */

/**
 * A message the UI has to render. The code and params let it be shown in any
 * language; `text` is the English fallback for a client that lacks the key.
 */
function msg(code, params, text) {
  return { code, params, text };
}

/**
 * Walk upward from the first certificate, following issuer -> subject, and
 * return the certification path plus any certificate that was not on it.
 * Matching is by X.509 name hash, not by signature: it establishes who claims
 * to have issued whom. `openssl verify` is what proves the signatures.
 */
function buildPath(metas) {
  const bySubjectHash = new Map();
  for (const c of metas) if (!bySubjectHash.has(c.subjectHash)) bySubjectHash.set(c.subjectHash, c);

  const ordered = [];
  const seen = new Set();
  const warnings = [];
  let current = metas[0];
  let reachedRoot = false;

  while (current && !seen.has(current.subjectHash)) {
    ordered.push(current);
    seen.add(current.subjectHash);
    if (current.selfSigned) {
      reachedRoot = true;
      break;
    }
    const next = bySubjectHash.get(current.issuerHash);
    if (!next) {
      warnings.push(
        msg(
          'w.noIssuer',
          { subject: current.subject },
          `Could not find the issuer of "${current.subject}" among the supplied certificates — an intermediate may be missing.`
        )
      );
      break;
    }
    current = next;
  }

  return { ordered, leftover: metas.filter((c) => !seen.has(c.subjectHash)), warnings, reachedRoot };
}

// Join several uploaded PEM files into one bundle, keeping the order given.
function joinPems(bufs = []) {
  const parts = bufs
    .filter((b) => b && b.length)
    .map((b) => b.toString('latin1').trim())
    .filter(Boolean);
  return parts.length ? `${parts.join('\n')}\n` : '';
}

// Split a bundle of concatenated PEM certificates into individual blocks.
function splitPems(text) {
  const re = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  return text.match(re) || [];
}

async function certMeta(dir, pem, idx) {
  const p = write(dir, `c${idx}.pem`, pem);
  const { stdout } = await openssl([
    'x509', '-in', p, '-noout',
    '-subject', '-issuer', '-subject_hash', '-issuer_hash',
    '-startdate', '-enddate', '-serial',
  ]);
  const get = (k) => {
    const m = stdout.split('\n').find((l) => l.startsWith(k + '='));
    return m ? m.slice(k.length + 1).trim() : '';
  };
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  // subject_hash / issuer_hash are printed on their own lines (8-hex chars)
  const hashes = lines.filter((l) => /^[0-9a-f]{8}$/.test(l));
  return {
    idx,
    subject: get('subject'),
    issuer: get('issuer'),
    subjectHash: hashes[0] || '',
    issuerHash: hashes[1] || '',
    notBefore: get('notBefore'),
    notAfter: get('notAfter'),
    serial: get('serial'),
    selfSigned: get('subject') === get('issuer'),
    path: p,
  };
}

export async function analyzeChain(dir, { leafBuf, chainBufs = [] }) {
  const all = [];
  const leafPems = splitPems(leafBuf.toString('latin1'));
  const chainPems = chainBufs.flatMap((b) => splitPems(b.toString('latin1')));

  if (!leafPems.length) {
    throw new Error('No PEM certificate found in the certificate file. Convert DER to PEM first.');
  }

  const pool = [...leafPems, ...chainPems];
  for (let i = 0; i < pool.length; i++) {
    all.push(await certMeta(dir, pool[i], i));
  }

  const leaf = all[0];
  const bySubjectHash = new Map();
  for (const c of all) {
    if (!bySubjectHash.has(c.subjectHash)) bySubjectHash.set(c.subjectHash, c);
  }

  // Walk from leaf up following issuer -> subject.
  const ordered = [];
  const issues = [];
  const seen = new Set();
  let current = leaf;
  let reachedRoot = false;

  while (current && !seen.has(current.subjectHash)) {
    ordered.push(current);
    seen.add(current.subjectHash);
    if (current.selfSigned) {
      reachedRoot = true;
      break;
    }
    const next = bySubjectHash.get(current.issuerHash);
    if (!next) {
      issues.push(
        msg(
          'w.missingIntermediate',
          { issuer: current.issuer, subject: current.subject },
          `Missing intermediate: issuer "${current.issuer}" of "${current.subject}" was not found in the supplied files.`
        )
      );
      break;
    }
    current = next;
  }

  const complete = reachedRoot;
  if (!reachedRoot && issues.length === 0) {
    issues.push(
      msg('w.noRoot', {}, 'Chain does not terminate in a self-signed root certificate (root not supplied).')
    );
  }

  // Extra: try openssl verify using the supplied certs as untrusted set.
  let verify = null;
  try {
    if (chainPems.length) {
      const chainFile = write(dir, 'untrusted.pem', chainPems.join('\n'));
      const { stdout, stderr } = await openssl(
        ['verify', '-untrusted', chainFile, leaf.path],
        {}
      ).catch((e) => ({ stdout: '', stderr: e.message }));
      verify = (stdout || stderr || '').trim();
    }
  } catch {
    /* best-effort */
  }

  return {
    complete,
    reachedRoot,
    count: all.length,
    chain: ordered.map((c) => ({
      subject: c.subject,
      issuer: c.issuer,
      notBefore: c.notBefore,
      notAfter: c.notAfter,
      serial: c.serial,
      selfSigned: c.selfSigned,
    })),
    unused: all
      .filter((c) => !seen.has(c.subjectHash))
      .map((c) => ({ subject: c.subject, issuer: c.issuer })),
    issues,
    verify,
  };
}

/* ------------------------------------------------------------------ */
/* Merge certificate + chain into a single bundle (no private key)     */
/* ------------------------------------------------------------------ */

// Return the PEM text of every certificate in a buffer, converting from
// DER first if the buffer is not already PEM.
async function normalizeToPems(dir, buf, tag) {
  if (isPem(buf)) return splitPems(buf.toString('latin1'));
  // Assume single DER certificate; convert to PEM.
  const inFile = write(dir, `${tag}.der`, buf);
  const { stdout } = await openssl(['x509', '-inform', 'DER', '-in', inFile, '-outform', 'PEM']);
  return splitPems(stdout);
}

/**
 * Order the supplied CA certificates leaf -> root and return them as one PEM,
 * with the leaf itself removed (it reaches OpenSSL through -in). Certificates
 * that are not part of the leaf's chain are dropped and reported.
 */
async function orderCaCerts(dir, leafBuf, chainBufs, warnings) {
  const chainPems = [];
  for (let i = 0; i < chainBufs.length; i++) {
    const buf = chainBufs[i];
    if (!buf || !buf.length) continue;
    chainPems.push(...(await normalizeToPems(dir, buf, `pfxchain${i}`)));
  }
  if (!chainPems.length) return '';

  const leafPems = await normalizeToPems(dir, leafBuf, 'pfxleaf');
  if (!leafPems.length) return joinPems(chainBufs);

  const pool = [leafPems[0], ...chainPems];
  const metas = [];
  for (let i = 0; i < pool.length; i++) metas.push(await certMeta(dir, pool[i], `pfx${i}`));

  const { ordered, leftover, warnings: pathWarnings } = buildPath(metas);
  warnings.push(...pathWarnings);

  let caMetas;
  if (ordered.length > 1) {
    caMetas = ordered.slice(1);
    if (leftover.length) {
      const subjects = leftover.map((c) => c.subject).join('; ');
      warnings.push(msg('w.leftOut', { subjects }, `Left out of the bundle, not part of this chain: ${subjects}`));
    }
  } else {
    warnings.push(
      msg('w.unordered', {}, 'Certificates could not be auto-ordered; kept them in the order supplied.')
    );
    caMetas = metas.slice(1);
  }

  return `${caMetas.map((c) => fs.readFileSync(c.path, 'utf8').trim()).join('\n')}\n`;
}

/**
 * Concatenate a leaf certificate with its intermediate(s) into one
 * PEM bundle, ordered leaf -> intermediate -> root. No private key involved.
 * By default the self-signed root is dropped (standard web-server "fullchain").
 */
export async function mergeChain(dir, { leafBuf, chainBufs = [], includeRoot = false }) {
  const leafPems = await normalizeToPems(dir, leafBuf, 'leaf');
  const chainPems = [];
  for (let i = 0; i < chainBufs.length; i++) {
    const buf = chainBufs[i];
    if (!buf || !buf.length) continue;
    // A distinct tag per upload: normalizeToPems names its temp file after it.
    chainPems.push(...(await normalizeToPems(dir, buf, `chain${i}`)));
  }
  if (!leafPems.length) throw new Error('No certificate found in the certificate file.');

  const pool = [...leafPems, ...chainPems];
  const metas = [];
  for (let i = 0; i < pool.length; i++) metas.push(await certMeta(dir, pool[i], i));

  const { ordered, leftover, warnings } = buildPath(metas);

  let finalMetas;
  if (!leftover.length) {
    finalMetas = ordered;
  } else if (ordered.length > 1) {
    // A path was found. Certificates off that path belong to some other chain,
    // and serving them would make the bundle wrong, so leave them out and say so.
    finalMetas = ordered;
    const subjects = leftover.map((c) => c.subject).join('; ');
    warnings.push(msg('w.leftOut', { subjects }, `Left out of the bundle, not part of this chain: ${subjects}`));
  } else {
    // The walk could not get past the leaf; keep everything rather than guess.
    warnings.push(
      msg('w.unordered', {}, 'Certificates could not be auto-ordered; kept them in the order supplied.')
    );
    finalMetas = metas;
  }

  if (!includeRoot) {
    const withoutRoot = finalMetas.filter((c) => !c.selfSigned);
    // Only drop the root if doing so leaves at least the leaf.
    if (withoutRoot.length) finalMetas = withoutRoot;
  }

  const bundle = finalMetas.map((c) => fs.readFileSync(c.path, 'utf8').trim()).join('\n') + '\n';
  const out = write(dir, 'fullchain.pem', bundle);

  return {
    produced: [{ path: out, name: 'fullchain.pem' }],
    order: finalMetas.map((c) => ({ subject: c.subject, issuer: c.issuer, selfSigned: c.selfSigned })),
    count: finalMetas.length,
    warnings,
    log: ['cat cert.pem intermediate.crt > fullchain.pem  (ordered leaf → root)'],
  };
}

/* ------------------------------------------------------------------ */
/* Fetch and analyze the TLS certificate chain served by a URL         */
/* ------------------------------------------------------------------ */

// Common CA bundle locations; used so `openssl verify` can judge trust.
const CA_BUNDLES = [
  '/etc/ssl/certs/ca-certificates.crt',
  '/etc/pki/tls/certs/ca-bundle.crt',
  '/etc/ssl/cert.pem',
];
function findCaBundle() {
  for (const p of CA_BUNDLES) {
    try { if (fs.statSync(p).isFile()) return p; } catch { /* ignore */ }
  }
  return null;
}

// Parse "example.com", "https://example.com/path", "host:8443" -> {host, port}.
export function parseHostPort(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('Please enter a URL or host name.');
  s = s.replace(/^[a-z]+:\/\//i, '');       // strip scheme
  s = s.replace(/\/.*$/, '');                // strip path
  s = s.replace(/^[^@]*@/, '');              // strip any userinfo
  let host = s, port = 443;
  const m = s.match(/^\[([^\]]+)\]:(\d+)$/); // [ipv6]:port
  if (m) { host = m[1]; port = Number(m[2]); }
  else if (s.includes(':') && !s.includes('::')) {
    const parts = s.split(':');
    host = parts[0];
    port = Number(parts[1]) || 443;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(host) && !host.includes(':')) {
    throw new Error('Invalid host name.');
  }
  if (!(port > 0 && port < 65536)) throw new Error('Invalid port.');
  return { host, port };
}

// Run openssl s_client to capture exactly the certificates the server sends.
async function fetchServerChain(host, port) {
  const caFile = findCaBundle();
  const args = [
    's_client', '-connect', `${host}:${port}`, '-servername', host, '-showcerts',
  ];
  if (caFile) args.push('-CAfile', caFile);

  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.OPENSSL_BIN || 'openssl',
      args,
      { timeout: 12000, maxBuffer: 8 * 1024 * 1024, killSignal: 'SIGKILL' },
      (err, stdout, stderr) => {
        const out = (stdout || '') + '\n' + (stderr || '');
        // s_client exits non-zero on verify failures, but still prints the chain.
        if (!/BEGIN CERTIFICATE/.test(out)) {
          const msg = (stderr || err?.message || '').split('\n')[0] || 'Could not retrieve certificate.';
          return reject(new Error(`Could not connect to ${host}:${port} — ${msg}`));
        }
        resolve(out);
      }
    );
    // Close the connection right after the handshake.
    child.stdin.end('Q\n');
  });
}

export async function analyzeUrlChain(dir, { host, port }) {
  const raw = await fetchServerChain(host, port);
  const pems = splitPems(raw);
  if (!pems.length) throw new Error('The server did not present any certificate.');

  const metas = [];
  for (let i = 0; i < pems.length; i++) metas.push(await certMeta(dir, pems[i], i));

  // Verify verdict as reported by openssl (authoritative when a CA bundle exists).
  const codeMatch = raw.match(/Verify return code:\s*(\d+)\s*\(([^)]*)\)/i);
  const verifyCode = codeMatch ? Number(codeMatch[1]) : null;
  const verifyText = codeMatch ? codeMatch[2] : '';
  const protoMatch = raw.match(/Protocol\s*:\s*(\S+)/);
  const cipherMatch = raw.match(/Cipher\s*:\s*(\S+)/);

  // Is the sent set a contiguous leaf -> up path?
  const bySubjectHash = new Map();
  for (const c of metas) if (!bySubjectHash.has(c.subjectHash)) bySubjectHash.set(c.subjectHash, c);
  let contiguous = true;
  for (let i = 0; i < metas.length - 1; i++) {
    if (metas[i].selfSigned) break;
    const next = bySubjectHash.get(metas[i].issuerHash);
    if (!next || next.idx !== metas[i + 1].idx) { contiguous = false; break; }
  }

  const issues = [];
  let complete;
  if (verifyCode === 0) {
    complete = true;
  } else if (verifyCode === 20 || verifyCode === 21) {
    complete = false;
    issues.push(
      msg(
        'w.serverMissingIntermediate',
        {},
        'Server is missing an intermediate certificate — clients that do not fetch it themselves will fail to verify this site.'
      )
    );
  } else if (verifyCode !== null) {
    complete = false;
    issues.push(`OpenSSL verification failed: ${verifyText} (code ${verifyCode}).`);
  } else {
    // No CA bundle available to judge trust; fall back to structural check.
    complete = contiguous;
    issues.push(
      msg('w.noCaBundle', {}, 'No system CA bundle available to confirm trust; showing structural analysis only.')
    );
  }
  if (!contiguous) {
    issues.push(
      msg(
        'w.badOrder',
        {},
        'The certificates were not sent in a proper leaf → root order (or a link is missing).'
      )
    );
  }

  return {
    host, port,
    complete,
    verifyCode,
    verifyText,
    protocol: protoMatch ? protoMatch[1] : null,
    cipher: cipherMatch ? cipherMatch[1] : null,
    count: metas.length,
    chain: metas.map((c) => ({
      subject: c.subject,
      issuer: c.issuer,
      notBefore: c.notBefore,
      notAfter: c.notAfter,
      selfSigned: c.selfSigned,
    })),
    issues,
  };
}

/* ------------------------------------------------------------------ */
/* CSR generation                                                      */
/* ------------------------------------------------------------------ */
function escapeConf(v) {
  return String(v).replace(/[\r\n]/g, ' ');
}

export async function generateCsr(dir, opts) {
  const {
    commonName, organization, organizationalUnit, locality, state, country, email,
    sans = [], keyType = 'rsa2048', keyPassword,
  } = opts;

  if (!commonName) throw new Error('Common Name (CN) is required.');

  const dn = [];
  if (country) dn.push(`C=${escapeConf(country)}`);
  if (state) dn.push(`ST=${escapeConf(state)}`);
  if (locality) dn.push(`L=${escapeConf(locality)}`);
  if (organization) dn.push(`O=${escapeConf(organization)}`);
  if (organizationalUnit) dn.push(`OU=${escapeConf(organizationalUnit)}`);
  dn.push(`CN=${escapeConf(commonName)}`);
  if (email) dn.push(`emailAddress=${escapeConf(email)}`);
  const subj = '/' + dn.join('/');

  const sanList = sans.map((s) => String(s).trim()).filter(Boolean);
  let confBody = `[req]\nprompt = no\ndistinguished_name = dn\n`;
  if (sanList.length) confBody += `req_extensions = req_ext\n`;
  confBody += `[dn]\n`;
  // Minimal DN section (subject supplied via -subj to avoid conf escaping issues).
  confBody += `CN = ${escapeConf(commonName)}\n`;
  if (sanList.length) {
    confBody += `[req_ext]\nsubjectAltName = @alt_names\n[alt_names]\n`;
    let dnsN = 1, ipN = 1;
    for (const s of sanList) {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(s) || s.includes(':')) confBody += `IP.${ipN++} = ${s}\n`;
      else confBody += `DNS.${dnsN++} = ${s}\n`;
    }
  }
  const conf = write(dir, 'csr.cnf', confBody);

  const keyOut = path.join(dir, 'private.key');
  const csrOut = path.join(dir, 'request.csr');

  const args = ['req', '-new', '-out', csrOut, '-keyout', keyOut, '-subj', subj, '-config', conf];
  if (sanList.length) args.push('-reqexts', 'req_ext');

  // Key generation options.
  if (keyType === 'rsa2048') args.push('-newkey', 'rsa:2048');
  else if (keyType === 'rsa4096') args.push('-newkey', 'rsa:4096');
  else if (keyType === 'ecp256') args.push('-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256');
  else if (keyType === 'ecp384') args.push('-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-384');
  else args.push('-newkey', 'rsa:2048');

  const env = {};
  if (keyPassword) {
    args.push('-passout', 'env:KEYPW');
    env.KEYPW = keyPassword;
  } else {
    args.push('-nodes');
  }

  await openssl(args, { env });

  const { stdout: csrText } = await openssl(['req', '-in', csrOut, '-noout', '-text', '-verify']).catch(
    () => ({ stdout: '' })
  );

  return {
    produced: [
      { path: csrOut, name: 'request.csr' },
      { path: keyOut, name: 'private.key' },
    ],
    csrText,
    subject: subj,
    log: [`openssl req -new -newkey ${keyType} -keyout private.key -out request.csr`],
  };
}
