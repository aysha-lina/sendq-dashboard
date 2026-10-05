import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { authApi } from '../../api/services';
import { Spinner } from '../../components/ui';
import { useTranslation } from '../../i18n/index.jsx';
import AuthSlider from './AuthSlider';
import useAuthDesign from '../../hooks/useAuthDesign';
import { offerToSaveLogin } from '../../utils/credentials';

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justReset = searchParams.get('reset') === '1';
  const justVerified = searchParams.get('verified') === '1';

  const { t } = useTranslation();
  const design = useAuthDesign();
  const { login, verifyTwoFactor, loading, error, errorCode, errorEmail, clearError } = useAuthStore();
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const oauthError = searchParams.get('oauth_error');
  const [form, setForm] = useState({ email: '', password: '' });
  const [resending, setResending] = useState(false);
  const [resentOk, setResentOk] = useState(false);
  const [twoFactor, setTwoFactor] = useState(null); // { method, challenge }
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    authApi.oauthConfig().then(({ data }) => setGoogleEnabled(Boolean(data.google))).catch(() => {});
  }, []);

  const handleChange = (e) => {
    clearError();
    setResentOk(false);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form.email, form.password);
    if (result.success) {
      // Only NOW (confirmed success) offer to save the password to the browser.
      offerToSaveLogin(form.email, form.password);
      navigate('/dashboard');
      return;
    }
    if (result.twoFactor) setTwoFactor({ method: result.method, challenge: result.challenge });
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setCodeError('');
    const result = await verifyTwoFactor(twoFactor.challenge, code.trim());
    if (result.success) {
      offerToSaveLogin(form.email, form.password); // confirmed success (after 2FA)
      navigate('/dashboard');
    } else setCodeError(result.message);
  };

  const handleResend = async () => {
    const emailToResend = errorEmail || form.email;
    if (!emailToResend) return;
    setResending(true);
    try {
      await authApi.resendVerification({ email: emailToResend });
      setResentOk(true);
    } catch {
      // silent — server always returns 200 for security
    } finally {
      setResending(false);
    }
  };

  const isUnverified = errorCode === 'EMAIL_UNVERIFIED';
  const year = new Date().getFullYear();

  return (
    <div className="login-split">
      {/* Left — sign in card */}
      <div className="login-split-left">
        <div className="login-split-logo">
          <img src={design.site_logo_light || '/assets/1.png'} alt="SendQ" />
        </div>

        <div className="login-split-card">
          <h2 className="login-split-title">Sign In</h2>
          <p className="login-split-subtitle">Welcome back! Please log in to continue.</p>

          {oauthError && (
            <div className="auth-banner error">
              <span className="material-symbols-rounded">error</span>
              {oauthError}
            </div>
          )}

          {justVerified && (
            <div className="auth-banner success">
              <span className="material-symbols-rounded">check_circle</span>
              Email verified! You can now sign in.
            </div>
          )}

          {justReset && (
            <div className="auth-banner success">
              <span className="material-symbols-rounded">check_circle</span>
              Password reset successfully. You can now sign in.
            </div>
          )}

          {resentOk && (
            <div className="auth-banner success">
              <span className="material-symbols-rounded">mark_email_read</span>
              Verification email resent — check your inbox.
            </div>
          )}

          {error && !resentOk && (
            <div className="auth-banner error">
              <span className="material-symbols-rounded">error</span>
              <div>
                <p>{error}</p>
                {isUnverified && (
                  <button
                    type="button"
                    className="auth-resend-inline"
                    onClick={handleResend}
                    disabled={resending}
                  >
                    {resending ? t('auth.forgot.sending') : `${t('auth.resend')} →`}
                  </button>
                )}
              </div>
            </div>
          )}

          {twoFactor ? (
            <form onSubmit={handleVerify} className="login-split-form">
              <p className="login-split-2fa-intro">
                {twoFactor.method === 'totp' ? t('auth.twofa.totp_hint') : t('auth.twofa.email_hint')}
              </p>
              <input
                id="twofa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                className="login-split-input"
                placeholder={t('auth.twofa.code')}
                value={code}
                onChange={(e) => { setCodeError(''); setCode(e.target.value); }}
              />
              {codeError && <div className="login-split-fielderr">{codeError}</div>}
              <div className="login-split-actions">
                <button type="submit" className="login-split-btn" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : t('auth.twofa.verify')}
                </button>
                <button
                  type="button"
                  className="login-split-forgot"
                  onClick={() => { setTwoFactor(null); setCode(''); setCodeError(''); }}
                >
                  {t('auth.twofa.back')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="login-split-form">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="login-split-input"
                placeholder="Username"
                value={form.email}
                onChange={handleChange}
              />

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="login-split-input"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
              />

              <div className="login-split-actions">
                <button type="submit" disabled={loading} className="login-split-btn">
                  {loading ? <Spinner size="sm" /> : 'Sign In'}
                </button>
                <Link to="/forgot-password" className="login-split-forgot">Forgot Password?</Link>
              </div>
            </form>
          )}

          {googleEnabled && !twoFactor && (
            <>
              <div className="login-split-or"><span>or</span></div>
              <a className="login-split-google" href="/api/auth/oauth/google/start">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
                Sign in with Google
              </a>
            </>
          )}

          <p className="login-split-footer">
            New to SendQ - Send with Unlimited Confidence? <Link to="/register">Sign Up</Link>
          </p>
        </div>

        <div className="login-split-copyright">© {year} - All Rights Reserved</div>
      </div>

      {/* Right — auto-looping slider */}
      <div className="login-split-right">
        <AuthSlider settings={design} />
      </div>
    </div>
  );
};

export default LoginPage;
