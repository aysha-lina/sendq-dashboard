import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/services';
import { Spinner } from '../../components/ui';
import AuthSlider from './AuthSlider';
import Recaptcha from './Recaptcha';
import useAuthDesign from '../../hooks/useAuthDesign';

const CheckEmailScreen = ({ email }) => {
  const design = useAuthDesign();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await authApi.resendVerification({ email });
      setResent(true);
    } catch {
      setError('Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="login-split">
      <div className="login-split-left">
        <div className="login-split-logo">
          <img src={design.site_logo_light || '/assets/1.png'} alt="SendQ" />
        </div>
        <div className="login-split-card">
          <div className="auth-verify-icon" style={{ fontSize: 40, marginBottom: 8 }}>✉️</div>
          <h2 className="login-split-title">Check your email</h2>
          <p className="login-split-subtitle">
            We sent a verification link to <strong>{email}</strong>. Click the link to activate your account.
          </p>

          {error && <div className="auth-banner error"><span className="material-symbols-rounded">error</span><p>{error}</p></div>}

          {resent ? (
            <div className="auth-banner success"><span className="material-symbols-rounded">mark_email_read</span>Verification email resent!</div>
          ) : (
            <button type="button" className="login-split-btn" onClick={handleResend} disabled={resending}>
              {resending ? <Spinner size="sm" /> : null}
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          )}

          <p className="login-split-footer">
            Already verified? <Link to="/login">Sign In</Link>
          </p>
        </div>
        <div className="login-split-copyright">© {new Date().getFullYear()} - All Rights Reserved</div>
      </div>
      <div className="login-split-right">
        <AuthSlider settings={design} />
      </div>
    </div>
  );
};

const RegisterPage = () => {
  const [form, setForm] = useState({
    name: '', full_name: '', email: '', password: '', timezone: 'UTC',
  });
  const timezones = (() => {
    try { return (typeof Intl.supportedValuesOf === 'function' && Intl.supportedValuesOf('timeZone')) || []; } catch { return []; }
  })();
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState({ enabled: false, provider: 'recaptcha', site_key: '' });
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registeredEmail, setRegisteredEmail] = useState(null);
  const design = useAuthDesign();

  useEffect(() => {
    authApi.captchaConfig()
      .then(({ data }) => setCaptcha(data))
      .catch(() => setCaptcha({ enabled: false, provider: 'recaptcha', site_key: '' }));
  }, []);

  const handleChange = (e) => {
    setError(null);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (captcha.enabled && !captchaToken) { setError('Please confirm you are not a robot.'); return; }
    setLoading(true);
    try {
      const fullName = form.full_name.trim();
      const [first, ...rest] = fullName.split(/\s+/);
      const payload = {
        name: form.name.trim(),
        company: form.name.trim(),
        first_name: first || fullName,
        last_name: rest.join(' ') || '-',
        email: form.email.trim(),
        password: form.password,
        timezone: form.timezone,
        recaptcha_token: captchaToken,
      };
      await authApi.register(payload);
      setRegisteredEmail(form.email.trim());
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (registeredEmail) {
    return <CheckEmailScreen email={registeredEmail} />;
  }

  return (
    <div className="login-split">
      {/* Left — create account card */}
      <div className="login-split-left login-split-left-wide">
        <div className="login-split-logo">
          <img src={design.site_logo_light || '/assets/1.png'} alt="SendQ" />
        </div>

        <div className="login-split-card">
          <h2 className="login-split-title">Create Account</h2>
          <p className="login-split-subtitle">Get started with your free account today.</p>

          {error && (
            <div className="auth-banner error">
              <span className="material-symbols-rounded">error</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-split-form">
            <label className="login-split-field">
              <span>Organization Name <em>*</em></span>
              <input
                name="name"
                type="text"
                required
                className="login-split-input"
                placeholder="Your organization name"
                value={form.name}
                onChange={handleChange}
              />
            </label>

            <div className="login-split-row">
              <label className="login-split-field">
                <span>Full Name <em>*</em></span>
                <input
                  name="full_name"
                  type="text"
                  required
                  className="login-split-input"
                  placeholder="Your full name"
                  value={form.full_name}
                  onChange={handleChange}
                />
              </label>
              <label className="login-split-field">
                <span>Email <em>*</em></span>
                <input
                  name="email"
                  type="email"
                  required
                  className="login-split-input"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </label>
            </div>

            <label className="login-split-field">
              <span>Password <em>*</em></span>
              <div className="login-split-password">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  className="login-split-input"
                  placeholder="Create a password"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="login-split-eye"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <span className="material-symbols-rounded">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </label>

            <label className="login-split-field">
              <span>Timezone <em>*</em></span>
              <select name="timezone" className="login-split-input" value={form.timezone} onChange={handleChange}>
                <option value="UTC">(GMT+00:00) UTC</option>
                {timezones.filter((tz) => tz !== 'UTC').map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </label>

            {captcha.enabled && captcha.site_key && (
              <Recaptcha provider={captcha.provider} siteKey={captcha.site_key} onChange={setCaptchaToken} />
            )}

            <button type="submit" disabled={loading} className="login-split-btn login-split-btn-block">
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Creating account…' : 'Get Started'}
            </button>
          </form>

          <p className="login-split-footer">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>

        <div className="login-split-copyright">© {new Date().getFullYear()} - All Rights Reserved</div>
      </div>

      {/* Right — auto-looping slider */}
      <div className="login-split-right">
        <AuthSlider settings={design} />
      </div>
    </div>
  );
};

export default RegisterPage;
