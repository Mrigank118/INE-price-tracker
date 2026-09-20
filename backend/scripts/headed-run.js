import process from 'node:process';
import { scrapeProduct } from '../src/scraper.js';

const url = process.argv[2];
if (!url) {
  console.error('Usage: npm run scrape:headed -- <product-url>');
  console.error('Example: npm run scrape:headed -- "https://demo.inelabteamdev.com/product/985"');
  process.exit(1);
}

console.log('====================================================');
console.log('INE Headed Scraper Demonstration');
console.log(`Target: ${url}`);
console.log('Browser: Chromium (headed / visible mode)');
if (process.env.DEMO_FAIL_ONCE === '1') console.log('Mode: DEMO_FAIL_ONCE=1 enabled (first attempt will simulate failure to demonstrate recovery)');
if (process.env.DEMO_DELAY_MS) console.log(`Mode: DEMO_DELAY_MS=${process.env.DEMO_DELAY_MS}ms artificial network delay enabled`);
console.log('====================================================\n');

try {
  const result = await scrapeProduct(url, {
    headless: false,
    failOnce: process.env.DEMO_FAIL_ONCE === '1',
    delayMs: Number(process.env.DEMO_DELAY_MS || 0),
    onProgress: ({ attempt, maxAttempts, stage, message }) => {
      console.log(message);
    }
  });

  console.log('\n----------------------------------------------------');
  console.log('Scrape Log Attempts:');
  for (const a of result.attempts) {
    console.log(`- Attempt ${a.attempt} [${a.status.toUpperCase()} via ${a.method}] (${a.durationMs}ms): ${a.message}`);
  }
  console.log('----------------------------------------------------');
  console.log('SUCCESS');
  console.log(JSON.stringify(result.data, null, 2));
  console.log('====================================================');
  process.exit(0);
} catch (error) {
  console.log('\n----------------------------------------------------');
  console.log('Scrape Log Attempts:');
  for (const a of error.attempts || []) {
    console.log(`- Attempt ${a.attempt} [${a.status.toUpperCase()} via ${a.method}] (${a.durationMs}ms): ${a.message}`);
  }
  console.log('----------------------------------------------------');
  console.error(`FAILED: ${error.message}`);
  console.log('====================================================');
  process.exit(1);
}
