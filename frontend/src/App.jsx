import React, { useCallback, useEffect, useState } from 'react';
import {
  ChainCheck, ChainMerge, Convert, CsrGenerate, Inspect, PfxCreate, PfxExtract,
  RemoveKeyPass, UrlCheck,
} from './components/Panels.jsx';
import KnowledgeBase from './components/KnowledgeBase.jsx';
import {
  IconBundle, IconChainLink, IconGlobe, IconInspect, IconKey, IconMoon,
  IconRequest, IconShieldCheck, IconSun, IconSwap, IconUnpack,
} from './components/icons.jsx';

/*
 * Tools are grouped by what they do to your data: reshape it, check it, or
 * make something new. The grouping is the navigation.
 */
const GROUPS = [
  {
    name: 'Reshape',
    tools: [
      {
        id: 'pfx-extract',
        label: 'Unpack a PFX',
        icon: IconUnpack,
        title: 'Unpack a PFX into a key and a certificate',
        blurb: 'Pull the certificate and private key back out of a PKCS#12 bundle, ready to drop into nginx or Apache.',
        Comp: PfxExtract,
      },
      {
        id: 'pfx-create',
        label: 'Build a PFX',
        icon: IconBundle,
        title: 'Build a PFX from a key and a certificate',
        blurb: 'Pack a private key, its certificate and any intermediates into one PKCS#12 bundle for Windows, IIS or a Java keystore.',
        Comp: PfxCreate,
      },
      {
        id: 'chain-merge',
        label: 'Merge a chain',
        icon: IconChainLink,
        title: 'Merge a certificate with its intermediates',
        blurb: 'Combine a certificate and its intermediates into one fullchain.pem, ordered leaf to root. No private key needed, and PEM or DER both work.',
        Comp: ChainMerge,
      },
      {
        id: 'convert',
        label: 'PEM and DER',
        icon: IconSwap,
        title: 'Convert between PEM and DER',
        blurb: 'The same certificate, written the other way round. The input encoding is detected from the bytes, so a misnamed file is fine.',
        Comp: Convert,
      },
    ],
  },
  {
    name: 'Check',
    tools: [
      {
        id: 'chain',
        label: 'Chain in a file',
        icon: IconShieldCheck,
        title: 'Check a chain held in files',
        blurb: 'Find out whether the certificates you have link all the way up to a self-signed root, and which intermediate is missing when they do not.',
        Comp: ChainCheck,
      },
      {
        id: 'url',
        label: 'Chain on a server',
        icon: IconGlobe,
        title: 'Check the chain a live server presents',
        blurb: 'Connect to a running host and read back the chain it actually serves. This is how you catch the missing intermediate that works in your browser but breaks curl.',
        Comp: UrlCheck,
      },
      {
        id: 'inspect',
        label: 'Read a certificate',
        icon: IconInspect,
        title: 'Read what is inside a certificate',
        blurb: 'Decode a certificate and show every field: subject, issuer, validity, extensions and alternative names.',
        Comp: Inspect,
      },
    ],
  },
  {
    name: 'Create',
    tools: [
      {
        id: 'csr',
        label: 'New key and CSR',
        icon: IconRequest,
        title: 'Generate a key and a signing request',
        blurb: 'Create a fresh private key and the CSR to send to your certificate authority, with every hostname listed as a subject alternative name.',
        Comp: CsrGenerate,
      },
      {
        id: 'remove-pass',
        label: 'Unlock a key',
        icon: IconKey,
        title: 'Remove the passphrase from a private key',
        blurb: 'Strip the passphrase so a service can start without someone typing it in.',
        Comp: RemoveKeyPass,
      },
    ],
  },
];

const TOOLS = GROUPS.flatMap((g) => g.tools);

// "OpenSSL 3.5.7 (Library: OpenSSL 3.5.7)" says the same thing twice.
function trimOpenssl(v) {
  return v.replace(/\s*\(Library:\s*(.*?)\)\s*$/, (m, lib) => (v.startsWith(lib) ? '' : m)).trim();
}

function toolFromHash() {
  const id = window.location.hash.replace('#', '');
  return TOOLS.some((t) => t.id === id) ? id : TOOLS[0].id;
}

export default function App() {
  const [active, setActive] = useState(toolFromHash);
  const [health, setHealth] = useState(null);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    const onHash = () => setActive(toolFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = useCallback((id) => {
    setActive(id);
    if (window.location.hash !== `#${id}`) window.history.replaceState(null, '', `#${id}`);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('ct-theme', theme);
    } catch {
      /* storage may be blocked; the theme still applies for this visit */
    }
  }, [theme]);

  const tool = TOOLS.find((t) => t.id === active);
  const Active = tool.Comp;

  return (
    <>
      <a className="skip-link" href="#work">Skip to the tool</a>

      <header className="masthead">
        <div className="masthead-in">
          <h1 className="wordmark">
            <span className="seal" aria-hidden="true">
              <IconShieldCheck size={15} />
            </span>
            Certificate Toolbox
          </h1>

          <div className="masthead-meta">
            {health?.openssl && <span className="ossl">{trimOpenssl(health.openssl)}</span>}
            <span className="ephemeral">Nothing is stored</span>
            <button
              type="button"
              className="theme-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
            >
              {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <div className="shell">
        <nav className="rail" aria-label="Tools">
          {GROUPS.map((g) => (
            <div className="rail-group" key={g.name}>
              <h2 className="rail-label" id={`grp-${g.name}`}>{g.name}</h2>
              <ul className="rail-list" aria-labelledby={`grp-${g.name}`}>
                {g.tools.map((t) => {
                  const Icon = t.icon;
                  const on = t.id === active;
                  return (
                    <li key={t.id}>
                      <button
                        id={`tab-${t.id}`}
                        className="rail-item"
                        type="button"
                        aria-current={on ? 'true' : undefined}
                        onClick={() => select(t.id)}
                      >
                        <Icon size={17} />
                        {t.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <main className="work" id="work" tabIndex={-1}>
          <div className="panel-body" key={tool.id}>
            <div className="work-head">
              <h2>{tool.title}</h2>
              <p>{tool.blurb}</p>
            </div>
            <Active />
          </div>
        </main>
      </div>

      <KnowledgeBase />

      <footer className="colophon">
        <div className="colophon-in">
          <span>
            Uploads are processed in a temporary directory and deleted straight away. Each download link works once,
            and expires an hour after it is made.
          </span>
          <span>Runs entirely on your own host.</span>
        </div>
      </footer>
    </>
  );
}
