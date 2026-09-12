// Sends the monthly performance email + PDF to each store, using the report
// data produced by generate-reports.js and the recipient list from the
// BowlersMart Store Locations Google Sheet.
//
// Required env vars:
//   MAILERSEND_API_KEY     a MailerSend API token
// Optional:
//   MAILERSEND_FROM_EMAIL  sender address (default aadler@bowlersmart.com)
//   MAILERSEND_FROM_NAME   sender display name (default "BowlersMart Ops")
//   TEST_EMAIL_OVERRIDE    if set, ALL emails go to this address instead of the
//                          real store addresses (subject gets a [TEST] prefix)
//   ONLY_STORE             if set, only send for this one store name

const fs = require('fs');
const path = require('path');
const { fetchStoreRecipients } = require('./lib/gviz-node.js');
const { STORE_LOCATIONS_SHEET } = require('./lib/sheets-config.js');
const { buildStoreEmail } = require('./lib/build-email.js');
const { MONTH_NAMES } = require('./lib/compute-revenue-stats.js');

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'output');
const TEST_EMAIL_OVERRIDE = process.env.TEST_EMAIL_OVERRIDE || null;
const ONLY_STORE = process.env.ONLY_STORE || null;
const FROM_EMAIL = process.env.MAILERSEND_FROM_EMAIL || 'aadler@bowlersmart.com';
const FROM_NAME = process.env.MAILERSEND_FROM_NAME || 'BowlersMart Ops';

function normStore(n) {
return n.toLowerCase().replace(/bowlersmart |bowlers mart /g, '').replace(/[^a-z0-9]/g, '').trim();
}

// Five stores are named differently on the dashboard than in the store-locations
// sheet, so normStore() alone never matches them. Before this map they fell
// through the `No recipient found` warning and were skipped silently -- five
// managers would have received nothing while the run still reported success.
//
// Keyed by normStore(dashboard name) -> normStore(recipient-sheet name). Each
// pairing is confirmed by the mailbox on the recipient row.
const RECIPIENT_ALIASES = {
  charlotte:            'charlottepark',      // charlotte@      Mike LeViner
  jacksonville:         'jacksonvilleiq',     // jacksonville@   Daniel Hall
  rockfordcherryvalley: 'rockfordcherry',     // cherryvalley@   Andrew Jensen
  tampauniversity:      'university',         // university@     Trevor Kopas
  rockfordcarters:      'rockford',           // rockford@       Will Schnack
};

function recipientFor(storeName, byNorm) {
  const n = normStore(storeName);
  return byNorm[n] || byNorm[RECIPIENT_ALIASES[n]] || null;
}

async function sendViaMailerSend({ to, toName, subject, text, html, attachmentPath, attachmentName }) {
const payload = {
from: { email: FROM_EMAIL, name: FROM_NAME },
to: [{ email: to, name: toName || undefined }],
subject,
text,
html,
};
if (attachmentPath) {
const content = fs.readFileSync(attachmentPath).toString('base64');
payload.attachments = [{ content, filename: attachmentName, disposition: 'attachment' }];
}

const res = await fetch('https://api.mailersend.com/v1/email', {
method: 'POST',
headers: {
'Authorization': `Bearer ${process.env.MAILERSEND_API_KEY}`,
'Content-Type': 'application/json',
},
body: JSON.stringify(payload),
});

if (!res.ok) {
const body = await res.text();
throw new Error(`MailerSend request failed (${res.status}): ${body}`);
}
}

