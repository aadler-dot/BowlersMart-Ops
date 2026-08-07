const { buildTakeaways } = require('./build-takeaways.js');

function firstName(fullName) {
  if (!fullName) return 'there';
    return fullName.trim().split(/\s+/)[0];
    }

    /**
     * @param {object} opts
      *   storeName, managerName, monthName, year, lastMonthName, revStats, compliance
       * @returns {{subject: string, text: string, html: string}}
        */
        function buildStoreEmail(opts) {
          const { storeName, managerName, monthName, year, lastMonthName, revStats, compliance } = opts;
            const takeaways = buildTakeaways(revStats, compliance);
              const greeting = firstName(managerName);

                const subject = `BowlersMart ${storeName.replace(/^BowlersMart\s+/i, '')} -- ${monthName} ${year} Performance Report`;

                  const text = `Hi ${greeting},

                  Attached is your store's performance report for ${storeName}, covering year-to-date ${year} and the full ${year - 1} comparison.

                  Key takeaways for ${storeName}:
                  ${takeaways.map(l => `- ${l}`).join('\n')}

                  The full report is attached, with weekly and quarterly breakdowns behind each of these numbers.

                  This report is generated automatically at the start of each month using data through the end of ${lastMonthName}. If anything looks off or you have questions about your numbers, reply to this email or reach out to Andrew directly.

                  Thanks for everything you do to keep ${storeName} running well.

                  -- BowlersMart Operations`;

                    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;max-width:640px;">
                    <p>Hi ${greeting},</p>
                    <p>Attached is your store's performance report for <strong>${storeName}</strong>, covering year-to-date ${year} and the full ${year - 1} comparison.</p>
                    <p><strong>Key takeaways for ${storeName}:</strong></p>
                    <ul style="padding-left:20px;">
                    ${takeaways.map(l => `<li style="margin-bottom:6px;">${escapeHtml(l)}</li>`).join('\n')}
                    </ul>
                    <p>The full report is attached, with weekly and quarterly breakdowns behind each of these numbers.</p>
                    <p>This report is generated automatically at the start of each month using data through the end of ${lastMonthName}. If anything looks off or you have questions about your numbers, reply to this email or reach out to Andrew directly.</p>
                    <p>Thanks for everything you do to keep ${storeName} running well.</p>
                    <p>-- BowlersMart Operations</p>
                    </div>`;

                      return { subject, text, html };
                      }

                      function escapeHtml(s) {
                        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
                        }

                        module.exports = { buildStoreEmail };
                        
