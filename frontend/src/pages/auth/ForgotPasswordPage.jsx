import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/services';
import { Spinner } from '../../components/ui';
import { useTranslation } from '../../i18n/index.jsx';

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">SendQ</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('auth.tagline')}</p>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📬</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('auth.check_email')}</h2>
              <p className="text-sm text-gray-500 mb-6">
                If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
              </p>
              <Link to="/login" className="text-blue-600 hover:underline text-sm font-medium">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('auth.forgot.title')}</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="email">{t('auth.email')}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 mt-2"
                >
                  {loading ? <Spinner size="sm" /> : null}
                  {loading ? t('auth.forgot.sending') : t('auth.forgot.submit')}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-gray-500">
                <Link to="/login" className="text-blue-600 hover:underline font-medium">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
