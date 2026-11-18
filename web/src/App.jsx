import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { api, subscribe } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import SessionView from './components/SessionView.jsx';
import NewSession from './components/NewSession.jsx';
import Prayer from './components/Prayer.jsx';
import Blessing from './components/Blessing.jsx';
import Awakening from './components/Awakening.jsx';
import Seal from './components/Seal.jsx';

const initial = { ready: false, config: null, spirits: [], sessions: {}, connected: false };

function reducer(state, a) {
  switch (a.type) {
    case 'state':
      return {
        ...state,
        ready: true,
        config: a.data.config,
        spirits: a.data.spirits,
        sessions: Object.fromEntries(a.data.sessions.map((s) => [s.id, s])),
      };
    case 'connected':
      return { ...state, connected: a.value };
    case 'session':
      return { ...state, sessions: { ...state.sessions, [a.session.id]: a.session } };
    case 'turn': {
      const s = state.sessions[a.sessionId];
      if (!s) return state;
      const turns = s.turns.some((t) => t.id === a.turn.id)
        ? s.turns.map((t) => (t.id === a.turn.id ? a.turn : t))
        : [...s.turns, a.turn];
      return { ...state, sessions: { ...state.sessions, [s.id]: { ...s, turns } } };
    }
    case 'deleted': {
      const { [a.sessionId]: _, ...rest } = state.sessions;
      return { ...state, sessions: rest };
    }
    default:
      return state;
  }
}

const routeId = () => (location.hash.match(/^#\/s\/([\w-]+)/) || [])[1] || null;

function usePersistent(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue];
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [selectedId, setSelectedId] = useState(routeId);
  const [overlay, setOverlay] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState(null);
  const [incense, setIncense] = usePersistent('omnissiah.incense', true);
  const [awakened, setAwakened] = useState(() => sessionStorage.getItem('omnissiah.awake') === '1');
  const [navOpen, setNavOpen] = useState(false);

  const notify = useCallback((message, tone = 'error') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(() => {
    api.state().then((data) => dispatch({ type: 'state', data }), (e) => notify(e.message));
  }, [notify]);

  useEffect(() => {
    return subscribe(
      (msg) => {
        if (msg.type === 'hello') refresh();
        else dispatch(msg);
      },
      (ok) => dispatch({ type: 'connected', value: ok }),
    );
  }, [refresh]);

  useEffect(() => {
    const onHash = () => setSelectedId(routeId());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const sessions = useMemo(
    () => Object.values(state.sessions).sort((a, b) => b.updatedAt - a.updatedAt),
    [state.sessions],
  );

  const select = useCallback((id) => {
    location.hash = id ? `#/s/${id}` : '#/';
    setNavOpen(false);
  }, []);

  // Fall back to the most recent session when the route is empty or stale.
  useEffect(() => {
    if (!state.ready) return;
    if (selectedId && state.sessions[selectedId]) return;
    if (sessions[0]) select(sessions[0].id);
  }, [state.ready, selectedId, state.sessions, sessions, select]);

  const current = selectedId ? state.sessions[selectedId] : null;

  const createSession = async (body) => {
    try {
      const s = await api.create(body);
      dispatch({ type: 'session', session: s });
      select(s.id);
      setShowNew(false);
      return s;
    } catch (e) {
      notify(e.message);
      throw e;
    }
  };

  const ritual = {
    pray: () => setOverlay('pray'),
    bless: () => setOverlay('bless'),
    newSession: () => setShowNew(true),
    toggleIncense: () => {
      setIncense((v) => !v);
      notify(`Incense ${incense ? 'extinguished' : 'lit'}`, 'info');
    },
  };

  return (
    <div className={`forge ${navOpen ? 'nav-open' : ''}`}>
      <div className="grain" aria-hidden />
      <Sidebar
        sessions={sessions}
        selectedId={selectedId}
        onSelect={select}
        spirits={state.spirits}
        connected={state.connected}
        incense={incense}
        ritual={ritual}
      />
      <button className="nav-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      <main className="nave">
        <button className="nav-toggle" aria-label="Open sessions" onClick={() => setNavOpen(true)}>
          <span />
          <span />
          <span />
        </button>
        {!state.ready ? (
          <div className="void-state">
            <Seal size={140} spinning />
            <p className="litany-sm">Establishing noospheric link…</p>
          </div>
        ) : current ? (
          <SessionView
            key={current.id}
            session={current}
            spirits={state.spirits}
            incense={incense}
            ritual={ritual}
            notify={notify}
            onDeleted={() => select(null)}
          />
        ) : (
          <EmptyForge onNew={() => setShowNew(true)} config={state.config} />
        )}
      </main>

      {showNew && state.config && (
        <NewSession config={state.config} spirits={state.spirits} onCreate={createSession} onClose={() => setShowNew(false)} />
      )}
      {overlay === 'pray' && <Prayer onClose={() => setOverlay(null)} />}
      {overlay === 'bless' && <Blessing onClose={() => setOverlay(null)} />}
      {!awakened && incense && (
        <Awakening
          onDone={() => {
            sessionStorage.setItem('omnissiah.awake', '1');
            setAwakened(true);
          }}
        />
      )}
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
          <span className="toast-rune">{toast.tone === 'error' ? '☩' : '⛭'}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function EmptyForge({ onNew, config }) {
  return (
    <div className="void-state">
      <Seal size={200} />
      <h1 className="void-title">The Forge Awaits</h1>
      <p className="void-copy">
        No communion has been opened. Begin a session to offer petitions to the Machine Spirits of Claude Code or Cursor
        Agent — each session keeps its own memory, sanctum and litany.
      </p>
      <button className="btn btn-primary btn-lg" onClick={onNew}>
        <span className="btn-rune">✠</span> Open a Communion
      </button>
      {config?.cwd && <p className="litany-sm">Default sanctum · {config.cwd}</p>}
    </div>
  );
}
