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
import { LangProvider, useI18n } from './i18n.jsx';

/*
 * Tools are grouped by what they do to your data: reshape it, check it, or
 * make something new. The grouping is the navigation.
 */
const GROUPS = [
  { key: 'nav.reshape', tools: ['pfx-extract', 'pfx-create', 'chain-merge', 'convert'] },
  { key: 'nav.check', tools: ['chain', 'url', 'inspect'] },
  { key: 'nav.create', tools: ['csr', 'remove-pass'] },
];

const TOOL_META = {
  'pfx-extract': { icon: IconUnpack, Comp: PfxExtract },
  'pfx-create': { icon: IconBundle, Comp: PfxCreate },
  'chain-merge': { icon: IconChainLink, Comp: ChainMerge },
  convert: { icon: IconSwap, Comp: Convert },
  chain: { icon: IconShieldCheck, Comp: ChainCheck },
  url: { icon: IconGlobe, Comp: UrlCheck },
  inspect: { icon: IconInspect, Comp: Inspect },
  csr: { icon: IconRequest, Comp: CsrGenerate },
  'remove-pass': { icon: IconKey, Comp: RemoveKeyPass },
};

const TOOLS = GROUPS.flatMap((g) => g.tools);

// "OpenSSL 3.5.7 (Library: OpenSSL 3.5.7)" says the same thing twice.
function trimOpenssl(v) {
  return v.replace(/\s*\(Library:\s*(.*?)\)\s*$/, (m, lib) => (v.startsWith(lib) ? '' : m)).trim();
}

function toolFromHash() {
  const id = window.location.hash.replace('#', '');
  return TOOLS.includes(id) ? id : TOOLS[0];
}

function Toolbox() {
  const { t, lang, toggle } = useI18n();
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

  const Active = TOOL_META[active].Comp;

  return (
    <>
      <a className="skip-link" href="#work">{t('skip.tool')}</a>

      <header className="masthead">
        <div className="masthead-in">
          <h1 className="wordmark">
            <span className="seal" aria-hidden="true">
              <IconShieldCheck size={15} />
            </span>
            {t('head.wordmark')}
          </h1>

          <div className="masthead-meta">
            {health?.openssl && <span className="ossl">{trimOpenssl(health.openssl)}</span>}
            <span className="ephemeral">{t('head.ephemeral')}</span>
            <button
              type="button"
              className="theme-btn lang-btn"
              onClick={toggle}
              aria-label={t('lang.switch')}
              lang={lang === 'zh' ? 'en' : 'zh-CN'}
            >
              {t('lang.button')}
            </button>
            <button
              type="button"
              className="theme-btn"
              onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))}
              aria-label={t(theme === 'dark' ? 'head.toLight' : 'head.toDark')}
            >
              {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <div className="shell">
        <nav className="rail" aria-label={t('nav.tools')}>
          {GROUPS.map((g) => (
            <div className="rail-group" key={g.key}>
              <h2 className="rail-label" id={`grp-${g.key}`}>{t(g.key)}</h2>
              <ul className="rail-list" aria-labelledby={`grp-${g.key}`}>
                {g.tools.map((id) => {
                  const Icon = TOOL_META[id].icon;
                  return (
                    <li key={id}>
                      <button
                        id={`tab-${id}`}
                        className="rail-item"
                        type="button"
                        aria-current={id === active ? 'true' : undefined}
                        onClick={() => select(id)}
                      >
                        <Icon size={17} />
                        {t(`tool.${id}.label`)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <main className="work" id="work" tabIndex={-1}>
          <div className="panel-body" key={active}>
            <div className="work-head">
              <h2>{t(`tool.${active}.title`)}</h2>
              <p>{t(`tool.${active}.blurb`)}</p>
            </div>
            <Active />
          </div>
        </main>
      </div>

      <KnowledgeBase />

      <footer className="colophon">
        <div className="colophon-in">
          <span>{t('foot.temp')}</span>
          <span>{t('foot.selfhost')}</span>
        </div>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <LangProvider>
      <Toolbox />
    </LangProvider>
  );
}
