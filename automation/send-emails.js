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

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'output');
const TEST_EMAIL_OVERRIDE = process.env.TEST_EMAIL_OVERRIDE || null;
const ONLY_STORE = process.env.ONLY_STORE || null;
const FROM_EMAIL = process.env.MAILERSEND_FROM_EMAIL || 'aadler@bowlersmart.com';
const FROM_NAME = process.env.MAILERSEND_FROM_NAME || 'BowlersMart Ops';

function normStore(n) {
return n.toLowerCase().replace(/bowlersmart |bowlers mart /g, '').replace(/[^a-z0-9]/g, '').trim();
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

const storeNames = ONLY_STORE ? [ONLY_STORE] : Object.keys(reportData.stores);
let sent = 0, skipped = 0;

for (const storeName of storeNames) {
const storeReport = reportData.stores[storeName];
if (!storeReport) { console.warn(`No report data for ${storeName}, skipping.`); skipped++; continue; }

const recipient = recipientByNorm[normStore(storeName)];
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
