// Render an HTML string to a PDF Buffer using a Chromium browser (system Edge/Chrome via
// playwright-core, else a cached Playwright chromium). Throws if no browser is available —
// callers (invoice-render.js) catch that and fall back to the pdfkit generator, so the app
// never depends on a browser being present in production.
const path = require('path');
const fs = require('fs');

// Locate a usable Chromium executable for environments without a system browser channel.
const cachedChromium = () => {
  const root = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright');
  if (!root || !fs.existsSync(root)) return null;
  try {
    const dir = fs.readdirSync(root).find((d) => d.startsWith('chromium-'));
    if (!dir) return null;
    const exe = path.join(root, dir, 'chrome-win', 'chrome.exe');
    return fs.existsSync(exe) ? exe : null;
  } catch { return null; }
};

const launchBrowser = async () => {
  const { chromium } = require('playwright-core');
  // Prefer a system browser channel; fall back to a cached Playwright chromium binary.
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel }); } catch { /* try next */ }
  }
  const exe = cachedChromium();
  if (exe) return chromium.launch({ executablePath: exe });
  throw new Error('No Chromium browser available for HTML→PDF');
};

// Make root-relative asset URLs absolute so the print engine can resolve them.
const absolutizeUrls = (html, base) => (base
  ? String(html).replace(/(src|href)="\/(?!\/)/g, `$1="${base.replace(/\/$/, '')}/`)
  : html);

const htmlToPdf = async (html, { baseUrl } = {}) => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(absolutizeUrls(html, baseUrl), { waitUntil: 'load', timeout: 8000 }).catch(() => {});
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
};

module.exports = { htmlToPdf };
