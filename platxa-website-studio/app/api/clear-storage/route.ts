export async function GET() {
  // Returns HTML that clears localStorage and redirects
  const html = `<!DOCTYPE html>
<html>
<head><title>Clearing...</title></head>
<body>
<h1>Clearing storage...</h1>
<script>
localStorage.clear();
sessionStorage.clear();
document.body.innerHTML = '<h1>✅ Cleared! Redirecting...</h1>';
setTimeout(() => window.location.href = '/studio/demo', 1000);
</script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
