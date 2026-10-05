const { test } = require('node:test');
const assert = require('node:assert');
const { parseCsvTable, suggestMapping, buildMappedRows } = require('../src/modules/subscribers/import.service');

const CSV_HEADER = 'Email,First Name,Company\njohn@x.com,John,Acme\njane@y.com,Jane,Globex';
const CSV_NO_HEADER = 'bob@z.com,Bob,Initech';

test('parseCsvTable: detects a header row and splits columns + rows', () => {
  const t = parseCsvTable(CSV_HEADER);
  assert.strictEqual(t.hasHeader, true);
  assert.deepStrictEqual(t.columns, ['Email', 'First Name', 'Company']);
  assert.strictEqual(t.rows.length, 2);
  assert.deepStrictEqual(t.rows[0], ['john@x.com', 'John', 'Acme']);
});

test('parseCsvTable: headerless data → synthetic column names, all rows kept', () => {
  const t = parseCsvTable(CSV_NO_HEADER);
  assert.strictEqual(t.hasHeader, false);
  assert.deepStrictEqual(t.columns, ['Column 1', 'Column 2', 'Column 3']);
  assert.strictEqual(t.rows.length, 1);
});

test('suggestMapping: maps standard fields by alias and custom fields by tag/label', () => {
  const fields = [{ tag: 'company', label: 'Company' }, { tag: 'city', label: 'City' }];
  const m = suggestMapping(['Email', 'First Name', 'Company', 'Unknown'], fields);
  assert.deepStrictEqual(m, ['email', 'first_name', 'company', '']);
});

test('buildMappedRows: applies the mapping, routing custom fields into custom_fields', () => {
  const t = parseCsvTable(CSV_HEADER);
  const rows = buildMappedRows(t, ['email', 'first_name', 'company']);
  assert.deepStrictEqual(rows[0], { email: 'john@x.com', first_name: 'John', custom_fields: { company: 'Acme' } });
  assert.deepStrictEqual(rows[1], { email: 'jane@y.com', first_name: 'Jane', custom_fields: { company: 'Globex' } });
});

test('buildMappedRows: a blank mapping entry skips that column', () => {
  const t = parseCsvTable(CSV_HEADER);
  const rows = buildMappedRows(t, ['email', '', '']); // only import the email column
  assert.deepStrictEqual(rows[0], { email: 'john@x.com' });
});
