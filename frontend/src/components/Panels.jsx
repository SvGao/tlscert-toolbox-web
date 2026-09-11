import React, { useState } from 'react';
import { postForm, postJson } from '../api.js';
import {
  Actions, ChainSpine, Checkbox, ErrorBox, FileInput, Issues, Log, OutHead,
  Plate, ResultFiles, SelectField, TextField, Verdict,
} from './ui.jsx';

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
      <FileInput label="PKCS#12 bundle" name="pfx" accept=".pfx,.p12" files={p.files} setFiles={p.setFiles} required
        hint="A .pfx or .p12 holding the certificate and its private key." />
      <TextField label="Bundle password" type="password" value={password} onChange={setPassword}
        hint="Leave empty if the bundle has no password." />
      <Checkbox checked={strip} onChange={setStrip}>
        Decrypt the private key too, so nginx and Apache can load it without a passphrase prompt. Written as{' '}
        <code>server.key</code>.
      </Checkbox>
      <Actions busy={p.busy} disabled={!p.files.pfx} need="a PKCS#12 bundle">Extract</Actions>
      <ErrorBox error={p.error} fix="Wrong password is the usual cause. Bundles written by older tools may also need OpenSSL's legacy provider, which this tool retries with automatically." />
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* key + cert -> PFX                                                   */
/* ------------------------------------------------------------------ */

