// import React, { useEffect, useState, useMemo, useRef } from 'react';
// import { createRoot } from 'react-dom/client';
// import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
// import { api } from './api';
// import './styles/app.css';

// function Layout({ children }) {
//   return (
//     <div className="app-shell">
//       <header className="topbar">
//         <Link className="wordmark" to="/">
//           <span className="brand-dot">●</span> INE PRICE TRACKER
//         </Link>
//         <nav>
//           <Link to="/">Dashboard</Link>
//           <Link to="/privacy">Privacy</Link>
//           <Link to="/terms">Terms</Link>
//         </nav>
//       </header>
//       <main>{children}</main>
//       <footer>
//         INE Product Price Tracker · Monitored against the official INE mock store (demo.inelabteamdev.com).
//       </footer>
//     </div>
//   );
// }

// function SearchPage() {
//   const [query, setQuery] = useState('');
//   const [results, setResults] = useState([]);
//   const [tracked, setTracked] = useState([]);
//   const [trackingId, setTrackingId] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [searching, setSearching] = useState(false);
//   const [message, setMessage] = useState('');
//   const [statusMessage, setStatusMessage] = useState('');
//   const navigate = useNavigate();
//   const searchTimeoutRef = useRef(null);

//   async function loadTracked() {
//     try {
//       const data = await api.tracked();
//       setTracked(data || []);
//     } catch (e) {
//       setMessage(e.message);
//     }
//   }

//   useEffect(() => {
//     loadTracked();
//   }, []);

//   // Debounced live search
//   useEffect(() => {
//     const q = query.trim();
//     if (q.length < 2) {
//       setResults([]);
//       setSearching(false);
//       return;
//     }

//     if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

//     setSearching(true);
//     searchTimeoutRef.current = setTimeout(async () => {
//       try {
//         const res = await api.search(q);
//         setResults(res || []);
//       } catch (e) {
//         setMessage(`Search failed: ${e.message}`);
//       } finally {
//         setSearching(false);
//       }
//     }, 350);

//     return () => {
//       if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
//     };
//   }, [query]);

//   async function handleManualSearch(e) {
//     e.preventDefault();
//     const q = query.trim();
//     if (q.length < 2) return;
//     if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
//     setSearching(true);
//     setMessage('');
//     try {
//       const res = await api.search(q);
//       setResults(res || []);
//     } catch (e) {
//       setMessage(`Search failed: ${e.message}`);
//     } finally {
//       setSearching(false);
//     }
//   }

//   async function track(item) {
//     setLoading(true);
//     setTrackingId(item.href);
//     setMessage('');
//     setStatusMessage(`Initiating tracking & initial scrape for "${item.text || item.name}"...`);

//     try {
//       const product = await api.add({
//         source_url: item.href,
//         name: item.text || item.name || 'Product'
//       });
//       await loadTracked();
//       navigate(`/product/${product.id}`);
//     } catch (e) {
//       setMessage(e.message);
//       setLoading(false);
//       setTrackingId(null);
//       setStatusMessage('');
//     }
//   }

//   // Set of tracked URLs for duplicate detection
//   const trackedUrlSet = useMemo(() => new Set(tracked.map((t) => t.source_url)), [tracked]);

//   return (
//     <>
//       <section className="hero">
//         <div>
//           <p className="eyebrow">INE LAB · AUTOMATED PRICE & STOCK TRACKER</p>
//           <h1>Monitor INE Store products in real-time.</h1>
//           <p className="lede">
//             Search 1,000 products from the INE mock storefront, track prices through hidden-price challenges, and view historical observations.
//           </p>
//         </div>
//         <div className="schedule-note">
//           <span>SCHEDULED SCRAPING</span>
//           <strong>Every 2 hours</strong>
//           <small>Protected external cron trigger (cron-job.org) · Unattended reliability · Honest logging</small>
//         </div>
//       </section>

//       <section className="search-panel">
//         <form onSubmit={handleManualSearch} className="search-form">
//           <label htmlFor="product-search">Search products by partial or full name</label>
//           <div className="search-row">
//             <input
//               id="product-search"
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               placeholder="e.g. shoe, monitor, vanta, vista..."
//               autoComplete="off"
//             />
//             <button type="submit" disabled={searching || loading}>
//               {searching ? 'Searching...' : 'Search Store'}
//             </button>
//           </div>
//         </form>

//         {message && <p className="error">{message}</p>}
//         {statusMessage && <p className="status-notice">{statusMessage}</p>}

//         <div className="result-list">
//           {searching && <p className="empty">Searching the storefront catalog...</p>}
//           {!searching && results.length === 0 && query.trim().length >= 2 ? (
//             <p className="empty">No matching products found in the INE catalog for "{query}".</p>
//           ) : null}

//           {results.map((item) => {
//             const isAlreadyTracked = trackedUrlSet.has(item.href);
//             const isThisTracking = trackingId === item.href && loading;

