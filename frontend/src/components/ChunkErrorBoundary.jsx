import { Component } from 'react';

// Catches errors thrown while rendering lazy-loaded routes. The common case is a
// "chunk load error": the browser is holding a stale index.html that points at a
// build hash that no longer exists on the server, so the dynamic import() 404s.
// Left unhandled, React unmounts the tree and the user sees a blank page. Here we
// detect that case and reload once (fetching a fresh index.html + current chunks);
// a sessionStorage guard prevents an infinite reload loop.
const isChunkError = (err) => {
  const msg = `${err?.name || ''} ${err?.message || ''}`.toLowerCase();
  return (
    msg.includes('chunkloaderror')
    || msg.includes('loading chunk')
    || msg.includes('dynamically imported module')
    || msg.includes('failed to fetch dynamically imported')
    || msg.includes('importing a module script failed')
  );
};

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (!isChunkError(error)) return;
    // Auto-reload to fetch the fresh build — but only if we didn't just try that a
    // moment ago. If a reload didn't fix it (error recurs within 10s), stop and show
    // the error UI instead of looping; a later deploy (>10s) can auto-recover again.
    const last = Number(sessionStorage.getItem('sq_chunk_reload_at') || 0);
    if (Date.now() - last > 10000) {
      sessionStorage.setItem('sq_chunk_reload_at', String(Date.now()));
      window.location.reload();
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#cbd5e1', background: '#19192f', textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 16 }}>This page failed to load. It may be an outdated version.</p>
          <button
            type="button"
            onClick={() => { sessionStorage.removeItem('sq_chunk_reload_at'); window.location.reload(); }}
            style={{ background: '#2bb2d6', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 22px', fontSize: 14, cursor: 'pointer' }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ChunkErrorBoundary;
