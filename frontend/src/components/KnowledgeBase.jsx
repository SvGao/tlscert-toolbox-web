import React, { useState } from 'react';
import { IconChevron } from './icons.jsx';
import { useT } from '../i18n.jsx';

const FORMATS = [
  { fmt: 'kb.derFmt', ext: '.der  .cer  .crt', enc: 'kb.encBinary', key: 'kb.no', holds: 'kb.derHolds' },
  { fmt: 'kb.pemFmt', ext: '.pem  .cer  .crt', enc: 'kb.encBase64', key: 'kb.no', holds: 'kb.pemHolds' },
  { fmt: 'kb.p12Fmt', ext: '.pfx  .p12', enc: 'kb.encBinary', key: 'kb.yesPw', holds: 'kb.p12Holds' },
  { fmt: 'kb.p7Fmt', ext: '.p7b  .p7c  .spc', enc: 'kb.encEither', key: 'kb.no', holds: 'kb.p7Holds' },
  { fmt: 'kb.csrFmt', ext: '.csr  .p10', enc: 'kb.encEither', key: 'kb.no', holds: 'kb.csrHolds' },
  { fmt: 'kb.keyFmt', ext: '.key  .pem', enc: 'kb.encPem', key: 'kb.isKey', holds: 'kb.keyHolds' },
];

const ALIASES = [
  ['.pfx = .p12', 'kb.alias1'],
  ['.p7b = .p7c = .spc', 'kb.alias2'],
  ['.p10 = .csr', 'kb.alias3'],
  ['.cer / .crt / .pem', 'kb.alias4'],
];

export default function KnowledgeBase() {
  const t = useT();
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
          {t('kb.title')}
          <span className="kb-sub">{t('kb.sub')}</span>
        </button>

        {open && (
          <div className="kb-body" id="kb-body">
            <p className="kb-intro">{t('kb.intro')}</p>

            <div className="kb-scroll">
              <table className="kb-table">
                <thead>
                  <tr>
                    <th>{t('kb.headFormat')}</th>
                    <th>{t('kb.headExt')}</th>
                    <th>{t('kb.headEnc')}</th>
                    <th>{t('kb.headKey')}</th>
                    <th>{t('kb.headHolds')}</th>
                  </tr>
                </thead>
                <tbody>
                  {FORMATS.map((f) => (
                    <tr key={f.fmt}>
                      <td className="kb-fmt">{t(f.fmt)}</td>
                      <td>
                        <code>{f.ext}</code>
                      </td>
                      <td>{t(f.enc)}</td>
                      <td className={f.key === 'kb.yesPw' ? 'kb-haskey' : undefined}>{t(f.key)}</td>
                      <td>{t(f.holds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="kb-cols">
              <div className="kb-card">
                <h4>{t('kb.aliasTitle')}</h4>
                <ul>
                  {ALIASES.map(([a, b]) => (
                    <li key={a}>
                      <code>{a}</code> {t(b)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="kb-card">
                <h4>{t('kb.tellTitle')}</h4>
                <p>{t('kb.tellLead')}</p>
                <ul>
                  <li>
                    <b>PEM</b> {t('kb.tellPem')} <code>-----BEGIN</code>
                    {t('kb.tellPemAfter')}
                  </li>
                  <li>
                    <b>DER</b> {t('kb.tellDer')}
                  </li>
                </ul>
                <p className="kb-tip">
                  {t('kb.tellTip')} <b>{t('tool.convert.label')}</b> {t('kb.tellTipAfter')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
