import React, { useState } from 'react';

const FORMATS = [
  {
    fmt: 'X.509 certificate (DER)',
    ext: '.der  .cer  .crt',
    enc: 'Binary',
    key: 'No',
    holds: 'A single certificate, stored as raw binary.',
  },
  {
    fmt: 'X.509 certificate (PEM)',
    ext: '.pem  .cer  .crt',
    enc: 'Base64 text',
    key: 'No',
    holds: 'One or more certificates in Base64, wrapped in -----BEGIN CERTIFICATE-----.',
  },
  {
    fmt: 'PKCS#12',
    ext: '.pfx  .p12',
    enc: 'Binary',
    key: 'Yes (password-protected)',
    holds: 'Certificate + chain + private key in one bundle. Used to move an identity between systems.',
  },
  {
    fmt: 'PKCS#7',
    ext: '.p7b  .p7c  .spc',
    enc: 'DER or PEM',
    key: 'No',
    holds: 'A certificate chain (tree of certs). No private key. .p7r is a CA reply.',
  },
  {
    fmt: 'PKCS#10 (CSR)',
    ext: '.csr  .p10',
    enc: 'DER or PEM',
    key: 'No',
    holds: 'A certificate signing request — what you send to a CA to get a cert issued.',
  },
  {
    fmt: 'Private key',
    ext: '.key  .pem',
    enc: 'PEM (or DER)',
    key: '— (is the key)',
    holds: 'The private key itself, optionally encrypted with a passphrase.',
  },
];

const SAME = [
  ['.pfx = .p12', 'Identical — both are PKCS#12.'],
  ['.p7b = .p7c = .spc', 'All PKCS#7 (certificate chain, no key).'],
  ['.p10 = .csr', 'Both are a PKCS#10 signing request.'],
  ['.cer / .crt / .pem', 'Usually the same thing — a single X.509 cert. They differ only by encoding, not by content.'],
];

export default function KnowledgeBase() {
  const [open, setOpen] = useState(false);
  return (
    <section className="kb">
      <button className="kb-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} Certificate formats — quick reference
      </button>
      {open && (
        <div className="kb-body">
          <p className="kb-intro">
            All certificates follow the <b>X.509</b> standard. <b>PKCS</b> (Public-Key Cryptography Standards, by RSA Labs)
            defines the container formats around them — you mainly meet <b>#7</b> (chains), <b>#10</b> (requests) and <b>#12</b> (cert + key bundles).
            The confusing part: a file <i>extension</i> does not equal a <i>format</i>.
          </p>

          <div className="kb-scroll">
            <table className="kb-table">
              <thead>
                <tr>
                  <th>Standard / format</th>
                  <th>Common extensions</th>
                  <th>Encoding</th>
                  <th>Private key?</th>
                  <th>What it holds</th>
                </tr>
              </thead>
              <tbody>
                {FORMATS.map((f) => (
                  <tr key={f.fmt}>
                    <td className="kb-fmt">{f.fmt}</td>
                    <td><code>{f.ext}</code></td>
                    <td>{f.enc}</td>
                    <td className={f.key.startsWith('Yes') ? 'kb-yes' : ''}>{f.key}</td>
                    <td>{f.holds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="kb-cols">
            <div className="kb-card">
              <h5>Same thing, different name</h5>
              <ul>
                {SAME.map(([a, b]) => (
                  <li key={a}><code>{a}</code> — {b}</li>
                ))}
              </ul>
            </div>
            <div className="kb-card">
              <h5>DER vs PEM — how to tell</h5>
              <p>The real fork is the <b>encoding</b>, and any extension can be either:</p>
              <ul>
                <li><b>PEM</b> — Base64 text. Open it and you see <code>-----BEGIN …-----</code>.</li>
                <li><b>DER</b> — raw binary. Open it and it looks like gibberish.</li>
              </ul>
              <p className="kb-tip">Rule of thumb: open the file in a text editor. Readable Base64 → PEM. Unreadable → DER. Use the <b>PEM ⇄ DER</b> tab to convert.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
