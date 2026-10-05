import { useEffect, useState } from 'react';
import { authApi } from '../api/services';

// Maps admin "Login & Signup Design" setting keys → the CSS custom properties consumed by
// the .login-split* rules. Applying these on :root makes the real auth pages reflect the
// admin's Appearance & Theme Customization edits (page bg, card, inputs, button, links, slider).
const DESIGN_VARS = {
  d_page_bg: '--d-page-bg',
  d_card_bg: '--d-card-bg',
  d_title: '--d-title',
  d_subtitle: '--d-subtitle',
  d_label: '--d-label',
  d_form_text: '--d-form-text',
  d_input_bg: '--d-input-bg',
  d_input_border: '--d-input-border',
  d_input_focus: '--d-input-focus',
  d_button: '--d-button',
  d_button_hover: '--d-button-hover',
  d_link: '--d-link',
  d_copyright: '--d-copyright',
  d_slider_bg: '--d-slider-bg',
  d_slider_accent: '--d-slider-accent',
  d_pager_dot: '--d-pager-dot',
  d_pager_active: '--d-pager-active',
};

// Cache the fetch across auth-page navigations so we hit the endpoint once per load.
let cache = null;
let inflight = null;
const loadSettings = () => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = authApi.publicSettings()
      .then((r) => { cache = r.data || {}; return cache; })
      .catch(() => ({}));
  }
  return inflight;
};

const applyDesign = (s) => {
  const root = document.documentElement;
  Object.entries(DESIGN_VARS).forEach(([key, cssVar]) => {
    if (s[key]) root.style.setProperty(cssVar, s[key]);
    else root.style.removeProperty(cssVar);
  });
  if (s.custom_css) {
    let el = document.getElementById('sq-public-custom-css');
    if (!el) { el = document.createElement('style'); el.id = 'sq-public-custom-css'; document.head.appendChild(el); }
    el.textContent = s.custom_css;
  }
};

// Fetch the public design/slider settings, apply the colour variables, and return the
// settings object (so the slider can read slide images + autoplay/interval/dots config).
export const useAuthDesign = () => {
  const [settings, setSettings] = useState(cache || {});
  useEffect(() => {
    let mounted = true;
    loadSettings().then((s) => { if (mounted) { setSettings(s); applyDesign(s); } });
    return () => { mounted = false; };
  }, []);
  return settings;
};

export default useAuthDesign;
