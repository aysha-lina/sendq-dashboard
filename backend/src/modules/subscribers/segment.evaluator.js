// Turns a segment's stored conditions into a Prisma `where` fragment for the
// Subscriber model. Supports standard columns (email/first_name/last_name/status)
// and custom list fields (via the `fieldValues` relation). matching = all → AND, any → OR.

const STANDARD_COLUMNS = new Set(['email', 'first_name', 'last_name', 'status']);

// Build a where fragment for a standard scalar column.
const columnWhere = (col, operator, value) => {
  switch (operator) {
    case 'is': return { [col]: value };
    case 'is_not': return { NOT: { [col]: value } };
    case 'contains': return { [col]: { contains: value } };
    case 'not_contains': return { NOT: { [col]: { contains: value } } };
    case 'starts_with': return { [col]: { startsWith: value } };
    case 'ends_with': return { [col]: { endsWith: value } };
    case 'greater': return { [col]: { gt: value } };
    case 'less': return { [col]: { lt: value } };
    case 'is_empty': return { OR: [{ [col]: null }, { [col]: '' }] };
    case 'is_not_empty': return { AND: [{ NOT: { [col]: null } }, { NOT: { [col]: '' } }] };
    default: return { [col]: { contains: value } };
  }
};

// Build a where fragment for a custom list field (matched through fieldValues).
const fieldWhere = (fieldId, operator, value) => {
  const some = (valueFilter) => ({ fieldValues: { some: { list_field_id: fieldId, value: valueFilter } } });
  switch (operator) {
    case 'is': return some(value);
    case 'is_not': return { NOT: some(value) };
    case 'contains': return some({ contains: value });
    case 'not_contains': return { NOT: some({ contains: value }) };
    case 'starts_with': return some({ startsWith: value });
    case 'ends_with': return some({ endsWith: value });
    case 'greater': return some({ gt: value });
    case 'less': return some({ lt: value });
    case 'is_empty':
      return { OR: [{ fieldValues: { none: { list_field_id: fieldId } } }, some('')] };
    case 'is_not_empty':
      return { fieldValues: { some: { list_field_id: fieldId, NOT: { value: '' } } } };
    default: return some({ contains: value });
  }
};

// listFields: [{ id, tag, uid }] for the segment's list (resolves custom field keys).
const buildSegmentWhere = (segment, listFields = []) => {
  const conditions = Array.isArray(segment?.conditions) ? segment.conditions : [];
  const fragments = conditions
    .filter((c) => c && c.field && c.operator)
    .map((c) => {
      const value = c.value == null ? '' : String(c.value);
      if (STANDARD_COLUMNS.has(c.field)) return columnWhere(c.field, c.operator, value);
      const field = listFields.find((f) => f.tag === c.field || f.uid === c.field || String(f.id) === String(c.field));
      if (!field) return null; // unknown field → ignore this condition
      return fieldWhere(field.id, c.operator, value);
    })
    .filter(Boolean);

  if (fragments.length === 0) return {};
  return (segment.matching === 'any') ? { OR: fragments } : { AND: fragments };
};

module.exports = { buildSegmentWhere };
