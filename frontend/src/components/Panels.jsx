import React, { useState } from 'react';
import { postForm, postJson } from '../api.js';
import {
  FileInput, TextField, SelectField, SubmitButton, ResultFiles, ErrorBox, Log,
} from './ui.jsx';

function usePanel() {
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const run = async (fn) => {
    setBusy(true); setError(''); setResult(null);
    try { setResult(await fn()); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return { files, setFiles, busy, error, result, run };
}

/* ---------------- PFX -> key + cert ---------------- */
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
    <form onSubmit={submit}>
      <p className="desc">Extract the certificate and private key from a PKCS#12 (.pfx / .p12) file.</p>
      <FileInput label="PFX file" name="pfx" accept=".pfx,.p12" files={p.files} setFiles={p.setFiles} required />
      <TextField label="PFX password" type="password" value={password} onChange={setPassword}
        hint="Leave empty if the file has no password." />
      <label className="check">
        <input type="checkbox" checked={strip} onChange={(e) => setStrip(e.target.checked)} />
        Also remove passphrase from private key (produces server.key)
      </label>
      <SubmitButton busy={p.busy}>Extract</SubmitButton>
      <ErrorBox error={p.error} />
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ---------------- key + cert -> PFX ---------------- */
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
      if (p.files.chain) fd.append('chain', p.files.chain);
      fd.append('exportPassword', exportPassword);
      fd.append('keyPassword', keyPassword);
      fd.append('legacy', String(legacy));
      return postForm('/api/pfx/create', fd);
    });
  };
  return (
    <form onSubmit={submit}>
      <p className="desc">Combine a private key and certificate (with optional chain) into a .pfx file.</p>
      <FileInput label="Private key" name="key" accept=".key,.pem" files={p.files} setFiles={p.setFiles} required />
      <FileInput label="Certificate" name="cert" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} required />
      <FileInput label="Chain / intermediates (optional)" name="chain" accept=".pem,.crt,.cer"
        files={p.files} setFiles={p.setFiles} hint="CA bundle appended with -certfile." />
      <TextField label="PFX export password" type="password" value={exportPassword} onChange={setExportPassword} />
      <TextField label="Key password (if the key is encrypted)" type="password" value={keyPassword} onChange={setKeyPassword} />
      <label className="check">
        <input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} />
        Use -legacy (for compatibility with older Windows / IIS imports)
      </label>
      <SubmitButton busy={p.busy}>Create PFX</SubmitButton>
      <ErrorBox error={p.error} />
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ---------------- Convert PEM <-> DER ---------------- */
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
    <form onSubmit={submit}>
      <p className="desc">Convert a certificate between PEM and DER encodings (CER / CRT / DER / PEM). Input format is auto-detected.</p>
      <FileInput label="Certificate" name="cert" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} required />
      <SelectField label="Output format" value={outForm} onChange={setOutForm}
        options={[
          { value: 'pem', label: 'PEM (Base64, .crt / .pem)' },
          { value: 'der', label: 'DER (binary, .der / .cer)' },
        ]} />
      <SubmitButton busy={p.busy}>Convert</SubmitButton>
      <ErrorBox error={p.error} />
      {p.result?.detectedInputForm && <p className="note">Detected input format: <b>{p.result.detectedInputForm}</b></p>}
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ---------------- Remove key passphrase ---------------- */
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
    <form onSubmit={submit}>
      <p className="desc">Strip the passphrase from an encrypted private key.</p>
      <FileInput label="Private key" name="key" accept=".key,.pem" files={p.files} setFiles={p.setFiles} required />
      <TextField label="Current passphrase" type="password" value={password} onChange={setPassword} required />
      <SubmitButton busy={p.busy}>Remove passphrase</SubmitButton>
      <ErrorBox error={p.error} />
      <ResultFiles files={p.result?.files} />
      <Log lines={p.result?.log} />
    </form>
  );
}

