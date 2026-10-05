import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { integrationApi } from '../../api/services';
import { toast } from '../../components/ui';

const Icon = ({ children, className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
    {children}
  </svg>
);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (part) => `${part}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const ManageConnectionsPage = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());

  const load = () => integrationApi.websites()
    .then(({ data }) => { setSites(data.data || []); setSelected(new Set()); })
    .catch(() => setSites([]));

  useEffect(() => { load(); }, []);

  const visibleSites = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    let v = !term ? sites : sites.filter((site) => (site.url || '').toLowerCase().includes(term) || (site.title || '').toLowerCase().includes(term));
    v = [...v].sort((a, b) => {
      const av = String((sort === 'title' ? a.title : a[sort]) || a.created_at || '');
      const bv = String((sort === 'title' ? b.title : b[sort]) || b.created_at || '');
      const cmp = av.localeCompare(bv);
      return dir === 'desc' ? -cmp : cmp;
    });
    return v;
  }, [sites, keyword, sort, dir]);

  const allSelected = visibleSites.length > 0 && visibleSites.every((s) => selected.has(s.uid));
  const toggleOne = (uid) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleSites.map((s) => s.uid)));

  const removeSite = async (uid) => {
    if (!window.confirm('Disconnect this website?')) return;
    try { await integrationApi.deleteWebsite(uid); load(); } catch { /* ignore */ }
  };

  const bulkDisconnect = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Disconnect ${selected.size} selected website(s)?`)) return;
    await Promise.allSettled([...selected].map((uid) => integrationApi.deleteWebsite(uid)));
    toast.success(`Disconnected ${selected.size} website(s).`);
    load();
  };

  const copyCode = async (uid) => {
    try {
      const { data } = await integrationApi.websiteCode(uid);
      await navigator.clipboard?.writeText(data.snippet);
      toast.success('Tracking snippet copied to clipboard.');
    } catch { toast.error('Could not get tracking code.'); }
  };

  return (
    <AppLayout>
      <div className="sq-page flex min-h-screen flex-col px-8 py-8 lg:px-14">
        <main className="flex-1">
          <div className="mb-8 text-lg font-semibold text-white">Home</div>

          <div className="mb-24 flex items-center gap-5">
            <Icon className="h-10 w-10 shrink-0 text-[rgba(197,192,142,0.22)]">
              <path d="M4 7h4M4 12h4M4 17h4" />
              <path d="M11 7h9M11 12h9M11 17h9" />
            </Icon>
            <h1 className="sq-section-title truncate text-[40px] sm:text-[44px]">Websites</h1>
          </div>

          <div className="mb-5 flex flex-col gap-4 border-b border-[#2d2d43] pb-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <input type="checkbox" className="h-6 w-6 rounded border border-[#66667a] bg-transparent" checked={allSelected} onChange={toggleAll} title="Select all" />
              <span className="text-lg font-semibold text-[#c3c3cf]">Sort by</span>
              <select className="input h-11 w-[136px] text-lg" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="created_at">Created at</option>
                <option value="title">Name</option>
              </select>
              <button type="button" className="btn-secondary h-11 w-11 px-0" title="Sort direction" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
                <Icon><path d="M4 7h14M4 12h10M4 17h6" /></Icon>
              </button>
              <div className="relative w-full sm:w-[250px]">
                <input
                  className="input h-11 pr-10 text-lg"
                  placeholder="Type to search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
                <Icon className="absolute right-3 top-3 h-5 w-5 text-[#b8b8c3]">
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 4 4" />
                </Icon>
              </div>
            </div>
            <button className="btn-primary h-11 px-5 text-lg" onClick={() => navigate('/integration/website')}>
              <span className="text-2xl leading-none">+</span>
              Add website
            </button>
          </div>

          {selected.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-[#1f1f33] px-5 py-4">
              <span className="text-lg font-semibold text-white">{selected.size} selected</span>
              <button className="btn-secondary h-10 text-base" onClick={() => setSelected(new Set())}>Clear</button>
              <span className="mx-1 h-6 w-px bg-[#3f3f55]" />
              <button className="btn-danger h-10 text-base" onClick={bulkDisconnect}>Disconnect selected</button>
            </div>
          )}

          <section className="sq-panel min-h-[326px] overflow-hidden">
            {visibleSites.length === 0 ? (
              <div className="flex min-h-[326px] flex-col items-center justify-center text-center text-[#a9a9b7]">
                <Icon className="mb-5 h-20 w-20 text-[#777889]">
                  <path d="m12 3 1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z" />
                  <path d="m18 14 .9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9L18 14Z" />
                </Icon>
                <p className="text-xl font-semibold">There are no websites yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#29293d]">
                {visibleSites.map((site) => (
                  <div key={site.uid} className="grid gap-4 px-5 py-5 text-lg md:grid-cols-[28px_1fr_160px_220px] md:items-center">
                    <input type="checkbox" className="h-6 w-6 rounded border border-[#66667a] bg-transparent" checked={selected.has(site.uid)} onChange={() => toggleOne(site.uid)} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#00abc4]">{site.title || site.url}</p>
                      <p className="truncate text-base text-[#9a9aa8]">{site.url}</p>
                      <p className="mt-1 font-semibold text-[#aaaab6]">Created at: {formatDate(site.created_at)}</p>
                    </div>
                    <span className={`w-fit rounded-full px-4 py-1 text-sm font-bold uppercase ${site.status === 'active' ? 'bg-[#b8e779] text-[#10200d]' : 'bg-[#9999a6] text-[#262633]'}`}>{site.status || 'inactive'}</span>
                    <div className="flex gap-2">
                      <button className="btn-secondary h-10 px-4 text-base" onClick={() => copyCode(site.uid)}>Get code</button>
                      <button className="btn-danger h-10 px-4 text-base" onClick={() => removeSite(site.uid)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        <footer className="pt-10 text-lg font-semibold text-[#b8b8c2]">
          Copyright © 2025. SendQ - Send with Unlimited Confidence Email Marketing. All Rights Reserved.
        </footer>
      </div>
    </AppLayout>
  );
};

export default ManageConnectionsPage;
