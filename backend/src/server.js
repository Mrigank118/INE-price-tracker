// import express from 'express';
// import cors from 'cors';
// import { config } from './config.js';
// import { supabase } from './db.js';
// import { discoverProducts, scrapeProduct, isAllowedStoreUrl } from './scraper.js';
// import { refreshCatalog } from './catalog.js';

// const app = express();
// app.use(cors());
// app.use(express.json({ limit: '100kb' }));

// const running = new Set();

// function authCron(req, res, next) {
//   const header = req.headers.authorization || '';
//   const token = header.replace(/^Bearer\s+/i, '').trim();
//   if (!token || !config.cronSecret || token !== config.cronSecret) {
//     return res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET token' });
//   }
//   next();
// }

// async function logAttempt(productId, attempt, status, message, httpStatus, durationMs) {
//   try {
//     await supabase.from('scrape_logs').insert({
//       tracked_product_id: productId,
//       attempt,
//       status: ['success', 'retried', 'failed'].includes(status) ? status : 'failed',
//       message: message ? String(message).slice(0, 500) : null,
//       http_status: httpStatus || null,
//       duration_ms: durationMs != null ? Math.round(durationMs) : null
//     });
//   } catch (err) {
//     console.error(`[DB] Failed to log attempt for product ${productId}:`, err.message);
//   }
// }

// async function runOne(product) {
//   if (running.has(product.id)) {
//     return { skipped: true, reason: 'already_running', productId: product.id };
//   }
//   running.add(product.id);

//   try {
//     let result;
//     try {
//       result = await scrapeProduct(product.source_url);
//     } catch (error) {
//       // Log all attempts honestly (retried / failed)
//       for (const attempt of error.attempts || []) {
//         await logAttempt(
//           product.id,
//           attempt.attempt,
//           attempt.status,
//           attempt.message,
//           attempt.httpStatus,
//           attempt.durationMs
//         );
//       }
//       throw error;
//     }

//     // Log all attempts up to success
//     for (const attempt of result.attempts || []) {
//       await logAttempt(
//         product.id,
//         attempt.attempt,
//         attempt.status,
//         attempt.message,
//         attempt.httpStatus,
//         attempt.durationMs
//       );
//     }

//     // Only on validated success do we record price_history
//     const nowIso = new Date().toISOString();
//     const { error: historyError } = await supabase.from('price_history').insert({
//       tracked_product_id: product.id,
//       price: result.data.price,
//       stock: result.data.stock,
//       currency: result.data.currency,
//       scraped_at: nowIso
//     });
//     if (historyError) {
//       console.error(`[DB] Failed to insert price_history: ${historyError.message}`);
//       throw historyError;
//     }

//     // Update tracked product last known good values
//     const { error: updateError } = await supabase.from('tracked_products').update({
//       name: result.data.name || product.name,
//       image_url: result.data.imageUrl || product.image_url,
//       currency: result.data.currency || product.currency,
//       last_price: result.data.price,
//       last_stock: result.data.stock,
//       last_scraped_at: nowIso
//     }).eq('id', product.id);

//     if (updateError) {
//       console.error(`[DB] Failed to update tracked_products: ${updateError.message}`);
//       throw updateError;
//     }

//     return { success: true, productId: product.id, data: result.data };
//   } catch (error) {
//     return { success: false, productId: product.id, error: error.message };
//   } finally {
//     running.delete(product.id);
//   }
// }

// app.get('/api/health', (_req, res) => {
//   res.json({ ok: true, service: 'ine-price-tracker-api', time: new Date().toISOString() });
// });

// app.get('/api/products/search', async (req, res) => {
//   const q = String(req.query.q || '').trim();
//   if (q.length < 2) return res.json([]);
//   try {
//     const results = await discoverProducts(q);
//     res.json(results);
//   } catch (error) {
//     res.status(502).json({ error: 'Store search failed', detail: error.message });
//   }
// });

// app.get('/api/tracked', async (_req, res) => {
//   const { data, error } = await supabase
//     .from('tracked_products')
//     .select('*')
//     .order('created_at', { ascending: false });
//   if (error) return res.status(500).json({ error: error.message });
//   res.json(data || []);
// });

