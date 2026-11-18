import React, { useState } from 'react';
import Overlay from './Overlay.jsx';

export default function NewSession({ config, spirits, onCreate, onClose }) {
  const [name, setName] = useState('');
  const [tool, setTool] = useState(config.default_tool);
  const [cwd, setCwd] = useState(config.cwd || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreate({ name, tool, cwd });
    } catch {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose} className="overlay-form" label="New communion">
      <form className="panel" onSubmit={submit}>
        <h2 className="panel-title">
          <span>✠</span> Open a Communion
        </h2>
        <label className="label">
          Name of the rite
          <input className="field" autoFocus placeholder="Left blank, the Logis will choose" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="label">
          Machine Spirit
          <div className="spirit-cards">
            {spirits.map((s) => (
              <button
                type="button"
                key={s.id}
                className={`spirit-card ${tool === s.id ? 'on' : ''}`}
                onClick={() => setTool(s.id)}
                aria-pressed={tool === s.id}
              >
                <span className="spirit-card-name">{s.name}</span>
                <span className={`spirit-card-state ${s.path ? 'awake' : 'absent'}`}>
                  {s.path ? `awake · ${s.bin.split("/").pop()}` : `absent · ${s.bin} not on PATH`}
                </span>
              </button>
            ))}
          </div>
        </div>
        <label className="label">
          Sanctum (working directory)
          <input className="field mono" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="~/code/project" />
        </label>
        <div className="panel-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Consecrating…' : 'Consecrate'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
