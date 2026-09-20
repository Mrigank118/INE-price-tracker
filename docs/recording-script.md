# 2 to 4 minute recording script

1. Open the deployed dashboard.
2. Search a partial product name and show the returned storefront links.
3. Track one product and open its product page.
4. Show the initial price/stock observation and the scrape log.
5. Run the headed scraper locally with `DEMO_FAIL_ONCE=1` against the same mock-store product URL.
6. Keep the browser visible. Explain that the first navigation is intentionally failed by the demo harness, then the bounded retry opens the same mock-store page.
7. Show the successful extraction and the final result in the console.
8. Return to the dashboard and run a manual scrape if desired.
9. Briefly show the scrape log with success/retry/failure states.
