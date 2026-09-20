// import 'dotenv/config';
import { scrapeProduct } from '../src/scraper.js';

const url = process.argv[2];

if (!url) {
  console.error(
    'Usage: npm run scrape:headed -- <product-url>'
  );
  process.exit(1);
}

console.log('====================================================');
console.log('INE Headed Scraper Demonstration');
console.log(`Target: ${url}`);
console.log('Browser: Chromium (headed / visible mode)');
console.log('====================================================');
console.log();

try {
  const result = await scrapeProduct(url, {
    headless: false,
    maxAttempts: 3,
    onProgress: ({ attempt, maxAttempts, message }) => {
      console.log(
        `[${attempt}/${maxAttempts}] ${message}`
      );
    }
  });

  console.log();
  console.log('----------------------------------------------------');
  console.log('SUCCESS');
  console.log('----------------------------------------------------');

  console.log(`Product:  ${result.data.name}`);
  console.log(
    `Price:    ${result.data.currency} ${result.data.price}`
  );
  console.log(`Stock:    ${result.data.stock}`);
  console.log(`Method:   ${result.method}`);
  console.log(`Attempts: ${result.attempt}`);
  console.log(`Duration: ${result.durationMs}ms`);

  console.log();
  console.log('Scrape Log Attempts:');

  for (const attempt of result.attempts || []) {
    console.log(
      `- Attempt ${attempt.attempt} [${attempt.status.toUpperCase()} via ${attempt.method}] (${attempt.durationMs}ms): ${attempt.message}`
    );
  }

  console.log('----------------------------------------------------');
  console.log('====================================================');
} catch (error) {
  console.log();
  console.log('----------------------------------------------------');
  console.log('Scrape Log Attempts:');

  for (const attempt of error.attempts || []) {
    console.log(
      `- Attempt ${attempt.attempt} [${attempt.status.toUpperCase()} via ${attempt.method}] (${attempt.durationMs}ms): ${attempt.message}`
    );
  }

  console.log('----------------------------------------------------');
  console.error(`FAILED: ${error.message}`);
  console.log('====================================================');

  process.exit(1);
}