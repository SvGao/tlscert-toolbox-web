import React, { useState } from 'react';
import { IconChevron } from './icons.jsx';

const FORMATS = [
  {
    fmt: 'X.509 certificate, DER',
    ext: '.der  .cer  .crt',
    enc: 'Binary',
    key: 'No',
    holds: 'One certificate, stored as raw bytes.',
  },
  {
    fmt: 'X.509 certificate, PEM',
    ext: '.pem  .cer  .crt',
    enc: 'Base64 text',
    key: 'No',
    holds: 'One or more certificates in Base64, each wrapped in -----BEGIN CERTIFICATE-----.',
  },
  {
    fmt: 'PKCS#12',
    ext: '.pfx  .p12',
    enc: 'Binary',
    key: 'Yes, password protected',
    holds: 'Certificate, chain and private key in one file. This is how an identity moves between systems.',
  },
  {
    fmt: 'PKCS#7',
    ext: '.p7b  .p7c  .spc',
    enc: 'DER or PEM',
    key: 'No',
    holds: 'A chain of certificates and nothing else. A .p7r is a reply from a CA.',
  },
  {
    fmt: 'PKCS#10, a CSR',
    ext: '.csr  .p10',
    enc: 'DER or PEM',
    key: 'No',
    holds: 'A signing request: what you send a CA to have a certificate issued.',
  },
  {
    fmt: 'Private key',
    ext: '.key  .pem',
    enc: 'PEM, sometimes DER',
    key: 'It is the key',
    holds: 'The private key itself, encrypted with a passphrase or not.',
  },
];

const ALIASES = [
  ['.pfx = .p12', 'The same thing. Both are PKCS#12.'],
  ['.p7b = .p7c = .spc', 'All PKCS#7: a chain, never a key.'],
  ['.p10 = .csr', 'Both are a PKCS#10 signing request.'],
  ['.cer / .crt / .pem', 'Usually one X.509 certificate. They differ in encoding, not in content.'],
];

export default function KnowledgeBase() {
  const [open, setOpen] = useState(false);

  return (
    <section className="kb">
      <div className="kb-inner">
        <button
          type="button"
          className="kb-toggle"
          aria-expanded={open}
          aria-controls="kb-body"
          onClick={() => setOpen((v) => !v)}
        >
          <IconChevron size={16} />
          Which file is which
          <span className="kb-sub">formats, extensions and what each one holds</span>
        </button>

        {open && (
          <div className="kb-body" id="kb-body">
            <p className="kb-intro">
              Every certificate follows the <b>X.509</b> standard. The <b>PKCS</b> standards from RSA Labs define the
              containers around it, and in practice you meet three: <b>#7</b> for chains, <b>#10</b> for requests, and{' '}
              <b>#12</b> for a certificate bundled with its key. The trap is that a file extension tells you almost
              nothing about the format inside.
            </p>

            <div className="kb-scroll">
              <table className="kb-table">
                <thead>
                  <tr>
                    <th>Format</th>
                    <th>Extensions in the wild</th>
                    <th>Encoding</th>
                    <th>Holds a key</th>
                    <th>What is inside</th>
                  </tr>
                </thead>
                <tbody>
                  {FORMATS.map((f) => (
                    <tr key={f.fmt}>
                      <td className="kb-fmt">{f.fmt}</td>
                      <td>
                        <code>{f.ext}</code>
                      </td>
                      <td>{f.enc}</td>
                      <td className={f.key.startsWith('Yes') ? 'kb-haskey' : undefined}>{f.key}</td>
                      <td>{f.holds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="kb-cols">
              <div className="kb-card">
                <h4>Names for the same thing</h4>
                <ul>
                  {ALIASES.map(([a, b]) => (
                    <li key={a}>
                      <code>{a}</code> {b}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="kb-card">
                <h4>Telling PEM from DER</h4>
                <p>The real fork is the encoding, and any of those extensions can be either one.</p>
                <ul>
                  <li>
                    <b>PEM</b> is Base64 text. Open it and you see <code>-----BEGIN</code> at the top.
                  </li>
                  <li>
                    <b>DER</b> is raw binary. Open it and you see nothing you can read.
                  </li>
                </ul>
                <p className="kb-tip">
                  So: open the file in a text editor. Readable means PEM, unreadable means DER. Either way,{' '}
                  <b>PEM and DER</b> above will convert it.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