export function PfxCreate() {
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
      <FileInput label="Private key" name="key" accept=".key,.pem" files={p.files} setFiles={p.setFiles} required />
      <FileInput label="Certificate" name="cert" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} required />
      <FileInput label="Intermediates and root" name="chain" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} multiple
        hint="Add the intermediate and the root as separate files, or one bundle holding both. Include them so the importing server presents a complete chain." />
      <TextField label="Password to protect the new bundle" type="password" value={exportPassword} onChange={setExportPassword} />
      <TextField label="Password on the private key" type="password" value={keyPassword} onChange={setKeyPassword}
        hint="Only needed if the key you uploaded is encrypted." />
      <Checkbox checked={legacy} onChange={setLegacy}>
        Write with legacy algorithms, for Windows and IIS versions that reject OpenSSL 3 defaults
      </Checkbox>
      <Actions busy={p.busy} disabled={!p.files.key || !p.files.cert} need="a private key and a certificate">Create bundle</Actions>
      <ErrorBox error={p.error} fix="If OpenSSL reports a key and certificate mismatch, the two files belong to different certificates." />
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
      <FileInput label="Certificate" name="cert" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} required
        hint="The leaf certificate, the one issued for your hostname. PEM or DER." />
      <FileInput label="Intermediates and root" name="chain" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} multiple
        hint="Add the intermediate and the root as separate files, or one bundle holding both. Order does not matter, and PEM and DER can be mixed." />
      <Checkbox checked={includeRoot} onChange={setIncludeRoot}>
        Keep the self-signed root in the output. Web servers normally leave it out, since clients already trust it.
      </Checkbox>
      <Actions busy={p.busy} disabled={!p.files.cert} need="a certificate">Merge into fullchain.pem</Actions>
      <ErrorBox error={p.error} />

      {r && (
        <>
          <section className="out">
            <Verdict ok sub={`${r.count} certificate${r.count > 1 ? 's' : ''}, ordered leaf to root`}>
              Merged
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
      <FileInput label="Certificate" name="cert" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} required
        hint="The encoding is detected from the file itself, not from its extension." />
      <SelectField label="Write it as" value={outForm} onChange={setOutForm}
        options={[
          { value: 'pem', label: 'PEM — Base64 text, for nginx, Apache and most Unix tooling' },
          { value: 'der', label: 'DER — raw binary, for Java keystores and Windows tooling' },
        ]} />
      <Actions busy={p.busy} disabled={!p.files.cert} need="a certificate">Convert</Actions>
      <ErrorBox error={p.error} />
      {p.result?.detectedInputForm && (
        <p className="note">
          Read the input as <b>{p.result.detectedInputForm.toUpperCase()}</b>.
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
      <FileInput label="Certificate" name="cert" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} required
        hint="The leaf certificate." />
      <FileInput label="Intermediates and root" name="chain" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} multiple
        hint="Add the intermediate and the root as separate files if that is how you received them. Skip this if the leaf file already holds the whole chain." />
      <Actions busy={p.busy} disabled={!p.files.cert} need="a certificate">Check the chain</Actions>
      <ErrorBox error={p.error} />

      {r && (
        <section className="out">
          <Verdict
            ok={r.complete}
            sub={r.complete
              ? 'every certificate links to its issuer, up to a self-signed root'
              : 'at least one issuer is missing, so clients cannot build a path to a trusted root'}
          >
            {r.complete ? 'Chain is complete' : 'Chain is incomplete'}
          </Verdict>
          <ChainSpine chain={r.chain} />
          <Issues items={r.issues} />
          {r.unused?.length > 0 && (
            <p className="note">
              Not part of the path: <b>{r.unused.map((u) => u.subject).join(' · ')}</b>
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
  const p = usePanel();
  const [url, setUrl] = useState('');

  const submit = (e) => {
    e.preventDefault();
    p.run(async () => postJson('/api/chain/url', { url }));
  };

  const r = p.result;
  return (
    <form className="form" onSubmit={submit}>
      <TextField label="Host" value={url} onChange={setUrl} required autoFocus
        placeholder="example.com"
        hint="A bare hostname, a full URL, or host:port. Port 443 is assumed." />
      <Actions busy={p.busy} disabled={!url.trim()} need="a hostname" note="Connects from this server, not from your browser.">
        Check the server
      </Actions>
      <ErrorBox error={p.error} fix="Check the hostname and that this server can reach it on the port given." />

      {r && (
        <section className="out">
          <Verdict ok={r.complete} subMono sub={`${r.host}:${r.port}`}>
            {r.complete ? 'Chain is complete and trusted' : 'The server is not presenting a usable chain'}
          </Verdict>

          <div className="facts">
            {r.protocol && <span className="fact">Protocol<b>{r.protocol}</b></span>}
            {r.cipher && <span className="fact">Cipher<b>{r.cipher}</b></span>}
            {r.verifyCode !== null && r.verifyCode !== undefined && (
              <span className="fact">Verify<b>{r.verifyCode} {r.verifyText}</b></span>
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
      <TextField label="Common name" value={f.commonName} onChange={upd('commonName')} required
        placeholder="example.com" hint="The primary hostname the certificate is for." />
      <TextField label="Subject alternative names" value={f.sans} onChange={upd('sans')}
        placeholder="www.example.com, api.example.com, 10.0.0.1"
        hint="Comma or space separated. DNS names and IP addresses are told apart automatically. Browsers ignore the common name, so list every hostname here." />

      <div className="grid2">
        <TextField label="Organization" value={f.organization} onChange={upd('organization')} />
        <TextField label="Organizational unit" value={f.organizationalUnit} onChange={upd('organizationalUnit')} />
        <TextField label="City" value={f.locality} onChange={upd('locality')} />
        <TextField label="State or province" value={f.state} onChange={upd('state')} />
        <TextField label="Country" value={f.country} onChange={upd('country')} placeholder="US" />
        <TextField label="Email" value={f.email} onChange={upd('email')} />
      </div>

      <SelectField label="Key" value={f.keyType} onChange={upd('keyType')}
        options={[
          { value: 'rsa2048', label: 'RSA 2048 — accepted everywhere' },
          { value: 'rsa4096', label: 'RSA 4096 — slower handshakes, longer margin' },
          { value: 'ecp256', label: 'EC P-256 — smaller and faster, modern clients' },
          { value: 'ecp384', label: 'EC P-384' },
        ]} />

      <TextField label="Password for the new key" type="password" value={f.keyPassword} onChange={upd('keyPassword')}
        hint="Leave empty for a key your web server can load unattended." />

      <Actions busy={p.busy} disabled={!f.commonName.trim()} need="a common name">Generate key and request</Actions>
      <ErrorBox error={p.error} />
      <ResultFiles files={p.result?.files} />
      {p.result?.csrText && (
        <section className="out">
          <OutHead aside="check this before sending it to the CA">What the request says</OutHead>
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
      <FileInput label="Encrypted private key" name="key" accept=".key,.pem" files={p.files} setFiles={p.setFiles} required />
      <TextField label="Current passphrase" type="password" value={password} onChange={setPassword} required />
      <Actions busy={p.busy} disabled={!p.files.key || !password} need="the key and its passphrase"
        note="The result is an unprotected key. Keep it readable only by root.">
        Remove the passphrase
      </Actions>
      <ErrorBox error={p.error} fix="OpenSSL reports a bad decrypt when the passphrase is wrong." />
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Inspect                                                             */
/* ------------------------------------------------------------------ */

export function Inspect() {
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
      <FileInput label="Certificate" name="cert" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} required
        hint="PEM or DER. Use this to find out what an unlabelled file actually contains." />
      <Actions busy={p.busy} disabled={!p.files.cert} need="a certificate">Decode it</Actions>
      <ErrorBox error={p.error} fix="If OpenSSL cannot parse the file, it may be a PKCS#12 bundle or a private key rather than a certificate." />
      {p.result?.text && (
        <section className="out">
          <OutHead>Certificate contents</OutHead>
          <Plate text={p.result.text} />
        </section>
      )}
    </form>
  );
}
