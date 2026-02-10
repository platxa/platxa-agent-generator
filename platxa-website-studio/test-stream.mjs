// Test the streaming format directly
const response = await fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Say the word hello' }]
  })
});

console.log('Status:', response.status);
console.log('Headers:', Object.fromEntries(response.headers.entries()));
console.log('\n--- Stream Content ---\n');

const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullContent = '';
let chunkCount = 0;

const startTime = Date.now();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });
  fullContent += chunk;
  chunkCount++;

  // Show first 10 chunks and last chunk
  if (chunkCount <= 10 || done) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[${elapsed}s] Chunk ${chunkCount}: ${chunk.substring(0, 100).replace(/\n/g, '\\n')}`);
  }
}

console.log('\n--- Summary ---');
console.log('Total chunks:', chunkCount);
console.log('Total length:', fullContent.length);
console.log('Duration:', Math.round((Date.now() - startTime) / 1000), 's');
console.log('\n--- Last 500 chars ---');
console.log(fullContent.slice(-500));
