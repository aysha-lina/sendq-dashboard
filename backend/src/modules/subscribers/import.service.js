const { v4: uuidv4 } = require('uuid');
const prisma = require('../../config/database.config');

// Map common header variants to canonical field names.
const HEADER_ALIASES = {
  email: 'email', 'email address': 'email', 'e-mail': 'email', 'e mail': 'email', mail: 'email',
  first_name: 'first_name', 'first name': 'first_name', firstname: 'first_name', fname: 'first_name', 'given name': 'first_name',
  last_name: 'last_name', 'last name': 'last_name', lastname: 'last_name', lname: 'last_name', surname: 'last_name',
  status: 'status', state: 'status',
};
const normalizeHeader = (h) => {
  const key = h.trim().toLowerCase().replace(/^\uFEFF/, '');
  return HEADER_ALIASES[key] || key;
};

// Tokenize a raw CSV string into a 2D array of cells (one inner array per non-empty row).
// Handles a UTF-8 BOM, comma/semicolon/tab/pipe delimiters, quoted fields, escaped
// quotes ("") and newlines embedded inside quotes.
const tokenizeCsv = (text) => {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  if (!clean.trim()) return [];

  // Detect the delimiter from the first line.
  const nl = clean.search(/\r?\n/);
  const firstLine = nl === -1 ? clean : clean.slice(0, nl);
  const candidates = [',', ';', '\t', '|'];
  const delim = candidates.reduce((best, d) => {
    const count = firstLine.split(d).length - 1;
    return count > best.count ? { d, count } : best;
  }, { d: ',', count: 0 }).d;

  const records = [];
  let field = '';
  let record = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else { field += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      record.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      record.push(field); field = '';
      records.push(record); record = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || record.length > 0) { record.push(field); records.push(record); }

  return records.filter((r) => r.some((c) => c.trim() !== ''));
};

const isEmailValue = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

// Parse CSV into the raw header columns + sample rows, WITHOUT alias normalization —
// for the column-mapping wizard. Returns { columns: string[], rows: string[][], hasHeader }.
const parseCsvTable = (text) => {
  const records = tokenizeCsv(text);
  if (records.length === 0) return { columns: [], rows: [], hasHeader: false };
  const firstRow = records[0].map((c) => c.trim());
  // Treat the first row as a header unless it already looks like data (contains an email).
  const hasHeader = !firstRow.some(isEmailValue);
  if (hasHeader) {
    return { columns: firstRow, rows: records.slice(1).map((r) => r.map((c) => c.trim())), hasHeader: true };
  }
  const columns = firstRow.map((_, i) => `Column ${i + 1}`);
  return { columns, rows: records.map((r) => r.map((c) => c.trim())), hasHeader: false };
};

const STD_FIELDS = ['email', 'first_name', 'last_name', 'status'];

// Suggest a target field for each detected column: a standard field via header alias,
// else a list custom-field tag matched by tag/label (case-insensitive), else '' (skip).
const suggestMapping = (columns, listFields = []) => {
  const byTag = new Map(listFields.map((f) => [String(f.tag).toLowerCase(), f.tag]));
  const byLabel = new Map(listFields.map((f) => [String(f.label).toLowerCase(), f.tag]));
  return columns.map((col) => {
    const norm = normalizeHeader(col);
    if (STD_FIELDS.includes(norm)) return norm;
    const key = String(col).trim().toLowerCase();
    return byTag.get(key) || byLabel.get(key) || '';
  });
};

// Build importable row objects from a parsed table + a per-column mapping array.
// Each mapping entry is a standard field key, a custom-field tag, or '' (skip).
const buildMappedRows = (table, mapping) => table.rows.map((cells) => {
  const rec = {};
  mapping.forEach((target, i) => {
    if (!target) return;
    const val = (cells[i] ?? '').trim();
    if (STD_FIELDS.includes(target)) rec[target] = val;
    else {
      rec.custom_fields = rec.custom_fields || {};
      rec.custom_fields[target] = val;
    }
  });
  return rec;
});

