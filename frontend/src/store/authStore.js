import { create } from 'zustand';
import { authApi } from '../api/services';

const useAuthStore = create((set, get) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('sendq_user')); } catch { return null; }
  })(),
  token: localStorage.getItem('sendq_token') || null,
  loading: false,
  error: null,
  errorCode: null,
  errorEmail: null,

  login: async (email, password) => {
    set({ loading: true, error: null, errorCode: null, errorEmail: null });
    try {
      const { data } = await authApi.login({ email, password });
      // Two-factor required: don't authenticate yet — hand the challenge back.
      if (data.twoFactorRequired) {
        set({ loading: false });
        return { success: false, twoFactor: true, method: data.method, challenge: data.challenge };
      }
      localStorage.setItem('sendq_token', data.token);
      localStorage.setItem('sendq_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed.';
      const errorCode = err.response?.data?.code || null;
      const errorEmail = err.response?.data?.email || null;
      set({ error: message, errorCode, errorEmail, loading: false });
      return { success: false, message };
    }
  },

  // Complete a 2FA login with the emailed/authenticator code.
  verifyTwoFactor: async (challenge, code) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authApi.verifyTwoFactor({ challenge, code });
      localStorage.setItem('sendq_token', data.token);
      localStorage.setItem('sendq_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Verification failed.';
      set({ error: message, loading: false });
      return { success: false, message };
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('sendq_token');
    localStorage.removeItem('sendq_user');
    set({ user: null, token: null });
  },

  clearError: () => set({ error: null, errorCode: null, errorEmail: null }),

  isAuthenticated: () => !!get().token,

  // Admin "Login as": stash the current admin session, then switch to the customer.
  impersonate: (token, user) => {
    if (!localStorage.getItem('sendq_admin_token')) {
      localStorage.setItem('sendq_admin_token', localStorage.getItem('sendq_token') || '');
      localStorage.setItem('sendq_admin_user', localStorage.getItem('sendq_user') || '');
    }
    localStorage.setItem('sendq_token', token);
    localStorage.setItem('sendq_user', JSON.stringify(user));
    set({ token, user });
  },

  // Restore the stashed admin session and exit impersonation.
  stopImpersonating: () => {
    const adminToken = localStorage.getItem('sendq_admin_token');
    const adminUser = localStorage.getItem('sendq_admin_user');
    if (adminToken) {
      localStorage.setItem('sendq_token', adminToken);
      localStorage.setItem('sendq_user', adminUser || 'null');
    }
    localStorage.removeItem('sendq_admin_token');
    localStorage.removeItem('sendq_admin_user');
    let parsed = null;
    try { parsed = JSON.parse(adminUser); } catch { parsed = null; }
    set({ token: adminToken || null, user: parsed });
  },

  isImpersonating: () => !!localStorage.getItem('sendq_admin_token'),
}));

export default useAuthStore;
