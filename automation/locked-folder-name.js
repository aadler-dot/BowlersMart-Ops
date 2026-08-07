// Prints the folder name (e.g. "2026-07") for a given month, used by both the
// month-end-lock workflow (which runs ON the last day of the month it's
// snapshotting) and the monthly-send workflow (which runs on the 1st of the
// following month and needs to find that same snapshot) -- so the two never
// drift apart on naming.
//
// Usage: node locked-folder-name.js current   -> the month today falls in
//        node locked-folder-name.js previous  -> the month before today's
const mode = process.argv[2] || 'current';
const now = new Date();
let year = now.getFullYear();
let monthIdx = now.getMonth(); // 0-based
if (mode === 'previous') {
    monthIdx -= 1;
    if (monthIdx < 0) { monthIdx = 11; year -= 1; }
}
const monthNum = String(monthIdx + 1).padStart(2, '0');
console.log(`${year}-${monthNum}`);
