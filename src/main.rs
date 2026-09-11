mod config;
mod orchestrator;
mod persona;
mod prompt;
mod repl;

use anyhow::{bail, Result};
use clap::{Parser, Subcommand, ValueEnum};
use colored::Colorize;
use std::io::{self, Read};
use std::path::PathBuf;
use std::process::ExitCode;

use config::Config;
use orchestrator::{DispatchOptions, Target};

#[derive(Debug, Clone, Copy, ValueEnum)]
enum ToolArg {
    #[value(name = "claude-code", alias = "claude", alias = "cc")]
    ClaudeCode,
    #[value(name = "cursor", alias = "agent")]
    Cursor,
}

impl From<ToolArg> for Target {
    fn from(value: ToolArg) -> Self {
        match value {
            ToolArg::ClaudeCode => Target::ClaudeCode,
            ToolArg::Cursor => Target::Cursor,
        }
    }
}

impl ToolArg {
    fn parse_name(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "claude" | "claude-code" | "claude_code" | "cc" => Some(Self::ClaudeCode),
            "cursor" | "agent" | "cursor-agent" | "cursor_agent" => Some(Self::Cursor),
            _ => None,
        }
    }
}

/// Tech Priest orchestrator — your session lives inside Omnissiah.
#[derive(Debug, Parser)]
#[command(
    name = "omnisaiah",
    about = "Tech Priest orchestrator for Claude Code & Cursor — praise the Omnissiah.",
    long_about = "Runs an interactive Omnissiah REPL. Each petition is dispatched headlessly to Claude Code or Cursor Agent (-p), so you never leave this app.\n\n  omnisaiah\n  omnisaiah \"refactor auth\"\n  omnisaiah -t cursor\n  omnisaiah -p \"one-shot scripted prompt\"",
    version,
    propagate_version = true,
    subcommand_negates_reqs = true,
    args_conflicts_with_subcommands = true
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Machine Spirit to awaken (default from config / claude-code)
    #[arg(short = 't', long = "tool", value_enum, global = true)]
    tool: Option<ToolArg>,

    /// One-shot print mode (no REPL) — for scripts
    #[arg(short = 'p', long = "print")]
    print: bool,

    /// Skip incense animation
    #[arg(long = "no-incense")]
    no_incense: bool,

    /// Do not wrap the prompt in Tech Priest meditation context
    #[arg(long = "raw")]
    raw: bool,

    /// Working directory for the subprocess
    #[arg(long = "cwd")]
    cwd: Option<PathBuf>,

    /// Optional first petition. Without -p, opens the REPL (sends this as turn 1).
    #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
    prompt: Vec<String>,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Alias for the default session / one-shot flow
    Invoke {
        #[arg(value_enum)]
        tool: Option<ToolArg>,
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        prompt: Vec<String>,
        #[arg(short = 'p', long = "print")]
        print: bool,
        #[arg(long = "no-incense")]
        no_incense: bool,
        #[arg(long = "raw")]
        raw: bool,
        #[arg(long = "cwd")]
        cwd: Option<PathBuf>,
        #[arg(last = true)]
        passthrough: Vec<String>,
    },

    /// List configured Machine Spirits
    Spirits,

    /// Swing the incense without invoking a tool
    Bless {
        #[arg(long = "no-animate")]
        no_animate: bool,
    },
}

struct InvokeArgs {
    tool: Option<ToolArg>,
    prompt: Vec<String>,
    print: bool,
    no_incense: bool,
    raw: bool,
    cwd: Option<PathBuf>,
    passthrough: Vec<String>,
}

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(code) => ExitCode::from(code as u8),
        Err(err) => {
            eprintln!("{} {}", "HERESY:".red().bold(), err);
            ExitCode::from(1)
        }
    }
}