// app.post('/api/tracked', async (req, res) => {
//   const { source_url, name } = req.body || {};
//   if (!source_url || !name || !isAllowedStoreUrl(source_url)) {
//     return res.status(400).json({
//       error: 'A valid product URL from the INE mock store (https://demo.inelabteamdev.com/) is required.'
//     });
//   }

//   const { data, error } = await supabase
//     .from('tracked_products')
//     .insert({ source_url, name: String(name).trim() })
//     .select()
//     .single();

//   if (error) {
//     if (error.code === '23505') {
//       return res.status(409).json({ error: 'Product is already being tracked.' });
//     }
//     return res.status(500).json({ error: error.message });
//   }

//   // Perform initial scrape upon tracking
//   const scrapeResult = await runOne(data);
//   const { data: refreshed } = await supabase
//     .from('tracked_products')
//     .select('*')
//     .eq('id', data.id)
//     .single();

//   res.status(201).json({
//     ...(refreshed || data),
//     initial_scrape_success: scrapeResult.success,
//     initial_scrape_error: scrapeResult.error || null
//   });
// });

// app.delete('/api/tracked/:id', async (req, res) => {
//   const { error } = await supabase
//     .from('tracked_products')
//     .delete()
//     .eq('id', req.params.id);
//   if (error) return res.status(500).json({ error: error.message });
//   res.status(204).end();
// });

// app.get('/api/tracked/:id/history', async (req, res) => {
//   const { data, error } = await supabase
//     .from('price_history')
//     .select('*')
//     .eq('tracked_product_id', req.params.id)
//     .order('scraped_at', { ascending: true })
//     .limit(500);
//   if (error) return res.status(500).json({ error: error.message });
//   res.json(data || []);
// });

// app.get('/api/tracked/:id/logs', async (req, res) => {
//   const { data, error } = await supabase
//     .from('scrape_logs')
//     .select('*')
//     .eq('tracked_product_id', req.params.id)
//     .order('scraped_at', { ascending: false })
//     .limit(200);
//   if (error) return res.status(500).json({ error: error.message });
//   res.json(data || []);
// });

// app.post('/api/tracked/:id/scrape', async (req, res) => {
//   const { data: product, error } = await supabase
//     .from('tracked_products')
//     .select('*')
//     .eq('id', req.params.id)
//     .single();
//   if (error || !product) {
//     return res.status(404).json({ error: 'Tracked product not found.' });
//   }

//   const result = await runOne(product);
//   res.status(result.success ? 200 : 502).json(result);
// });

// app.post('/api/cron/scrape', authCron, async (_req, res) => {
//   const { data: products, error } = await supabase
//     .from('tracked_products')
//     .select('*')
//     .eq('scrape_enabled', true);
//   if (error) return res.status(500).json({ error: error.message });

//   const results = [];
//   for (let i = 0; i < (products || []).length; i += config.concurrency) {
//     const batch = products.slice(i, i + config.concurrency);
//     results.push(...await Promise.all(batch.map(runOne)));
//   }

//   const total = results.length;
//   const successful = results.filter((r) => r.success).length;
//   const failed = results.filter((r) => !r.success && !r.skipped).length;
//   const skipped = results.filter((r) => r.skipped).length;

//   res.json({
//     ran_at: new Date().toISOString(),
//     summary: { total, successful, failed, skipped },
//     results
//   });
// });

// app.listen(config.port, () => {
//   console.log(`INE Price Tracker API listening on port ${config.port}`);
//   refreshCatalog().catch((err) => console.warn('[Catalog] Pre-warm failed:', err.message));
// });
// import express from 'express';
// import cors from 'cors';
// import { config } from './config.js';
// import { supabase } from './db.js';
// import {
//   discoverProducts,
//   scrapeProduct,
//   isAllowedStoreUrl,
//   buildStructureSignature
// } from './scraper.js';
// import { refreshCatalog } from './catalog.js';

// const app = express();

// app.use(cors());
// app.use(express.json({ limit: '100kb' }));

// /*
//  * Prevent the same tracked product from being scraped simultaneously.
//  */
// const running = new Set();

// /*
//  * Prevent overlapping full cron runs inside this Render instance.
//  */
// let cronRunning = false;

