#!/usr/bin/env node
import puppeteer from 'puppeteer';

const URL = 'http://localhost:3000/studio/test-3min?prompt=Create%20a%20simple%20hero';

async function run() {
  console.log('🚀 3-Minute Test\n');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('onFinish') || text.includes('Processing') || text.includes('openGeneratedFiles') || text.includes('Parsed')) {
      console.log(`📋 ${text.substring(0, 200)}`);
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('✅ Page loaded, waiting for generation (max 3 min)...\n');

  for (let i = 0; i < 36; i++) {  // 36 * 5s = 180s = 3 minutes
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = (i + 1) * 5;

    const state = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        gen: body.includes('Generating') || body.includes('processing') || body.includes('Finalizing'),
        files: body.includes('Previewing') && body.includes('generated file'),
        status: body.includes('Generated') && body.includes('file'),
        noFiles: body.includes('No files generated yet'),
      };
    });

    console.log(`[${elapsed}s] gen:${state.gen} files:${state.files} status:${state.status}`);

    if (state.files || state.status) {
      console.log('\n🎉 SUCCESS! Files generated!');
      await page.screenshot({ path: '/tmp/success-3min.png', fullPage: true });
      await browser.close();
      return 0;
    }

    if (!state.gen && elapsed > 60) {
      console.log('\n⚠️ Generation stopped');
      await page.screenshot({ path: '/tmp/stopped-3min.png', fullPage: true });
    }
  }

  console.log('\n⏱️ Timeout');
  await page.screenshot({ path: '/tmp/timeout-3min.png', fullPage: true });
  await browser.close();
  return 1;
}

run().then(code => process.exit(code));
