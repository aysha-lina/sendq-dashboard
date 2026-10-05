import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';

// Real 404 — replaces the previous silent redirect-to-dashboard for unknown URLs.
const NotFoundPage = () => {
  const { token } = useAuthStore();
  return (
    <div className="notfound-page">
      <div className="notfound-card">
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-text">The page you’re looking for doesn’t exist or may have moved.</p>
        <Link to={token ? '/dashboard' : '/login'} className="notfound-btn">
          {token ? 'Back to dashboard' : 'Go to sign in'}
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
