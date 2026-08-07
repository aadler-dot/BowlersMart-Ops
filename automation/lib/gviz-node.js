// Minimal server-side gviz reader (Node 18+ has global fetch).
// Used for sheets that don't need any of the dashboard's browser-side
// rendering logic -- currently just the store locations recipient list.

async function fetchGvizTable(sheetId, gid) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}`;
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
    if (!match) throw new Error(`Could not parse gviz response for sheet ${sheetId} gid ${gid}`);
    const json = JSON.parse(match[1]);
    if (json.status === 'error') {
          const msg = json.errors?.[0]?.detailed_message || json.errors?.[0]?.message || 'unknown gviz error';
          throw new Error(`gviz error for sheet ${sheetId} gid ${gid}: ${msg}`);
    }
    return json.table;
}

/** Reads the store locations sheet into [{name, contact, email}] */
async function fetchStoreRecipients(cfg) {
    const table = await fetchGvizTable(cfg.sheetId, cfg.gid);
    const rows = table.rows || [];
    const out = [];
    for (const row of rows) {
          const cells = row.c || [];
          const getVal = i => { const c = cells[i]; return c && c.v !== undefined ? c.v : null; };
          const name = getVal(cfg.nameIdx);
          const contact = getVal(cfg.contactIdx);
          const email = getVal(cfg.emailIdx);
          if (!name || !email) continue;
          out.push({ name: String(name).trim(), contact: contact ? String(contact).trim() : '', email: String(email).trim() });
    }
    return out;
}

module.exports = { fetchGvizTable, fetchStoreRecipients };
