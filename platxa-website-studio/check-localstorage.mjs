import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();

await page.goto('http://localhost:3000/studio/test-ls', { waitUntil: 'networkidle2', timeout: 30000 });

// Wait a moment for hydration
await new Promise(r => setTimeout(r, 2000));

// Check localStorage
const storage = await page.evaluate(() => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.includes('platxa') || key.includes('editor') || key.includes('chat')) {
      const value = localStorage.getItem(key);
      data[key] = value ? value.substring(0, 500) : null;
    }
  }
  return data;
});

console.log('LocalStorage contents:\n');
for (const [key, value] of Object.entries(storage)) {
  console.log(`${key}:`);
  console.log(`  ${value}`);
  console.log('');
}

// Check Zustand store state
const storeState = await page.evaluate(() => {
  // Try to access the Zustand store
  const editorStorage = localStorage.getItem('platxa-editor-storage');
  if (editorStorage) {
    try {
      const parsed = JSON.parse(editorStorage);
      return {
        fileCount: Object.keys(parsed.state?.fileContents || {}).length,
        tabCount: parsed.state?.openTabs?.length || 0,
        files: Object.keys(parsed.state?.fileContents || {}).slice(0, 10),
      };
    } catch (e) {
      return { error: e.message };
    }
  }
  return { empty: true };
});

console.log('Editor Store State:');
console.log(JSON.stringify(storeState, null, 2));

await browser.close();