// /*
//  * Cron authentication.
//  *
//  * Expected:
//  * Authorization: Bearer <CRON_SECRET>
//  */
// function authCron(req, res, next) {
//   const header = req.headers.authorization || '';
//   const token = header.replace(/^Bearer\s+/i, '').trim();

//   if (
//     !token ||
//     !config.cronSecret ||
//     token !== config.cronSecret
//   ) {
//     return res.status(401).json({
//       error: 'Unauthorized: Invalid or missing CRON_SECRET token'
//     });
//   }

//   next();
// }

// /*
//  * Record one scraper attempt.
//  */
// async function logAttempt(
//   productId,
//   attempt,
//   status,
//   message,
//   httpStatus,
//   durationMs
// ) {
//   try {
//     await supabase.from('scrape_logs').insert({
//       tracked_product_id: productId,
//       attempt,
//       status: ['success', 'retried', 'failed'].includes(status)
//         ? status
//         : 'failed',
//       message: message
//         ? String(message).slice(0, 500)
//         : null,
//       http_status: httpStatus || null,
//       duration_ms:
//         durationMs != null
//           ? Math.round(durationMs)
//           : null
//     });
//   } catch (err) {
//     console.error(
//       `[DB] Failed to log attempt for product ${productId}:`,
//       err.message
//     );
//   }
// }

// /*
//  * Scrape and persist one tracked product.
//  */
// async function runOne(product) {
//   if (running.has(product.id)) {
//     return {
//       skipped: true,
//       reason: 'already_running',
//       productId: product.id
//     };
//   }

//   running.add(product.id);

//   try {
//     let result;

//     try {
//       result = await scrapeProduct(product.source_url);
//     } catch (error) {
//       /*
//        * Log every failed/retried attempt honestly.
//        */
//       for (const attempt of error.attempts || []) {
//         await logAttempt(
//           product.id,
//           attempt.attempt,
//           attempt.status,
//           attempt.message,
//           attempt.httpStatus,
//           attempt.durationMs
//         );
//       }

//       throw error;
//     }

//     /*
//      * Determine structure change BEFORE writing the
//      * successful attempt log so the message can contain
//      * the structure-change information without creating
//      * a duplicate success log.
//      */
//     let newStructureSignature = null;

//     if (result.data.structure) {
//       newStructureSignature = buildStructureSignature(
//         result.data.structure
//       );
//     }

//     const structureChanged =
//       Boolean(product.structure_signature) &&
//       Boolean(newStructureSignature) &&
//       product.structure_signature !== newStructureSignature;

//     if (structureChanged) {
//       console.warn(
//         `[STRUCTURE] Product structure changed: ${product.name} (${product.source_url})`
//       );
//     }

//     /*
//      * Log every attempt that occurred before successful extraction.
//      *
//      * If structure changed, annotate the existing successful
//      * attempt instead of inserting a second success row.
//      */
//     for (const attempt of result.attempts || []) {
//       let message = attempt.message;

//       if (
//         structureChanged &&
//         attempt.status === 'success'
//       ) {
//         message =
//           `${message || 'Scrape succeeded.'} ` +
//           'STORE_STRUCTURE_CHANGED: Product page structure differs from the previous successful scrape.';
//       }

//       await logAttempt(
//         product.id,
//         attempt.attempt,
//         attempt.status,
//         message,
//         attempt.httpStatus,
//         attempt.durationMs
//       );
//     }

//     /*
//      * Only validated successful data reaches price_history.
//      */
//     const nowIso = new Date().toISOString();

//     const { error: historyError } = await supabase
//       .from('price_history')
//       .insert({
//         tracked_product_id: product.id,
//         price: result.data.price,
//         stock: result.data.stock,
//         currency: result.data.currency,
//         scraped_at: nowIso
//       });

//     if (historyError) {
//       console.error(
//         `[DB] Failed to insert price_history: ${historyError.message}`
//       );

//       throw historyError;
//     }

//     /*
//      * Update the last known good product data.
//      */
//     const updatePayload = {
//       name: result.data.name || product.name,
//       image_url:
//         result.data.imageUrl || product.image_url,
//       currency:
//         result.data.currency || product.currency,
//       last_price: result.data.price,
//       last_stock: result.data.stock,
//       last_scraped_at: nowIso
//     };

