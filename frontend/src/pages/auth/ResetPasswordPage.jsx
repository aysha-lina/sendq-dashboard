import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/services';
import { Spinner } from '../../components/ui';
import { useTranslation } from '../../i18n/index.jsx';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError(t('auth.register.mismatch'));
      return;
    }

    if (!token || !email) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ email, token, password: form.password });
      navigate('/login?reset=1');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid reset link</h2>
            <p className="text-sm text-gray-500 mb-6">
              This link is missing required parameters. Please request a new reset link.
            </p>
            <Link to="/forgot-password" className="btn-primary inline-block px-6 py-2">
              Request new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">SendQ</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('auth.tagline')}</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('auth.reset.title')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            Resetting password for <strong>{email}</strong>
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}{' '}
              {error.includes('expired') && (
                <Link to="/forgot-password" className="underline font-medium">
                  Request a new link
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="password">{t('auth.reset.new')}</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                className="input"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>

            <div>
              <label className="label" htmlFor="confirm">{t('auth.reset.confirm')}</label>
              <input
                id="confirm"
                type="password"
                required
                className="input"
                placeholder="Repeat your new password"
                value={form.confirm}
                onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {loading ? <Spinner size="sm" /> : null}
              {loading ? t('auth.reset.submitting') : t('auth.reset.submit')}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
