import React, { useEffect, useState } from 'react';
import {
  PfxExtract, PfxCreate, Convert, RemoveKeyPass, ChainCheck, ChainMerge, UrlCheck, Inspect, CsrGenerate,
} from './components/Panels.jsx';
import KnowledgeBase from './components/KnowledgeBase.jsx';

const TABS = [
  { id: 'pfx-extract', label: 'PFX → Key + Cert', icon: '🔓', Comp: PfxExtract },
  { id: 'pfx-create', label: 'Key + Cert → PFX', icon: '📦', Comp: PfxCreate },
  { id: 'chain-merge', label: 'Merge cert + chain', icon: '🧩', Comp: ChainMerge },
  { id: 'convert', label: 'PEM ⇄ DER', icon: '🔁', Comp: Convert },
  { id: 'chain', label: 'Chain check (file)', icon: '🔗', Comp: ChainCheck },
  { id: 'url', label: 'Chain check (URL)', icon: '🌐', Comp: UrlCheck },
  { id: 'csr', label: 'Generate CSR', icon: '📝', Comp: CsrGenerate },
  { id: 'remove-pass', label: 'Remove key passphrase', icon: '🔑', Comp: RemoveKeyPass },
  { id: 'inspect', label: 'Inspect cert', icon: '🔍', Comp: Inspect },
];

export default function App() {
  const [active, setActive] = useState(TABS[0].id);
  const [health, setHealth] = useState(null);
  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  const Active = TABS.find((t) => t.id === active).Comp;

  return (
    <div className="app">
      <header>
        <h1>🔐 Certificate Toolbox</h1>
        <p className="sub">Convert, merge, inspect certificates, check chains and generate CSRs — all in your browser session. No data is stored.</p>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab' + (t.id === active ? ' active' : '')}
            onClick={() => setActive(t.id)}
          >
            <span className="tab-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <main className="panel">
        <Active />
      </main>

      <KnowledgeBase />

      <footer>
        <span className="privacy">🛡 Files live in a temp directory only. Download links self-destruct after one use or 1 hour.</span>
        {health?.openssl && <span className="ossl">{health.openssl}</span>}
      </footer>
    </div>
  );
}
