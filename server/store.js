import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Persists sessions as one JSON file, written atomically and debounced. */
export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'sessions.json');
    this.sessions = new Map();
    this.timer = null;
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const s of data.sessions || []) {
        // A rite that was running when the forge went down cannot be resumed.
        for (const t of s.turns || []) {
          if (t.status === 'running' || t.status === 'aborting') {
            t.status = 'aborted';
            t.live = '';
            t.endedAt ??= Date.now();
          }
        }
        this.sessions.set(s.id, s);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(`omnissiah: could not read ${this.file}: ${err.message}`);
    }
  }

  list() {
    return [...this.sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id) {
    return this.sessions.get(id);
  }

  put(session) {
    this.sessions.set(session.id, session);
    this.save();
  }

  remove(id) {
    this.sessions.delete(id);
    this.save();
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, sessions: this.list() }));
    fs.renameSync(tmp, this.file);
  }
}

export const newId = () => crypto.randomUUID();
