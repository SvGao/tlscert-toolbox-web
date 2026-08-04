import fs from 'fs';
import path from 'path';
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
export async function createPfx(dir, { keyBuf, certBuf, chainBuf, exportPassword, keyPassword, legacy }) {
  const key = write(dir, 'in.key', keyBuf);
  const cert = write(dir, 'in.crt', certBuf);
  const out = path.join(dir, 'certificate.pfx');

  const args = ['pkcs12', '-export', '-out', out, '-inkey', key, '-in', cert, '-passout', 'env:OUTPW'];
  const env = { OUTPW: exportPassword || '' };

  if (keyPassword) {
    args.push('-passin', 'env:INPW');
    env.INPW = keyPassword;
  }
  if (chainBuf && chainBuf.length) {
    const chain = write(dir, 'chain.crt', chainBuf);
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
    log: [
      `openssl pkcs12 -export -out certificate.pfx -inkey server.key -in cert.pem${
        chainBuf ? ' -certfile chain.crt' : ''
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

export async function analyzeChain(dir, { leafBuf, chainBuf }) {
  const all = [];
  const leafPems = splitPems(leafBuf.toString('latin1'));
  const chainPems = chainBuf ? splitPems(chainBuf.toString('latin1')) : [];

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
        `Missing intermediate: issuer "${current.issuer}" of "${current.subject}" was not found in the supplied files.`
      );
      break;
    }
    current = next;
  }

  const complete = reachedRoot;
  if (!reachedRoot && issues.length === 0) {
    issues.push('Chain does not terminate in a self-signed root certificate (root not supplied).');
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
