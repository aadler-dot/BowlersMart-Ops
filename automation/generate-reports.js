// Generates one merged PDF (2026 YTD + 2025 full year) per store, plus a
// report-data.json with the computed key-takeaway stats for each store.
// Meant to run in CI (GitHub Actions) via Playwright against the live
// deployed dashboard, using whatever data is live at run time (the month-end
// "data lock" workflow is what makes that data trustworthy as a snapshot).

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const { computeRevenueStats, MONTH_NAMES } = require('./lib/compute-revenue-stats.js');

const SITE_URL = process.env.SITE_URL || 'https://aadler-dot.github.io/BowlersMart-Ops/';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'output');
const ONLY_STORE = process.env.ONLY_STORE || null; // for test runs: generate just one store

// PDF export options shared by both years -- no browser-injected header/footer
// (date/url/page-number chrome), no margins, so the output matches exactly
// what the site's own "Export PDF" button (window.print()) produces.
const PDF_OPTS = {
  format: 'Letter',
  printBackground: true,
  displayHeaderFooter: false,
  margin: { top: '0in', right: '0in', bottom: '0in', left: '0in' },
};

// Which month this report covers. Defaults to "the month that just ended"
// relative to today, i.e. running on Aug 1 covers July.
function defaultLastCompleteMonthIdx() {
  const now = new Date();
  const idx = now.getMonth() - 1; // 0-based; getMonth() is also 0-based (0=Jan)
  return idx < 0 ? 11 : idx;
}
const LAST_COMPLETE_MONTH_IDX = process.env.LAST_COMPLETE_MONTH_IDX !== undefined
  ? parseInt(process.env.LAST_COMPLETE_MONTH_IDX, 10)
  : defaultLastCompleteMonthIdx();
const REPORT_YEAR = process.env.REPORT_YEAR ? parseInt(process.env.REPORT_YEAR, 10) : new Date().getFullYear();

async function waitForDashboardData(page) {
  // Wait on the page's own completion flag. The previous condition checked that
  // these three globals were merely non-empty, which is true long before loading
  // finishes: cycleWeeks is filled synchronously from static config before any
  // fetch, and depositData becomes non-empty after the FIRST of 35 weekly tabs.
  // Reports could therefore be generated against partial deposit data, and after
  // the Ares cycle-count overlay was added, against pre-overlay cycle data.
  // `dataLoaded` is set only after every sheet AND the overlay have resolved.
  await page.waitForFunction(() => typeof dataLoaded !== 'undefined' && dataLoaded === true,
    { timeout: 120000 });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Fetching revenue/merged JSON from ${SITE_URL} ...`);
  const [rev26, rev25, merged25] = await Promise.all([
    fetch(new URL('revenue.json', SITE_URL)).then(r => r.json()),
    fetch(new URL('revenue_2025.json', SITE_URL)).then(r => r.json()),
    fetch(new URL('merged_2025.json', SITE_URL)).then(r => r.json()),
  ]);

  console.log('Launching headless browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(SITE_URL, { waitUntil: 'networkidle' });

  // Bypass the client-side access gate (cosmetic only; the app JS runs regardless)
  await page.evaluate(() => { document.getElementById('gate').style.display = 'none'; });

  console.log('Waiting for live sheet data to finish loading...');
  await waitForDashboardData(page);

  const storeNames = await page.evaluate(() => stores.map(s => s.name));
  const targetStores = ONLY_STORE ? storeNames.filter(n => n === ONLY_STORE) : storeNames;
  if (targetStores.length === 0) {
    // Exact-match filter: a typo or casing slip used to yield zero stores, write
    // an empty report-data.json over a good one, and still exit 0.
    console.error(`ONLY_STORE="${ONLY_STORE}" matched no store. Known names:\n  ` +
      storeNames.join('\n  '));
    await browser.close();
    process.exit(1);
  }
  console.log(`Generating reports for ${targetStores.length} store(s)...`);

  const reportData = {
    generatedAt: new Date().toISOString(),
    monthName: MONTH_NAMES[LAST_COMPLETE_MONTH_IDX],
    year: REPORT_YEAR,
    stores: {},
  };

  for (const storeName of targetStores) {
    console.log(`  - ${storeName}`);

    await page.evaluate((name) => { openStoreDetail(name); }, storeName);
    await page.waitForTimeout(1200); // let charts finish drawing

    const compliance = await page.evaluate((name) => {
      const cash = getCashCompliance(name);
      const cycle = getCycleCompliance(name);
      const deposit = getDepositCompliance(name);
      return {
        cash26: cash?.avgPct ?? null,
        cycle26: cycle?.pct ?? null,
        dep26: deposit?.pct ?? null,
      };
    }, storeName);

    const m25 = merged25[storeName] || {};
    compliance.cash25 = m25.cash?.year ?? null;
    compliance.cycle25 = m25.cycle?.yearAvg ?? null;
    compliance.dep25 = m25.deposit?.pct ?? null;

    const revStats = computeRevenueStats(storeName, rev26, rev25, merged25, LAST_COMPLETE_MONTH_IDX);

    await page.emulateMedia({ media: 'print' });
    const pdf2026 = await page.pdf(PDF_OPTS);

    await page.evaluate(() => { switchStoreYear(2025); });
    await page.waitForTimeout(1200);
    const pdf2025 = await page.pdf(PDF_OPTS);
    await page.emulateMedia({ media: 'screen' });

    const merged = await PDFDocument.create();
    for (const buf of [pdf2026, pdf2025]) {
      const src = await PDFDocument.load(buf);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    const mergedBytes = await merged.save();

    const slug = storeName.replace(/^BowlersMart\s+/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const pdfPath = path.join(OUTPUT_DIR, `${slug}.pdf`);
    fs.writeFileSync(pdfPath, mergedBytes);

    reportData.stores[storeName] = { compliance, revStats, pdfPath };
  }

  // A single-store run must merge into any existing snapshot, not replace it.
  // Overwriting wholesale is how locked/2026-08 ended up with two PDFs but only
  // one store in report-data.json: the second test run clobbered the first.
  const dataPath = path.join(OUTPUT_DIR, 'report-data.json');
  if (ONLY_STORE && fs.existsSync(dataPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      reportData.stores = { ...(existing.stores || {}), ...reportData.stores };
      console.log(`Merged into existing snapshot (${Object.keys(reportData.stores).length} store(s) total).`);
    } catch (e) {
      console.error(`Refusing to overwrite unreadable ${dataPath}: ${e.message}`);
      process.exit(1);
    }
  }
  fs.writeFileSync(dataPath, JSON.stringify(reportData, null, 2));
  await browser.close();
  console.log(`Done. Wrote ${targetStores.length} PDF(s) and report-data.json to ${OUTPUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
