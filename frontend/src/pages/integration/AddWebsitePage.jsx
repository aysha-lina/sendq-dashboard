import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { integrationApi } from '../../api/services';

const Icon = ({ children, className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
    {children}
  </svg>
);

const normalizeUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const AddWebsitePage = () => {
  const navigate = useNavigate();
  const [siteUrl, setSiteUrl] = useState('');
  const [message, setMessage] = useState('');
  const [integrationCode, setIntegrationCode] = useState('');

  const [saving, setSaving] = useState(false);

  const handleGetCode = async (event) => {
    event.preventDefault();
    const url = normalizeUrl(siteUrl);
    let host;
    try { host = new URL(url).hostname; } catch { setMessage('Enter a valid website URL.'); setIntegrationCode(''); return; }

    setSaving(true);
    setMessage('');
    try {
      const { data: site } = await integrationApi.createWebsite({ title: host, url });
      const { data: code } = await integrationApi.websiteCode(site.uid);
      setIntegrationCode(code.snippet);
      setMessage('Website connected. Paste this snippet into your site’s <head>.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to connect website.');
      setIntegrationCode('');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSiteUrl('');
    setMessage('');
    setIntegrationCode('');
  };

  return (
    <AppLayout>
      <div className="sq-page flex min-h-screen flex-col px-8 py-10 lg:px-14">
        <main className="flex-1">
          <div className="mb-14 flex items-center gap-3 text-lg font-semibold">
            <span>Home</span>
            <span className="text-[#8d8e9d]">&gt;</span>
            <span>Websites</span>
          </div>

          <section className="mb-20 flex flex-col gap-8 xl:flex-row xl:items-center">
            <div className="flex max-w-[720px] items-center gap-10">
              <div className="hidden shrink-0 text-[#858694] sm:block">
                <Icon className="h-24 w-24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
                  <path d="M4 10h16v4H4z" />
                  <path d="M7 12h.01M10 12h.01M13 12h.01M16 12h.01" />
                </Icon>
              </div>
              <div>
                <h1 className="sq-section-title mb-3 text-[34px]">Connect your website</h1>
                <p className="max-w-[430px] text-xl font-semibold leading-relaxed text-[#bfc0ca]">
                  Connect to your own home or landing page to enable subscription popup forms
                </p>
              </div>
            </div>
            <button
              className="btn-secondary h-12 w-fit px-8 text-lg"
              onClick={() => navigate('/integration/connections')}
            >
              Manage Your Sites
            </button>
          </section>

          <form onSubmit={handleGetCode} className="max-w-[728px]">
            <h2 className="mb-7 text-2xl font-bold italic text-[#bebeca]">Integration code</h2>

            <label className="mb-3 block text-lg font-semibold text-white">Enter your site URL</label>
            <input
              className="input h-11 text-lg"
              placeholder="Eg. https://www.domainname.com"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
            />

            <div className="mt-8 flex items-center gap-8">
              <button className="btn-primary h-11 px-5 text-lg" type="submit" disabled={!siteUrl.trim() || saving}>
                {saving ? 'Connecting…' : 'Get code'}
              </button>
              <button className="text-lg font-bold text-white underline" type="button" onClick={handleCancel}>
                Cancel
              </button>
            </div>

            {message && <p className="mt-6 text-lg font-semibold text-[#bfc0ca]">{message}</p>}

            {integrationCode && (
              <div className="mt-5 rounded-md border border-[#555467] bg-[#242438] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold text-white">Code</span>
                  <button
                    className="btn-secondary h-9 px-4"
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(integrationCode)}
                  >
                    Copy
                  </button>
                </div>
                <code className="block break-all text-sm text-[#c8c8d4]">{integrationCode}</code>
              </div>
            )}
          </form>
        </main>

        <footer className="pt-10 text-lg font-semibold text-[#b8b8c2]">
          Copyright © 2025. SendQ - Send with Unlimited Confidence Email Marketing. All Rights Reserved.
        </footer>
      </div>
    </AppLayout>
  );
};

export default AddWebsitePage;
