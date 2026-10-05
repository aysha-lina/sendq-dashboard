import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authApi } from '../../api/services';
import useAuthStore from '../../store/authStore';
import { Spinner } from '../../components/ui';

// Consumes a one-click login token (admin "Generate one-click login URL"),
// stores the session, and drops the user into their dashboard.
const TokenLoginPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('Invalid login link.'); return; }
    localStorage.setItem('sendq_token', token);
    authApi.me()
      .then((res) => {
        const user = res.data.user || res.data;
        localStorage.setItem('sendq_user', JSON.stringify(user));
        useAuthStore.setState({ token, user });
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        localStorage.removeItem('sendq_token');
        setError('This login link is invalid or has expired.');
      });
  }, [token, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <div className="auth-verify-icon">⚠️</div>
            <h2 className="auth-title">Login link error</h2>
            <p className="auth-subtitle">{error}</p>
            <button type="button" className="btn-primary auth-submit-btn" onClick={() => navigate('/login')}>Go to login</button>
          </>
        ) : (
          <>
            <Spinner size="lg" />
            <p className="auth-subtitle" style={{ marginTop: 16 }}>Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default TokenLoginPage;