// Parse a raw CSV string into row objects keyed by normalized header.
// Handles a UTF-8 BOM, comma/semicolon/tab delimiters, quoted fields,
// escaped quotes ("") and newlines embedded inside quotes.
const parseCsv = (text) => {
  const nonEmpty = tokenizeCsv(text);
  if (nonEmpty.length === 0) return [];

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  const firstRow = nonEmpty[0].map((c) => c.trim());
  const headerCandidates = firstRow.map(normalizeHeader);

  let headers;
  let dataRows;
  if (headerCandidates.includes('email')) {
    // First row is a real header row.
    headers = headerCandidates;
    dataRows = nonEmpty.slice(1);
  } else if (firstRow.some(isEmail)) {
    // No header row — the first line is already data. Use positional columns,
    // and put the column that contains an email first.
    const emailIdx = firstRow.findIndex(isEmail);
    const positional = ['first_name', 'last_name', 'status'];
    headers = firstRow.map((_, i) => (i === emailIdx ? 'email' : positional.shift() || `col_${i}`));
    dataRows = nonEmpty;
  } else {
    // Fallback: treat first row as headers (best effort).
    headers = headerCandidates;
    dataRows = nonEmpty.slice(1);
  }

  return dataRows.map((cells) => headers.reduce((rec, h, i) => {
    rec[h] = (cells[i] ?? '').trim();
    return rec;
  }, {}));
};

// Process a batch of subscriber rows into a list. Shared by the synchronous
// import route and the BullMQ import worker. Reports progress via onProgress.
const processImport = async ({ customerId, listId, rows, onProgress }) => {
  let created = 0;
  let updated = 0;
  const errors = [];
  const total = rows.length;

  // If any row carries mapped custom fields, resolve this list's fields once (tag → id).
  const needsCustomFields = rows.some((r) => r && r.custom_fields && Object.keys(r.custom_fields).length);
  const fieldByTag = new Map();
  if (needsCustomFields) {
    const listFields = await prisma.listField.findMany({ where: { mail_list_id: listId } }).catch(() => []);
    listFields.forEach((f) => fieldByTag.set(f.tag, f.id));
  }
  const persistCustomFields = async (subscriberId, custom) => {
    for (const [tag, value] of Object.entries(custom || {})) {
      const fieldId = fieldByTag.get(tag);
      if (!fieldId) continue;
       
      await prisma.subscriberFieldValue.upsert({
        where: { subscriber_id_list_field_id: { subscriber_id: subscriberId, list_field_id: fieldId } },
        update: { value: String(value ?? '').slice(0, 65535) },
        create: { subscriber_id: subscriberId, list_field_id: fieldId, value: String(value ?? '').slice(0, 65535) },
      }).catch(() => {});
    }
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const email = (row.email || row.EMAIL || row.Email || '').trim();
    if (!email) {
      const cols = Object.keys(row).filter(Boolean).join(', ') || '(none)';
      errors.push({ row, message: `Email is missing. Detected columns: ${cols}` });
    } else {
      const data = {
        customer_id: customerId,
        mail_list_id: listId,
        email,
        first_name: row.first_name || row.FIRST_NAME || row['first name'] || null,
        last_name: row.last_name || row.LAST_NAME || row['last name'] || null,
        status: row.status || 'subscribed',
      };
      try {
        const existing = await prisma.subscriber.findFirst({
          where: { customer_id: customerId, mail_list_id: listId, email },
        });
        if (existing) {
          await prisma.subscriber.update({ where: { id: existing.id }, data });
          if (needsCustomFields) await persistCustomFields(existing.id, row.custom_fields);
          updated += 1;
        } else {
          const sub = await prisma.subscriber.create({ data: { uid: uuidv4(), ...data } });
          if (needsCustomFields) await persistCustomFields(sub.id, row.custom_fields);
          created += 1;
        }
      } catch (err) {
        errors.push({ row, message: err.message });
      }
    }
    if (onProgress && (i % 25 === 0 || i === total - 1)) {
      onProgress({ processed: i + 1, total, created, updated, failed: errors.length });
    }
  }

  require('../../utils/event-log').logEvent({ customerId, type: 'subscribers.imported', name: `${created + updated} of ${total} subscribers imported` });
  return { created, updated, errors, total };
};

module.exports = { parseCsv, parseCsvTable, suggestMapping, buildMappedRows, processImport, STD_FIELDS };
