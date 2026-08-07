// Computes YTD-through-last-complete-month revenue comparisons (2026 vs 2025)
// and last-complete-month-only comparisons, per store. Pure data, no browser needed
// since revenue.json / revenue_2025.json / merged_2025.json are public static files.

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// A store counts as "opened during 2025" (and gets its YoY comparison suppressed)
// if its 2025 revenue through the same cutoff month is negligible, or it's missing
// from merged_2025.json entirely (which only has entries for stores open in 2025).
const NEW_IN_2025_THRESHOLD = 500;

/**
 * @param {number} lastCompleteMonthIdx 0-based index into MONTH_NAMES of the last
 *   fully-completed month (e.g. if today is Aug 1-31, that's 6 = July).
   */
function computeRevenueStats(storeName, revenue2026, revenue2025, merged2025, lastCompleteMonthIdx) {
    const r26 = revenue2026.stores[storeName] || {};
  const r25 = revenue2025.stores[storeName] || {};
  const monthsToSum = MONTH_NAMES.slice(0, lastCompleteMonthIdx + 1);

  let ytd26 = 0, ytd25 = 0;
  monthsToSum.forEach(m => { ytd26 += (r26[m] || 0); ytd25 += (r25[m] || 0); });

  const lastMonthName = MONTH_NAMES[lastCompleteMonthIdx];
  const lastMonth26 = r26[lastMonthName] || 0;
  const lastMonth25 = r25[lastMonthName] || 0;

  // Prefer the cleanest available signal: if the store has no Q1 cash/cycle
  // data in merged_2025.json, it wasn't open for the first half of 2025, which
  // makes any YoY revenue comparison misleading regardless of the dollar total.
  const m25 = merged2025[storeName];
  const missingQ1Data = !m25 || m25.cash?.q1 == null || m25.cycle?.Q1 == null;
  const openedDuring2025 = missingQ1Data || ytd25 < NEW_IN_2025_THRESHOLD;

  const pctChange = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

  return {
    lastMonthName,
    ytd26: Math.round(ytd26),
    ytd25: Math.round(ytd25),
    ytdChangePct: openedDuring2025 ? null : pctChange(ytd26, ytd25),
    lastMonth26: Math.round(lastMonth26),
    lastMonth25: Math.round(lastMonth25),
    lastMonthChangePct: openedDuring2025 ? null : pctChange(lastMonth26, lastMonth25),
    openedDuring2025,
};
}

module.exports = { computeRevenueStats, MONTH_NAMES, NEW_IN_2025_THRESHOLD };
