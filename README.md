# Omnissiah

Tech Priest CLI that keeps **you inside Omnissiah**. Claude Code / Cursor Agent are called headlessly (`-p`) for each petition — they do not take over the terminal.

## Install

```bash
cargo install --path . --force
```

## Usage

```bash
omnisaiah                       # interactive REPL (default: claude-code)
omnisaiah -t cursor             # REPL via Cursor Agent
omnisaiah "refactor auth"       # REPL, first turn pre-filled
omnisaiah -p "scripted prompt"  # one-shot, no REPL
```

Inside the REPL:

```
⚙ [claude] › explain this crate
⚙ [claude] › /tool cursor
⚙ [cursor] › /bless
⚙ [cursor] › /quit
```

| Rite | Effect |
|------|--------|
| `/help` | List commands |
| `/quit` | End session |
| `/tool claude-code\|cursor` | Switch backend |
| `/bless` | Incense |
| `/raw` | Toggle prompt wrap |
| `/incense` | Toggle incense |

Follow-up turns pass `--continue` to the underlying tool so conversation persists.

## Config

`.omnisaiah.toml` or `~/.config/omnisaiah/config.toml`:

```toml
claude_bin = "claude"
cursor_bin = "agent"
default_tool = "claude-code"
reverence = 2
incense = true
wrap_prompt = true
```