//     /*
//      * Only update the structure fields when the scraper
//      * actually supplied a structure signature.
//      */
//     if (newStructureSignature) {
//       updatePayload.structure_signature =
//         newStructureSignature;

//       /*
//        * This flag describes whether the CURRENT successful
//        * scrape detected a structure change.
//        *
//        * structure_changed_at keeps the timestamp of the
//        * latest detected change.
//        */
//       updatePayload.structure_changed =
//         structureChanged;

//       if (structureChanged) {
//         updatePayload.structure_changed_at = nowIso;
//       }
//     }

//     const { error: updateError } = await supabase
//       .from('tracked_products')
//       .update(updatePayload)
//       .eq('id', product.id);

//     if (updateError) {
//       console.error(
//         `[DB] Failed to update tracked_products: ${updateError.message}`
//       );

//       throw updateError;
//     }

//     return {
//       success: true,
//       productId: product.id,
//       structure_changed: structureChanged,
//       data: result.data
//     };
//   } catch (error) {
//     return {
//       success: false,
//       productId: product.id,
//       error: error.message
//     };
//   } finally {
//     running.delete(product.id);
//   }
// }

// /*
//  * Health check.
//  */
// app.get('/api/health', (_req, res) => {
//   res.json({
//     ok: true,
//     service: 'ine-price-tracker-api',
//     time: new Date().toISOString()
//   });
// });

// /*
//  * Product search.
//  */
// app.get('/api/products/search', async (req, res) => {
//   const q = String(req.query.q || '').trim();

//   if (q.length < 2) {
//     return res.json([]);
//   }

//   try {
//     const results = await discoverProducts(q);
//     res.json(results);
//   } catch (error) {
//     res.status(502).json({
//       error: 'Store search failed',
//       detail: error.message
//     });
//   }
// });

// /*
//  * Get tracked products.
//  */
// app.get('/api/tracked', async (_req, res) => {
//   const { data, error } = await supabase
//     .from('tracked_products')
//     .select('*')
//     .order('created_at', {
//       ascending: false
//     });

//   if (error) {
//     return res.status(500).json({
//       error: error.message
//     });
//   }

//   res.json(data || []);
// });

// /*
//  * Track a product.
//  */
// app.post('/api/tracked', async (req, res) => {
//   const { source_url, name } = req.body || {};

//   if (
//     !source_url ||
//     !name ||
//     !isAllowedStoreUrl(source_url)
//   ) {
//     return res.status(400).json({
//       error:
//         'A valid product URL from the INE mock store (https://demo.inelabteamdev.com/) is required.'
//     });
//   }

//   const { data, error } = await supabase
//     .from('tracked_products')
//     .insert({
//       source_url,
//       name: String(name).trim()
//     })
//     .select()
//     .single();

//   if (error) {
//     if (error.code === '23505') {
//       return res.status(409).json({
//         error: 'Product is already being tracked.'
//       });
//     }

//     return res.status(500).json({
//       error: error.message
//     });
//   }

//   /*
//    * Perform initial scrape.
//    */
//   const scrapeResult = await runOne(data);

//   const { data: refreshed } = await supabase
//     .from('tracked_products')
//     .select('*')
//     .eq('id', data.id)
//     .single();

//   res.status(201).json({
//     ...(refreshed || data),
//     initial_scrape_success: scrapeResult.success,
//     initial_scrape_error:
//       scrapeResult.error || null
//   });
// });

// /*
//  * Remove tracked product.
//  */
// app.delete('/api/tracked/:id', async (req, res) => {
//   const { error } = await supabase
//     .from('tracked_products')
//     .delete()
//     .eq('id', req.params.id);

//   if (error) {
//     return res.status(500).json({
//       error: error.message
//     });
//   }

//   res.status(204).end();
// });

// /*
//  * Price/stock history.
//  */
// app.get('/api/tracked/:id/history', async (req, res) => {
//   const { data, error } = await supabase
//     .from('price_history')
//     .select('*')
//     .eq('tracked_product_id', req.params.id)
//     .order('scraped_at', {
//       ascending: true
//     })
//     .limit(500);

//   if (error) {
//     return res.status(500).json({
//       error: error.message
//     });
//   }

//   res.json(data || []);
// });

