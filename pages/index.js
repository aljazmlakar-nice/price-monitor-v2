import { useState, useEffect } from 'react';

const SHOPS = [
  { key: 'olibetta_at', label: '🐟 Olibetta AT', domain: 'olibetta.at', isOlibetta: true },
  { key: 'olibetta_de', label: '🐟 Olibetta DE', domain: 'olibetta.de', isOlibetta: true },
  { key: 'hornbach_at', label: '🇦🇹 Hornbach AT', domain: 'hornbach.at' },
  { key: 'hornbach_de', label: '🇩🇪 Hornbach DE', domain: 'hornbach.de' },
  { key: 'zooroyal_at', label: '🇦🇹 ZooRoyal AT', domain: 'zooroyal.at' },
  { key: 'zooroyal_de', label: '🇩🇪 ZooRoyal DE', domain: 'zooroyal.de' },
  { key: 'zoologo_at', label: '🇦🇹 Zoologo AT', domain: 'zoologo.at' },
  { key: 'zoologo_de', label: '🇩🇪 Zoologo DE', domain: 'zoologo.de' },
  { key: 'dehner_at', label: '🇦🇹 Dehner AT', domain: 'dehner.at' },
  { key: 'dehner_de', label: '🇩🇪 Dehner DE', domain: 'dehner.de' },
  { key: 'aquasabi_de', label: '🇩🇪 Aquasabi DE', domain: 'aquasabi.de' },
  { key: 'koelle_de', label: '🇩🇪 Kölle Zoo DE', domain: 'koelle-zoo.de' },
];