//             return (
//               <div className="result" key={item.href}>
//                 <div className="result-info">
//                   <strong>{item.text || item.name}</strong>
//                   <div className="result-meta">
//                     {item.brand && <span className="meta-tag">{item.brand}</span>}
//                     {item.category && <span className="meta-tag">{item.category}</span>}
//                     {item.sku && <span className="meta-sku">SKU: {item.sku}</span>}
//                   </div>
//                   <small>{item.href}</small>
//                 </div>
//                 <div>
//                   {isAlreadyTracked ? (
//                     <button className="secondary" disabled>
//                       ✓ Already Tracked
//                     </button>
//                   ) : (
//                     <button onClick={() => track(item)} disabled={loading}>
//                       {isThisTracking ? 'Scraping & Tracking...' : '+ Track Product'}
//                     </button>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </section>

//       <section className="tracked-section">
//         <div className="section-heading">
//           <div>
//             <p className="eyebrow">MONITORED PRODUCTS</p>
//             <h2>Tracked Catalog ({tracked.length})</h2>
//           </div>
//           <span>Refreshes automatically</span>
//         </div>

//         <div className="tracked-table">
//           <div className="table-head">
//             <span>Product</span>
//             <span>Current Price</span>
//             <span>Stock Status</span>
//             <span>Last Scraped</span>
//             <span>Action</span>
//           </div>
//           {tracked.map((p) => (
//             <Link className="table-row" to={`/product/${p.id}`} key={p.id}>
//               <span>
//                 <strong>{p.name}</strong>
//                 <small>{p.source_url}</small>
//               </span>
//               <span>
//                 {p.last_price == null ? (
//                   <span className="badge-pending">Pending scrape</span>
//                 ) : (
//                   <span className="price-tag">
//                     {p.currency || 'INR'} {Number(p.last_price).toLocaleString()}
//                   </span>
//                 )}
//               </span>
//               <span>
//                 {p.last_stock ? (
//                   <span className={`stock-pill ${p.last_stock.toLowerCase().includes('out') ? 'out' : 'in'}`}>
//                     {p.last_stock}
//                   </span>
//                 ) : (
//                   '—'
//                 )}
//               </span>
//               <span>
//                 {p.last_scraped_at ? new Date(p.last_scraped_at).toLocaleString() : 'Never'}
//               </span>
//               <span className="open-btn">View History →</span>
//             </Link>
//           ))}
//           {!tracked.length && (
//             <p className="empty">No tracked products yet. Search the catalog above to add your first product.</p>
//           )}
//         </div>
//       </section>
//     </>
//   );
// }

// function ProductPage() {
//   const { id } = useParams();
//   const [product, setProduct] = useState(null);
//   const [history, setHistory] = useState([]);
//   const [logs, setLogs] = useState([]);
//   const [busy, setBusy] = useState(false);
//   const [message, setMessage] = useState('');
//   const [successNotice, setSuccessNotice] = useState('');

//   async function load() {
//     const products = await api.tracked();
//     const p = products.find((x) => x.id === id);
//     if (!p) throw new Error('Tracked product not found');
//     setProduct(p);
//     const [hist, lgs] = await Promise.all([api.history(id), api.logs(id)]);
//     setHistory(hist || []);
//     setLogs(lgs || []);
//   }

//   useEffect(() => {
//     load().catch((e) => setMessage(e.message));
//   }, [id]);

//   async function triggerManualScrape() {
//     setBusy(true);
//     setMessage('');
//     setSuccessNotice('Running live scrape against INE mock store (challenge & hidden-price resolution)...');

//     try {
//       const res = await api.scrape(id);
//       if (res.success) {
//         setSuccessNotice(`Scrape completed successfully! Price: ${res.data.currency} ${Number(res.data.price).toLocaleString()} (${res.data.stock})`);
//       } else {
//         setMessage(`Scrape failed: ${res.error || 'Challenge or navigation error'}`);
//         setSuccessNotice('');
//       }
//       await load();
//     } catch (e) {
//       setMessage(`Scrape error: ${e.message}`);
//       setSuccessNotice('');
//     } finally {
//       setBusy(false);
//     }
//   }

//   async function removeProduct() {
//     if (!confirm(`Are you sure you want to stop tracking "${product.name}"? This will delete its history and logs.`)) {
//       return;
//     }
//     try {
//       await api.remove(id);
//       window.location.href = '/';
//     } catch (e) {
//       setMessage(`Failed to remove product: ${e.message}`);
//     }
//   }

//   // Bonus alerts: Price Drop & Back in Stock detection
//   const priceAlert = useMemo(() => {
//     if (history.length < 2) return null;
//     const latest = Number(history[history.length - 1].price);
//     const prev = Number(history[history.length - 2].price);
//     if (latest < prev) {
//       const diff = prev - latest;
//       const pct = Math.round((diff / prev) * 100);
//       return { type: 'drop', message: `Price dropped by ${pct}% (${product?.currency || 'INR'} ${diff.toLocaleString()} lower than previous observation)!` };
//     }
//     if (latest > prev) {
//       const diff = latest - prev;
//       return { type: 'increase', message: `Price increased by ${product?.currency || 'INR'} ${diff.toLocaleString()} since last scrape.` };
//     }
//     return null;
//   }, [history, product]);