async fn run() -> Result<i32> {
    let cli = Cli::parse();
    let mut cfg = Config::load()?;

    match cli.command {
        Some(Commands::Spirits) => {
            persona::say("Known Machine Spirits under this forge:");
            println!("  • {}  → `{}`", "claude-code".cyan(), cfg.claude_bin);
            println!("  • {}        → `{}`", "cursor".cyan(), cfg.cursor_bin);
            println!(
                "  default: {}",
                cfg.default_tool.yellow()
            );
            println!();
            println!("{}", "  omnisaiah                  # REPL".dimmed());
            println!("{}", "  omnisaiah -t cursor        # REPL via Cursor".dimmed());
            println!("{}", "  omnisaiah -p \"script me\"   # one-shot".dimmed());
            Ok(0)
        }
        Some(Commands::Bless { no_animate }) => {
            persona::say(&persona::dialogue::greeting());
            persona::incense::swing(!no_animate);
            persona::say("The incense is offered. The Machine Spirit stirs.");
            Ok(0)
        }
        Some(Commands::Invoke {
            tool,
            prompt,
            print,
            no_incense,
            raw,
            cwd,
            passthrough,
        }) => {
            do_invoke(
                &mut cfg,
                InvokeArgs {
                    tool: tool.or(cli.tool),
                    prompt,
                    print,
                    no_incense,
                    raw,
                    cwd,
                    passthrough,
                },
            )
            .await
        }
        None => {
            do_invoke(
                &mut cfg,
                InvokeArgs {
                    tool: cli.tool,
                    prompt: cli.prompt,
                    print: cli.print,
                    no_incense: cli.no_incense,
                    raw: cli.raw,
                    cwd: cli.cwd,
                    passthrough: Vec::new(),
                },
            )
            .await
        }
    }
}

async fn do_invoke(cfg: &mut Config, args: InvokeArgs) -> Result<i32> {
    if args.no_incense {
        cfg.incense = false;
    }
    if args.raw {
        cfg.wrap_prompt = false;
    }

    let target = resolve_target(args.tool, cfg)?;
    let mut user_prompt = join_prompt(args.prompt);

    // Scripted one-shot: -p
    if args.print {
        if user_prompt.is_none() {
            user_prompt = read_stdin_prompt()?;
        }
        let Some(p) = user_prompt else {
            bail!("--print requires a prompt argument or stdin");
        };
        return one_shot(cfg, target, p, args.cwd, args.passthrough).await;
    }

    // Default: stay inside Omnissiah REPL (works on TTY and piped line-by-line input).
    // Tools are always called with -p so they never take over the terminal.
    if !args.passthrough.is_empty() {
        eprintln!(
            "{}",
            "note: passthrough args are ignored in REPL mode (use -p for one-shot)".dimmed()
        );
    }

    repl::run(cfg, target, args.cwd, user_prompt).await
}

async fn one_shot(
    cfg: &Config,
    target: Target,
    user_prompt: String,
    cwd: Option<PathBuf>,
    passthrough: Vec<String>,
) -> Result<i32> {
    let final_prompt = prompt::build(&user_prompt, target.display_name(), cfg);
    persona::announce_start(target.display_name(), cfg.incense);

    let code = orchestrator::dispatch(
        target,
        cfg,
        DispatchOptions {
            prompt: Some(final_prompt),
            print: true,
            extra_args: passthrough,
            cwd,
            detach_stdin: true,
        },
    )
    .await?;

    if code == 0 {
        persona::announce_success();
        Ok(0)
    } else {
        persona::announce_error(target.display_name());
        bail!("the rite concluded with exit code {code} — Machine Spirit Wrath");
    }
}

fn resolve_target(tool: Option<ToolArg>, cfg: &Config) -> Result<Target> {
    if let Some(t) = tool {
        return Ok(t.into());
    }
    ToolArg::parse_name(&cfg.default_tool)
        .map(Into::into)
        .ok_or_else(|| {
            anyhow::anyhow!(
                "unknown default_tool '{}' (use claude-code or cursor)",
                cfg.default_tool
            )
        })
}

fn join_prompt(parts: Vec<String>) -> Option<String> {
    let joined = parts.join(" ");
    let trimmed = joined.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn read_stdin_prompt() -> Result<Option<String>> {
    if atty_stdin() {
        return Ok(None);
    }
    let mut buf = String::new();
    io::stdin().read_to_string(&mut buf)?;
    let trimmed = buf.trim().to_string();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed))
    }
}

fn atty_stdin() -> bool {
    std::io::IsTerminal::is_terminal(&io::stdin())
}
