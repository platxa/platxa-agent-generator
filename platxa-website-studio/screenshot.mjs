import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('http://localhost:3000/studio/test-live?prompt=Design%20a%20professional%20law%20firm%20website%20with%20testimonials', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.screenshot({ path: '/tmp/studio-preview.png', fullPage: true });
console.log('Screenshot saved to /tmp/studio-preview.png');
await browser.close();
