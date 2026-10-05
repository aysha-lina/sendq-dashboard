import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { authApi } from '../../api/services';
import { Spinner } from '../../components/ui';

// Google redirects here with ?code & ?state. We post them to the backend, which
// exchanges the code (secret stays server-side) and returns a JWT, then we land on the app.
const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // the auth code is single-use — never exchange twice
    ran.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const googleError = params.get('error');

    if (googleError) { setError('Google sign-in was cancelled.'); return; }
    if (!code || !state) { setError('Missing Google sign-in response.'); return; }

    authApi.googleOAuthExchange({ code, state })
      .then(({ data }) => {
        localStorage.setItem('sendq_token', data.token);
        localStorage.setItem('sendq_user', JSON.stringify(data.user));
        useAuthStore.setState({ token: data.token, user: data.user });
        navigate('/dashboard', { replace: true });
      })
      .catch((err) => setError(err.response?.data?.message || 'Google authentication failed.'));
  }, [params, navigate]);

  return (
    <div className="notfound-page">
      <div className="notfound-card">
        {error ? (
          <>
            <h1 className="notfound-title">Sign-in failed</h1>
            <p className="notfound-text">{error}</p>
            <Link to="/login" className="notfound-btn">Back to sign in</Link>
          </>
        ) : (
          <>
            <Spinner size="lg" />
            <p className="notfound-text" style={{ marginTop: 16 }}>Signing you in with Google…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
