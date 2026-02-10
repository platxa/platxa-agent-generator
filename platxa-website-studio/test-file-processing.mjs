#!/usr/bin/env node
/**
 * Test: File Processing Fix Verification
 *
 * Tests that the onFinish callback properly processes files
 * even for long-running AI generation sessions.
 */

import puppeteer from 'puppeteer';

const TEST_URL = 'http://localhost:3000/studio/test-file-fix?prompt=Create%20a%20simple%20hero%20section';
const TIMEOUT = 300000; // 5 minutes for Ollama

async function runTest() {
  console.log('🧪 Starting File Processing Test...\n');
  console.log('⏱️  This test may take 3-5 minutes with local Ollama\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Collect console messages for debugging
  const consoleLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text, time: new Date().toISOString() });

    // Show important logs in real-time
    if (text.includes('[ChatPanel]') || text.includes('[EditorStore]')) {
      const shortText = text.length > 120 ? text.substring(0, 120) + '...' : text;
      console.log(`  📋 ${shortText}`);
    }
  });

  try {
    console.log('📡 Navigating to test page...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for initial hydration
    console.log('⏳ Waiting for store hydration...');
    await page.waitForFunction(() => {
      return document.body.innerText.includes('AI Assistant');
    }, { timeout: 10000 });
    console.log('✅ Page loaded\n');

    // Monitor for file generation
    console.log('🤖 Waiting for AI generation (this may take 3-5 minutes)...\n');

    let lastCheck = Date.now();
    const startTime = Date.now();

    // Poll for results
    const result = await page.evaluate(async (timeout) => {
      return new Promise((resolve) => {
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);

          // Check for files in store
          const previewText = document.body.innerText;
          const hasFiles = previewText.includes('Previewing') && previewText.includes('generated file');
          const hasGeneratedStatus = previewText.includes('Generated') && previewText.includes('file');
          const isStreaming = previewText.includes('Generating');
          const hasError = previewText.includes('error') || previewText.includes('Error');

          // Log status to console for debugging
          if (elapsed % 30 === 0) {
            console.log(`[Test] ${elapsed}s - streaming: ${isStreaming}, hasFiles: ${hasFiles}, hasStatus: ${hasGeneratedStatus}`);
          }

          if (hasFiles || hasGeneratedStatus) {
            clearInterval(checkInterval);
            resolve({
              success: true,
              elapsed,
              hasFiles,
              hasGeneratedStatus,
              message: 'Files detected in UI'
            });
          }

          if (hasError && !isStreaming) {
            clearInterval(checkInterval);
            resolve({
              success: false,
              elapsed,
              message: 'Error detected'
            });
          }

          if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            resolve({
              success: false,
              elapsed,
              isStreaming,
              message: 'Timeout waiting for files'
            });
          }
        }, 5000);
      });
    }, TIMEOUT);

    // Get final state
    const finalState = await page.evaluate(() => {
      const previewText = document.body.innerText;
      return {
        hasPreviewingMessage: previewText.includes('Previewing') && previewText.includes('generated file'),
        hasGeneratedMessage: previewText.includes('Generated') && previewText.includes('file'),
        hasNoFilesMessage: previewText.includes('No files generated yet'),
        bodyTextSample: previewText.substring(0, 500),
      };
    });

    // Get relevant console logs
    const relevantLogs = consoleLogs.filter(l =>
      l.text.includes('onFinish') ||
      l.text.includes('openGeneratedFiles') ||
      l.text.includes('Parsed') ||
      l.text.includes('Processing')
    ).slice(-20);

    // Take screenshot
    const screenshotPath = '/tmp/file-processing-test.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Screenshot saved: ${screenshotPath}`);

    // Report results
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Time elapsed: ${result.elapsed}s`);
    console.log(`Result: ${result.message}`);
    console.log('');

    if (finalState.hasPreviewingMessage || finalState.hasGeneratedMessage) {
      console.log('✅ PASS: Files were generated and displayed in UI');
    } else if (finalState.hasNoFilesMessage) {
      console.log('❌ FAIL: "No files generated yet" is still showing');
    } else {
      console.log('⚠️  INCONCLUSIVE: Could not determine file state');
    }

    console.log('\n📋 Key Console Logs:');
    relevantLogs.forEach(l => {
      console.log(`  ${l.text.substring(0, 100)}`);
    });

    console.log('\n📝 Final UI State:');
    console.log(`  hasPreviewingMessage: ${finalState.hasPreviewingMessage}`);
    console.log(`  hasGeneratedMessage: ${finalState.hasGeneratedMessage}`);
    console.log(`  hasNoFilesMessage: ${finalState.hasNoFilesMessage}`);

    console.log('='.repeat(60));

    const passed = result.success || finalState.hasPreviewingMessage || finalState.hasGeneratedMessage;
    console.log(`\n${passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}\n`);

    return passed ? 0 : 1;

  } catch (error) {
    console.error('❌ Test error:', error.message);
    return 1;
  } finally {
    await browser.close();
  }
}

runTest().then(code => process.exit(code));
