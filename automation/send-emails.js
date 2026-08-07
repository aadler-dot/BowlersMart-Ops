// Sends the monthly performance email + PDF to each store, using the report
// data produced by generate-reports.js and the recipient list from the
// BowlersMart Store Locations Google Sheet.
//
// Required env vars:
//   GMAIL_USER            the Gmail address sending the emails
//   GMAIL_APP_PASSWORD    a Gmail App Password for that account
// Optional:
//   TEST_EMAIL_OVERRIDE   if set, ALL emails go to this address instead of the
//                         real store addresses (subject gets a [TEST] prefix)
//   ONLY_STORE            if set, only send for this one store name

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { fetchStoreRecipients } = require('./lib/gviz-node.js');
const { STORE_LOCATIONS_SHEET } = require('./lib/sheets-config.js');
const { buildStoreEmail } = require('./lib/build-email.js');

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'output');
const TEST_EMAIL_OVERRIDE = process.env.TEST_EMAIL_OVERRIDE || null;
const ONLY_STORE = process.env.ONLY_STORE || null;

function normStore(n) {
  return n.toLowerCase().replace(/bowlersmart |bowlers mart /g, '').replace(/[^a-z0-9]/g, '').trim();
  }

  async function main() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set (as GitHub Actions secrets in production).');
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

                                const transporter = nodemailer.createTransport({
                                    service: 'gmail',
                                        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
                                          });

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
                                                                                                                          
                                                                                                                              console.log(`Sending to ${toAddress} for ${storeName}...`);
                                                                                                                                  await transporter.sendMail({
                                                                                                                                        from: process.env.GMAIL_USER,
                                                                                                                                              to: toAddress,
                                                                                                                                                    subject,
                                                                                                                                                          text: email.text,
                                                                                                                                                                html: email.html,
                                                                                                                                                                      attachments: [{
                                                                                                                                                                              filename: `${storeName.replace(/^BowlersMart\s+/i, '').replace(/[^a-z0-9]+/gi, '-')}-${reportData.monthName}-${reportData.year}-report.pdf`,
                                                                                                                                                                                      path: storeReport.pdfPath,
                                                                                                                                                                                            }],
                                                                                                                                                                                                });
                                                                                                                                                                                                    sent++;
                                                                                                                                                                                                      }
                                                                                                                                                                                                      
                                                                                                                                                                                                        console.log(`Done. Sent ${sent}, skipped ${skipped}.`);
                                                                                                                                                                                                        }
                                                                                                                                                                                                        
                                                                                                                                                                                                        main().catch(err => { console.error(err); process.exit(1); });
                                                                                                                                                                                                        