//   const stockAlert = useMemo(() => {
//     if (history.length < 2) return null;
//     const latestStock = String(history[history.length - 1].stock || '').toLowerCase();
//     const prevStock = String(history[history.length - 2].stock || '').toLowerCase();
//     if (prevStock.includes('out') && !latestStock.includes('out')) {
//       return { type: 'back_in_stock', message: 'Product is back in stock!' };
//     }
//     if (!prevStock.includes('out') && latestStock.includes('out')) {
//       return { type: 'out_of_stock', message: 'Product just went out of stock!' };
//     }
//     return null;
//   }, [history]);

//   if (!product) {
//     return (
//       <section className="page-state">
//         <p>{message || 'Loading product tracking details...'}</p>
//       </section>
//     );
//   }

//   return (
//     <>
//       <div className="breadcrumb">
//         <Link to="/">‹ Back to Dashboard</Link>
//       </div>

//       <section className="product-header">
//         <div>
//           <p className="eyebrow">MONITORED PRODUCT</p>
//           <h1>{product.name}</h1>
//           <div className="product-links">
//             <a href={product.source_url} target="_blank" rel="noreferrer" className="ext-link">
//               Open on INE Store ↗
//             </a>
//           </div>
//         </div>
//         <div className="actions">
//           <button onClick={triggerManualScrape} disabled={busy} className="primary-action">
//             {busy ? 'Scraping in progress...' : '⚡ Run Scrape Now'}
//           </button>
//           <button className="secondary danger-action" onClick={removeProduct} disabled={busy}>
//             Stop Tracking
//           </button>
//         </div>
//       </section>

//       {/* Bonus In-App Alerts */}
//       {priceAlert && (
//         <div className={`alert-banner ${priceAlert.type}`}>
//           <strong>{priceAlert.type === 'drop' ? '📉 Price Drop Detected' : '📈 Price Update'}:</strong> {priceAlert.message}
//         </div>
//       )}
//       {stockAlert && (
//         <div className={`alert-banner ${stockAlert.type}`}>
//           <strong>{stockAlert.type === 'back_in_stock' ? '🎉 Back in Stock' : '⚠️ Inventory Alert'}:</strong> {stockAlert.message}
//         </div>
//       )}

//       {message && <p className="error">{message}</p>}
//       {successNotice && <p className="success-notice">{successNotice}</p>}

//       <section className="metrics">
//         <div>
//           <span>Current / Last Price</span>
//           <strong>
//             {product.last_price == null
//               ? 'No data yet'
//               : `${product.currency || 'INR'} ${Number(product.last_price).toLocaleString()}`}
//           </strong>
//         </div>
//         <div>
//           <span>Stock Status</span>
//           <strong>{product.last_stock || 'No data yet'}</strong>
//         </div>
//         <div>
//           <span>Last Successful Scrape</span>
//           <strong>
//             {product.last_scraped_at
//               ? new Date(product.last_scraped_at).toLocaleString()
//               : 'Pending'}
//           </strong>
//         </div>
//       </section>

//       <section className="history">
//         <div className="section-heading">
//           <div>
//             <p className="eyebrow">OBSERVATIONS OVER TIME</p>
//             <h2>Price History</h2>
//           </div>
//           <span>{history.length} valid records</span>
//         </div>

//         <PriceChart data={history} currency={product.currency || 'INR'} />

//         <div className="history-table">
//           <div className="table-head">
//             <span>Timestamp</span>
//             <span>Observed Price</span>
//             <span>Stock Status</span>
//             <span>Currency</span>
//           </div>
//           {history
//             .slice()
//             .reverse()
//             .map((row) => (
//               <div className="table-row" key={row.id}>
//                 <span>{new Date(row.scraped_at).toLocaleString()}</span>
//                 <span className="bold-price">
//                   {row.price == null
//                     ? '—'
//                     : `${row.currency || product.currency || 'INR'} ${Number(row.price).toLocaleString()}`}
//                 </span>
//                 <span>
//                   <span className={`stock-pill ${String(row.stock).toLowerCase().includes('out') ? 'out' : 'in'}`}>
//                     {row.stock || '—'}
//                   </span>
//                 </span>
//                 <span>{row.currency || product.currency || 'INR'}</span>
//               </div>
//             ))}
//           {!history.length && <p className="empty">No price history recorded yet.</p>}
//         </div>
//       </section>

//       <section className="logs">
//         <div className="section-heading">
//           <div>
//             <p className="eyebrow">HONEST OBSERVABILITY</p>
//             <h2>Scrape Attempts & Diagnostic Logs</h2>
//           </div>
//           <span>{logs.length} attempts logged</span>
//         </div>
//         <p className="logs-desc">
//           Every scrape attempt is honestly recorded below: success, retried (e.g. challenge failure, upstream rate-limit, delay), and failed states are distinguished.
//         </p>

//         <div className="log-table">
//           <div className="table-head">
//             <span>Timestamp</span>
//             <span>Attempt</span>
//             <span>Status</span>
//             <span>Duration</span>
//             <span>HTTP</span>
//             <span>Message / Diagnostic Details</span>
//           </div>
//           {logs.map((log) => (
//             <div className="table-row" key={log.id}>
//               <span>{new Date(log.scraped_at).toLocaleString()}</span>
//               <span>#{log.attempt}</span>
//               <span>
//                 <span className={`status-pill ${log.status}`}>{log.status.toUpperCase()}</span>
//               </span>
//               <span>{log.duration_ms != null ? `${log.duration_ms}ms` : '—'}</span>
//               <span>{log.http_status || '—'}</span>
//               <span className="log-message">{log.message || '—'}</span>
//             </div>
//           ))}
//           {!logs.length && <p className="empty">No scrape attempts logged yet.</p>}
//         </div>
//       </section>
//     </>
//   );
// }