async function main() {
if (!process.env.MAILERSEND_API_KEY) {
throw new Error('MAILERSEND_API_KEY must be set (as a GitHub Actions secret in production).');
}

const reportDataPath = path.join(OUTPUT_DIR, 'report-data.json');
if (!fs.existsSync(reportDataPath)) {
throw new Error(`report-data.json not found at ${reportDataPath} -- run generate-reports.js first.`);
}
const reportData = JSON.parse(fs.readFileSync(reportDataPath, 'utf8'));

console.log('Reading store recipient list...');
const recipients = await fetchStoreRecipients(STORE_LOCATIONS_SHEET);
const recipientByNorm = {};
recipients.forEach(r => { recipientByNorm[normStore(r.name)] = r; });

// ── PRE-FLIGHT GUARDS ────────────────────────────────────────────────────────
// On 1 Sep 2026 this script ran against a snapshot built on 10 Aug during a
// two-store test. The 31 Aug lock had failed, so report-data.json still held
// one store with ten days of August revenue in it. The send did exactly what it
// was told -- one real email to one real manager, "Sent 1, skipped 0" -- and
// exited 0. Nothing flagged that 50 stores got nothing and the one that did got
// figures off by a factor of seven.
//
// Both checks below are skipped for a deliberate single-store test run
// (ONLY_STORE), which is the one time a partial snapshot is expected.
if (!ONLY_STORE) {
  // 1. A snapshot describing a month cannot predate the end of that month.
  const monthIdx = MONTH_NAMES.findIndex(m => m === reportData.monthName);
  if (monthIdx >= 0 && reportData.year) {
    const monthEnd = new Date(Date.UTC(reportData.year, monthIdx + 1, 1));
    const generatedAt = new Date(reportData.generatedAt);
    if (isNaN(generatedAt.getTime()) || generatedAt < monthEnd) {
      throw new Error(
        `Refusing to send: report-data.json is dated ${reportData.generatedAt} but claims to ` +
        `cover ${reportData.monthName} ${reportData.year}, which had not ended yet. ` +
        `Re-run month-end-data-lock with report_month=${reportData.year}-` +
        String(monthIdx + 1).padStart(2, '0') + '.');
    }
  }

  // 2. A full send must cover every store the snapshot was meant to contain.
  //    expectedStores is what the dashboard listed when the lock ran; onlyStore
  //    records a deliberately filtered run. Recipient count is NOT usable here --
  //    the sheet carries HQ, the warehouse and several store-name variants, so it
  //    legitimately exceeds the store count.
  // `onlyStore` alone is not disqualifying: a single-store run merges into an
  // existing snapshot, so the result can still be complete. The count is what
  // decides.
  const snapshotCount = Object.keys(reportData.stores || {}).length;
  if (typeof reportData.expectedStores === 'number' && snapshotCount < reportData.expectedStores) {
    throw new Error(
      `Refusing to send: report-data.json has ${snapshotCount} store(s) but the lock ` +
      `expected ${reportData.expectedStores}. The run did not finish -- the missing stores ` +
      `would silently receive nothing. Re-run month-end-data-lock with only_store blank` +
      (reportData.onlyStore ? ` (this snapshot was last written by an only_store="${reportData.onlyStore}" run).` : '.'));
  }

  // A store in the snapshot with no recipient gets nothing and is only warned
  // about mid-loop. Surface the whole list up front instead.
  const noRecipient = Object.keys(reportData.stores || {})
    .filter(n => !recipientFor(n, recipientByNorm));
  if (noRecipient.length) {
    throw new Error(
      `Refusing to send: ${noRecipient.length} store(s) in the snapshot have no recipient in ` +
      `the store locations sheet, so they would be skipped silently:\n  ` +
      noRecipient.join('\n  '));
  }
}

const storeNames = ONLY_STORE ? [ONLY_STORE] : Object.keys(reportData.stores);
let sent = 0, skipped = 0;

for (const storeName of storeNames) {
const storeReport = reportData.stores[storeName];
if (!storeReport) { console.warn(`No report data for ${storeName}, skipping.`); skipped++; continue; }

const recipient = recipientFor(storeName, recipientByNorm);
if (!recipient) { console.warn(`No recipient found for ${storeName} in the store locations sheet, skipping.`); skipped++; continue; }

const email = buildStoreEmail({
storeName,
managerName: recipient.contact,
monthName: reportData.monthName,
year: reportData.year,
lastMonthName: reportData.monthName,
revStats: storeReport.revStats,
compliance: storeReport.compliance,
});

const toAddress = TEST_EMAIL_OVERRIDE || recipient.email;
const subject = TEST_EMAIL_OVERRIDE ? `[TEST -> ${recipient.email}] ${email.subject}` : email.subject;
const attachmentName = `${storeName.replace(/^BowlersMart\s+/i, '').replace(/[^a-z0-9]+/gi, '-')}-${reportData.monthName}-${reportData.year}-report.pdf`;

console.log(`Sending to ${toAddress} for ${storeName}...`);
await sendViaMailerSend({
to: toAddress,
toName: recipient.contact,
subject,
text: email.text,
html: email.html,
attachmentPath: storeReport.pdfPath,
attachmentName,
});
sent++;
}

console.log(`Done. Sent ${sent}, skipped ${skipped}.`);
}

main().catch(err => { console.error(err); process.exit(1); });
