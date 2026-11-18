#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, normalizeTool } from '../server/config.js';
import { createServer } from '../server/app.js';
import { expandPath } from '../server/forge.js';
import { SPIRITS, invoke, spiritStatus } from '../server/spirits.js';
import { line, wrapPrompt } from '../server/litany.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = {
  gold: (s) => `\x1b[38;2;212;175;55m${s}\x1b[0m`,
  red: (s) => `\x1b[38;2;200;40;45m${s}\x1b[0m`,
  cyan: (s) => `\x1b[38;2;80;220;230m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const HELP = `${c.gold('omnissiah')} — Tech-Priest session manager for AI coding

${c.gold('Usage')}
  omnissiah                       open the cogitator (web UI) in your browser
  omnissiah "refactor auth"       open it with a new session already petitioning
  omnissiah -t cursor             new sessions default to Cursor Agent
  omnissiah -p "scripted prompt"  one-shot: stream the answer to stdout, no UI
  omnissiah spirits               list Machine Spirits and whether they are installed

${c.gold('Options')}
  -t, --tool <claude-code|cursor>   Machine Spirit to use
  -p, --print                       one-shot print mode (prompt from args or stdin)
      --raw                         do not wrap the prompt in Tech-Priest meditation
      --cwd <dir>                   working directory (sanctum) for the spirit
      --port <n>                    port for the cogitator (default 4040)
      --no-open                     do not open a browser
      --dev                         also start the Vite dev server (hot reload)
  -h, --help                        show this litany
  -V, --version                     show version
`;

function parseArgs(argv) {
  const o = { prompt: [], open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) fail(`${a} needs a value`);
      return argv[++i];
    };
    if (o.rest) o.prompt.push(a);
    else if (a === '--') o.rest = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-V' || a === '--version') o.version = true;
    else if (a === '-p' || a === '--print') o.print = true;
    else if (a === '-t' || a === '--tool') o.tool = val();
    else if (a.startsWith('--tool=')) o.tool = a.slice(7);
    else if (a === '--raw') o.raw = true;
    else if (a === '--cwd') o.cwd = val();
    else if (a === '--port') o.port = Number(val());
    else if (a === '--no-open') o.open = false;
    else if (a === '--dev') o.dev = true;
    else if (a === '--no-incense') o.noIncense = true;
    else if (a.startsWith('-') && o.prompt.length === 0) fail(`unknown option ${a}`);
    else o.prompt.push(a);
  }
  return o;
}

function fail(msg) {
  console.error(`${c.red('HERESY:')} ${msg}`);
  process.exit(1);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return console.log(HELP);
  if (opts.version) {
    const { default: pkg } = await import('../package.json', { with: { type: 'json' } });
    return console.log(pkg.version);
  }

  const cfg = loadConfig();
  if (opts.tool) cfg.default_tool = normalizeTool(opts.tool) || fail(`unknown tool '${opts.tool}' (claude-code | cursor)`);
  if (opts.raw) cfg.wrap_prompt = false;
  if (opts.noIncense) cfg.incense = false;
  if (opts.port) cfg.port = opts.port;
  cfg.cwd = expandPath(opts.cwd || process.cwd());

  if (opts.prompt[0] === 'spirits' && opts.prompt.length === 1) return listSpirits(cfg);

  let prompt = opts.prompt.join(' ').trim();
  if (opts.print) {
    if (!prompt && !process.stdin.isTTY) prompt = (await readStdin()).trim();
    if (!prompt) fail('--print requires a prompt argument or stdin');
    process.exitCode = await oneShot(cfg, prompt);
    return;
  }
  await serve(cfg, opts, prompt);
}

function listSpirits(cfg) {
  console.log(c.gold('Known Machine Spirits under this forge:'));
  for (const s of spiritStatus(cfg)) {
    const mark = s.path ? c.cyan('● awake  ') : c.red('○ absent ');
    console.log(`  ${mark} ${s.id.padEnd(12)} → ${s.path || s.bin}`);
  }
  console.log(c.dim(`  default: ${cfg.default_tool}${cfg.configFile ? `   config: ${cfg.configFile}` : ''}`));
}

async function oneShot(cfg, prompt) {
  const tool = cfg.default_tool;
  const name = SPIRITS[tool].name;
  const sent = cfg.wrap_prompt ? wrapPrompt(prompt, name, cfg.reverence) : prompt;
  const turn = { blocks: [], live: '' };
  const printed = new Map();
  const seenTools = new Set();
  console.error(c.gold(`⚙ ${line('before_dispatch', name)}`));

  const render = () => {
    turn.blocks.forEach((b, i) => {
      if (b.kind === 'text') {
        const done = printed.get(i) || 0;
        if (b.text.length > done) {
          process.stdout.write((done === 0 && i > 0 ? '\n' : '') + b.text.slice(done));
          printed.set(i, b.text.length);
        }
      } else if (b.kind === 'tool' && !seenTools.has(b.id)) {
        seenTools.add(b.id);
        console.error(c.dim(`\n  ⛭ rite: ${b.name}`));
      }
    });
  };

  try {
    const { done } = invoke(tool, cfg, { prompt: sent, cwd: cfg.cwd, turn, onChange: render, onStderr: (d) => process.stderr.write(d) });
    const { code } = await done;
    render();
    process.stdout.write('\n');
    const ok = code === 0 && !turn.spiritError;
    console.error(ok ? c.gold(`⚙ ${line('success')}`) : c.red(`⚙ ${line('error', name)}`));
    return ok ? 0 : code || 1;
  } catch (err) {
    fail(err.message);
  }
}

async function serve(cfg, opts, prompt) {
  const { server, forge, close } = createServer(cfg);
  await new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') fail(`port ${cfg.port} is taken — is another cogitator already running? Try --port`);
      reject(err);
    });
    server.listen(cfg.port, '127.0.0.1', resolve);
  });

  let url = `http://127.0.0.1:${server.address().port}`;
  let vite;
  if (opts.dev) {
    vite = spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'), [], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, OMNISSIAH_PORT: String(server.address().port) },
    });
    url = 'http://127.0.0.1:5173';
  }

  if (prompt) {
    const s = forge.create({ tool: cfg.default_tool, cwd: cfg.cwd });
    forge.petition(s.id, prompt);
    url += `/#/s/${s.id}`;
  }

  console.log(`
  ${c.red('⛭')} ${c.gold('O M N I S S I A H')} ${c.red('⛭')}
  ${c.dim(line('greeting'))}

  Cogitator  ${c.cyan(url)}
  Sanctum    ${cfg.cwd}
  Spirits    ${spiritStatus(cfg).map((s) => (s.path ? c.cyan(s.short) : c.dim(`${s.short} (absent)`))).join('  ')}

  ${c.dim('Ctrl+C to seal the forge.')}
`);

  if (opts.open && cfg.open_browser) openBrowser(url);

  const shutdown = () => {
    console.log(c.dim('\n  The incense fades. Until the next communion.'));
    vite?.kill();
    close();
    setTimeout(() => process.exit(0), 200).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* no browser available — the URL is printed anyway */
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (buf += d));
    process.stdin.on('end', () => resolve(buf));
  });
}

main().catch((err) => fail(err.message));