// /*
//  * Scrape logs.
//  */
// app.get('/api/tracked/:id/logs', async (req, res) => {
//   const { data, error } = await supabase
//     .from('scrape_logs')
//     .select('*')
//     .eq('tracked_product_id', req.params.id)
//     .order('scraped_at', {
//       ascending: false
//     })
//     .limit(200);

//   if (error) {
//     return res.status(500).json({
//       error: error.message
//     });
//   }

//   res.json(data || []);
// });

// /*
//  * Manual scrape.
//  */
// app.post('/api/tracked/:id/scrape', async (req, res) => {
//   const { data: product, error } = await supabase
//     .from('tracked_products')
//     .select('*')
//     .eq('id', req.params.id)
//     .single();

//   if (error || !product) {
//     return res.status(404).json({
//       error: 'Tracked product not found.'
//     });
//   }

//   const result = await runOne(product);

//   res
//     .status(result.success ? 200 : 502)
//     .json(result);
// });

// /*
//  * ---------------------------------------------------------
//  * BACKGROUND CRON SCRAPER
//  * ---------------------------------------------------------
//  *
//  * This performs the actual scraping work.
//  *
//  * The HTTP endpoint below returns 202 immediately so
//  * cron-job.org does not wait for Playwright scraping.
//  */
// async function runCronScrape() {
//   if (cronRunning) {
//     console.log(
//       '[CRON] Scrape already running; skipping overlapping run.'
//     );
//     return;
//   }

//   cronRunning = true;

//   const started = Date.now();

//   try {
//     console.log('[CRON] Scrape started.');

//     const { data: products, error } = await supabase
//       .from('tracked_products')
//       .select('*')
//       .eq('scrape_enabled', true);

//     if (error) {
//       console.error(
//         '[CRON] Failed to load tracked products:',
//         error.message
//       );
//       return;
//     }

//     console.log(
//       `[CRON] Found ${products?.length || 0} tracked products.`
//     );

//     const results = [];

//     /*
//      * Process products in configured concurrency batches.
//      */
//     for (
//       let i = 0;
//       i < (products || []).length;
//       i += config.concurrency
//     ) {
//       const batch = products.slice(
//         i,
//         i + config.concurrency
//       );

//       console.log(
//         `[CRON] Processing products ${i + 1}-${Math.min(
//           i + batch.length,
//           products.length
//         )} of ${products.length}.`
//       );

//       const batchResults = await Promise.all(
//         batch.map(runOne)
//       );

//       results.push(...batchResults);
//     }

//     const total = results.length;

//     const successful = results.filter(
//       (r) => r.success
//     ).length;

//     const failed = results.filter(
//       (r) => !r.success && !r.skipped
//     ).length;

//     const skipped = results.filter(
//       (r) => r.skipped
//     ).length;

//     const structureChanges = results.filter(
//       (r) => r.success && r.structure_changed
//     ).length;

//     console.log(
//       `[CRON] Completed in ${
//         Date.now() - started
//       }ms. ` +
//         `total=${total} ` +
//         `successful=${successful} ` +
//         `failed=${failed} ` +
//         `skipped=${skipped} ` +
//         `structure_changes=${structureChanges}`
//     );
//   } catch (error) {
//     console.error(
//       '[CRON] Unexpected error:',
//       error
//     );
//   } finally {
//     cronRunning = false;
//   }
// }

// /*
//  * Cron endpoint.
//  *
//  * IMPORTANT:
//  * Return immediately with a tiny response.
//  * The actual scrape continues in the background.
//  */
// app.post(
//   '/api/cron/scrape',
//   authCron,
//   (_req, res) => {
//     res.status(202).json({
//       accepted: true,
//       message: 'Scrape job started.'
//     });

//     void runCronScrape();
//   }
// );

// /*
//  * Start server.
//  */
// app.listen(config.port, () => {
//   console.log(
//     `INE Price Tracker API listening on port ${config.port}`
//   );

//   refreshCatalog().catch((err) =>
//     console.warn(
//       '[Catalog] Pre-warm failed:',
//       err.message
//     )
//   );
// });


import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { supabase } from './db.js';
import {
  discoverProducts,
  scrapeProduct,
  isAllowedStoreUrl,
  buildStructureSignature
} from './scraper.js';
import { refreshCatalog } from './catalog.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

