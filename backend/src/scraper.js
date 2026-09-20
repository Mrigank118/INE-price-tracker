import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { config } from './config.js';
import { searchCatalog } from './catalog.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function cleanText(value) {
  return String(value ?? '').replace(/[\u200B\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parsePrice(raw) {
  if (raw == null) return null;
  let text = cleanText(raw)
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\u0966-\u096F]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x0966 + 48))
    .replace(/[^0-9.,-]/g, '');
  if (!text) return null;

  const firstDot = text.indexOf('.');
  const lastDot = text.lastIndexOf('.');
  const firstComma = text.indexOf(',');
  const lastComma = text.lastIndexOf(',');

  if (firstDot !== -1 && firstComma !== -1) {
    if (firstDot < firstComma) {
      // e.g. 11.989,00 or 1.234.567,89 -> dot is thousands, comma is decimal
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. 11,989.00 or 1,234,567.89 -> comma is thousands, dot is decimal
      text = text.replace(/,/g, '');
    }
  } else if (firstComma !== -1) {
    const afterComma = text.slice(lastComma + 1);
    const commasCount = (text.match(/,/g) || []).length;
    if (commasCount > 1 || afterComma.length === 3) {
      // e.g. 14,794 or 1,234,567 -> thousands separator
      text = text.replace(/,/g, '');
    } else if (afterComma.length === 2 || afterComma.length === 1) {
      // e.g. 14,95 or 14,9 -> decimal separator
      text = text.replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (firstDot !== -1) {
    const dotsCount = (text.match(/\./g) || []).length;
    const afterDot = text.slice(lastDot + 1);
    if (dotsCount > 1 || (dotsCount === 1 && afterDot.length === 3 && text.length > 5)) {
      text = text.replace(/\./g, '');
    }
  }

  const value = Number(text);
  return Number.isFinite(value) && value > 0 && value < 1e9 ? Number(value.toFixed(2)) : null;
}

export function normaliseStock(value) {
  if (value == null) return null;
  const text = cleanText(value);
  const lower = text.toLowerCase();
  if (/out.?of.?stock|sold.?out|unavailable|not.?available|^0$/.test(lower)) {
    return 'out_of_stock';
  }
  // If text contains a stock count e.g. "In stock · 200 left" or "137 in stock"
  if (/in\s+stock|only\s+\d+\s+left|selling\s+fast|hurry|left/i.test(lower)) {
    return text.toUpperCase();
  }
  return text;
}

export function detectCurrency(text) {
  if (!text) return 'INR';
  if (text.includes('₹') || /INR/i.test(text)) return 'INR';
  if (text.includes('€') || /EUR/i.test(text)) return 'EUR';
  if (text.includes('$') || /USD/i.test(text)) return 'USD';
  if (text.includes('£') || /GBP/i.test(text)) return 'GBP';
  return 'INR';
}

export function isAllowedStoreUrl(url) {
  try {
    const target = new URL(url);
    const base = new URL(config.storeBaseUrl);
    return target.protocol === base.protocol && target.host === base.host;
  } catch {
    return false;
  }
}

export function assertValid(data) {
  if (!data) throw new Error('NO_DATA_EXTRACTED');
  if (!isAllowedStoreUrl(data.sourceUrl || data.url)) {
    throw new Error('INVALID_STORE_URL');
  }
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    throw new Error('INVALID_PRODUCT_NAME');
  }
  if (data.price == null || !Number.isFinite(data.price) || data.price <= 0) {
    throw new Error('INVALID_PRICE');
  }
  if (!data.stock || typeof data.stock !== 'string' || data.stock.trim().length === 0) {
    throw new Error('INVALID_STOCK');
  }
  return data;
}

export function extractFromHtml(html, url) {
  const $ = cheerio.load(html);
  const title = cleanText($('h1').first().text()) || cleanText($('title').first().text());

  let foundPrice = null;
  let foundCurrency = null;
  let foundStock = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      if (data['@type'] === 'Product') {
        if (data.offers?.price) foundPrice = parsePrice(data.offers.price);
        if (data.offers?.priceCurrency) foundCurrency = cleanText(data.offers.priceCurrency);
        if (data.offers?.availability) foundStock = normaliseStock(data.offers.availability);
      }
    } catch {}
  });

  return {
    sourceUrl: url,
    url,
    name: title || null,
    price: foundPrice,
    currency: foundCurrency,
    stock: foundStock,
    imageUrl: null
  };
}

async function tryHttpExtraction(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) INE-Price-Tracker/1.0',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const html = await res.text();
    const data = extractFromHtml(html, url);
    return assertValid(data);
  } finally {
    clearTimeout(timer);
  }
}

