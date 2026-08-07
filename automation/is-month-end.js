// Exits 0 (success, "yes") if today is the last day of the month, else exits 1.
// Used as a cheap gate in the daily-scheduled month-end-lock workflow so the
// heavy Playwright job only actually runs once a month.
const now = new Date();
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const isMonthEnd = process.env.FORCE_RUN || now.getDate() === lastDay;
console.log(isMonthEnd ? `Today (${now.toDateString()}) is month-end.` : `Today (${now.toDateString()}) is not month-end.`);
process.exit(isMonthEnd ? 0 : 1);
