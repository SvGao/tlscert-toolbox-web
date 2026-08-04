import React, { useRef, useState } from 'react';

export function FileInput({ label, name, accept, files, setFiles, hint, required }) {
  const ref = useRef();
  const file = files[name];
  const [drag, setDrag] = useState(false);

  const onPick = (f) => setFiles((prev) => ({ ...prev, [name]: f }));

  return (
    <div className="field">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      <div
        className={'drop' + (drag ? ' drag' : '') + (file ? ' has' : '')}
        onClick={() => ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files[0]) onPick(e.dataTransfer.files[0]);
        }}
      >
        {file ? (
          <span className="filename">📄 {file.name} <em>({(file.size / 1024).toFixed(1)} KB)</em></span>
        ) : (
          <span className="placeholder">Drop file here or click to browse</span>
        )}
        <input
          ref={ref}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => e.target.files[0] && onPick(e.target.files[0])}
        />
      </div>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export function TextField({ label, value, onChange, type = 'text', placeholder, hint, required }) {
  return (
    <div className="field">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export function SubmitButton({ busy, children }) {
  return (
    <button className="submit" type="submit" disabled={busy}>
      {busy ? 'Working…' : children}
    </button>
  );
}

export function ResultFiles({ files }) {
  if (!files?.length) return null;
  return (
    <div className="results">
      <h4>Download (each link works once, expires in 1 hour)</h4>
      <ul className="download-list">
        {files.map((f) => (
          <DownloadItem key={f.token} file={f} />
        ))}
      </ul>
    </div>
  );
}

function DownloadItem({ file }) {
  const [used, setUsed] = useState(false);
  return (
    <li>
      <span className="dl-name">📥 {file.fileName}</span>
      {used ? (
        <span className="dl-used">link used</span>
      ) : (
        <a
          className="dl-btn"
          href={`/download/${file.token}`}
          onClick={() => setTimeout(() => setUsed(true), 500)}
        >
          Download
        </a>
      )}
    </li>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="error-box">⚠ {error}</div>;
}

export function Log({ lines }) {
  if (!lines?.length) return null;
  return (
    <div className="log">
      <h4>Equivalent OpenSSL commands</h4>
      <pre>{lines.join('\n')}</pre>
    </div>
  );
}
