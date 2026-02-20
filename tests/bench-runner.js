import puppeteer from 'npm:puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  executablePath: '/usr/bin/google-chrome'
});
const page = await browser.newPage();
page.on('console', msg => console.log('[B]', msg.text()));
page.on('pageerror', err => console.error('[ERR]', err.message));
await page.goto('http://localhost:8080/tests/run-benchmark.html');
await new Promise(r => setTimeout(r, 3000));
const text = await page.evaluate(() => document.getElementById('output')?.textContent ?? 'NO OUTPUT');
console.log('\n=== RESULTS ===\n' + text);
await browser.close();
