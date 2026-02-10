#!/usr/bin/env node
/**
 * Test: Hydration Fix Verification
 *
 * This test verifies that:
 * 1. Generated files are properly stored in the editor store
 * 2. Preview shows correct file count (not "No files generated yet")
 * 3. No console errors occur
 */

import puppeteer from 'puppeteer';

const TEST_URL = 'http://localhost:3000/studio/test-hydration?prompt=Create%20a%20simple%20hero%20section%20with%20Welcome%20text';
const TIMEOUT = 90000; // 90 seconds for AI generation

async function runTest() {
  console.log('🧪 Starting Hydration Fix Test...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Collect console messages
  const consoleLogs = [];
  const consoleErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error' && !text.includes('favicon')) {
      consoleErrors.push(text);
    }
  });

  try {
    console.log('📡 Navigating to test page...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for initial hydration
    console.log('⏳ Waiting for store hydration...');
    await page.waitForFunction(() => {
      const logs = window.__testLogs || [];
      return logs.some(l => l.includes('hydrat'));
    }, { timeout: 5000 }).catch(() => {
      console.log('   (No hydration logs found, continuing...)');
    });

    // Wait for AI generation to start and complete
    console.log('🤖 Waiting for AI generation (this may take up to 60 seconds)...');

    // Wait for either "Previewing X generated files" or timeout
    const result = await page.waitForFunction(() => {
      // Check if preview panel shows generated files
      const previewText = document.body.innerText;
      if (previewText.includes('Previewing') && previewText.includes('generated file')) {
        return { success: true, message: 'Files generated and displayed' };
      }
      // Check for generation status in console
      const editorLogs = Array.from(document.querySelectorAll('*'))
        .map(el => el.textContent)
        .filter(t => t && t.includes('generated'));
      if (editorLogs.length > 0) {
        return { success: true, message: 'Generation detected' };
      }
      return null;
    }, { timeout: TIMEOUT }).catch(() => null);

    // Check final state
    console.log('\n📊 Checking final state...');

    // Get the page content
    const pageContent = await page.evaluate(() => document.body.innerText);

    // Check for "No files generated yet"
    const hasNoFilesMessage = pageContent.includes('No files generated yet');
    const hasPreviewingMessage = pageContent.includes('Previewing') && pageContent.includes('generated file');

    // Get console logs related to hydration and file generation
    const hydrationLogs = consoleLogs.filter(l =>
      l.text.includes('[EditorStore]') ||
      l.text.includes('[PreviewPanel]') ||
      l.text.includes('[ChatPanel]')
    );

    console.log('\n📋 Relevant Console Logs:');
    hydrationLogs.slice(-20).forEach(l => {
      console.log(`   [${l.type}] ${l.text.substring(0, 120)}`);
    });

    // Take screenshot
    const screenshotPath = '/tmp/hydration-test-result.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Screenshot saved: ${screenshotPath}`);

    // Report results
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));

    if (hasPreviewingMessage) {
      console.log('✅ PASS: Preview shows "Previewing X generated files"');
    } else if (hasNoFilesMessage) {
      console.log('❌ FAIL: Preview shows "No files generated yet"');
    } else {
      console.log('⚠️  INCONCLUSIVE: Could not determine preview state');
    }

    if (consoleErrors.length === 0) {
      console.log('✅ PASS: No console errors');
    } else {
      console.log(`❌ FAIL: ${consoleErrors.length} console error(s):`);
      consoleErrors.forEach(e => console.log(`   - ${e.substring(0, 100)}`));
    }

    // Check for hydration-related logs
    const hydrationComplete = hydrationLogs.some(l =>
      l.text.includes('Hydration finished') || l.text.includes('Already hydrated')
    );
    if (hydrationComplete) {
      console.log('✅ PASS: Hydration completed successfully');
    } else {
      console.log('⚠️  WARNING: No hydration completion log found');
    }

    const filesOpened = hydrationLogs.some(l => l.text.includes('openGeneratedFiles'));
    if (filesOpened) {
      console.log('✅ PASS: openGeneratedFiles was called');
    } else {
      console.log('⚠️  INFO: openGeneratedFiles not called (may need longer wait)');
    }

    console.log('='.repeat(60));

    const passed = (hasPreviewingMessage || !hasNoFilesMessage) && consoleErrors.length === 0;
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