/*
 * Prevent the same tracked product from being scraped simultaneously.
 */
const running = new Set();

/*
 * Prevent overlapping full cron runs inside this Render instance.
 */
let cronRunning = false;

/*
 * Cron authentication.
 *
 * Expected:
 * Authorization: Bearer <CRON_SECRET>
 */
function authCron(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();

  if (
    !token ||
    !config.cronSecret ||
    token !== config.cronSecret
  ) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing CRON_SECRET token'
    });
  }

  next();
}

/*
 * Record one scraper attempt.
 */
async function logAttempt(
  productId,
  attempt,
  status,
  message,
  httpStatus,
  durationMs
) {
  try {
    await supabase.from('scrape_logs').insert({
      tracked_product_id: productId,
      attempt,
      status: ['success', 'retried', 'failed'].includes(status)
        ? status
        : 'failed',
      message: message
        ? String(message).slice(0, 500)
        : null,
      http_status: httpStatus || null,
      duration_ms:
        durationMs != null
          ? Math.round(durationMs)
          : null
    });
  } catch (err) {
    console.error(
      `[DB] Failed to log attempt for product ${productId}:`,
      err.message
    );
  }
}

/*
 * Scrape and persist one tracked product.
 */
async function runOne(product) {
  if (running.has(product.id)) {
    return {
      skipped: true,
      reason: 'already_running',
      productId: product.id
    };
  }

  running.add(product.id);

  try {
    let result;

    try {
      result = await scrapeProduct(product.source_url);
    } catch (error) {
      /*
       * Log every failed/retried attempt honestly.
       */
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

    /*
     * Determine structure change BEFORE writing the
     * successful attempt log so the message can contain
     * the structure-change information without creating
     * a duplicate success log.
     */
    let newStructureSignature = null;

    if (result.data.structure) {
      newStructureSignature = buildStructureSignature(
        result.data.structure
      );
    }

    const structureChanged =
      Boolean(product.structure_signature) &&
      Boolean(newStructureSignature) &&
      product.structure_signature !== newStructureSignature;

    if (structureChanged) {
      console.warn(
        `[STRUCTURE] Product structure changed: ${product.name} (${product.source_url})`
      );
    }

    /*
     * Log every attempt that occurred before successful extraction.
     *
     * If structure changed, annotate the existing successful
     * attempt instead of inserting a second success row.
     */
    for (const attempt of result.attempts || []) {
      let message = attempt.message;

      if (
        structureChanged &&
        attempt.status === 'success'
      ) {
        message =
          `${message || 'Scrape succeeded.'} ` +
          'STORE_STRUCTURE_CHANGED: Product page structure differs from the previous successful scrape.';
      }

      await logAttempt(
        product.id,
        attempt.attempt,
        attempt.status,
        message,
        attempt.httpStatus,
        attempt.durationMs
      );
    }

    /*
     * Only validated successful data reaches price_history.
     */
    const nowIso = new Date().toISOString();

    const { error: historyError } = await supabase
      .from('price_history')
      .insert({
        tracked_product_id: product.id,
        price: result.data.price,
        stock: result.data.stock,
        currency: result.data.currency,
        scraped_at: nowIso
      });

    if (historyError) {
      console.error(
        `[DB] Failed to insert price_history: ${historyError.message}`
      );

      throw historyError;
    }

    /*
     * Update the last known good product data.
     */
    const updatePayload = {
      name: result.data.name || product.name,
      image_url:
        result.data.imageUrl || product.image_url,
      currency:
        result.data.currency || product.currency,
      last_price: result.data.price,
      last_stock: result.data.stock,

      /*
       * IMPORTANT:
       * last_scraped_at means last SUCCESSFUL scrape.
       *
       * Failed scrapes do not update this timestamp,
       * so the product remains due for the next cron run.
       */
      last_scraped_at: nowIso
    };

    /*
     * Only update the structure fields when the scraper
     * actually supplied a structure signature.
     */
    if (newStructureSignature) {
      updatePayload.structure_signature =
        newStructureSignature;

      /*
       * This flag describes whether the CURRENT successful
       * scrape detected a structure change.
       */
      updatePayload.structure_changed =
        structureChanged;

      /*
       * Keep the timestamp of the latest detected change.
       */
      if (structureChanged) {
        updatePayload.structure_changed_at = nowIso;
      }
    }

    const { error: updateError } = await supabase
      .from('tracked_products')
      .update(updatePayload)
      .eq('id', product.id);

    if (updateError) {
      console.error(
        `[DB] Failed to update tracked_products: ${updateError.message}`
      );

      throw updateError;
    }

    return {
      success: true,
      productId: product.id,
      structure_changed: structureChanged,
      data: result.data
    };
  } catch (error) {
    return {
      success: false,
      productId: product.id,
      error: error.message
    };
  } finally {
    running.delete(product.id);
  }
}

/*
 * Health check.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ine-price-tracker-api',
    time: new Date().toISOString()
  });
});

/*
 * Product search.
 */
app.get('/api/products/search', async (req, res) => {
  const q = String(req.query.q || '').trim();

  if (q.length < 2) {
    return res.json([]);
  }

  try {
    const results = await discoverProducts(q);
    res.json(results);
  } catch (error) {
    res.status(502).json({
      error: 'Store search failed',
      detail: error.message
    });
  }
});

/*
 * Get tracked products.
 */
app.get('/api/tracked', async (_req, res) => {
  const { data, error } = await supabase
    .from('tracked_products')
    .select('*')
    .order('created_at', {
      ascending: false
    });

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data || []);
});

