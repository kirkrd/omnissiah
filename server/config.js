import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULTS = {
  claude_bin: 'claude',
  cursor_bin: 'agent',
  default_tool: 'claude-code',
  reverence: 2,
  incense: true,
  wrap_prompt: true,
  // Extra CLI args appended to every dispatch, e.g. "--permission-mode acceptEdits"
  claude_args: '',
  cursor_args: '',
  port: 4040,
  open_browser: true,
};

const CONFIG_NAMES = ['.omnissiah.toml', '.tech-priest.toml'];

export function findConfigFile(start = process.cwd()) {
  const dirs = [];
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    dirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const home = os.homedir();
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  for (const d of dirs) {
    for (const name of CONFIG_NAMES) {
      const p = path.join(d, name);
      if (isFile(p)) return p;
    }
  }
  const global = path.join(xdg, 'omnissiah', 'config.toml');
  if (isFile(global)) return global;
  return null;
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Minimal flat `key = value` TOML reader — enough for this config. */
export function parseConfig(raw) {
  const cfg = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line || line.startsWith('[')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (!(key in DEFAULTS)) continue;
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    const def = DEFAULTS[key];
    if (typeof def === 'boolean') cfg[key] = /^(true|1|yes|on)$/i.test(val);
    else if (typeof def === 'number') {
      const n = Number(val);
      if (Number.isFinite(n)) cfg[key] = n;
    } else cfg[key] = val;
  }
  return cfg;
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#') return line.slice(0, i);
  }
  return line;
}

export function loadConfig() {
  const file = findConfigFile();
  let cfg = { ...DEFAULTS };
  if (file) cfg = { ...cfg, ...parseConfig(fs.readFileSync(file, 'utf8')) };
  const env = process.env;
  if (env.OMNISSIAH_CLAUDE_BIN) cfg.claude_bin = env.OMNISSIAH_CLAUDE_BIN;
  if (env.OMNISSIAH_CURSOR_BIN) cfg.cursor_bin = env.OMNISSIAH_CURSOR_BIN;
  if (env.OMNISSIAH_DEFAULT_TOOL) cfg.default_tool = env.OMNISSIAH_DEFAULT_TOOL;
  if (env.OMNISSIAH_REVERENCE && Number.isFinite(Number(env.OMNISSIAH_REVERENCE)))
    cfg.reverence = Number(env.OMNISSIAH_REVERENCE);
  if (env.OMNISSIAH_PORT && Number.isFinite(Number(env.OMNISSIAH_PORT)))
    cfg.port = Number(env.OMNISSIAH_PORT);
  cfg.reverence = clamp(Math.round(cfg.reverence), 0, 3);
  cfg.default_tool = normalizeTool(cfg.default_tool) || 'claude-code';
  cfg.configFile = file;
  return cfg;
}

export function normalizeTool(name) {
  switch (String(name || '').toLowerCase()) {
    case 'claude':
    case 'claude-code':
    case 'claude_code':
    case 'cc':
      return 'claude-code';
    case 'cursor':
    case 'agent':
    case 'cursor-agent':
    case 'cursor_agent':
      return 'cursor';
    default:
      return null;
  }
}

export function dataDir() {
  const base = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return process.env.OMNISSIAH_DATA_DIR || path.join(base, 'omnissiah');
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
