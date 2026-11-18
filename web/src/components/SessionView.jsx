import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Turn from './Turn.jsx';
import Composer from './Composer.jsx';
import Censer from './Censer.jsx';
import Seal from './Seal.jsx';
import { cost, shortPath } from '../format.js';

const REVERENCE = ['Plain', 'Whisper', 'Meditation', 'Divine Rite'];

export default function SessionView({ session, spirits, incense, ritual, notify, onDeleted }) {
  const logRef = useRef(null);
  const stick = useRef(true);
  const [editingName, setEditingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const last = session.turns.at(-1);
  const running = last?.status === 'running' || last?.status === 'aborting';
  const totalCost = session.turns.reduce((n, t) => n + (t.cost || 0), 0);
  const memory = session.spiritSessions?.[session.tool];

  const patch = (p) => api.update(session.id, p).catch((e) => notify(e.message));

  // Follow the stream unless the reader has scrolled up.
  const onScroll = () => {
    const el = logRef.current;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });

  useEffect(() => setConfirmDelete(false), [session.id]);

  const send = async (text) => {
    stick.current = true;
    try {
      await api.petition(session.id, text);
      return true;
    } catch (e) {
      notify(e.message);
      return false;
    }
  };

  const command = async (cmd, arg) => {
    switch (cmd) {
      case 'new':
        return ritual.newSession();
      case 'pray':
        return ritual.pray();
      case 'bless':
        return ritual.bless();
      case 'incense':
        return ritual.toggleIncense();
      case 'tool': {
        const t = /^cur|^agent/i.test(arg || '') ? 'cursor' : /^cl|^cc/i.test(arg || '') ? 'claude-code' : null;
        if (!t) return notify('Usage: /tool claude-code | cursor', 'info');
        await patch({ tool: t });
        return notify(`Attention shifts to the Machine Spirit of ${t === 'cursor' ? 'Cursor Agent' : 'Claude Code'}.`, 'info');
      }
      case 'raw':
        await patch({ wrap: !session.wrap });
        return notify(`Meditation wrapping ${session.wrap ? 'off' : 'on'}`, 'info');
      case 'reverence': {
        const n = Number(arg);
        if (!(n >= 0 && n <= 3)) return notify('Usage: /reverence 0-3', 'info');
        return patch({ reverence: n, wrap: n > 0 });
      }
      case 'rename':
        if (!arg) return setEditingName(true);
        return patch({ name: arg });
      case 'cd':
        if (!arg) return notify('Usage: /cd <directory>', 'info');
        await patch({ cwd: arg });
        return notify('Sanctum moved. The spirit’s memory is unbound.', 'info');
      case 'forget':
        await patch({ forget: true });
        return notify('The Machine Spirit forgets. The next petition opens a new communion.', 'info');
      case 'abort':
        return api.abort(session.id).catch((e) => notify(e.message));
      default:
        return notify(`Unknown rite '/${cmd}' — try /help`, 'info');
    }
  };

  const remove = async () => {
    try {
      await api.remove(session.id);
      onDeleted();
    } catch (e) {
      notify(e.message);
    }
  };

  return (
    <section className="session">
      <header className="session-head">
        <div className="session-title-row">
          {editingName ? (
            <input
              className="field field-title"
              autoFocus
              defaultValue={session.name}
              aria-label="Session name"
              onBlur={(e) => {
                setEditingName(false);
                if (e.target.value.trim() && e.target.value !== session.name) patch({ name: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditingName(false);
              }}
            />
          ) : (
            <h1 className="session-title" onDoubleClick={() => setEditingName(true)} title="Double-click to rename">
              {session.name}
            </h1>
          )}
          <div className="head-actions">
            {confirmDelete ? (
              <>
                <span className="litany-sm">Purge this record forever?</span>
                <button className="btn btn-danger btn-sm" onClick={remove}>
                  Purge
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
                  Spare
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(true)}>
                  Rename
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)} disabled={running}>
                  Purge
                </button>
              </>
            )}
          </div>
        </div>

        <div className="dataslate">
          <div className="spirit-switch" role="radiogroup" aria-label="Machine Spirit">
            {spirits.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={session.tool === s.id}
                className={`switch-opt ${session.tool === s.id ? 'on' : ''}`}
                disabled={running}
                onClick={() => patch({ tool: s.id })}
                title={s.path ? s.path : `${s.bin} not found on PATH`}
              >
                <i className={s.path ? 'awake' : 'absent'} />
                {s.name}
              </button>
            ))}
          </div>
          <Datum label="Sanctum" value={shortPath(session.cwd)} title={session.cwd} />
          <Datum
            label="Memory"
            value={memory ? `bound · ${memory.slice(0, 8)}` : 'unbound'}
            title={memory ? `Resumes spirit session ${memory}` : 'Next petition opens a new conversation'}
          />
          <Datum label="Reverence" value={session.wrap ? REVERENCE[session.reverence] : 'Raw'} />
          {totalCost > 0 && <Datum label="Tithe" value={cost(totalCost)} />}
        </div>

        <div className={`head-censer ${running ? 'on' : ''}`} aria-hidden>
          {incense ? <Censer size={30} swinging={running} smoke={running} /> : <Seal size={36} spinning={running} />}
        </div>
      </header>

      <div className="log" ref={logRef} onScroll={onScroll}>
        <div className="log-inner">
          <div className="greeting">
            <Seal size={72} />
            <p>{session.greeting || 'Hail the Omnissiah, the Divine Machine!'}</p>
            <p className="litany-sm">
              Communion opened {new Date(session.createdAt).toLocaleString()} · type <kbd>/help</kbd> for rites
            </p>
          </div>
          {session.turns.map((t, i) => (
            <Turn key={t.id} turn={t} index={i} />
          ))}
        </div>
      </div>

      <Composer
        sessionId={session.id}
        running={running}
        tool={session.tool}
        wrap={session.wrap}
        reverence={session.reverence}
        onSend={send}
        onCommand={command}
        onAbort={() => command('abort')}
        onReverence={(n) => patch({ reverence: n, wrap: n > 0 })}
      />
    </section>
  );
}

function Datum({ label, value, title }) {
  return (
    <div className="datum" title={title}>
      <span className="datum-label">{label}</span>
      <span className="datum-value">{value}</span>
    </div>
  );
}
