import { config } from './config.js';

let cachedItems = null;
let lastFetchedAt = 0;
let fetchPromise = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPageWithRetry(page, pageSize = 60, maxRetries = 3) {
  const url = `${config.storeBaseUrl}/api/catalog?page=${page}&pageSize=${pageSize}`;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) INE-Price-Tracker/1.0',
          Accept: 'application/json'
        }
      });
      if (res.status === 429) {
        let waitMs = 1200;
        try {
          const json = await res.json();
          if (json.retryAfter) waitMs = (json.retryAfter * 1000) + 200;
        } catch {}
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) {
        if (attempt < maxRetries) {
          await sleep(500 * attempt);
          continue;
        }
        throw new Error(`Catalog API responded with HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      await sleep(500 * attempt);
    }
  }
}

export async function refreshCatalog(force = false) {
  const now = Date.now();
  if (!force && cachedItems && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedItems;
  }
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const firstPage = await fetchPageWithRetry(1, 60);
      const totalPages = firstPage.pages || 1;
      const items = [...(firstPage.items || [])];

      for (let p = 2; p <= totalPages; p++) {
        await sleep(100); // polite pacing
        try {
          const pageData = await fetchPageWithRetry(p, 60);
          if (pageData?.items) items.push(...pageData.items);
        } catch (err) {
          console.warn(`[Catalog] Failed to fetch page ${p}: ${err.message}`);
        }
      }

      cachedItems = items;
      lastFetchedAt = Date.now();
      console.log(`[Catalog] Cached ${items.length} products from INE storefront.`);
      return cachedItems;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export async function searchCatalog(query, limit = 20) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];

  if (!cachedItems || Date.now() - lastFetchedAt >= CACHE_TTL_MS) {
    await refreshCatalog().catch((err) => {
      console.warn('[Catalog] Refresh failed, using existing cache if available:', err.message);
    });
  }

  const items = cachedItems || [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = [];
  for (const item of items) {
    const name = String(item.name || '').toLowerCase();
    const brand = String(item.brand || '').toLowerCase();
    const category = String(item.category || '').toLowerCase();
    const sku = String(item.sku || '').toLowerCase();
    const desc = String(item.description || '').toLowerCase();
    const haystack = `${name} ${brand} ${category} ${sku} ${desc}`;

    let score = 0;

    // Exact name match
    if (name === q) score += 100;
    // Prefix name match
    else if (name.startsWith(q)) score += 50;
    // Substring in name
    else if (name.includes(q)) score += 30;

    // Brand or SKU match
    if (brand.includes(q)) score += 20;
    if (sku.includes(q)) score += 25;

    // Category match
    if (category.includes(q)) score += 15;

    // All token matches
    const allTokensMatch = tokens.every((t) => haystack.includes(t));
    if (allTokensMatch) score += 15;

    // Any token in name
    for (const t of tokens) {
      if (name.includes(t)) score += 5;
    }

    if (score > 0) {
      scored.push({
        id: item.id,
        href: `${config.storeBaseUrl}/product/${item.id}`,
        text: item.name,
        name: item.name,
        brand: item.brand,
        category: item.category,
        sku: item.sku,
        description: item.description,
        score
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getCachedCatalog() {
  return cachedItems || [];
}
