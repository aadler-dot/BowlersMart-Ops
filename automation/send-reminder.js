// Sends Andrew a reminder 3 days before month-end to review/update the
// store locations recipient sheet before the monthly reports go out.

const nodemailer = require('nodemailer');

const REMINDER_TO = process.env.REMINDER_TO || 'aadler@bowlersmart.com';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1EEvOeTxqXnp4ImZk3bldTqbVES3rLYrQZx7wvBCXTDU/edit';

function isThreeDaysBeforeMonthEnd(date) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === lastDay - 3;
    }

    async function main() {
      const now = new Date();
        if (!process.env.FORCE_SEND && !isThreeDaysBeforeMonthEnd(now)) {
            console.log(`Today (${now.toDateString()}) is not 3 days before month-end -- nothing to do.`);
                return;
                  }

                    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
                        throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set.');
                          }

                            const monthName = now.toLocaleString('en-US', { month: 'long' });

                              const transporter = nodemailer.createTransport({
                                  service: 'gmail',
                                      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
                                        });

                                          const text = `Heads up -- ${monthName} closes out in 3 days, and the monthly store performance reports go out on the 1st.

                                          If any store emails or managers have changed, update the store locations sheet before then:
                                          ${SHEET_URL}

                                          No action needed if nothing's changed.

                                          -- BowlersMart Ops automation`;

                                            await transporter.sendMail({
                                                from: process.env.GMAIL_USER,
                                                    to: REMINDER_TO,
                                                        subject: `Reminder: review store contact list before ${monthName} closes`,
                                                            text,
                                                              });

                                                                console.log(`Reminder sent to ${REMINDER_TO}`);
                                                                }

                                                                main().catch(err => { console.error(err); process.exit(1); });
                                                                