// function PriceChart({ data, currency }) {
//   if (!data.length) {
//     return <div className="chart-empty">No successful observations recorded yet.</div>;
//   }

//   const values = data.map((d) => Number(d.price));
//   const min = Math.min(...values);
//   const max = Math.max(...values);
//   const range = max - min || 1;
//   const width = 900;
//   const height = 260;
//   const padding = 35;

//   const points = data
//     .map((d, i) => {
//       const x = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding);
//       const y = height - padding - ((Number(d.price) - min) / range) * (height - 2 * padding);
//       return `${x},${y}`;
//     })
//     .join(' ');

//   return (
//     <div className="chart-wrap">
//       <div className="chart-header">
//         <span>Price trend ({currency})</span>
//         <span>Min: {currency} {min.toLocaleString()} · Max: {currency} {max.toLocaleString()}</span>
//       </div>
//       <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Price history chart">
//         <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
//         <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e2e8f0" strokeDasharray="4" strokeWidth="1" />
//         <polyline fill="none" stroke="#0f172a" strokeWidth="2.5" points={points} />
//         {data.map((d, i) => {
//           const cx = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding);
//           const cy = height - padding - ((Number(d.price) - min) / range) * (height - 2 * padding);
//           return (
//             <g key={d.id || i}>
//               <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
//             </g>
//           );
//         })}
//       </svg>
//       <div className="chart-axis">
//         <span>First: {new Date(data[0].scraped_at).toLocaleDateString()}</span>
//         <span>Latest: {new Date(data[data.length - 1].scraped_at).toLocaleDateString()}</span>
//       </div>
//     </div>
//   );
// }

// function Legal({ type }) {
//   const privacy = type === 'privacy';
//   return (
//     <section className="legal">
//       <p className="eyebrow">{privacy ? 'PRIVACY POLICY' : 'TERMS OF SERVICE'}</p>
//       <h1>{privacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
//       {privacy ? (
//         <>
//           <p>This application stores tracked product URLs, names, price history, stock history, and scrape diagnostic logs in Supabase PostgreSQL.</p>
//           <h2>Data Use</h2>
//           <p>Observations are captured solely to monitor price trends and stock status for the INE mock storefront (demo.inelabteamdev.com).</p>
//           <h2>Credentials & Security</h2>
//           <p>Supabase service-role keys and cron secrets are stored strictly on the server and are never sent to the browser.</p>
//         </>
//       ) : (
//         <>
//           <p>This software is built for the INE Software Engineer Intern Assignment.</p>
//           <h2>Allowed Scope</h2>
//           <p>The scraper exclusively accesses the official INE mock storefront (demo.inelabteamdev.com). Third-party retailers are strictly disallowed.</p>
//           <h2>Cron Trigger</h2>
//           <p>The backend exposes a secure POST /api/cron/scrape endpoint scheduled every 2 hours via cron-job.org.</p>
//         </>
//       )}
//     </section>
//   );
// }

// function App() {
//   return (
//     <Layout>
//       <Routes>
//         <Route path="/" element={<SearchPage />} />
//         <Route path="/product/:id" element={<ProductPage />} />
//         <Route path="/privacy" element={<Legal type="privacy" />} />
//         <Route path="/terms" element={<Legal type="terms" />} />
//       </Routes>
//     </Layout>
//   );
// }

// createRoot(document.getElementById('root')).render(
//   <React.StrictMode>
//     <BrowserRouter>
//       <App />
//     </BrowserRouter>
//   </React.StrictMode>
// );
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useParams
} from 'react-router-dom';
import { api } from './api';
import './styles/app.css';