/*
 * Track a product.
 */
app.post('/api/tracked', async (req, res) => {
  const { source_url, name } = req.body || {};

  if (
    !source_url ||
    !name ||
    !isAllowedStoreUrl(source_url)
  ) {
    return res.status(400).json({
      error:
        'A valid product URL from the INE mock store (https://demo.inelabteamdev.com/) is required.'
    });
  }

  const { data, error } = await supabase
    .from('tracked_products')
    .insert({
      source_url,
      name: String(name).trim()
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Product is already being tracked.'
      });
    }

    return res.status(500).json({
      error: error.message
    });
  }

  /*
   * Perform initial scrape.
   */
  const scrapeResult = await runOne(data);

  const { data: refreshed } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', data.id)
    .single();

  res.status(201).json({
    ...(refreshed || data),
    initial_scrape_success: scrapeResult.success,
    initial_scrape_error:
      scrapeResult.error || null
  });
});

/*
 * Update scrape frequency.
 *
 * Supported:
 * 120  = 2 hours
 * 240  = 4 hours
 * 360  = 6 hours
 * 720  = 12 hours
 * 1440 = 24 hours
 */
app.patch('/api/tracked/:id/frequency', async (req, res) => {
  const allowedIntervals = [
    120,
    240,
    360,
    720,
    1440
  ];

  const interval = Number(
    req.body?.scrape_interval_minutes
  );

  if (!allowedIntervals.includes(interval)) {
    return res.status(400).json({
      error:
        'Invalid scrape interval. Allowed values are 120, 240, 360, 720, or 1440 minutes.'
    });
  }

  const { data, error } = await supabase
    .from('tracked_products')
    .update({
      scrape_interval_minutes: interval
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        error: 'Tracked product not found.'
      });
    }

    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data);
});

/*
 * Remove tracked product.
 */
app.delete('/api/tracked/:id', async (req, res) => {
  const { error } = await supabase
    .from('tracked_products')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.status(204).end();
});

/*
 * Price/stock history.
 */
app.get('/api/tracked/:id/history', async (req, res) => {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('tracked_product_id', req.params.id)
    .order('scraped_at', {
      ascending: true
    })
    .limit(500);

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data || []);
});

/*
 * Scrape logs.
 */
app.get('/api/tracked/:id/logs', async (req, res) => {
  const { data, error } = await supabase
    .from('scrape_logs')
    .select('*')
    .eq('tracked_product_id', req.params.id)
    .order('scraped_at', {
      ascending: false
    })
    .limit(200);

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data || []);
});

/*
 * Manual scrape.
 */
app.post('/api/tracked/:id/scrape', async (req, res) => {
  const { data: product, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !product) {
    return res.status(404).json({
      error: 'Tracked product not found.'
    });
  }

  const result = await runOne(product);

  res
    .status(result.success ? 200 : 502)
    .json(result);
});

