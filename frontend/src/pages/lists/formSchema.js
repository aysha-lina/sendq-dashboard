// Default form-builder content + a small merge helper. Stored in ListForm.content (Json).
export const STANDARD_FIELDS = [
  { tag: 'EMAIL', label: 'Email Address', required: true, locked: true },
  { tag: 'FIRST_NAME', label: 'First name', required: false },
  { tag: 'LAST_NAME', label: 'Last name', required: false },
];

export const defaultFormContent = () => ({
  title: 'Subscribe to our newsletter',
  description: '',
  fields: STANDARD_FIELDS.map((f) => ({ ...f, enabled: f.tag === 'EMAIL' })),
  submitText: 'Sign Up',
  successMessage: 'Thanks for subscribing!',
  theme: { background: '#ffffff', text: '#1a1a1a', button: '#292929', buttonText: '#ffffff' },
});

// Merge a stored (possibly partial/empty) content blob with defaults so the
// builder and renderer always have a complete shape.
export const normalizeContent = (raw) => {
  const base = defaultFormContent();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    theme: { ...base.theme, ...(raw.theme || {}) },
    fields: Array.isArray(raw.fields) && raw.fields.length
      ? [
        // Standard fields first (merged with any stored overrides)…
        ...STANDARD_FIELDS.map((sf) => {
          const stored = raw.fields.find((f) => f.tag === sf.tag);
          return { ...sf, ...(stored || {}), enabled: stored ? stored.enabled !== false : sf.tag === 'EMAIL' };
        }),
        // …then preserve any custom list-field entries (don't drop them).
        ...raw.fields
          .filter((f) => f.tag && !STANDARD_FIELDS.some((sf) => sf.tag === f.tag))
          .map((f) => ({ required: false, ...f, enabled: f.enabled !== false })),
      ]
      : base.fields,
  };
};
