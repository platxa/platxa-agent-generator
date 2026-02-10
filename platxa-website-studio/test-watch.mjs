#!/usr/bin/env node
import puppeteer from 'puppeteer';

const URL = 'http://localhost:3000/studio/test-watch?prompt=Create%20a%20simple%20hero%20section';

async function run() {
  console.log('🚀 Starting browser test...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Log console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ChatPanel]') || text.includes('[EditorStore]') || text.includes('onFinish')) {
      console.log(`📋 ${text.substring(0, 150)}`);
    }
  });

  console.log('📡 Loading page...');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('✅ Page loaded\n');

  // Wait for generation WITHOUT refreshing
  console.log('⏳ Waiting for generation to complete (max 120s)...\n');

  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const state = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        isGenerating: body.includes('Generating') || body.includes('processing'),
        hasFiles: body.includes('Previewing') && body.includes('generated file'),
        hasGeneratedMsg: body.includes('Generated') && body.includes('file'),
        noFiles: body.includes('No files generated yet'),
        time: body.match(/(\d+)s/)?.[1] || '?'
      };
    });

    console.log(`[${(i+1)*5}s] generating:${state.isGenerating} files:${state.hasFiles} status:${state.hasGeneratedMsg} noFiles:${state.noFiles}`);

    if (state.hasFiles || state.hasGeneratedMsg) {
      console.log('\n✅ FILES GENERATED!');
      await page.screenshot({ path: '/tmp/test-success.png', fullPage: true });
      console.log('📸 Screenshot saved to /tmp/test-success.png');
      await browser.close();
      return 0;
    }

    if (!state.isGenerating && !state.hasFiles && state.noFiles) {
      console.log('\n⚠️  Generation stopped but no files');
      await page.screenshot({ path: '/tmp/test-nofiles.png', fullPage: true });
      console.log('📸 Screenshot saved to /tmp/test-nofiles.png');
    }
  }

  console.log('\n⏱️  Timeout reached');
  await page.screenshot({ path: '/tmp/test-timeout.png', fullPage: true });
  await browser.close();
  return 1;
}

run().then(code => process.exit(code));
