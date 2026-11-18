import React, { memo, useEffect, useState } from 'react';
import Markdown from './Markdown.jsx';
import { cost, duration, hexStamp, roman } from '../format.js';

const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'notebook_path', 'description', 'prompt'];

function toolSummary(input) {
  if (!input || typeof input !== 'object') return '';
  for (const k of SUMMARY_KEYS) {
    if (typeof input[k] === 'string' && input[k]) return input[k];
  }
  if (Array.isArray(input.todos)) return `${input.todos.length} tasks`;
  const first = Object.values(input).find((v) => typeof v === 'string');
  return first || '';
}

function ToolRite({ block }) {
  const [open, setOpen] = useState(false);
  const summary = toolSummary(block.input);
  const todos = Array.isArray(block.input?.todos) ? block.input.todos : null;
  return (
    <div className={`rite rite-${block.status}`}>
      <button className="rite-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="rite-gear" aria-hidden>
          ⛭
        </span>
        <span className="rite-name">{block.name}</span>
        <span className="rite-summary">{summary.split('\n')[0]}</span>
        <span className="rite-state">{block.status === 'running' ? 'in rite' : block.status === 'error' ? 'heresy' : 'sanctified'}</span>
        <span className={`rite-caret ${open ? 'open' : ''}`} aria-hidden>
          ▸
        </span>
      </button>
      {todos && !open && (
        <ul className="rite-todos">
          {todos.map((t, i) => (
            <li key={i} className={`todo-${t.status}`}>
              <span aria-hidden>{t.status === 'completed' ? '✠' : t.status === 'in_progress' ? '⛭' : '○'}</span>
              {t.content || t.activeForm}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="rite-body">
          <div className="rite-label">Invocation</div>
          <pre>{JSON.stringify(block.input, null, 2)}</pre>
          {block.result != null && block.result !== '' && (
            <>
              <div className="rite-label">{block.status === 'error' ? 'Heresy reported' : 'Response'}</div>
              <pre>{block.result}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Elapsed({ since }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return duration(now - since);
}

function Contemplation() {
  return (
    <div className="contemplation" aria-live="polite">
      <span className="binary-stream" aria-hidden>
        01001111 01001101 01001110 01001001
      </span>
      <span>The Machine Spirit contemplates…</span>
    </div>
  );
}

function Turn({ turn, index }) {
  const [showSent, setShowSent] = useState(false);
  const running = turn.status === 'running' || turn.status === 'aborting';
  const elapsed = (turn.endedAt || Date.now()) - turn.startedAt;
  const spirit = turn.tool === 'cursor' ? 'Cursor Agent' : 'Claude Code';

  return (
    <article className={`turn turn-${turn.status}`}>
      <header className="petition">
        <div className="petition-label">
          <span className="petition-num">Petition {roman(index + 1)}</span>
          <span className="petition-meta">
            {hexStamp(turn.startedAt)} · {spirit}
            {turn.resumed ? ' · memory bound' : ' · new communion'}
          </span>
          {turn.sent !== turn.prompt && (
            <button className="link-btn" onClick={() => setShowSent((v) => !v)}>
              {showSent ? 'hide meditation' : 'view meditation'}
            </button>
          )}
        </div>
        <div className="petition-text">{turn.prompt}</div>
        {showSent && <pre className="petition-sent">{turn.sent}</pre>}
      </header>

      <p className="priest-line">
        <span aria-hidden>✠</span> {turn.before}
      </p>

      <div className="response">
        {turn.blocks.map((b, i) =>
          b.kind === 'tool' ? (
            <ToolRite key={b.id || i} block={b} />
          ) : b.kind === 'thought' ? (
            <details key={i} className="thought">
              <summary>Cogitation</summary>
              <Markdown text={b.text} />
            </details>
          ) : b.raw ? (
            <pre key={i} className="raw-out">
              {b.text}
            </pre>
          ) : (
            <Markdown key={i} text={b.text} />
          ),
        )}
        {turn.live && <Markdown text={turn.live} className="live" />}
        {running && !turn.live && <Contemplation />}
        {turn.spiritError && <div className="heresy">☩ {turn.spiritError}</div>}
        {turn.stderr && (turn.status === 'error' || !turn.blocks.length) && (
          <details className="stderr" open={turn.status === 'error' && !turn.blocks.length}>
            <summary>Machine-spirit murmurs (stderr)</summary>
            <pre>{turn.stderr}</pre>
          </details>
        )}
      </div>

      <footer className="turn-foot">
        {running ? (
          <span className="status status-running">
            <span className="spin" aria-hidden>
              ⛭
            </span>
            {turn.status === 'aborting' ? 'Severing the rite…' : <>In rite · <Elapsed since={turn.startedAt} /></>}
          </span>
        ) : (
          <>
            <span className={`status status-${turn.status}`}>{turn.after}</span>
            <span className="turn-stats">
              {duration(turn.durationMs ?? elapsed)}
              {turn.cost != null && ` · ${cost(turn.cost)}`}
              {turn.exitCode ? ` · exit ${turn.exitCode}` : ''}
            </span>
          </>
        )}
      </footer>
    </article>
  );
}

export default memo(Turn);
