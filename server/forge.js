import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store, newId } from './store.js';
import { SPIRITS, invoke } from './spirits.js';
import { line, wrapPrompt } from './litany.js';
import { clamp, normalizeTool } from './config.js';

const NAMES = [
  'Rite of Refactoring', 'Canticle of Tests', 'Litany of Bugfixing', 'Benediction of Types',
  'Rite of Migration', 'Psalm of the Pipeline', 'Catechism of the Schema', 'Invocation of Docs',
];

export function expandPath(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}

function assertDir(dir) {
  let st;
  try {
    st = fs.statSync(dir);
  } catch {
    throw httpError(400, `No such sanctum: ${dir}`);
  }
  if (!st.isDirectory()) throw httpError(400, `Not a directory: ${dir}`);
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * The Forge owns sessions and running rites, and emits `update` events:
 *   { type: 'session', session }               — full session snapshot
 *   { type: 'turn', sessionId, turn }          — one turn changed (streaming)
 *   { type: 'deleted', sessionId }
 */
export class Forge extends EventEmitter {
  constructor(cfg, dataDir) {
    super();
    this.cfg = cfg;
    this.store = new Store(dataDir);
    this.running = new Map(); // sessionId -> { child, turnId }
    this.pending = new Map(); // turnId -> timer (throttled emits)
  }

  list() {
    return this.store.list();
  }

  get(id) {
    const s = this.store.get(id);
    if (!s) throw httpError(404, 'Session not found in the Noosphere');
    return s;
  }

  create({ name, tool, cwd, wrap, reverence } = {}) {
    const dir = expandPath(cwd || this.cfg.cwd || process.cwd());
    assertDir(dir);
    const now = Date.now();
    const session = {
      id: newId(),
      name: (name || '').trim() || `${NAMES[this.store.sessions.size % NAMES.length]} ${romanize(this.store.sessions.size + 1)}`,
      tool: normalizeTool(tool) || this.cfg.default_tool,
      cwd: dir,
      wrap: wrap ?? this.cfg.wrap_prompt,
      reverence: clamp(Number(reverence ?? this.cfg.reverence) | 0, 0, 3),
      spiritSessions: {},
      createdAt: now,
      updatedAt: now,
      greeting: line('greeting'),
      turns: [],
    };
    this.store.put(session);
    this.emitSession(session);
    return session;
  }

  update(id, patch = {}) {
    const s = this.get(id);
    if (patch.name != null) s.name = String(patch.name).trim().slice(0, 120) || s.name;
    if (patch.tool != null) {
      const t = normalizeTool(patch.tool);
      if (!t) throw httpError(400, `Unknown Machine Spirit '${patch.tool}'`);
      if (this.running.has(id) && t !== s.tool) throw httpError(409, 'Cannot change spirits mid-rite');
      s.tool = t;
    }
    if (patch.cwd != null) {
      if (this.running.has(id)) throw httpError(409, 'Cannot move sanctum mid-rite');
      const dir = expandPath(patch.cwd);
      assertDir(dir);
      if (dir !== s.cwd) s.spiritSessions = {}; // a spirit's memory is bound to its sanctum
      s.cwd = dir;
    }
    if (patch.wrap != null) s.wrap = !!patch.wrap;
    if (patch.reverence != null) s.reverence = clamp(Number(patch.reverence) | 0, 0, 3);
    if (patch.forget) s.spiritSessions = {};
    s.updatedAt = Date.now();
    this.store.put(s);
    this.emitSession(s);
    return s;
  }

  remove(id) {
    this.get(id);
    this.abort(id);
    this.store.remove(id);
    this.emit('update', { type: 'deleted', sessionId: id });
  }

  petition(id, text) {
    const s = this.get(id);
    const prompt = String(text || '').trim();
    if (!prompt) throw httpError(400, 'An empty petition offends the Machine God');
    if (this.running.has(id)) throw httpError(409, 'A rite is already in progress for this session');

    const spirit = SPIRITS[s.tool];
    const sent = s.wrap ? wrapPrompt(prompt, spirit.name, s.reverence) : prompt;
    const resumeId = s.spiritSessions?.[s.tool] || null;
    const turn = {
      id: newId(),
      tool: s.tool,
      prompt,
      sent,
      resumed: !!resumeId,
      status: 'running',
      startedAt: Date.now(),
      endedAt: null,
      blocks: [],
      live: '',
      stderr: '',
      before: line('before_dispatch', spirit.name),
      after: null,
    };
    s.turns.push(turn);
    s.updatedAt = Date.now();
    this.store.put(s);
    this.emitSession(s);

    let rite;
    try {
      rite = invoke(s.tool, this.cfg, {
        prompt: sent,
        resumeId,
        cwd: s.cwd,
        turn,
        onSessionId: (sid) => {
          s.spiritSessions = { ...s.spiritSessions, [turn.tool]: sid };
        },
        onChange: () => this.emitTurn(s, turn),
        onStderr: (d) => {
          turn.stderr = (turn.stderr + d).slice(-8000);
          this.emitTurn(s, turn);
        },
      });
    } catch (err) {
      this.finish(s, turn, 'error', 1, err.message);
      return turn;
    }
    this.running.set(id, { child: rite.child, turnId: turn.id });
    rite.done.then(
      ({ code }) => {
        const aborted = turn.status === 'aborting';
        const failed = code !== 0 || !!turn.spiritError;
        this.finish(s, turn, aborted ? 'aborted' : failed ? 'error' : 'done', code);
      },
      (err) => this.finish(s, turn, 'error', 1, err.message),
    );
    return turn;
  }

  finish(s, turn, status, code, message) {
    this.running.delete(s.id);
    turn.status = status;
    turn.exitCode = code;
    turn.endedAt = Date.now();
    turn.live = '';
    if (message) turn.spiritError = message;
    const spirit = SPIRITS[turn.tool].name;
    turn.after = line(status === 'done' ? 'success' : status === 'aborted' ? 'aborted' : 'error', spirit);
    s.updatedAt = Date.now();
    this.store.put(s);
    this.flushTurn(turn.id);
    this.emitSession(s);
  }

  abort(id) {
    const r = this.running.get(id);
    if (!r) return false;
    const s = this.store.get(id);
    const turn = s?.turns.find((t) => t.id === r.turnId);
    if (turn) turn.status = 'aborting';
    r.child.kill('SIGTERM');
    setTimeout(() => {
      if (r.child.exitCode == null && r.child.signalCode == null) r.child.kill('SIGKILL');
    }, 3000).unref();
    return true;
  }

  shutdown() {
    for (const id of this.running.keys()) this.abort(id);
    this.store.flush();
  }

  emitSession(s) {
    this.emit('update', { type: 'session', session: s });
  }

  // Streaming produces many tiny updates; coalesce them to ~20/s per turn.
  emitTurn(s, turn) {
    if (this.pending.has(turn.id)) return;
    this.pending.set(
      turn.id,
      setTimeout(() => {
        this.pending.delete(turn.id);
        this.emit('update', { type: 'turn', sessionId: s.id, turn });
      }, 50),
    );
  }

  flushTurn(turnId) {
    clearTimeout(this.pending.get(turnId));
    this.pending.delete(turnId);
  }
}

function romanize(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
}
