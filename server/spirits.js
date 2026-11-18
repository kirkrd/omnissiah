import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const SPIRITS = {
  'claude-code': { name: 'Claude Code', short: 'claude', binKey: 'claude_bin', argsKey: 'claude_args' },
  cursor: { name: 'Cursor Agent', short: 'cursor', binKey: 'cursor_bin', argsKey: 'cursor_args' },
};

/** Resolve a binary on PATH (or as a path). Returns absolute path or null. */
export function which(bin) {
  if (!bin) return null;
  const candidates = bin.includes('/')
    ? [path.resolve(bin)]
    : (process.env.PATH || '').split(path.delimiter).filter(Boolean).map((d) => path.join(d, bin));
  for (const c of candidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      if (fs.statSync(c).isFile()) return c;
    } catch {
      /* keep searching */
    }
  }
  return null;
}

export function spiritStatus(cfg) {
  return Object.entries(SPIRITS).map(([id, s]) => ({
    id,
    name: s.name,
    short: s.short,
    bin: cfg[s.binKey],
    path: which(cfg[s.binKey]),
  }));
}

/** Split an args string honouring simple quotes. */
export function splitArgs(str) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(str || ''))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/**
 * Build argv + stdin for a headless dispatch.
 * Claude Code reads the prompt from stdin so variadic flags in `claude_args` can't swallow it.
 */
export function buildInvocation(tool, cfg, prompt, resumeId) {
  const spirit = SPIRITS[tool];
  if (!spirit) throw new Error(`unknown Machine Spirit '${tool}'`);
  const extra = splitArgs(cfg[spirit.argsKey]);
  const resume = resumeId ? ['--resume', resumeId] : [];
  if (tool === 'claude-code') {
    return {
      bin: cfg.claude_bin,
      args: ['--print', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', ...resume, ...extra],
      stdin: prompt,
    };
  }
  return {
    bin: cfg.cursor_bin,
    args: ['--print', '--output-format', 'stream-json', ...resume, ...extra, prompt],
    stdin: null,
  };
}

const MAX_RESULT = 6000;

function clip(text, max = MAX_RESULT) {
  if (text == null) return '';
  const s = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  return s.length > max ? `${s.slice(0, max)}\n… (${s.length - max} more characters withheld by the Logis)` : s;
}

function toolResultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content))
    return content.map((c) => (c.type === 'text' ? c.text : c.type === 'image' ? '[image]' : JSON.stringify(c))).join('\n');
  return JSON.stringify(content);
}

/**
 * Turns a stream of JSON lines (Claude Code / Cursor Agent `stream-json`) into
 * a list of renderable blocks on `turn`. Calls `onChange()` after each mutation.
 */
export class StreamParser {
  constructor(turn, { onSessionId, onChange } = {}) {
    this.turn = turn;
    this.onSessionId = onSessionId || (() => {});
    this.onChange = onChange || (() => {});
    this.tools = new Map();
    this.buffer = '';
  }

