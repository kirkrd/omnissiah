import React, { useEffect, useState } from 'react';
import Seal from './Seal.jsx';
import { relTime } from '../format.js';

export default function Sidebar({ sessions, selectedId, onSelect, spirits, connected, incense, ritual }) {
  const [filter, setFilter] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const anyRunning = sessions.some((s) => s.turns.at(-1)?.status === 'running');
  const q = filter.trim().toLowerCase();
  const shown = q ? sessions.filter((s) => `${s.name} ${s.cwd}`.toLowerCase().includes(q)) : sessions;

  return (
    <aside className="reliquary">
      <header className="brand">
        <Seal size={64} active={anyRunning} spinning={anyRunning} />
        <div>
          <div className="brand-name">Omnissiah</div>
          <div className="brand-sub">Cogitator of the Forge</div>
        </div>
      </header>

      <button className="btn btn-primary btn-block" onClick={ritual.newSession}>
        <span className="btn-rune">✠</span> New Communion
      </button>

      {sessions.length > 4 && (
        <input
          className="field field-search"
          placeholder="Search the archives…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Search sessions"
        />
      )}

      <div className="section-label">
        <span>Communions</span>
        <span className="count">{sessions.length}</span>
      </div>

      <nav className="session-list" aria-label="Sessions">
        {shown.map((s) => {
          const last = s.turns.at(-1);
          const status = last?.status === 'aborting' ? 'running' : last?.status || 'idle';
          return (
            <button
              key={s.id}
              className={`session-item ${s.id === selectedId ? 'selected' : ''} st-${status}`}
              onClick={() => onSelect(s.id)}
              aria-current={s.id === selectedId ? 'page' : undefined}
            >
              <span className="session-rune" aria-hidden>
                {status === 'running' ? '⛭' : status === 'error' ? '☩' : status === 'aborted' ? '⊘' : '✠'}
              </span>
              <span className="session-text">
                <span className="session-name">{s.name}</span>
                <span className="session-meta">
                  <span className={`chip chip-${s.tool}`}>{s.tool === 'cursor' ? 'cursor' : 'claude'}</span>
                  {s.turns.length} petition{s.turns.length === 1 ? '' : 's'} · {relTime(s.updatedAt)}
                </span>
              </span>
            </button>
          );
        })}
        {!shown.length && <p className="litany-sm pad">{q ? 'No record matches.' : 'The archives are empty.'}</p>}
      </nav>

      <footer className="reliquary-foot">
        <div className="spirit-status">
          {spirits.map((s) => (
            <span key={s.id} className={`spirit-dot ${s.path ? 'awake' : 'absent'}`} title={s.path || `${s.bin} not found on PATH`}>
              <i /> {s.short}
            </span>
          ))}
          <span className={`spirit-dot ${connected ? 'awake' : 'absent'}`} title="Noospheric link to the forge">
            <i /> noosphere
          </span>
        </div>
        <div className="rite-buttons">
          <button className="btn btn-ghost btn-sm" onClick={ritual.pray} title="/pray">
            Pray
          </button>
          <button className="btn btn-ghost btn-sm" onClick={ritual.bless} title="/bless">
            Bless
          </button>
          <button
            className={`btn btn-ghost btn-sm ${incense ? 'on' : ''}`}
            onClick={ritual.toggleIncense}
            title="/incense — animations"
            aria-pressed={incense}
          >
            Incense
          </button>
        </div>
      </footer>
    </aside>
  );
}
