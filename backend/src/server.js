import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { supabase } from './db.js';
import { discoverProducts, scrapeProduct, isAllowedStoreUrl } from './scraper.js';
import { refreshCatalog } from './catalog.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));

const running = new Set();

function authCron(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token || !config.cronSecret || token !== config.cronSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET token' });
  }
  next();
}

async function logAttempt(productId, attempt, status, message, httpStatus, durationMs) {
  try {
    await supabase.from('scrape_logs').insert({
      tracked_product_id: productId,
      attempt,
      status: ['success', 'retried', 'failed'].includes(status) ? status : 'failed',
      message: message ? String(message).slice(0, 500) : null,
      http_status: httpStatus || null,
      duration_ms: durationMs != null ? Math.round(durationMs) : null
    });
  } catch (err) {
    console.error(`[DB] Failed to log attempt for product ${productId}:`, err.message);
  }
}

async function runOne(product) {
  if (running.has(product.id)) {
    return { skipped: true, reason: 'already_running', productId: product.id };
  }
  running.add(product.id);

  try {
    let result;
    try {
      result = await scrapeProduct(product.source_url);
    } catch (error) {
      // Log all attempts honestly (retried / failed)
      for (const attempt of error.attempts || []) {
        await logAttempt(
          product.id,
          attempt.attempt,
          attempt.status,
          attempt.message,
          attempt.httpStatus,
          attempt.durationMs
        );
      }
      throw error;
    }

    // Log all attempts up to success
    for (const attempt of result.attempts || []) {
      await logAttempt(
        product.id,
        attempt.attempt,
        attempt.status,
        attempt.message,
        attempt.httpStatus,
        attempt.durationMs
      );
    }

    // Only on validated success do we record price_history
    const nowIso = new Date().toISOString();
    const { error: historyError } = await supabase.from('price_history').insert({
      tracked_product_id: product.id,
      price: result.data.price,
      stock: result.data.stock,
      currency: result.data.currency,
      scraped_at: nowIso
    });
    if (historyError) {
      console.error(`[DB] Failed to insert price_history: ${historyError.message}`);
      throw historyError;
    }

    // Update tracked product last known good values
    const { error: updateError } = await supabase.from('tracked_products').update({
      name: result.data.name || product.name,
      image_url: result.data.imageUrl || product.image_url,
      currency: result.data.currency || product.currency,
      last_price: result.data.price,
      last_stock: result.data.stock,
      last_scraped_at: nowIso
    }).eq('id', product.id);

    if (updateError) {
      console.error(`[DB] Failed to update tracked_products: ${updateError.message}`);
      throw updateError;
    }

    return { success: true, productId: product.id, data: result.data };
  } catch (error) {
    return { success: false, productId: product.id, error: error.message };
  } finally {
    running.delete(product.id);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ine-price-tracker-api', time: new Date().toISOString() });
});

app.get('/api/products/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  try {
    const results = await discoverProducts(q);
    res.json(results);
  } catch (error) {
    res.status(502).json({ error: 'Store search failed', detail: error.message });
  }
});

app.get('/api/tracked', async (_req, res) => {
  const { data, error } = await supabase
    .from('tracked_products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/tracked', async (req, res) => {
  const { source_url, name } = req.body || {};
  if (!source_url || !name || !isAllowedStoreUrl(source_url)) {
    return res.status(400).json({
      error: 'A valid product URL from the INE mock store (https://demo.inelabteamdev.com/) is required.'
    });
  }

  const { data, error } = await supabase
    .from('tracked_products')
    .insert({ source_url, name: String(name).trim() })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Product is already being tracked.' });
    }
    return res.status(500).json({ error: error.message });
  }

  // Perform initial scrape upon tracking
  const scrapeResult = await runOne(data);
  const { data: refreshed } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', data.id)
    .single();

  res.status(201).json({
    ...(refreshed || data),
    initial_scrape_success: scrapeResult.success,
    initial_scrape_error: scrapeResult.error || null
  });
});

app.delete('/api/tracked/:id', async (req, res) => {
  const { error } = await supabase
    .from('tracked_products')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

app.get('/api/tracked/:id/history', async (req, res) => {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('tracked_product_id', req.params.id)
    .order('scraped_at', { ascending: true })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/tracked/:id/logs', async (req, res) => {
  const { data, error } = await supabase
    .from('scrape_logs')
    .select('*')
    .eq('tracked_product_id', req.params.id)
    .order('scraped_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/tracked/:id/scrape', async (req, res) => {
  const { data: product, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !product) {
    return res.status(404).json({ error: 'Tracked product not found.' });
  }

  const result = await runOne(product);
  res.status(result.success ? 200 : 502).json(result);
});

app.post('/api/cron/scrape', authCron, async (_req, res) => {
  const { data: products, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('scrape_enabled', true);
  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (let i = 0; i < (products || []).length; i += config.concurrency) {
    const batch = products.slice(i, i + config.concurrency);
    results.push(...await Promise.all(batch.map(runOne)));
  }

  const total = results.length;
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;

  res.json({
    ran_at: new Date().toISOString(),
    summary: { total, successful, failed, skipped },
    results
  });
});

app.listen(config.port, () => {
  console.log(`INE Price Tracker API listening on port ${config.port}`);
  refreshCatalog().catch((err) => console.warn('[Catalog] Pre-warm failed:', err.message));
});
