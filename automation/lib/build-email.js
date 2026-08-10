// BowlersMart brand colors, used to color-code the report email and its
// logo header. Blue for positive trends, red for negative -- matches the
// logo's own color scheme.
const BRAND_BLUE = '#1202F7';
const BRAND_RED = '#CE1604';
const BODY_TEXT = '#222';

const { buildTakeaways } = require('./build-takeaways.js');

function firstName(fullName) {
if (!fullName) return 'there';
return fullName.trim().split(/\s+/)[0];
}

function trendColor(trend) {
if (trend === 'positive') return BRAND_BLUE;
if (trend === 'negative') return BRAND_RED;
return BODY_TEXT;
}

/**
* @param {object} opts
* storeName, managerName, monthName, year, lastMonthName, revStats, compliance
* @returns {{subject: string, text: string, html: string}}
*/
function buildStoreEmail(opts) {
const { storeName, managerName, monthName, year, lastMonthName, revStats, compliance } = opts;
const takeaways = buildTakeaways(revStats, compliance);
const greeting = firstName(managerName);

const subject = `BowlersMart ${storeName.replace(/^BowlersMart\s+/i, '')} -- ${monthName} ${year} Performance Report`;

const textLines = takeaways.map(function (t) { return '- ' + t.text; }).join('\n');
const text = `Hi ${greeting},

Attached is your store's performance report for ${storeName}, covering year-to-date ${year} and the full ${year - 1} comparison.

Key takeaways for ${storeName}:
${textLines}

The full report is attached, with weekly and quarterly breakdowns behind each of these numbers.

This report is generated automatically at the start of each month using data through the end of ${lastMonthName}. If anything looks off or you have questions about your numbers, reply to this email or reach out to Andrew directly.

Thanks for everything you do to keep ${storeName} running well.

-- BowlersMart Operations`;

const htmlLines = takeaways.map(function (t) {
return '<li style="margin-bottom:6px;color:' + trendColor(t.trend) + ';">' + escapeHtml(t.text) + '</li>';
}).join('\n');

const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:${BODY_TEXT};line-height:1.5;max-width:640px;">
<div style="padding:24px;">
<p>Hi ${greeting},</p>
<p>Attached is your store's performance report for <strong>${storeName}</strong>, covering year-to-date ${year} and the full ${year - 1} comparison.</p>
<p><strong>Key takeaways for ${storeName}:</strong></p>
<ul style="padding-left:20px;">
${htmlLines}
</ul>
<p>The full report is attached, with weekly and quarterly breakdowns behind each of these numbers.</p>
<p>This report is generated automatically at the start of each month using data through the end of ${lastMonthName}. If anything looks off or you have questions about your numbers, reply to this email or reach out to Andrew directly.</p>
<p>Thanks for everything you do to keep ${storeName} running well.</p>
<p>-- BowlersMart Operations</p>
</div>
</div>`;

return { subject, text, html };
}

function escapeHtml(s) {
return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { buildStoreEmail };