/*
 * ---------------------------------------------------------
 * BACKGROUND CRON SCRAPER
 * ---------------------------------------------------------
 *
 * The external cron runs every 2 hours.
 *
 * Each product can have its own interval:
 *
 * 120  = 2 hours
 * 240  = 4 hours
 * 360  = 6 hours
 * 720  = 12 hours
 * 1440 = 24 hours
 *
 * The cron does NOT scrape every product every time.
 * It only scrapes products whose interval has elapsed.
 */
async function runCronScrape() {
  if (cronRunning) {
    console.log(
      '[CRON] Scrape already running; skipping overlapping run.'
    );
    return;
  }

  cronRunning = true;

  const started = Date.now();

  try {
    console.log('[CRON] Scrape started.');

    const { data: products, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('scrape_enabled', true);

    if (error) {
      console.error(
        '[CRON] Failed to load tracked products:',
        error.message
      );
      return;
    }

    const now = Date.now();

    /*
     * Determine which products are actually due.
     *
     * A product is due when:
     *
     * 1. It has never been successfully scraped, OR
     * 2. Its configured interval has elapsed.
     *
     * Failed scrapes do not update last_scraped_at.
     */
    const dueProducts = [];
    const skippedProducts = [];

    for (const product of products || []) {
      const intervalMinutes =
        Number(product.scrape_interval_minutes) || 120;

      const intervalMs =
        intervalMinutes * 60 * 1000;

      /*
       * Never successfully scraped:
       * scrape immediately.
       */
      if (!product.last_scraped_at) {
        dueProducts.push(product);
        continue;
      }

      const lastScraped =
        new Date(
          product.last_scraped_at
        ).getTime();

      const dueAt =
        lastScraped + intervalMs;

      if (now >= dueAt) {
        dueProducts.push(product);
      } else {
        skippedProducts.push({
          productId: product.id,
          name: product.name,
          intervalMinutes,
          lastScrapedAt:
            product.last_scraped_at,
          dueAt:
            new Date(dueAt).toISOString()
        });
      }
    }

    console.log(
      `[CRON] Found ${products?.length || 0} enabled products. ` +
      `Due=${dueProducts.length} ` +
      `Skipped=${skippedProducts.length}.`
    );

    const results = [];

    /*
     * Process due products in concurrency batches.
     */
    for (
      let i = 0;
      i < dueProducts.length;
      i += config.concurrency
    ) {
      const batch = dueProducts.slice(
        i,
        i + config.concurrency
      );

      console.log(
        `[CRON] Processing due products ${i + 1}-${Math.min(
          i + batch.length,
          dueProducts.length
        )} of ${dueProducts.length}.`
      );

      const batchResults = await Promise.all(
        batch.map(runOne)
      );

      results.push(...batchResults);
    }

    const totalDue = results.length;

    const successful = results.filter(
      (r) => r.success
    ).length;

    const failed = results.filter(
      (r) => !r.success && !r.skipped
    ).length;

    const alreadyRunning = results.filter(
      (r) => r.skipped
    ).length;

    const structureChanges = results.filter(
      (r) =>
        r.success &&
        r.structure_changed
    ).length;

    console.log(
      `[CRON] Completed in ${
        Date.now() - started
      }ms. ` +
      `enabled=${products?.length || 0} ` +
      `due=${totalDue} ` +
      `skipped_not_due=${skippedProducts.length} ` +
      `successful=${successful} ` +
      `failed=${failed} ` +
      `already_running=${alreadyRunning} ` +
      `structure_changes=${structureChanges}`
    );
  } catch (error) {
    console.error(
      '[CRON] Unexpected error:',
      error
    );
  } finally {
    cronRunning = false;
  }
}

/*
 * Cron endpoint.
 *
 * Returns immediately with 202 so cron-job.org
 * does not wait for Playwright scraping.
 */
app.post(
  '/api/cron/scrape',
  authCron,
  (_req, res) => {
    res.status(202).json({
      accepted: true,
      message: 'Scrape job started.'
    });

    void runCronScrape();
  }
);

/*
 * Start server.
 */
app.listen(config.port, () => {
  console.log(
    `INE Price Tracker API listening on port ${config.port}`
  );

  refreshCatalog().catch((err) =>
    console.warn(
      '[Catalog] Pre-warm failed:',
      err.message
    )
  );
});