import React, { useState } from 'react';
import { postForm, postJson } from '../api.js';
import {
  Actions, ChainSpine, Checkbox, ErrorBox, FileInput, Issues, Log, OutHead,
  Plate, ResultFiles, SelectField, TextField, Verdict,
} from './ui.jsx';
import { useT } from '../i18n.jsx';

// The chain field takes several files: intermediates and the root are often
// delivered separately. Each is appended under the same field name.
function appendChain(fd, chain) {
  (chain || []).forEach((f) => fd.append('chain', f));
}

function usePanel() {
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const run = async (fn) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await fn());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return { files, setFiles, busy, error, result, run };
}

/* ------------------------------------------------------------------ */
/* PFX -> key + cert                                                   */
/* ------------------------------------------------------------------ */

export function PfxExtract() {
  const t = useT();
  const p = usePanel();
  const [password, setPassword] = useState('');
  const [strip, setStrip] = useState(true);

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => {
      const fd = new FormData();
      fd.append('pfx', p.files.pfx);
      fd.append('password', password);
      fd.append('stripKeyPass', String(strip));
      return postForm('/api/pfx/extract', fd);
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <FileInput label={t('p.extract.file')} name="pfx" accept=".pfx,.p12" files={p.files} setFiles={p.setFiles} required
        hint={t('p.extract.fileHint')} />
      <TextField label={t('p.extract.pw')} type="password" value={password} onChange={setPassword}
        hint={t('p.extract.pwHint')} />
      <Checkbox checked={strip} onChange={setStrip}>
        {t('p.extract.strip')} <code>server.key</code>.
      </Checkbox>
      <Actions busy={p.busy} disabled={!p.files.pfx} need={t('p.extract.need')}>{t('p.extract.go')}</Actions>
      <ErrorBox error={p.error} fix={t('p.extract.fix')} />
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* key + cert -> PFX                                                   */
/* ------------------------------------------------------------------ */

export function PfxCreate() {
  const t = useT();
  const p = usePanel();
  const [exportPassword, setExportPassword] = useState('');
  const [keyPassword, setKeyPassword] = useState('');
  const [legacy, setLegacy] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => {
      const fd = new FormData();
      fd.append('key', p.files.key);
      fd.append('cert', p.files.cert);
      appendChain(fd, p.files.chain);
      fd.append('exportPassword', exportPassword);
      fd.append('keyPassword', keyPassword);
      fd.append('legacy', String(legacy));
      return postForm('/api/pfx/create', fd);
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <FileInput label={t('f.key')} name="key" accept=".key,.pem" files={p.files} setFiles={p.setFiles} required />
      <FileInput label={t('f.cert')} name="cert" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} required />
      <FileInput label={t('f.chain')} name="chain" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} multiple
        hint={t('p.create.chainHint')} />
      <TextField label={t('p.create.exportPw')} type="password" value={exportPassword} onChange={setExportPassword} />
      <TextField label={t('p.create.keyPw')} type="password" value={keyPassword} onChange={setKeyPassword}
        hint={t('p.create.keyPwHint')} />
      <Checkbox checked={legacy} onChange={setLegacy}>
        {t('p.create.legacy')}
      </Checkbox>
      <Actions busy={p.busy} disabled={!p.files.key || !p.files.cert} need={t('p.create.need')}>{t('p.create.go')}</Actions>
      <ErrorBox error={p.error} fix={t('p.create.fix')} />
      {p.result?.warnings?.length > 0 && (
        <section className="out">
          <Issues items={p.result.warnings} />
        </section>
      )}
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Merge cert + chain                                                  */
/* ------------------------------------------------------------------ */

export function ChainMerge() {
  const t = useT();
  const p = usePanel();
  const [includeRoot, setIncludeRoot] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => {
      const fd = new FormData();
      fd.append('cert', p.files.cert);
      appendChain(fd, p.files.chain);
      fd.append('includeRoot', String(includeRoot));
      return postForm('/api/chain/merge', fd);
    });
  };

  const r = p.result;
  return (
    <form className="form" onSubmit={submit}>
      <FileInput label={t('f.cert')} name="cert" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} required
        hint={t('p.merge.certHint')} />
      <FileInput label={t('f.chain')} name="chain" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} multiple
        hint={t('p.merge.chainHint')} />
      <Checkbox checked={includeRoot} onChange={setIncludeRoot}>
        {t('p.merge.includeRoot')}
      </Checkbox>
      <Actions busy={p.busy} disabled={!p.files.cert} need={t('p.merge.need')}>{t('p.merge.go')}</Actions>
      <ErrorBox error={p.error} />

      {r && (
        <>
          <section className="out">
            <Verdict ok sub={r.count > 1 ? t('p.merge.doneSub', { n: r.count }) : t('p.merge.doneSub1')}>
              {t('p.merge.done')}
            </Verdict>
            <ChainSpine chain={r.order} showValidity={false} />
            <Issues items={r.warnings} />
          </section>
          <ResultFiles files={r.files} />
          <Log lines={r.log} />
        </>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Convert PEM <-> DER                                                 */
/* ------------------------------------------------------------------ */

export function Convert() {
  const t = useT();
  const p = usePanel();
  const [outForm, setOutForm] = useState('pem');

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => {
      const fd = new FormData();
      fd.append('cert', p.files.cert);
      fd.append('outForm', outForm);
      fd.append('outName', outForm === 'der' ? 'certificate.der' : 'certificate.crt');
      return postForm('/api/convert', fd);
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <FileInput label={t('f.cert')} name="cert" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} required
        hint={t('p.convert.certHint')} />
      <SelectField label={t('p.convert.out')} value={outForm} onChange={setOutForm}
        options={[
          { value: 'pem', label: t('p.convert.pem') },
          { value: 'der', label: t('p.convert.der') },
        ]} />
      <Actions busy={p.busy} disabled={!p.files.cert} need={t('p.merge.need')}>{t('p.convert.go')}</Actions>
      <ErrorBox error={p.error} />
      {p.result?.detectedInputForm && (
        <p className="note">
          {t('p.convert.detected')} <b>{p.result.detectedInputForm.toUpperCase()}</b>
        </p>
      )}
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Chain check (file)                                                  */
/* ------------------------------------------------------------------ */

export function ChainCheck() {
  const t = useT();
  const p = usePanel();

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => {
      const fd = new FormData();
      fd.append('cert', p.files.cert);
      appendChain(fd, p.files.chain);
      return postForm('/api/chain/check', fd);
    });
  };

  const r = p.result;
  return (
    <form className="form" onSubmit={submit}>
      <FileInput label={t('f.cert')} name="cert" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} required
        hint={t('p.check.certHint')} />
      <FileInput label={t('f.chain')} name="chain" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} multiple
        hint={t('p.check.chainHint')} />
      <Actions busy={p.busy} disabled={!p.files.cert} need={t('p.merge.need')}>{t('p.check.go')}</Actions>
      <ErrorBox error={p.error} />

      {r && (
        <section className="out">
          <Verdict
            ok={r.complete}
            sub={t(r.complete ? 'p.check.okSub' : 'p.check.badSub')}
          >
            {t(r.complete ? 'p.check.ok' : 'p.check.bad')}
          </Verdict>
          <ChainSpine chain={r.chain} />
          <Issues items={r.issues} />
          {r.unused?.length > 0 && (
            <p className="note">
              {t('p.check.unused')} <b>{r.unused.map((u) => u.subject).join(' · ')}</b>
            </p>
          )}
        </section>
      )}

      {r?.verify && (
        <section className="out">
          <OutHead>openssl verify</OutHead>
          <Plate text={r.verify} />
        </section>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Chain check (URL)                                                   */
/* ------------------------------------------------------------------ */

export function UrlCheck() {
  const t = useT();
  const p = usePanel();
  const [url, setUrl] = useState('');

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => postJson('/api/chain/url', { url }));
  };

  const r = p.result;
  return (
    <form className="form" onSubmit={submit}>
      <TextField label={t('p.url.host')} value={url} onChange={setUrl} required autoFocus
        placeholder="example.com"
        hint={t('p.url.hostHint')} />
      <Actions busy={p.busy} disabled={!url.trim()} need={t('p.url.need')} note={t('p.url.note')}>
        {t('p.url.go')}
      </Actions>
      <ErrorBox error={p.error} fix={t('p.url.fix')} />

      {r && (
        <section className="out">
          <Verdict ok={r.complete} subMono sub={`${r.host}:${r.port}`}>
            {t(r.complete ? 'p.url.ok' : 'p.url.bad')}
          </Verdict>

          <div className="facts">
            {r.protocol && <span className="fact">{t('p.url.protocol')}<b>{r.protocol}</b></span>}
            {r.cipher && <span className="fact">{t('p.url.cipher')}<b>{r.cipher}</b></span>}
            {r.verifyCode !== null && r.verifyCode !== undefined && (
              <span className="fact">{t('p.url.verify')}<b>{r.verifyCode} {r.verifyText}</b></span>
            )}
          </div>

          <ChainSpine chain={r.chain} />
          <Issues items={r.issues} />
        </section>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Generate CSR                                                        */
/* ------------------------------------------------------------------ */

export function CsrGenerate() {
  const t = useT();
  const p = usePanel();
  const [f, setF] = useState({
    commonName: '', organization: '', organizationalUnit: '', locality: '',
    state: '', country: '', email: '', sans: '', keyType: 'rsa2048', keyPassword: '',
  });
  const upd = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => postJson('/api/csr/generate', { ...f, sans: f.sans }));
  };

  return (
    <form className="form" onSubmit={submit}>
      <TextField label={t('p.csr.cn')} value={f.commonName} onChange={upd('commonName')} required
        placeholder="example.com" hint={t('p.csr.cnHint')} />
      <TextField label={t('p.csr.san')} value={f.sans} onChange={upd('sans')}
        placeholder="www.example.com, api.example.com, 10.0.0.1"
        hint={t('p.csr.sanHint')} />

      <div className="grid2">
        <TextField label={t('p.csr.o')} value={f.organization} onChange={upd('organization')} />
        <TextField label={t('p.csr.ou')} value={f.organizationalUnit} onChange={upd('organizationalUnit')} />
        <TextField label={t('p.csr.l')} value={f.locality} onChange={upd('locality')} />
        <TextField label={t('p.csr.st')} value={f.state} onChange={upd('state')} />
        <TextField label={t('p.csr.c')} value={f.country} onChange={upd('country')} placeholder="US" />
        <TextField label={t('p.csr.email')} value={f.email} onChange={upd('email')} />
      </div>

      <SelectField label={t('p.csr.key')} value={f.keyType} onChange={upd('keyType')}
        options={[
          { value: 'rsa2048', label: t('p.csr.rsa2048') },
          { value: 'rsa4096', label: t('p.csr.rsa4096') },
          { value: 'ecp256', label: t('p.csr.ecp256') },
          { value: 'ecp384', label: t('p.csr.ecp384') },
        ]} />

      <TextField label={t('p.csr.keyPw')} type="password" value={f.keyPassword} onChange={upd('keyPassword')}
        hint={t('p.csr.keyPwHint')} />

      <Actions busy={p.busy} disabled={!f.commonName.trim()} need={t('p.csr.need')}>{t('p.csr.go')}</Actions>
      <ErrorBox error={p.error} />
      <ResultFiles files={p.result?.files} />
      {p.result?.csrText && (
        <section className="out">
          <OutHead aside={t('p.csr.saysAside')}>{t('p.csr.says')}</OutHead>
          <Plate text={p.result.csrText} />
        </section>
      )}
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Remove key passphrase                                               */
/* ------------------------------------------------------------------ */

export function RemoveKeyPass() {
  const t = useT();
  const p = usePanel();
  const [password, setPassword] = useState('');

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => {
      const fd = new FormData();
      fd.append('key', p.files.key);
      fd.append('password', password);
      return postForm('/api/key/remove-pass', fd);
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <FileInput label={t('p.pass.key')} name="key" accept=".key,.pem" files={p.files} setFiles={p.setFiles} required />
      <TextField label={t('p.pass.current')} type="password" value={password} onChange={setPassword} required />
      <Actions busy={p.busy} disabled={!p.files.key || !password} need={t('p.pass.need')}
        note={t('p.pass.note')}>
        {t('p.pass.go')}
      </Actions>
      <ErrorBox error={p.error} fix={t('p.pass.fix')} />
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Inspect                                                             */
/* ------------------------------------------------------------------ */

export function Inspect() {
  const t = useT();
  const p = usePanel();

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => {
      const fd = new FormData();
      fd.append('cert', p.files.cert);
      return postForm('/api/inspect', fd);
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <FileInput label={t('f.cert')} name="cert" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} required
        hint={t('p.inspect.certHint')} />
      <Actions busy={p.busy} disabled={!p.files.cert} need={t('p.merge.need')}>{t('p.inspect.go')}</Actions>
      <ErrorBox error={p.error} fix={t('p.inspect.fix')} />
      {p.result?.text && (
        <section className="out">
          <OutHead>{t('p.inspect.out')}</OutHead>
          <Plate text={p.result.text} />
        </section>
      )}
    </form>
  );
}
