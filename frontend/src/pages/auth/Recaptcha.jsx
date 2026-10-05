import { useEffect, useRef } from 'react';

// Renders the real captcha widget for the provider configured in admin Settings.
// Driven by /auth/captcha-config — only mounted by the parent when enabled.
const SCRIPTS = {
  recaptcha: 'https://www.google.com/recaptcha/api.js?render=explicit',
  recaptcha_v3: 'https://www.google.com/recaptcha/api.js?render=explicit',
  hcaptcha: 'https://js.hcaptcha.com/1/api.js?render=explicit',
};

const loaders = {};
const loadScript = (src) => {
  if (loaders[src]) return loaders[src];
  loaders[src] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { existing.addEventListener('load', resolve); resolve(); return; }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return loaders[src];
};

const Recaptcha = ({ provider = 'recaptcha', siteKey, onChange }) => {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  const isHcaptcha = provider === 'hcaptcha';
  const api = () => (isHcaptcha ? window.hcaptcha : window.grecaptcha);

  useEffect(() => {
    if (!siteKey) return undefined;
    let cancelled = false;
    loadScript(SCRIPTS[provider] || SCRIPTS.recaptcha).then(() => {
      const tryRender = () => {
        if (cancelled) return;
        const sdk = api();
        if (!sdk?.render || !containerRef.current) { setTimeout(tryRender, 100); return; }
        if (widgetId.current !== null) return;
        widgetId.current = sdk.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onChange?.(token),
          'expired-callback': () => onChange?.(''),
          'error-callback': () => onChange?.(''),
        });
      };
      tryRender();
    }).catch(() => {});
    return () => { cancelled = true; };
     
  }, [provider, siteKey]);

  return <div className="login-split-captcha" ref={containerRef} />;
};

export default Recaptcha;
