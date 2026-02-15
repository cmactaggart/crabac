import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { marked } from 'marked';

const PORT = parseInt(process.env.SITE_PORT || '3002', 10);
const ROOT = join(import.meta.dirname, '..');
const SCREENSHOTS = join(ROOT, 'docs', 'screenshots');

const MIME = {
  '.html': 'text/html',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Read and render README once at startup
const readme = readFileSync(join(ROOT, 'README.md'), 'utf-8');

// Rewrite image paths: docs/screenshots/foo.png → /images/foo.png
const rewritten = readme.replace(/docs\/screenshots\//g, '/images/');

const content = marked.parse(rewritten, { async: false });

// API doc path — read fresh on each request
const API_DOC_PATH = join(ROOT, 'docs', 'api.md');

function buildPage(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>crab.ac</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #1a1110;
    --bg-card: #231a19;
    --sidebar-bg: #161010;
    --text: #e8ddd0;
    --text-muted: #9a8a7a;
    --accent: #c0542e;
    --border: #3a2a25;
    --link: #e07050;
  }

  html, body {
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
  }

  .layout {
    display: flex;
    min-height: 100%;
  }

  /* ─── Sidebar ─── */
  .sidebar {
    width: 260px;
    flex-shrink: 0;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    padding: 2rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  .sidebar-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .sidebar-logo img {
    width: 80px;
    height: 80px;
  }

  .sidebar-logo h1 {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .sidebar-links {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .sidebar-links a {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
  }

  .sidebar-links a:hover {
    background: rgba(255,255,255,0.05);
    color: var(--text);
  }

  .sidebar-links svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .sidebar-footer {
    margin-top: auto;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }

  /* ─── Main Content ─── */
  .main {
    flex: 1;
    min-width: 0;
    max-width: 860px;
    margin: 0 auto;
    padding: 3rem 2.5rem 4rem;
  }

  /* Markdown styles */
  .main h1 { font-size: 2rem; font-weight: 800; margin: 2rem 0 1rem; }
  .main h2 { font-size: 1.4rem; font-weight: 700; margin: 2.5rem 0 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
  .main h3 { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }

  .main p { margin: 0.75rem 0; }

  .main a { color: var(--link); text-decoration: none; }
  .main a:hover { text-decoration: underline; }

  .main img {
    max-width: 100%;
    border-radius: 8px;
    margin: 1rem 0;
    border: 1px solid var(--border);
  }

  .main ul, .main ol {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .main li { margin: 0.25rem 0; }

  .main code {
    background: rgba(255,255,255,0.08);
    padding: 0.15em 0.35em;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  }

  .main pre {
    background: #0d0808;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .main pre code {
    background: none;
    padding: 0;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .main blockquote {
    border-left: 3px solid var(--accent);
    padding: 0.5rem 1rem;
    margin: 1rem 0;
    color: var(--text-muted);
  }

  .main table {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
  }

  .main th, .main td {
    border: 1px solid var(--border);
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  .main th {
    background: rgba(255,255,255,0.04);
    font-weight: 600;
  }

  .main hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2rem 0;
  }

  /* Hide the centered logo + links line from the raw README since we have the sidebar */
  .main > p:first-child { display: none; }
  .main > h1:first-of-type + p { display: none; }

  /* ─── Mobile ─── */
  @media (max-width: 768px) {
    .layout { flex-direction: column; }

    .sidebar {
      width: 100%;
      height: auto;
      position: static;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      padding: 1rem;
      gap: 0.75rem;
    }

    .sidebar-logo {
      flex-direction: row;
      gap: 0.5rem;
    }

    .sidebar-logo img { width: 36px; height: 36px; }
    .sidebar-logo h1 { font-size: 1.1rem; }

    .sidebar-links {
      flex-direction: row;
      gap: 0;
    }

    .sidebar-links a { padding: 0.4rem 0.6rem; font-size: 0.8rem; }

    .sidebar-footer { display: none; }

    .main {
      padding: 1.5rem 1rem 3rem;
    }
  }
</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div class="sidebar-logo">
      <img src="/images/crabac.png" alt="crab.ac">
      <h1>crab.ac</h1>
    </div>
    <div class="sidebar-links">
      <a href="https://github.com/cmactaggart/crabac" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        GitHub
      </a>
      <a href="https://app.crab.ac">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Open App
      </a>
      <a href="https://bsky.app/profile/crabac.bsky.social" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.59 3.513 6.182 3.268-4.533.86-6.15 3.726-3.455 6.58C6.752 23.743 10.514 20.2 12 16.89c1.486 3.31 5.248 6.853 8.649 3.205 2.695-2.854 1.078-5.72-3.455-6.58 2.593.245 5.397-.641 6.182-3.268.246-.828.624-5.79.624-6.479 0-.688-.139-1.86-.902-2.203-.659-.3-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>
        Bluesky
      </a>
      <a href="mailto:bingo@crab.ac">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        bingo@crab.ac
      </a>
      <a href="/api-doc">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        API Doc
      </a>
    </div>
    <div class="sidebar-footer">
      MIT License &copy; 2025-2026
    </div>
  </nav>
  <main class="main">
    ${body}
  </main>
</div>
</body>
</html>`;
}

const html = buildPage(content);

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Serve screenshots
  if (path.startsWith('/images/')) {
    const filename = path.slice('/images/'.length);
    // Sanitize: only allow simple filenames
    if (/^[a-zA-Z0-9._-]+$/.test(filename)) {
      const filePath = join(SCREENSHOTS, filename);
      if (existsSync(filePath)) {
        const ext = extname(filename).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        const data = readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(data);
        return;
      }
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Serve index
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Serve API docs (re-read from disk on each request so edits go live immediately)
  if (path === '/api-doc') {
    const apiDoc = readFileSync(API_DOC_PATH, 'utf-8');
    const apiHtml = buildPage(marked.parse(apiDoc, { async: false }));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(apiHtml);
    return;
  }

  // Favicon — serve crab icon
  if (path === '/favicon.ico' || path === '/favicon.png') {
    const faviconPath = join(SCREENSHOTS, 'crabac.png');
    if (existsSync(faviconPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(readFileSync(faviconPath));
      return;
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`crab.ac static site running on http://localhost:${PORT}`);
});
