import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sendq_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Cache-Control'] = 'no-cache';
  config.headers.Pragma = 'no-cache';
  config.params = { _ts: Date.now(), ...(config.params || {}) };
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sendq_token');
      localStorage.removeItem('sendq_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
