import clsx from 'clsx';
import { create } from 'zustand';

// ─── Toasts ─────────────────────────────────────────────────────────────────────
let toastSeq = 0;
const useToastStore = create((set) => ({
  toasts: [],
  push: (message, type = 'info') => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Imperative helper usable outside React: toast.success('Saved'), toast.error('Failed')
export const toast = {
  show: (message, type) => useToastStore.getState().push(message, type),
  success: (message) => useToastStore.getState().push(message, 'success'),
  error: (message) => useToastStore.getState().push(message, 'error'),
  info: (message) => useToastStore.getState().push(message, 'info'),
};

export const Toaster = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (!toasts.length) return null;
  return (
    <div className="sq-toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`sq-toast sq-toast-${t.type}`} role="status" onClick={() => dismiss(t.id)}>
          <span className="material-symbols-rounded">
            {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────
const statusColors = {
  new: 'bg-gray-100 text-gray-700',
  ready: 'bg-blue-100 text-blue-700',
  sending: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  error: 'bg-red-100 text-red-700',
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
};

export const StatusBadge = ({ status }) => (
  <span className={clsx('badge', statusColors[status] || 'bg-gray-100 text-gray-600')}>
    {status}
  </span>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 'md' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-gray-200 border-t-blue-600', sizes[size])} />
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
export const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
    {description && <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>}
    {action}
  </div>
);

// ─── Page Header ──────────────────────────────────────────────────────────────
export const PageHeader = ({ title, description, action }) => (
  <div className="flex items-start justify-between mb-6">
    <div>
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, sub, percent, colorClass = 'bg-blue-500' }) => (
  <div className="card p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className="text-xs text-gray-400">{sub}</span>
    </div>
    <p className="text-2xl font-bold text-gray-900 mb-3">{value}</p>
    {percent !== undefined && (
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Usage</span>
          <span>{percent}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', percent >= 80 ? 'bg-red-500' : colorClass)}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>
    )}
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// ─── Html Editor ─────────────────────────────────────────────────────────────
export { default as HtmlEditor } from './HtmlEditor';

// ─── Form Field ───────────────────────────────────────────────────────────────
export const FormField = ({ label, error, required, children }) => (
  <div className="mb-4">
    {label && (
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
    )}
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);