const emptyArticle = () => ({ name: '', ean: '', urls: {}, shippingRates: {} });

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false); // article being edited/added
  const [scraping, setScraping] = useState(false);
  const [results, setResults] = useState(null);
  const [activeArticleResults, setActiveArticleResults] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'edit' | 'results'
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('pm_api_key');
    if (savedKey) setApiKey(savedKey);
    const saved = localStorage.getItem('pm_articles');
    if (saved) setArticles(JSON.parse(saved));
  }, []);

  const saveArticles = (arts) => {
    setArticles(arts);
    localStorage.setItem('pm_articles', JSON.stringify(arts));
  };

  const startNew = () => {
    setEditing({ ...emptyArticle(), id: Date.now() });
    setView('edit');
  };

  const startEdit = (article) => {
    setEditing({ ...article });
    setView('edit');
  };

  const saveEditing = () => {
    if (!editing.name.trim()) { alert('Vpiši ime artikla!'); return; }
    const exists = articles.find(a => a.id === editing.id);
    if (exists) saveArticles(articles.map(a => a.id === editing.id ? editing : a));
    else saveArticles([...articles, editing]);
    setView('list');
    setEditing(null);
  };

  const deleteArticle = (id) => {
    if (!confirm('Pobrišem ta artikel?')) return;
    saveArticles(articles.filter(a => a.id !== id));
    if (activeId === id) { setActiveId(null); setResults(null); }
  };

  const updateUrl = (key, val) => {
    setEditing(prev => ({ ...prev, urls: { ...prev.urls, [key]: val } }));
  };

  const scrapeArticle = async (article) => {
    setScraping(true);
    setActiveId(article.id);
    setResults(null);
    setView('results');

    const validUrls = Object.fromEntries(
      Object.entries(article.urls).filter(([_, v]) => v && v.trim())
    );

    try {
      const resp = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: validUrls })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setResults(data.shops);
      setActiveArticleResults(article);
      setLastUpdated(new Date().toLocaleString('sl-SI'));
    } catch (err) {
      alert('Napaka: ' + err.message);
    }
    setScraping(false);
  };

  const downloadCSV = () => {
    if (!results || !activeArticleResults) return;
    const now = new Date();
    const rows = [['Datum', 'Artikel', 'EAN', 'Shop', 'Cena', 'Cena (num)', 'Na zalogi', 'URL']];
    const datum = now.toLocaleString('sl-SI');
    for (const shop of results) {
      rows.push([datum, activeArticleResults.name, activeArticleResults.ean || '', shop.name, shop.price || '', shop.price_num || '', shop.available === true ? 'Da' : shop.available === false ? 'Ne' : '?', shop.url]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeArticleResults.name.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}_${now.getDate()}.${now.getMonth()+1}.csv`;
    a.click();
  };

  const olibettaAt = results?.find(s => s.key === 'olibetta_at');
  const olibettaDe = results?.find(s => s.key === 'olibetta_de');

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0' }}>
      {/* Topbar */}
      <div style={s.topbar}>
        <div style={{ ...s.logo, cursor: 'pointer' }} onClick={() => setView('list')}>
          Olibetta <span style={{ color: '#7F77DD' }}>Price Monitor</span>
          <span style={{ fontSize: 11, background: '#EEEDFE', color: '#534AB7', padding: '2px 8px', borderRadius: 99, marginLeft: 10, fontWeight: 400 }}>v2 — Scraping</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: apiKey ? '#0F6E56' : '#993C1D', cursor: 'pointer', padding: '4px 10px', background: apiKey ? '#E1F5EE' : '#FAECE7', borderRadius: 99 }} onClick={() => setShowSettings(true)}>{apiKey ? '✓ API ključ' : '⚠ Nastavi API ključ'}</span>
          <div>
          {view === 'list' && <button style={{ ...s.btn, ...s.btnPrimary }} onClick={startNew}>+ Nov artikel</button>}</div>
          {view === 'edit' && <><button style={s.btn} onClick={() => setView('list')}>← Nazaj</button><button style={{ ...s.btn, ...s.btnPrimary }} onClick={saveEditing}>Shrani artikel</button></>}
          {view === 'results' && <><button style={s.btn} onClick={() => setView('list')}>← Nazaj</button><button style={{ ...s.btn, ...s.btnGreen }} onClick={downloadCSV} disabled={!results}>📥 CSV</button></>}
        </div>
      </div>

      <div style={s.main}>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              {articles.length === 0 ? 'Ni še artiklov. Klikni "+ Nov artikel" da začneš.' : `${articles.length} artikel${articles.length === 1 ? '' : 'ov'}`}
            </div>
            {articles.map(article => (
              <div key={article.id} style={s.articleCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{article.name}</div>
                    {article.ean && <div style={{ fontSize: 12, color: '#888' }}>EAN: {article.ean}</div>}
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                      {Object.values(article.urls).filter(Boolean).length} URL-jev nastavljenih
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...s.btn, fontSize: 13, padding: '7px 14px' }} onClick={() => startEdit(article)}>✏️ Uredi</button>
                    <button style={{ ...s.btn, fontSize: 13, padding: '7px 14px', color: '#993C1D', borderColor: '#f0b8a8' }} onClick={() => deleteArticle(article.id)}>🗑</button>
                    <button style={{ ...s.btn, ...s.btnPrimary, fontSize: 13, padding: '7px 16px' }} onClick={() => scrapeArticle(article)}
                      disabled={!Object.values(article.urls).some(Boolean)}>
                      🔄 Osveži cene
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {articles.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🐟</div>
                <div style={{ fontSize: 14 }}>Dodaj prvi artikel in vnesi URL-je za vsako trgovino</div>
              </div>
            )}
          </div>
        )}

        {/* EDIT VIEW */}
        {view === 'edit' && editing && (
          <div>
            <div style={s.card}>
              <div style={s.cardTitle}>Podatki artikla</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div style={s.field}>
                  <label style={s.label}>Ime artikla</label>
                  <input style={s.input} value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                    placeholder="npr. Juwel Rio 180 LED schwarz" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>EAN (opcijsko)</label>
                  <input style={s.input} value={editing.ean || ''} onChange={e => setEditing(p => ({ ...p, ean: e.target.value }))}
                    placeholder="npr. 4022573043518" />
                </div>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>URL-ji po trgovinah</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                Vnesi direktni URL produkta za vsako trgovino. Prazna polja bodo preskočena.
              </div>
              {SHOPS.map(shop => (
                <div key={shop.key} style={{ marginBottom: 10 }}>
                  <label style={{ ...s.label, color: shop.isOlibetta ? '#0F6E56' : '#666' }}>{shop.label}</label>
                  <input style={{ ...s.input, borderColor: editing.urls[shop.key] ? (shop.isOlibetta ? '#5DCAA5' : '#7F77DD') : undefined }}
                    value={editing.urls[shop.key] || ''}
                    onChange={e => updateUrl(shop.key, e.target.value)}
                    placeholder={`https://www.${shop.domain}/...`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESULTS VIEW */}
        {view === 'results' && (
          <div>
            {scraping && (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 14, color: '#666' }}>Scrapam cene direktno s spletnih strani...</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>To traja 10-30 sekund</div>
              </div>
            )}

            {results && activeArticleResults && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{activeArticleResults.name}</div>
                    {activeArticleResults.ean && <div style={{ fontSize: 12, color: '#888' }}>EAN: {activeArticleResults.ean}</div>}
                    {lastUpdated && <div style={{ fontSize: 12, color: '#aaa' }}>Osveženo: {lastUpdated}</div>}
                  </div>
                </div>

                {/* Olibetta summary */}
                {(olibettaAt || olibettaDe) && (
                  <div style={{ display: 'grid', gridTemplateColumns: olibettaAt && olibettaDe ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
                    {[olibettaAt, olibettaDe].filter(Boolean).map(ol => (
                      <div key={ol.key} style={s.olBanner}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#0F6E56', fontWeight: 600, marginBottom: 2 }}>
                          🐟 {ol.key === 'olibetta_at' ? 'Olibetta AT' : 'Olibetta DE'}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#085041' }}>{ol.price || '—'}</div>
                        <div style={{ fontSize: 12, color: '#0F6E56', marginTop: 2 }}>
                          {ol.available === true ? '✓ Na zalogi' : ol.available === false ? '✗ Ni na zalogi' : '? Razpoložljivost neznana'}
                        </div>
                        {ol.error && <div style={{ fontSize: 11, color: '#993C1D', marginTop: 4 }}>⚠ {ol.error}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Results table */}
                <div style={s.card}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>{['Trgovina', 'Cena', 'Dostava', 'Skupaj', 'Razlika vs Olibetta AT', 'Na zalogi', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {results.map((shop, i) => {
                        const olNum = olibettaAt?.price_num;
                        let diffEl = <span style={{ color: '#ccc' }}>—</span>;
                        if (olNum && shop.price_num && !shop.isOlibetta) {
                          const d = shop.price_num - olNum;
                          const pct = ((d / olNum) * 100).toFixed(1);
                          if (d > 0.01) diffEl = <span style={{ color: '#0F6E56', fontSize: 12 }}>+{d.toFixed(2)} € (+{pct}%)</span>;
                          else if (d < -0.01) diffEl = <span style={{ color: '#993C1D', fontSize: 12 }}>{d.toFixed(2)} € ({pct}%)</span>;
                          else diffEl = <span style={{ color: '#888', fontSize: 12 }}>enaka cena</span>;
                        }
                        const isBest = !shop.isOlibetta && shop.price_num && shop.price_num === Math.min(...results.filter(r => !r.isOlibetta && r.price_num).map(r => r.price_num));
                        const availEl = shop.available === true ? <span style={{ ...s.avail, background: '#E1F5EE', color: '#085041' }}>Da</span>
                          : shop.available === false ? <span style={{ ...s.avail, background: '#FAECE7', color: '#993C1D' }}>Ni</span>
                          : <span style={{ ...s.avail, background: '#f5f4f0', color: '#888' }}>?</span>;
                        return (
                          <tr key={i} style={{ background: shop.isOlibetta ? '#f0fdf8' : 'white', borderLeft: shop.isOlibetta ? '2px solid #1D9E75' : isBest ? '2px solid #5DCAA5' : '2px solid transparent' }}>
                            <td style={s.td}>
                              <a href={shop.url} target="_blank" rel="noreferrer" style={{ color: shop.isOlibetta ? '#085041' : '#534AB7', fontWeight: shop.isOlibetta ? 600 : 400 }}>
                                {SHOPS.find(s => s.key === shop.key)?.label || shop.name}
                              </a>
                            </td>
                            <td style={s.td}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: shop.isOlibetta ? '#0F6E56' : isBest ? '#0F6E56' : 'inherit' }}>
                                {shop.price || '—'}
                              </span>
                              {isBest && ' 🏆'}
                              {shop.isOlibetta && ' 🐟'}
                            </td>
                            <td style={s.td}>{shop.shipping || <span style={{color:'#aaa',fontSize:12}}>?</span>}</td>
                              <td style={s.td}>{shop.total_num ? <span style={{fontWeight:600}}>{shop.total_num.toLocaleString('de-AT',{minimumFractionDigits:2})} €</span> : '—'}</td>
                              <td style={s.td}>{shop.isOlibetta ? <span style={{ fontSize: 12, color: '#888' }}>referenca</span> : diffEl}</td>
                            <td style={s.td}>{availEl}</td>
                            <td style={{ ...s.td, fontSize: 12, color: shop.error ? '#993C1D' : '#aaa' }}>
                              {shop.error ? `⚠ ${shop.error}` : shop.price ? '✓ OK' : '— ni podatka'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    
      {showSettings && (
        <div style={s.overlay} onClick={() => setShowSettings(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>⚙ Nastavitve</h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
              Anthropic API ključ je potreben za iskanje cen dostave z AI.<br/>
              Dobiti na <a href='https://console.anthropic.com' target='_blank' style={{color:'#534AB7'}}>console.anthropic.com</a>
            </p>
            <div style={s.field}>
              <label style={s.label}>API ključ</label>
              <input style={s.input} type='password' value={apiKey}
                onChange={e => setApiKey(e.target.value)} placeholder='sk-ant-...' />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={s.btn} onClick={() => setShowSettings(false)}>Prekliči</button>
              <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => {
                localStorage.setItem('pm_api_key', apiKey);
                setShowSettings(false);
              }}>Shrani</button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}

const s = {
  topbar: { background: '#fff', borderBottom: '1px solid #e8e6e0', padding: '0 2rem', display: 'flex', alignItems: 'center', height: 56, position: 'sticky', top: 0, zIndex: 10 },
  logo: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: '1px solid #e0ddd8', background: '#fff', color: '#1a1a1a' },
  btnPrimary: { background: '#7F77DD', color: '#fff', borderColor: '#7F77DD' },
  btnGreen: { background: '#1D9E75', color: '#fff', borderColor: '#1D9E75' },
  main: { maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem' },
  card: { background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem' },
  cardTitle: { fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888', marginBottom: 16 },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #e0ddd8', borderRadius: 8, fontSize: 13, background: '#fafaf8', color: '#1a1a1a', outline: 'none' },
  articleCard: { background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '1rem 1.5rem', marginBottom: 10 },
  olBanner: { background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 10, padding: '14px 20px' },
  th: { padding: '8px 16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#999', borderBottom: '1px solid #f0ede8', fontWeight: 500, whiteSpace: 'nowrap' },
  td: { padding: '10px 16px', borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' },
  avail: { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 99 },
};
