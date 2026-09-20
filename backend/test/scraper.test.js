import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanText,
  parsePrice,
  normaliseStock,
  detectCurrency,
  isAllowedStoreUrl,
  assertValid,
  extractFromHtml
} from '../src/scraper.js';

test('parsePrice: handles diverse currency formats correctly', () => {
  // Indian currency with comma thousands separator
  assert.equal(parsePrice('₹14,794'), 14794);
  assert.equal(parsePrice('₹59,452'), 59452);
  assert.equal(parsePrice('₹9,922'), 9922);

  // European dot thousands and comma decimals
  assert.equal(parsePrice('11.989,00 €'), 11989);
  assert.equal(parsePrice('14,95 €'), 14.95);
  assert.equal(parsePrice('1.234.567,89'), 1234567.89);

  // Standard US / International format
  assert.equal(parsePrice('$1,234.50'), 1234.5);
  assert.equal(parsePrice('49.99 EUR'), 49.99);

  // Full-width unicode digits
  assert.equal(parsePrice('￥１２３４'), 1234);

  // Rejects invalid strings, decoys, zero, and hidden states
  assert.equal(parsePrice('Price hidden'), null);
  assert.equal(parsePrice('challenge_failed'), null);
  assert.equal(parsePrice('0'), null);
  assert.equal(parsePrice(null), null);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('   '), null);
});

test('normaliseStock: preserves stock counts and normalizes out-of-stock', () => {
  assert.equal(normaliseStock('In stock · 200 left'), 'IN STOCK · 200 LEFT');
  assert.equal(normaliseStock('137 IN STOCK'), '137 IN STOCK');
  assert.equal(normaliseStock('Out of stock'), 'out_of_stock');
  assert.equal(normaliseStock('0'), 'out_of_stock');
  assert.equal(normaliseStock('Sold out'), 'out_of_stock');
  assert.equal(normaliseStock('Currently unavailable'), 'out_of_stock');
  assert.equal(normaliseStock(null), null);
});

test('detectCurrency: correctly identifies currency symbols', () => {
  assert.equal(detectCurrency('₹14,794'), 'INR');
  assert.equal(detectCurrency('14.95 EUR'), 'EUR');
  assert.equal(detectCurrency('€49.99'), 'EUR');
  assert.equal(detectCurrency('$99.00'), 'USD');
  assert.equal(detectCurrency('£25.00'), 'GBP');
  assert.equal(detectCurrency(''), 'INR');
});

test('isAllowedStoreUrl: strictly allows only the INE mock store domain', () => {
  assert.equal(isAllowedStoreUrl('https://demo.inelabteamdev.com/product/985'), true);
  assert.equal(isAllowedStoreUrl('https://demo.inelabteamdev.com/product/505'), true);
  assert.equal(isAllowedStoreUrl('https://demo.inelabteamdev.com/'), true);

  // Disallows 3rd party stores or invalid URLs
  assert.equal(isAllowedStoreUrl('https://amazon.com/dp/B08N5WRWNW'), false);
  assert.equal(isAllowedStoreUrl('https://demo.inelabteamdev.com.attacker.com/product/985'), false);
  assert.equal(isAllowedStoreUrl('https://evil-site.com'), false);
  assert.equal(isAllowedStoreUrl('not-a-url'), false);
  assert.equal(isAllowedStoreUrl(''), false);
});

test('assertValid: validates complete data and rejects corrupted / partial extraction', () => {
  const valid = {
    sourceUrl: 'https://demo.inelabteamdev.com/product/985',
    name: 'Ironwood Monitor Neo',
    price: 14794,
    stock: 'IN STOCK · 200 LEFT',
    currency: 'INR'
  };
  assert.deepEqual(assertValid(valid), valid);

  // Missing or empty name
  assert.throws(() => assertValid({ ...valid, name: '' }), /INVALID_PRODUCT_NAME/);
  assert.throws(() => assertValid({ ...valid, name: ' ' }), /INVALID_PRODUCT_NAME/);

  // Invalid, zero, or negative price
  assert.throws(() => assertValid({ ...valid, price: null }), /INVALID_PRICE/);
  assert.throws(() => assertValid({ ...valid, price: 0 }), /INVALID_PRICE/);
  assert.throws(() => assertValid({ ...valid, price: -10 }), /INVALID_PRICE/);
  assert.throws(() => assertValid({ ...valid, price: NaN }), /INVALID_PRICE/);

  // Missing or empty stock
  assert.throws(() => assertValid({ ...valid, stock: '' }), /INVALID_STOCK/);
  assert.throws(() => assertValid({ ...valid, stock: null }), /INVALID_STOCK/);

  // Invalid store URL
  assert.throws(() => assertValid({ ...valid, sourceUrl: 'https://amazon.com/item' }), /INVALID_STORE_URL/);
});

test('extractFromHtml: parses structured JSON-LD correctly if present', () => {
  const html = `<!doctype html><html><head>
    <script type="application/ld+json">{"@type":"Product","name":"Demo Headphone","offers":{"price":"129.90","priceCurrency":"EUR","availability":"InStock"}}</script>
  </head><body><h1>Demo Headphone</h1></body></html>`;
  const data = extractFromHtml(html, 'https://demo.inelabteamdev.com/product/demo');
  assert.equal(data.name, 'Demo Headphone');
  assert.equal(data.price, 129.9);
  assert.equal(data.currency, 'EUR');
  assert.equal(data.stock, 'InStock');
});
