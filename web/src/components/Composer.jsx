import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const RITES = [
  ['/help', 'Show this litany'],
  ['/new', 'Open a new communion'],
  ['/tool', 'Switch spirit: claude-code | cursor'],
  ['/reverence', 'Meditation level 0–3'],
  ['/raw', 'Toggle meditation wrapping'],
  ['/forget', 'Unbind the spirit’s memory (fresh conversation)'],
  ['/cd', 'Move the sanctum (working directory)'],
  ['/rename', 'Rename this communion'],
  ['/abort', 'Sever the running rite'],
  ['/pray', 'Recite the Litany of the Omnissiah'],
  ['/bless', 'Swing the incense'],
  ['/incense', 'Toggle animations'],
];

const LEVELS = ['Raw', 'Whisper', 'Meditation', 'Divine'];
const drafts = new Map();

export default function Composer({ sessionId, running, tool, wrap, reverence, onSend, onCommand, onAbort, onReverence }) {
  const [text, setText] = useState(() => drafts.get(sessionId) || '');
  const [showHelp, setShowHelp] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const history = useRef({ list: [], idx: -1 });

  useEffect(() => {
    drafts.set(sessionId, text);
  }, [sessionId, text]);

  useEffect(() => {
    ref.current?.focus();
  }, [sessionId]);

  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [text]);

  const slash = text.startsWith('/') && !text.includes(' ') && !text.includes('\n');
  const matches = slash ? RITES.filter(([c]) => c.startsWith(text.toLowerCase())) : [];

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    if (value.startsWith('/')) {
      const [, cmd, arg] = value.match(/^\/(\S+)\s*([\s\S]*)$/) || [];
      setText('');
      if (cmd === 'help' || cmd === '?') return setShowHelp(true);
      return onCommand(cmd.toLowerCase(), arg.trim());
    }
    if (running) return;
    history.current = { list: [value, ...history.current.list.filter((h) => h !== value)].slice(0, 50), idx: -1 };
    setText('');
    const ok = await onSend(value);
    if (!ok) setText(value);
  };

  const onKeyDown = (e) => {
    if (matches.length && (e.key === 'Tab' || (e.key === 'Enter' && matches[hi] && text !== matches[hi][0]))) {
      e.preventDefault();
      setText(`${matches[hi][0]} `);
      return;
    }
    if (matches.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setHi((h) => (h + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'Escape') {
      if (running) onAbort();
      setShowHelp(false);
      return;
    }
    const h = history.current;
    if (e.key === 'ArrowUp' && !text && h.list.length) {
      e.preventDefault();
      h.idx = Math.min(h.idx + 1, h.list.length - 1);
      setText(h.list[h.idx]);
    } else if (e.key === 'ArrowDown' && h.idx >= 0 && text === h.list[h.idx]) {
      e.preventDefault();
      h.idx -= 1;
      setText(h.idx >= 0 ? h.list[h.idx] : '');
    }
  };

  useEffect(() => setHi(0), [text]);

  return (
    <div className="composer-wrap">
      {(matches.length > 0 || showHelp) && (
        <div className="rite-menu" role="listbox" aria-label="Rites">
          {(showHelp ? RITES : matches).map(([c, d], i) => (
            <button
              key={c}
              role="option"
              aria-selected={!showHelp && i === hi}
              className={`rite-opt ${!showHelp && i === hi ? 'hi' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowHelp(false);
                setText(`${c} `);
                ref.current.focus();
              }}
            >
              <code>{c}</code>
              <span>{d}</span>
            </button>
          ))}
          {showHelp && (
            <p className="rite-menu-foot">
              Enter offers · Shift+Enter new line · ↑ recalls · Esc severs a running rite
            </p>
          )}
        </div>
      )}

      <div className={`composer ${running ? 'busy' : ''}`}>
        <span className="composer-prompt" aria-hidden>
          ⚙ <b>[{tool === 'cursor' ? 'cursor' : 'claude'}]</b> ›
        </span>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={running ? 'The spirit labours… (Esc to sever)' : 'Offer a petition to the Machine Spirit, or / for rites'}
          onChange={(e) => {
            setText(e.target.value);
            setShowHelp(false);
          }}
          onKeyDown={onKeyDown}
          aria-label="Petition"
        />
        {running ? (
          <button className="btn btn-danger" onClick={onAbort}>
            Sever
          </button>
        ) : (
          <button className="btn btn-primary" onClick={submit} disabled={!text.trim()}>
            Offer
          </button>
        )}
      </div>

      <div className="composer-foot">
        <div className="reverence" role="radiogroup" aria-label="Reverence">
          {LEVELS.map((l, i) => {
            const on = wrap ? reverence === i : i === 0;
            return (
              <button key={l} role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => onReverence(i)} title={`Reverence ${i}`}>
                {l}
              </button>
            );
          })}
        </div>
        <span className="litany-sm">Enter to offer · Shift+Enter for new line · / for rites</span>
      </div>
    </div>
  );
}