const SCRAPE_FREQUENCIES = [
  { value: 120, label: 'Every 2 hours' },
  { value: 240, label: 'Every 4 hours' },
  { value: 360, label: 'Every 6 hours' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Every 24 hours' }
];

function getFrequencyLabel(minutes) {
  const frequency = SCRAPE_FREQUENCIES.find(
    (item) => item.value === Number(minutes)
  );

  return frequency?.label || 'Every 2 hours';
}

function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="wordmark" to="/">
          <span className="brand-dot">●</span> INE PRICE TRACKER
        </Link>

        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </header>

      <main>{children}</main>

      <footer>
        INE Product Price Tracker · Monitored against the official INE mock store (demo.inelabteamdev.com).
      </footer>
    </div>
  );
}

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [tracked, setTracked] = useState([]);
  const [trackingId, setTrackingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [frequencySavingId, setFrequencySavingId] = useState(null);

  const navigate = useNavigate();
  const searchTimeoutRef = useRef(null);

  async function loadTracked() {
    try {
      const data = await api.tracked();
      setTracked(data || []);
    } catch (e) {
      setMessage(e.message);
    }
  }

  useEffect(() => {
    loadTracked();
  }, []);

  // Debounced live search
  useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.search(q);
        setResults(res || []);
      } catch (e) {
        setMessage(`Search failed: ${e.message}`);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  async function handleManualSearch(e) {
    e.preventDefault();

    const q = query.trim();

    if (q.length < 2) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearching(true);
    setMessage('');

    try {
      const res = await api.search(q);
      setResults(res || []);
    } catch (e) {
      setMessage(`Search failed: ${e.message}`);
    } finally {
      setSearching(false);
    }
  }

  async function track(item) {
    setLoading(true);
    setTrackingId(item.href);
    setMessage('');
    setStatusMessage(
      `Initiating tracking & initial scrape for "${item.text || item.name}"...`
    );

    try {
      const product = await api.add({
        source_url: item.href,
        name: item.text || item.name || 'Product'
      });

      await loadTracked();

      navigate(`/product/${product.id}`);
    } catch (e) {
      setMessage(e.message);
      setLoading(false);
      setTrackingId(null);
      setStatusMessage('');
    }
  }

  async function handleFrequencyChange(productId, value) {
    const minutes = Number(value);

    setFrequencySavingId(productId);
    setMessage('');

    try {
      const updated = await api.updateFrequency(
        productId,
        minutes
      );

      setTracked((current) =>
        current.map((product) =>
          product.id === productId
            ? {
                ...product,
                ...updated,
                scrape_interval_minutes: minutes
              }
            : product
        )
      );
    } catch (e) {
      setMessage(
        `Failed to update scrape frequency: ${e.message}`
      );
    } finally {
      setFrequencySavingId(null);
    }
  }

  // Set of tracked URLs for duplicate detection
  const trackedUrlSet = useMemo(
    () => new Set(tracked.map((t) => t.source_url)),
    [tracked]
  );

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">
            INE LAB · AUTOMATED PRICE & STOCK TRACKER
          </p>

          <h1>Monitor INE Store products in real-time.</h1>

          <p className="lede">
            Search 1,000 products from the INE mock storefront,
            track prices through hidden-price challenges, and view
            historical observations.
          </p>
        </div>

        <div className="schedule-note">
          <span>SCHEDULED SCRAPING</span>
          <strong>Configurable per product</strong>
          <small>
            External cron trigger runs every 2 hours · Each product
            can use its own scraping interval · Honest logging
          </small>
        </div>
      </section>

      <section className="search-panel">
        <form
          onSubmit={handleManualSearch}
          className="search-form"
        >
          <label htmlFor="product-search">
            Search products by partial or full name
          </label>

          <div className="search-row">
            <input
              id="product-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. shoe, monitor, vanta, vista..."
              autoComplete="off"
            />

            <button
              type="submit"
              disabled={searching || loading}
            >
              {searching ? 'Searching...' : 'Search Store'}
            </button>
          </div>
        </form>

        {message && <p className="error">{message}</p>}

        {statusMessage && (
          <p className="status-notice">{statusMessage}</p>
        )}

        <div className="result-list">
          {searching && (
            <p className="empty">
              Searching the storefront catalog...
            </p>
          )}

          {!searching &&
          results.length === 0 &&
          query.trim().length >= 2 ? (
            <p className="empty">
              No matching products found in the INE catalog for
              "{query}".
            </p>
          ) : null}

          {results.map((item) => {
            const isAlreadyTracked =
              trackedUrlSet.has(item.href);

            const isThisTracking =
              trackingId === item.href && loading;

            return (
              <div className="result" key={item.href}>
                <div className="result-info">
                  <strong>
                    {item.text || item.name}
                  </strong>

                  <div className="result-meta">
                    {item.brand && (
                      <span className="meta-tag">
                        {item.brand}
                      </span>
                    )}

                    {item.category && (
                      <span className="meta-tag">
                        {item.category}
                      </span>
                    )}

                    {item.sku && (
                      <span className="meta-sku">
                        SKU: {item.sku}
                      </span>
                    )}
                  </div>

                  <small>{item.href}</small>
                </div>

                <div>
                  {isAlreadyTracked ? (
                    <button
                      className="secondary"
                      disabled
                    >
                      ✓ Already Tracked
                    </button>
                  ) : (
                    <button
                      onClick={() => track(item)}
                      disabled={loading}
                    >
                      {isThisTracking
                        ? 'Scraping & Tracking...'
                        : '+ Track Product'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="tracked-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              MONITORED PRODUCTS
            </p>

            <h2>
              Tracked Catalog ({tracked.length})
            </h2>
          </div>

          <span>Refreshes automatically</span>
        </div>

        <div className="tracked-table">
          <div className="table-head">
            <span>Product</span>
            <span>Current Price</span>
            <span>Stock Status</span>
            <span>Scrape Frequency</span>
            <span>Last Scraped</span>
            <span>Action</span>
          </div>

          {tracked.map((p) => (
            <Link
              className="table-row"
              to={`/product/${p.id}`}
              key={p.id}
            >
              <span>
                <strong>{p.name}</strong>
                <small>{p.source_url}</small>
              </span>

              <span>
                {p.last_price == null ? (
                  <span className="badge-pending">
                    Pending scrape
                  </span>
                ) : (
                  <span className="price-tag">
                    {p.currency || 'INR'}{' '}
                    {Number(
                      p.last_price
                    ).toLocaleString()}
                  </span>
                )}
              </span>

              <span>
                {p.last_stock ? (
                  <span
                    className={`stock-pill ${
                      p.last_stock
                        .toLowerCase()
                        .includes('out')
                        ? 'out'
                        : 'in'
                    }`}
                  >
                    {p.last_stock}
                  </span>
                ) : (
                  '—'
                )}
              </span>

              <span
                className="product-frequency"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <select
                  aria-label={`Scrape frequency for ${p.name}`}
                  value={
                    Number(
                      p.scrape_interval_minutes
                    ) || 120
                  }
                  disabled={
                    frequencySavingId === p.id
                  }
                  onChange={(e) =>
                    handleFrequencyChange(
                      p.id,
                      e.target.value
                    )
                  }
                >
                  {SCRAPE_FREQUENCIES.map(
                    (frequency) => (
                      <option
                        key={frequency.value}
                        value={frequency.value}
                      >
                        {frequency.label}
                      </option>
                    )
                  )}
                </select>

                {frequencySavingId === p.id && (
                  <small>Saving...</small>
                )}
              </span>

              <span>
                {p.last_scraped_at
                  ? new Date(
                      p.last_scraped_at
                    ).toLocaleString()
                  : 'Never'}
              </span>

              <span className="open-btn">
                View History →
              </span>
            </Link>
          ))}

          {!tracked.length && (
            <p className="empty">
              No tracked products yet. Search the catalog
              above to add your first product.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function ProductPage() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [successNotice, setSuccessNotice] =
    useState('');
  const [frequencySaving, setFrequencySaving] =
    useState(false);

  async function load() {
    const products = await api.tracked();

    const p = products.find(
      (x) => x.id === id
    );

    if (!p) {
      throw new Error(
        'Tracked product not found'
      );
    }

    setProduct(p);

    const [hist, lgs] = await Promise.all([
      api.history(id),
      api.logs(id)
    ]);

    setHistory(hist || []);
    setLogs(lgs || []);
  }

  useEffect(() => {
    load().catch((e) =>
      setMessage(e.message)
    );
  }, [id]);

  async function handleProductFrequencyChange(
    value
  ) {
    const minutes = Number(value);

    setFrequencySaving(true);
    setMessage('');

    try {
      const updated =
        await api.updateFrequency(
          id,
          minutes
        );

      setProduct((current) => ({
        ...current,
        ...updated,
        scrape_interval_minutes: minutes
      }));
    } catch (e) {
      setMessage(
        `Failed to update scrape frequency: ${e.message}`
      );
    } finally {
      setFrequencySaving(false);
    }
  }

  async function triggerManualScrape() {
    setBusy(true);
    setMessage('');

    setSuccessNotice(
      'Running live scrape against INE mock store (challenge & hidden-price resolution)...'
    );

    try {
      const res = await api.scrape(id);

      if (res.success) {
        setSuccessNotice(
          `Scrape completed successfully! Price: ${
            res.data.currency
          } ${Number(
            res.data.price
          ).toLocaleString()} (${res.data.stock})`
        );
      } else {
        setMessage(
          `Scrape failed: ${
            res.error ||
            'Challenge or navigation error'
          }`
        );

        setSuccessNotice('');
      }

      await load();
    } catch (e) {
      setMessage(
        `Scrape error: ${e.message}`
      );

      setSuccessNotice('');
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct() {
    if (
      !confirm(
        `Are you sure you want to stop tracking "${product.name}"? This will delete its history and logs.`
      )
    ) {
      return;
    }

    try {
      await api.remove(id);
      window.location.href = '/';
    } catch (e) {
      setMessage(
        `Failed to remove product: ${e.message}`
      );
    }
  }

  // Bonus alerts: Price Drop & Back in Stock detection
  const priceAlert = useMemo(() => {
    if (history.length < 2) {
      return null;
    }

    const latest = Number(
      history[history.length - 1].price
    );

    const prev = Number(
      history[history.length - 2].price
    );

    if (latest < prev) {
      const diff = prev - latest;

      const pct = Math.round(
        (diff / prev) * 100
      );

      return {
        type: 'drop',
        message:
          `Price dropped by ${pct}% ` +
          `(${product?.currency || 'INR'} ` +
          `${diff.toLocaleString()} lower than previous observation)!`
      };
    }

    if (latest > prev) {
      const diff = latest - prev;

      return {
        type: 'increase',
        message:
          `Price increased by ${
            product?.currency || 'INR'
          } ${diff.toLocaleString()} since last scrape.`
      };
    }

    return null;
  }, [history, product]);

  const stockAlert = useMemo(() => {
    if (history.length < 2) {
      return null;
    }

    const latestStock = String(
      history[history.length - 1].stock || ''
    ).toLowerCase();

    const prevStock = String(
      history[history.length - 2].stock || ''
    ).toLowerCase();

    if (
      prevStock.includes('out') &&
      !latestStock.includes('out')
    ) {
      return {
        type: 'back_in_stock',
        message:
          'Product is back in stock!'
      };
    }

    if (
      !prevStock.includes('out') &&
      latestStock.includes('out')
    ) {
      return {
        type: 'out_of_stock',
        message:
          'Product just went out of stock!'
      };
    }

    return null;
  }, [history]);

  if (!product) {
    return (
      <section className="page-state">
        <p>
          {message ||
            'Loading product tracking details...'}
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">
          ‹ Back to Dashboard
        </Link>
      </div>

      <section className="product-header">
        <div>
          <p className="eyebrow">
            MONITORED PRODUCT
          </p>

          <h1>{product.name}</h1>

          <div className="product-links">
            <a
              href={product.source_url}
              target="_blank"
              rel="noreferrer"
              className="ext-link"
            >
              Open on INE Store ↗
            </a>
          </div>
        </div>

        <div className="actions">
          <button
            onClick={triggerManualScrape}
            disabled={busy}
            className="primary-action"
          >
            {busy
              ? 'Scraping in progress...'
              : '⚡ Run Scrape Now'}
          </button>

          <button
            className="secondary danger-action"
            onClick={removeProduct}
            disabled={busy}
          >
            Stop Tracking
          </button>
        </div>
      </section>

      {/* Configurable scrape frequency */}
      <section className="frequency-panel">
        <div>
          <p className="eyebrow">
            SCHEDULE
          </p>

          <h2>Scrape Frequency</h2>

          <p>
            The external scheduler runs every 2 hours.
            The backend only scrapes this product when
            its configured interval is due.
          </p>
        </div>

        <div className="product-frequency">
          <label htmlFor="product-frequency-select">
            Frequency
          </label>

          <select
            id="product-frequency-select"
            value={
              Number(
                product.scrape_interval_minutes
              ) || 120
            }
            disabled={frequencySaving}
            onChange={(e) =>
              handleProductFrequencyChange(
                e.target.value
              )
            }
          >
            {SCRAPE_FREQUENCIES.map(
              (frequency) => (
                <option
                  key={frequency.value}
                  value={frequency.value}
                >
                  {frequency.label}
                </option>
              )
            )}
          </select>

          {frequencySaving && (
            <small>Saving...</small>
          )}
        </div>
      </section>

      {/* Bonus In-App Alerts */}
      {priceAlert && (
        <div
          className={`alert-banner ${priceAlert.type}`}
        >
          <strong>
            {priceAlert.type === 'drop'
              ? '📉 Price Drop Detected'
              : '📈 Price Update'}
            :
          </strong>{' '}
          {priceAlert.message}
        </div>
      )}

      {stockAlert && (
        <div
          className={`alert-banner ${stockAlert.type}`}
        >
          <strong>
            {stockAlert.type ===
            'back_in_stock'
              ? '🎉 Back in Stock'
              : '⚠️ Inventory Alert'}
            :
          </strong>{' '}
          {stockAlert.message}
        </div>
      )}

      {message && (
        <p className="error">{message}</p>
      )}

      {successNotice && (
        <p className="success-notice">
          {successNotice}
        </p>
      )}

      <section className="metrics">
        <div>
          <span>
            Current / Last Price
          </span>

          <strong>
            {product.last_price == null
              ? 'No data yet'
              : `${
                  product.currency ||
                  'INR'
                } ${Number(
                  product.last_price
                ).toLocaleString()}`}
          </strong>
        </div>

        <div>
          <span>Stock Status</span>

          <strong>
            {product.last_stock ||
              'No data yet'}
          </strong>
        </div>

        <div>
          <span>
            Last Successful Scrape
          </span>

          <strong>
            {product.last_scraped_at
              ? new Date(
                  product.last_scraped_at
                ).toLocaleString()
              : 'Pending'}
          </strong>
        </div>

        <div>
          <span>Configured Frequency</span>

          <strong>
            {getFrequencyLabel(
              product.scrape_interval_minutes
            )}
          </strong>
        </div>
      </section>

      <section className="history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              OBSERVATIONS OVER TIME
            </p>

            <h2>Price History</h2>
          </div>

          <span>
            {history.length} valid records
          </span>
        </div>

        <PriceChart
          data={history}
          currency={
            product.currency || 'INR'
          }
        />

        <div className="history-table">
          <div className="table-head">
            <span>Timestamp</span>
            <span>Observed Price</span>
            <span>Stock Status</span>
            <span>Currency</span>
          </div>

          {history
            .slice()
            .reverse()
            .map((row) => (
              <div
                className="table-row"
                key={row.id}
              >
                <span>
                  {new Date(
                    row.scraped_at
                  ).toLocaleString()}
                </span>

                <span className="bold-price">
                  {row.price == null
                    ? '—'
                    : `${
                        row.currency ||
                        product.currency ||
                        'INR'
                      } ${Number(
                        row.price
                      ).toLocaleString()}`}
                </span>

                <span>
                  <span
                    className={`stock-pill ${
                      String(
                        row.stock
                      )
                        .toLowerCase()
                        .includes('out')
                        ? 'out'
                        : 'in'
                    }`}
                  >
                    {row.stock || '—'}
                  </span>
                </span>

                <span>
                  {row.currency ||
                    product.currency ||
                    'INR'}
                </span>
              </div>
            ))}

          {!history.length && (
            <p className="empty">
              No price history recorded yet.
            </p>
          )}
        </div>
      </section>

      <section className="logs">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              HONEST OBSERVABILITY
            </p>

            <h2>
              Scrape Attempts & Diagnostic Logs
            </h2>
          </div>

          <span>
            {logs.length} attempts logged
          </span>
        </div>

        <p className="logs-desc">
          Every scrape attempt is honestly
          recorded below: success, retried
          (e.g. challenge failure, upstream
          rate-limit, delay), and failed states
          are distinguished.
        </p>

        <div className="log-table">
          <div className="table-head">
            <span>Timestamp</span>
            <span>Attempt</span>
            <span>Status</span>
            <span>Duration</span>
            <span>HTTP</span>
            <span>
              Message / Diagnostic Details
            </span>
          </div>

          {logs.map((log) => (
            <div
              className="table-row"
              key={log.id}
            >
              <span>
                {new Date(
                  log.scraped_at
                ).toLocaleString()}
              </span>

              <span>
                #{log.attempt}
              </span>

              <span>
                <span
                  className={`status-pill ${log.status}`}
                >
                  {log.status.toUpperCase()}
                </span>
              </span>

              <span>
                {log.duration_ms != null
                  ? `${log.duration_ms}ms`
                  : '—'}
              </span>

              <span>
                {log.http_status || '—'}
              </span>

              <span className="log-message">
                {log.message || '—'}
              </span>
            </div>
          ))}

          {!logs.length && (
            <p className="empty">
              No scrape attempts logged yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function PriceChart({ data, currency }) {
  if (!data.length) {
    return (
      <div className="chart-empty">
        No successful observations recorded yet.
      </div>
    );
  }

  const values = data.map((d) =>
    Number(d.price)
  );

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 900;
  const height = 260;
  const padding = 35;

  const points = data
    .map((d, i) => {
      const x =
        padding +
        (i /
          Math.max(
            data.length - 1,
            1
          )) *
          (width - 2 * padding);

      const y =
        height -
        padding -
        ((Number(d.price) - min) /
          range) *
          (height - 2 * padding);

      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="chart-wrap">
      <div className="chart-header">
        <span>
          Price trend ({currency})
        </span>

        <span>
          Min: {currency}{' '}
          {min.toLocaleString()} · Max:{' '}
          {currency}{' '}
          {max.toLocaleString()}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Price history chart"
      >
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        <line
          x1={padding}
          y1={padding}
          x2={width - padding}
          y2={padding}
          stroke="#e2e8f0"
          strokeDasharray="4"
          strokeWidth="1"
        />

        <polyline
          fill="none"
          stroke="#0f172a"
          strokeWidth="2.5"
          points={points}
        />

        {data.map((d, i) => {
          const cx =
            padding +
            (i /
              Math.max(
                data.length - 1,
                1
              )) *
              (width - 2 * padding);

          const cy =
            height -
            padding -
            ((Number(d.price) - min) /
              range) *
              (height - 2 * padding);

          return (
            <g key={d.id || i}>
              <circle
                cx={cx}
                cy={cy}
                r="4.5"
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>

      <div className="chart-axis">
        <span>
          First:{' '}
          {new Date(
            data[0].scraped_at
          ).toLocaleDateString()}
        </span>

        <span>
          Latest:{' '}
          {new Date(
            data[data.length - 1].scraped_at
          ).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

function Legal({ type }) {
  const privacy = type === 'privacy';

  return (
    <section className="legal">
      <p className="eyebrow">
        {privacy
          ? 'PRIVACY POLICY'
          : 'TERMS OF SERVICE'}
      </p>

      <h1>
        {privacy
          ? 'Privacy Policy'
          : 'Terms of Service'}
      </h1>

      {privacy ? (
        <>
          <p>
            This application stores tracked
            product URLs, names, price history,
            stock history, and scrape diagnostic
            logs in Supabase PostgreSQL.
          </p>

          <h2>Data Use</h2>

          <p>
            Observations are captured solely to
            monitor price trends and stock status
            for the INE mock storefront
            (demo.inelabteamdev.com).
          </p>

          <h2>
            Credentials & Security
          </h2>

          <p>
            Supabase service-role keys and cron
            secrets are stored strictly on the
            server and are never sent to the
            browser.
          </p>
        </>
      ) : (
        <>
          <p>
            This software is built for the INE
            Software Engineer Intern Assignment.
          </p>

          <h2>Allowed Scope</h2>

          <p>
            The scraper exclusively accesses the
            official INE mock storefront
            (demo.inelabteamdev.com).
            Third-party retailers are strictly
            disallowed.
          </p>

          <h2>Cron Trigger</h2>

          <p>
            The backend exposes a secure POST
            /api/cron/scrape endpoint scheduled
            every 2 hours via cron-job.org.
          </p>
        </>
      )}
    </section>
  );
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={<SearchPage />}
        />

        <Route
          path="/product/:id"
          element={<ProductPage />}
        />

        <Route
          path="/privacy"
          element={<Legal type="privacy" />}
        />

        <Route
          path="/terms"
          element={<Legal type="terms" />}
        />
      </Routes>
    </Layout>
  );
}

createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);