async function getTimeOffset() {
  try {
    const res = await fetch(`${config.storeBaseUrl}/api/challenge`, {
      headers: { 'User-Agent': 'Mozilla/5.0 INE-Price-Tracker/1.0' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json.ts) return json.ts - Date.now();
    }
  } catch {}
  return 0;
}

async function runBrowserScrapeAttempt(url, options = {}) {
  const headless = options.headless !== false;
  const slowMo = headless ? 0 : 75;
  const timeOffset = await getTimeOffset();

  const browser = await chromium.launch({
    headless,
    slowMo,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  // Time synchronization script to ensure challenge timestamps match server clock
  await context.addInitScript((offset) => {
    const origDateNow = Date.now;
    Date.now = function () {
      return origDateNow.call(Date) + offset;
    };
  }, timeOffset);

  const page = await context.newPage();
  let interceptedQuote = null;
  let serverHttpStatus = null;

  // Intercept responses for price payload and status codes
  page.on('response', async (res) => {
    if (res.url() === url) serverHttpStatus = res.status();
    if (res.url().includes('/api/products/') && res.url().includes('/price')) {
      if (res.status() === 503) {
        // upstream 503 error
      }
    }
  });

  try {
    if (options.delayMs) await sleep(options.delayMs);

    const navRes = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs || config.timeoutMs
    });
    serverHttpStatus = navRes?.status() || serverHttpStatus;

    // Immediately disable disruptive cookie overlays
    await page.addStyleTag({
      content: '.cookie-overlay { display: none !important; pointer-events: none !important; }'
    }).catch(() => {});
    await page.evaluate(() => { document.body.style.overflow = 'auto'; }).catch(() => {});

    // Wait for product details to load
    await page.waitForSelector('h1', { timeout: 8000 }).catch(() => {});
    const productName = cleanText(await page.locator('h1').first().innerText().catch(() => ''));

    // Locate price block
    const priceBlock = page.locator('.price-block');
    await priceBlock.waitFor({ timeout: 8000 });

    let initialText = cleanText(await priceBlock.innerText());

    // Check if price is in hidden state requiring interaction
    if (initialText.includes('Price hidden') || initialText.includes('Reveal price')) {
      options.onProgress?.({ stage: 'interaction', message: 'Price hidden; performing hover and dwell interaction...' });

      const box = await priceBlock.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 20, box.y + 20);
        for (let i = 0; i < 15; i++) {
          await sleep(50);
          await page.mouse.move(box.x + 25 + i * 15, box.y + 20 + (i % 2) * 10);
        }
        await sleep(700); // Exceed minDwellMs (600ms)
      }

      const revealBtn = page.locator('button:has-text("Reveal price")');
      await revealBtn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});

      if (await revealBtn.isVisible()) {
        options.onProgress?.({ stage: 'reveal', message: 'Clicking reveal price button...' });
        await revealBtn.click().catch(() => {});
      }
    }

    // Wait for price resolution or challenge outcome (up to 18 seconds within attempt)
    const deadline = Date.now() + 18000;
    let extractedData = null;

    while (Date.now() < deadline) {
      await sleep(700);
      const currentText = cleanText(await priceBlock.innerText());

      // If the page is actively loading or retrying internally, let it proceed
      if (currentText.includes('Retrying (attempt') || currentText.includes('Loading current price') || currentText.includes('Updating…')) {
        await sleep(1000);
        continue;
      }

      // Check for final failure condition or challenge error
      if (currentText.includes("Couldn't load the price") || currentText.includes('challenge_failed')) {
        const tryAgainBtn = page.locator('button:has-text("Try again")');
        if (await tryAgainBtn.isVisible().catch(() => false)) {
          options.onProgress?.({ stage: 'retry_action', message: 'Challenge failure detected; clicking try again...' });
          await tryAgainBtn.click().catch(() => {});
          await sleep(1500);
          continue;
        }
        throw new Error(`challenge_failed: ${currentText.replace(/\s+/g, ' ').slice(0, 80)}`);
      }

      // If still showing reveal button due to Xn dropped click, click again
      const revealBtn = page.locator('button:has-text("Reveal price")');
      if (await revealBtn.isVisible().catch(() => false) && !await revealBtn.isDisabled().catch(() => true)) {
        await revealBtn.click().catch(() => {});
        continue;
      }

      // Check if price loaded successfully
      const hasPriceSuccess = await page.locator('.price-success').count().then((c) => c > 0).catch(() => false);
      const looksLoaded = hasPriceSuccess || currentText.includes('ratings') || currentText.includes('in stock') || currentText.includes('out of stock') || currentText.includes('% off');

      if (looksLoaded) {
        // Extract real price and stock from DOM
    const domResult = await page.evaluate(() => {
  const priceBlock = document.querySelector('.price-block');
  const priceMain = document.querySelector('.price-main');

  if (!priceBlock) return null;

  // The live/current price is marked by data-price="true" on the
  // INE storefront. Prefer that exact element.
  const dataPrice = priceBlock.querySelector('[data-price="true"]');

  if (dataPrice) {
    const style = window.getComputedStyle(dataPrice);

    const visible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      dataPrice.getAttribute('aria-hidden') !== 'true';

    if (visible) {
      const text = (
        dataPrice.innerText ||
        dataPrice.textContent ||
        ''
      ).trim();

      if (text) {
        const stockBadge = document.querySelector('.stock-badge');

        return {
          rawPriceText: text,
          rawStockText: stockBadge
            ? (stockBadge.innerText || stockBadge.textContent || '').trim()
            : null,
          priceBlockText: priceBlock.innerText || ''
        };
      }
    }
  }

  // Fallback: look for a visible monetary value in the price block.
  const text = priceMain?.innerText || priceBlock.innerText || '';

  // Prefer values with an explicit currency symbol.
  const currencyMatch = text.match(
    /(?:₹|€|\$|£)\s*[\d,]+(?:\.\d{1,2})?/ 
  );

  if (currencyMatch) {
    const stockBadge = document.querySelector('.stock-badge');

    return {
      rawPriceText: currencyMatch[0],
      rawStockText: stockBadge
        ? (stockBadge.innerText || stockBadge.textContent || '').trim()
        : null,
      priceBlockText: text
    };
  }

  return null;
});

        if (domResult?.rawPriceText) {
          const parsed = parsePrice(domResult.rawPriceText);
         const currency = detectCurrency(
  `${domResult.rawPriceText || ''} ${domResult.priceBlockText || ''}`
);
          const stock = normaliseStock(domResult.rawStockText) || 'in_stock';

          if (parsed != null && parsed > 0) {
            extractedData = {
              sourceUrl: url,
              url,
              name: productName || 'INE Product',
              price: parsed,
              currency,
              stock,
              imageUrl: null
            };
            break;
          }
        }
      }
    }

    if (!extractedData) {
      throw new Error('PRICE_NOT_FOUND_AFTER_INTERACTION');
    }

    return {
      data: assertValid(extractedData),
      httpStatus: serverHttpStatus || 200,
      method: 'playwright'
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

export async function scrapeProduct(url, options = {}) {
  if (!isAllowedStoreUrl(url)) {
    throw new Error('STORE_URL_NOT_ALLOWED');
  }

  const started = Date.now();
  const attempts = [];
  let lastError = null;
  const maxAttempts = options.maxAttempts || config.maxAttempts || 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStarted = Date.now();
    options.onProgress?.({
      attempt,
      maxAttempts,
      stage: 'starting',
      message: `[${attempt}/${maxAttempts}] Navigating to ${url}...`
    });

    try {
      if (options.failOnce && attempt === 1) {
        throw new Error('DEMO_FAIL_SIMULATED: First navigation failed by demonstration harness');
      }

      // 1. First attempt fast lightweight HTTP parse (if structured data exists)
      let result;
      try {
        const httpData = await tryHttpExtraction(url);
        result = { data: httpData, httpStatus: 200, method: 'http' };
        attempts.push({
          attempt,
          method: 'http',
          status: 'success',
          message: 'HTTP extraction succeeded.',
          httpStatus: 200,
          durationMs: Date.now() - attemptStarted
        });
      } catch {
        // Fall back to Playwright browser interaction
        result = await runBrowserScrapeAttempt(url, { ...options, attempt });
        attempts.push({
          attempt,
          method: 'playwright',
          status: 'success',
          message: `Browser extraction succeeded (${result.data.currency} ${result.data.price}, ${result.data.stock}).`,
          httpStatus: result.httpStatus,
          durationMs: Date.now() - attemptStarted
        });
      }

      options.onProgress?.({
        attempt,
        maxAttempts,
        stage: 'success',
        message: `[${attempt}/${maxAttempts}] Price found: ${result.data.currency} ${result.data.price} (${result.data.stock})`
      });

      return {
        ...result,
        attempt,
        attempts,
        durationMs: Date.now() - started
      };
    } catch (err) {
      lastError = err;
      const isLast = attempt === maxAttempts;
      const status = isLast ? 'failed' : 'retried';
      const errMsg = err.message || 'Scrape attempt failed';

      attempts.push({
        attempt,
        method: 'playwright',
        status,
        message: errMsg,
        httpStatus: null,
        durationMs: Date.now() - attemptStarted
      });

      options.onProgress?.({
        attempt,
        maxAttempts,
        stage: status,
        message: `[${attempt}/${maxAttempts}] ${errMsg}${isLast ? ' (Final attempt failed)' : ' (Retrying...)'}`
      });

      if (!isLast) {
        const backoffMs = Math.min(6000, 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250));
        await sleep(backoffMs);
      }
    }
  }

  const finalError = new Error(lastError?.message || 'SCRAPE_FAILED');
  finalError.attempts = attempts;
  finalError.durationMs = Date.now() - started;
  throw finalError;
}

export async function discoverProducts(query) {
  return await searchCatalog(query, 25);
}
