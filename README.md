# Omnissiah

A Warhammer 40k–flavoured **session manager for AI coding**. Omnissiah runs a local cogitator (web UI) where you open
*communions* — persistent sessions with Claude Code or Cursor Agent — and offer petitions to them. Each petition is
dispatched headlessly (`--print --output-format stream-json`) and streamed back live: text, tool rites, todo lists,
cost and duration.

- **Multiple sessions**, each with its own name, Machine Spirit, working directory (sanctum) and memory.
  Follow-ups resume the exact spirit conversation (`--resume <id>`), not just "the last one in this folder".
- **Live streaming** of responses, tool calls (expandable invocation + result), and TodoWrite progress.
- **Rites**: `/tool`, `/reverence`, `/forget`, `/cd`, `/abort`, `/pray`, `/bless`… (type `/` in the composer).
- Sessions persist in `$XDG_DATA_HOME/omnissiah/sessions.json` and survive restarts.
- `omnissiah -p` still works as a one-shot for scripts.

## Install

Requires Node 20+.

```fish
git clone https://github.com/kirkrd/omnissiah.git
cd omnissiah
npm install
npm run build
npm link        # puts `omnissiah` on PATH
```

## Usage

```fish
omnissiah                         # open the cogitator at http://127.0.0.1:4040
omnissiah "refactor auth"         # …with a new session already petitioning
omnissiah -t cursor               # new sessions default to Cursor Agent
omnissiah --cwd ~/code/app        # default sanctum for new sessions
omnissiah -p "scripted prompt"    # one-shot to stdout, no UI
omnissiah spirits                 # which spirits are installed
```

In the composer: **Enter** offers, **Shift+Enter** adds a line, **↑** recalls, **Esc** severs a running rite.

| Rite | Effect |
|------|--------|
| `/new` | Open a new communion |
| `/tool claude-code\|cursor` | Switch Machine Spirit |
| `/reverence 0-3` | How much Tech-Priest meditation wraps the prompt |
| `/raw` | Toggle prompt wrapping |
| `/forget` | Start a fresh spirit conversation in this session |
| `/cd <dir>` | Move the session's working directory |
| `/rename <name>` | Rename the session |
| `/abort` | Stop the running rite |
| `/pray`, `/bless`, `/incense` | Litany, censer, toggle animations |

## Permissions

Headless Claude Code / Cursor Agent cannot prompt you for tool approval. Pass the permission flags you want through
`claude_args` / `cursor_args` in the config, e.g. `claude_args = "--permission-mode acceptEdits"`.

## Config

`.omnissiah.toml` (searched upward from the current directory) or `~/.config/omnissiah/config.toml` —
see [`.omnissiah.toml.example`](.omnissiah.toml.example). Environment overrides: `OMNISSIAH_CLAUDE_BIN`,
`OMNISSIAH_CURSOR_BIN`, `OMNISSIAH_DEFAULT_TOOL`, `OMNISSIAH_REVERENCE`, `OMNISSIAH_PORT`, `OMNISSIAH_DATA_DIR`.

## Security

The server binds to `127.0.0.1` only, rejects unknown `Host` headers (DNS rebinding) and requires a custom header on
every mutating request, so other websites cannot drive your spirits.

## Development

```fish
npm run dev     # API server + Vite with hot reload on http://127.0.0.1:5173
npm test        # parser and config tests
```
