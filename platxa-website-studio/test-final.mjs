#!/usr/bin/env node
import puppeteer from 'puppeteer';

const URL = 'http://localhost:3000/studio/final-test?prompt=Create%20a%20hero%20section';

async function run() {
  console.log('🚀 Final Test - Checking file generation flow\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture ALL console messages
  page.on('console', msg => {
    const text = msg.text();
    // Log everything related to file processing
    if (text.includes('onFinish') ||
        text.includes('Processing') ||
        text.includes('openGeneratedFiles') ||
        text.includes('Parsed') ||
        text.includes('files') ||
        text.includes('useEffect')) {
      console.log(`📋 ${text}`);
    }
  });

  console.log('📡 Loading page...');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('✅ Page loaded\n');

  console.log('⏳ Waiting for generation (max 5 minutes)...\n');

  // Wait up to 5 minutes
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = (i + 1) * 5;

    const state = await page.evaluate(() => {
      const body = document.body.innerText;
      const fileCount = (body.match(/(\d+)\s*file/i) || [])[1];
      return {
        isGenerating: body.includes('Generating') || body.includes('processing') || body.includes('Finalizing'),
        hasFiles: body.includes('Previewing') && body.includes('generated file'),
        hasGeneratedMsg: body.includes('Generated') && body.includes('file'),
        fileCount: fileCount || 0,
        noFiles: body.includes('No files generated yet'),
      };
    });

    const status = state.isGenerating ? '🔄' : (state.hasFiles ? '✅' : '❓');
    console.log(`[${elapsed}s] ${status} gen:${state.isGenerating} files:${state.hasFiles} count:${state.fileCount} noFiles:${state.noFiles}`);

    // Success condition
    if (state.hasFiles || state.hasGeneratedMsg) {
      console.log('\n🎉 SUCCESS! Files generated and displayed!');
      await page.screenshot({ path: '/tmp/final-success.png', fullPage: true });
      console.log('📸 Screenshot: /tmp/final-success.png');
      await browser.close();
      return 0;
    }

    // Generation stopped without files
    if (!state.isGenerating && state.noFiles && elapsed > 30) {
      console.log('\n⚠️ Generation stopped but no files. Taking screenshot...');
      await page.screenshot({ path: '/tmp/final-stopped.png', fullPage: true });
      // Don't exit - keep checking in case files appear later
    }
  }

  console.log('\n⏱️ Timeout after 5 minutes');
  await page.screenshot({ path: '/tmp/final-timeout.png', fullPage: true });
  await browser.close();
  return 1;
}

run().then(code => process.exit(code));