/* ---------------- Chain check ---------------- */
export function ChainCheck() {
  const p = usePanel();
  const submit = (e) => {
    e.preventDefault();
    p.run(async () => {
      const fd = new FormData();
      fd.append('cert', p.files.cert);
      if (p.files.chain) fd.append('chain', p.files.chain);
      return postJsonChain(fd);
    });
  };
  const r = p.result;
  return (
    <form onSubmit={submit}>
      <p className="desc">Verify that a certificate chain is complete and terminates in a root. Upload the leaf certificate and (optionally) the intermediate/CA bundle.</p>
      <FileInput label="Certificate (leaf)" name="cert" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} required />
      <FileInput label="Chain / CA bundle (optional)" name="chain" accept=".pem,.crt,.cer" files={p.files} setFiles={p.setFiles} />
      <SubmitButton busy={p.busy}>Check chain</SubmitButton>
      <ErrorBox error={p.error} />
      {r && (
        <div className="chain-report">
          <div className={'chain-status ' + (r.complete ? 'ok' : 'bad')}>
            {r.complete ? '✔ Chain is complete (reaches a self-signed root)' : '✘ Chain is incomplete'}
          </div>
          <ol className="chain-list">
            {r.chain.map((c, i) => (
              <li key={i}>
                <div className="c-subj">{c.subject}</div>
                <div className="c-meta">Issuer: {c.issuer}</div>
                <div className="c-meta">Valid: {c.notBefore} → {c.notAfter}{c.selfSigned ? '  · self-signed (root)' : ''}</div>
              </li>
            ))}
          </ol>
          {r.issues?.length > 0 && (
            <div className="issues">
              {r.issues.map((x, i) => <div key={i} className="issue">⚠ {x}</div>)}
            </div>
          )}
          {r.unused?.length > 0 && (
            <p className="note">Unused certificates supplied: {r.unused.map((u) => u.subject).join('; ')}</p>
          )}
          {r.verify && <div className="log"><h4>openssl verify</h4><pre>{r.verify}</pre></div>}
        </div>
      )}
    </form>
  );
}
async function postJsonChain(fd) { return postForm('/api/chain/check', fd); }

/* ---------------- Inspect certificate ---------------- */
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
    <form onSubmit={submit}>
      <p className="desc">Decode and display the full details of a certificate (PEM or DER).</p>
      <FileInput label="Certificate" name="cert" accept=".pem,.crt,.cer,.der" files={p.files} setFiles={p.setFiles} required />
      <SubmitButton busy={p.busy}>Inspect</SubmitButton>
      <ErrorBox error={p.error} />
      {p.result?.text && <div className="log"><h4>Certificate details</h4><pre>{p.result.text}</pre></div>}
    </form>
  );
}

/* ---------------- CSR generation ---------------- */
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
    <form onSubmit={submit}>
      <p className="desc">Generate a new private key and Certificate Signing Request (CSR).</p>
      <TextField label="Common Name (CN)" value={f.commonName} onChange={upd('commonName')}
        placeholder="example.com" required />
      <TextField label="Subject Alternative Names (SAN)" value={f.sans} onChange={upd('sans')}
        placeholder="www.example.com, api.example.com, 10.0.0.1"
        hint="Comma or space separated. DNS names and IPs are auto-detected." />
      <div className="grid2">
        <TextField label="Organization (O)" value={f.organization} onChange={upd('organization')} />
        <TextField label="Organizational Unit (OU)" value={f.organizationalUnit} onChange={upd('organizationalUnit')} />
        <TextField label="Locality / City (L)" value={f.locality} onChange={upd('locality')} />
        <TextField label="State / Province (ST)" value={f.state} onChange={upd('state')} />
        <TextField label="Country (C)" value={f.country} onChange={upd('country')} placeholder="US" />
        <TextField label="Email" value={f.email} onChange={upd('email')} />
      </div>
      <SelectField label="Key type" value={f.keyType} onChange={upd('keyType')}
        options={[
          { value: 'rsa2048', label: 'RSA 2048' },
          { value: 'rsa4096', label: 'RSA 4096' },
          { value: 'ecp256', label: 'EC P-256' },
          { value: 'ecp384', label: 'EC P-384' },
        ]} />
      <TextField label="Key password (optional)" type="password" value={f.keyPassword} onChange={upd('keyPassword')}
        hint="Leave empty for an unencrypted key." />
      <SubmitButton busy={p.busy}>Generate CSR</SubmitButton>
      <ErrorBox error={p.error} />
      <ResultFiles files={p.result?.files} />
      {p.result?.csrText && <div className="log"><h4>CSR details</h4><pre>{p.result.csrText}</pre></div>}
      <Log lines={p.result?.log} />
    </form>
  );
}