  feed(chunk) {
    this.buffer += chunk;
    let nl;
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const lineStr = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (lineStr) this.line(lineStr);
    }
  }

  flush() {
    const rest = this.buffer.trim();
    this.buffer = '';
    if (rest) this.line(rest);
    this.turn.live = '';
  }

  pushText(text) {
    if (!text) return;
    const last = this.turn.blocks.at(-1);
    if (last && last.kind === 'text' && last.raw) last.text += text;
    else this.turn.blocks.push({ kind: 'text', text });
  }

  line(str) {
    let ev;
    try {
      ev = JSON.parse(str);
    } catch {
      // Not JSON: a plain-text spirit. Show it verbatim.
      const last = this.turn.blocks.at(-1);
      if (last && last.kind === 'text' && last.raw) last.text += `${str}\n`;
      else this.turn.blocks.push({ kind: 'text', text: `${str}\n`, raw: true });
      this.onChange();
      return;
    }
    if (ev && typeof ev.session_id === 'string' && ev.session_id) this.onSessionId(ev.session_id);
    this.event(ev);
    this.onChange();
  }

  event(ev) {
    const t = this.turn;
    switch (ev?.type) {
      case 'system':
        if (ev.subtype === 'init') {
          if (ev.model) t.model = ev.model;
          if (ev.cwd) t.cwd = ev.cwd;
        }
        break;
      case 'stream_event': {
        const e = ev.event || {};
        if (e.type === 'message_start') t.live = '';
        else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') t.live += e.delta.text || '';
        break;
      }
      case 'assistant': {
        t.live = '';
        for (const c of ev.message?.content || []) {
          if (c.type === 'text') this.pushText(c.text);
          else if (c.type === 'tool_use') {
            const block = { kind: 'tool', id: c.id, name: c.name, input: c.input, status: 'running' };
            this.tools.set(c.id, block);
            t.blocks.push(block);
          } else if (c.type === 'thinking' && c.thinking) {
            t.blocks.push({ kind: 'thought', text: c.thinking });
          }
        }
        if (ev.message?.usage) t.usage = ev.message.usage;
        break;
      }
      case 'user': {
        const content = ev.message?.content;
        if (!Array.isArray(content)) break;
        for (const c of content) {
          if (c.type !== 'tool_result') continue;
          const block = this.tools.get(c.tool_use_id);
          if (!block) continue;
          block.result = clip(toolResultText(c.content));
          block.status = c.is_error ? 'error' : 'done';
        }
        break;
      }
      case 'tool_call': {
        // Cursor Agent: { subtype: started|completed, call_id, tool_call: { <name>ToolCall: { args, result } } }
        const [key, body] = Object.entries(ev.tool_call || {})[0] || [];
        const name = (key || 'tool').replace(/ToolCall$/, '');
        const id = ev.call_id || `${name}-${this.tools.size}`;
        if (ev.subtype === 'started') {
          const block = { kind: 'tool', id, name, input: body?.args ?? {}, status: 'running' };
          this.tools.set(id, block);
          t.blocks.push(block);
        } else if (ev.subtype === 'completed') {
          const block = this.tools.get(id);
          if (block) {
            const res = body?.result;
            const failed = res && (res.error || res.failure || res.rejected);
            block.result = clip(res?.success ?? res ?? '');
            block.status = failed ? 'error' : 'done';
          }
        }
        break;
      }
      case 'result': {
        t.live = '';
        if (typeof ev.total_cost_usd === 'number') t.cost = ev.total_cost_usd;
        if (typeof ev.duration_ms === 'number') t.durationMs = ev.duration_ms;
        if (typeof ev.num_turns === 'number') t.numTurns = ev.num_turns;
        if (ev.is_error) t.spiritError = typeof ev.result === 'string' ? ev.result : ev.subtype || 'error';
        if (!t.blocks.some((b) => b.kind === 'text') && typeof ev.result === 'string') this.pushText(ev.result);
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Spawn a Machine Spirit headlessly. Returns { child, done: Promise<exitCode> }.
 */
export function invoke(tool, cfg, { prompt, resumeId, cwd, turn, onSessionId, onChange, onStderr }) {
  const inv = buildInvocation(tool, cfg, prompt, resumeId);
  const parser = new StreamParser(turn, { onSessionId, onChange });
  const child = spawn(inv.bin, inv.args, {
    cwd,
    env: process.env,
    stdio: [inv.stdin == null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  if (inv.stdin != null) {
    child.stdin.on('error', () => {});
    child.stdin.end(inv.stdin);
  }
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => parser.feed(d));
  child.stderr.on('data', (d) => onStderr?.(d));
  const done = new Promise((resolve, reject) => {
    child.on('error', (err) => {
      if (err.code === 'ENOENT')
        reject(new Error(`failed to awaken Machine Spirit '${inv.bin}' — is it installed and on PATH?`));
      else reject(err);
    });
    child.on('close', (code, signal) => {
      parser.flush();
      onChange?.();
      resolve({ code: code ?? (signal ? 130 : 1), signal });
    });
  });
  return { child, done };
}
