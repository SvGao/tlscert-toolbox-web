import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconAlert, IconCheck, IconCopy, IconCross, IconDownload, IconFile, IconPlus,
  IconShieldCheck, IconSpinner,
} from './icons.jsx';

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function FileInput({ label, name, accept, files, setFiles, hint, required, multiple }) {
  const ref = useRef();
  const raw = files[name];
  const list = multiple ? raw || [] : (raw && [raw]) || [];
  const [drag, setDrag] = useState(false);

  const add = (incoming) => {
    const picked = Array.from(incoming || []);
    if (!picked.length) return;
    setFiles((prev) => {
      if (!multiple) return { ...prev, [name]: picked[0] };
      const current = prev[name] || [];
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
      const added = picked.filter((f) => !seen.has(`${f.name}:${f.size}`));
      return { ...prev, [name]: [...current, ...added] };
    });
  };

  const removeAt = (i) =>
    setFiles((prev) => {
      const next = { ...prev };
      if (!multiple) {
        delete next[name];
        return next;
      }
      const rest = (prev[name] || []).filter((_, n) => n !== i);
      if (rest.length) next[name] = rest;
      else delete next[name];
      return next;
    });

  // Drag handlers sit on the whole zone; the click target is a single button,
  // so there is never a nested-control trap.
  const dragProps = {
    onDragOver: (e) => {
      e.preventDefault();
      setDrag(true);
    },
    onDragLeave: () => setDrag(false),
    onDrop: (e) => {
      e.preventDefault();
      setDrag(false);
      add(e.dataTransfer.files);
    },
  };

  const empty = list.length === 0;

  return (
    <div className="field">
      <div className="field-label" id={`lbl-${name}`}>
        {label}
        {required && <span className="required-tag">required</span>}
        {multiple && list.length > 0 && (
          <span className="count-tag">
            {list.length} file{list.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div
        className={'drop' + (drag ? ' drag' : '') + (empty ? '' : ' has') + (multiple ? ' multi' : '')}
        {...dragProps}
      >
        {empty ? (
          <>
            <IconFile className="file-icon" size={17} />
            <span className="drop-name drop-prompt">
              {multiple
                ? 'Drop one or more files here, or click to browse'
                : 'Drop a file here, or click to browse'}
            </span>
            <button
              type="button"
              className="drop-hit"
              onClick={() => ref.current.click()}
              aria-labelledby={`lbl-${name}`}
            >
              <span className="sr-only">Choose a file</span>
            </button>
          </>
        ) : (
          list.map((f, i) => (
            <div className="drop-file" key={`${f.name}:${f.size}:${i}`}>
              <IconFile className="file-icon" size={17} />
              <span className="drop-name">
                <b>{f.name}</b>
                <span>{formatBytes(f.size)}</span>
              </span>
              <button
                type="button"
                className="drop-clear"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${f.name}`}
              >
                <IconCross size={16} />
              </button>
            </div>
          ))
        )}

        {multiple && !empty && (
          <button type="button" className="drop-add" onClick={() => ref.current.click()}>
            <IconPlus size={15} /> Add another file
          </button>
        )}

        <input
          ref={ref}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function TextField({ label, value, onChange, type = 'text', placeholder, hint, required, autoFocus }) {
  const id = useFieldId(label);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span className="required-tag">required</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <small className="hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, hint }) {
  const id = useFieldId(label);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

let uid = 0;
function useFieldId(seed) {
  const ref = useRef();
  if (!ref.current) ref.current = `f${(uid += 1)}-${String(seed).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}`;
  return ref.current;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function Actions({ busy, disabled, children, note, need }) {
  const reason = disabled && need ? `Add ${need} to continue.` : null;
  return (
    <div className="actions">
      <button className="submit" type="submit" disabled={busy || disabled}>
        {busy && <IconSpinner />}
        {busy ? 'Working' : children}
      </button>
      {!busy && (reason || note) && <span className="submit-note">{reason || note}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export function ErrorBox({ error, fix }) {
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      <IconAlert size={17} />
      <div>
        <b>That did not work</b>
        <div className="msg">{error}</div>
        {fix && <div className="hint" style={{ marginTop: 6 }}>{fix}</div>}
      </div>
    </div>
  );
}

export function OutHead({ children, aside }) {
  return (
    <div className="out-head">
      <h3>{children}</h3>
      <div className="rule" />
      {aside && <span className="aside">{aside}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Produced files                                                      */
/* ------------------------------------------------------------------ */

export function ResultFiles({ files }) {
  if (!files?.length) return null;
  return (
    <section className="out">
      <OutHead aside="each link works once, then expires">Files produced</OutHead>
      <ul className="files">
        {files.map((f) => (
          <DownloadItem key={f.token} file={f} />
        ))}
      </ul>
    </section>
  );
}

function DownloadItem({ file }) {
  const [used, setUsed] = useState(false);
  return (
    <li>
      <span className="f-name">{file.fileName}</span>
      {used ? (
        <span className="dl-used">
          <IconCheck size={15} /> Downloaded
        </span>
      ) : (
        <a className="dl-btn" href={`/download/${file.token}`} onClick={() => setTimeout(() => setUsed(true), 600)}>
          <IconDownload size={15} /> Download
        </a>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The plate: machine-authored text                                    */
/* ------------------------------------------------------------------ */

export function Plate({ text }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
  }, [text]);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="plate">
      <button type="button" className={'copy' + (copied ? ' done' : '')} onClick={copy}>
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre>{text}</pre>
    </div>
  );
}

export function Log({ lines }) {
  if (!lines?.length) return null;
  return (
    <section className="out">
      <OutHead aside="run these yourself to get the same result">Equivalent OpenSSL commands</OutHead>
      <Plate text={lines.join('\n')} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Verdict + chain spine                                               */
/* ------------------------------------------------------------------ */

export function Verdict({ ok, children, sub, subMono }) {
  return (
    <div className={'verdict ' + (ok ? 'ok' : 'bad')} role="status">
      {ok ? <IconShieldCheck size={19} /> : <IconAlert size={19} />}
      <span>
        {children}
        {sub && <span className={'sub' + (subMono ? ' mono' : '')}>{sub}</span>}
      </span>
    </div>
  );
}

export function Issues({ items }) {
  if (!items?.length) return null;
  return (
    <div className="issues">
      {items.map((x, i) => (
        <div className="issue" key={i}>
          <IconAlert size={16} />
          <span>{x}</span>
        </div>
      ))}
    </div>
  );
}

const DAY = 86400000;

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shortDate(d) {
  return d.toISOString().slice(0, 10);
}

function humanSpan(days) {
  const d = Math.abs(days);
  if (d < 90) return `${d} d`;
  if (d < 730) return `${Math.round(d / 30.44)} mo`;
  return `${(d / 365.25).toFixed(1)} y`;
}

export function Validity({ notBefore, notAfter }) {
  const from = parseDate(notBefore);
  const to = parseDate(notAfter);
  if (!from || !to) return null;

  const now = Date.now();
  const span = to - from;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((now - from) / span) * 100)) : 100;
  const days = Math.floor((to - now) / DAY);

  let level = '';
  let remain;
  if (days < 0) {
    level = 'bad';
    remain = `expired ${humanSpan(days)} ago`;
  } else if (now < from.getTime()) {
    level = 'warn';
    remain = `not valid yet`;
  } else if (days <= 30) {
    level = 'warn';
    remain = `${days} d left`;
  } else {
    remain = `${humanSpan(days)} left`;
  }

  return (
    <div className="validity">
      <div
        className="validity-track"
        role="img"
        aria-label={`Valid ${shortDate(from)} to ${shortDate(to)}, ${remain}`}
      >
        <div className={'validity-fill ' + level} style={{ width: `${pct}%` }} />
      </div>
      <div className="validity-meta">
        <span>{shortDate(from)}</span>
        <span className={'remain ' + level}>{remain}</span>
        <span>{shortDate(to)}</span>
      </div>
    </div>
  );
}

/**
 * Leaf at the top, root at the bottom, with the connector standing for
 * "signed by the certificate below it".
 */
export function ChainSpine({ chain, showValidity = true }) {
  if (!chain?.length) return null;
  return (
    <ol className="spine">
      {chain.map((c, i) => {
        const leaf = i === 0;
        const root = Boolean(c.selfSigned);
        return (
          <li
            key={i}
            className={(leaf ? 'is-leaf ' : '') + (root ? 'is-root' : '')}
            style={{ animationDelay: `${Math.min(i, 4) * 35}ms` }}
          >
            <div className="node-role">{leaf ? 'Leaf' : root ? 'Root (self-signed)' : 'Intermediate'}</div>
            <div className="node-subject">{c.subject}</div>
            {!root && <div className="node-issuer">signed by {c.issuer}</div>}
            {showValidity && <Validity notBefore={c.notBefore} notAfter={c.notAfter} />}
          </li>
        );
      })}
    </ol>
  );
}
