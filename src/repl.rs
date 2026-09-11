use anyhow::{bail, Result};
use colored::Colorize;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

use crate::config::Config;
use crate::orchestrator::{self, DispatchOptions, Target};
use crate::persona;
use crate::prompt;

/// Interactive Omnissiah session — user stays in *this* CLI; tools run headless via `-p`.
pub async fn run(
    cfg: &mut Config,
    mut target: Target,
    cwd: Option<PathBuf>,
    initial_prompt: Option<String>,
) -> Result<i32> {
    persona::announce_start(target.display_name(), cfg.incense);
    print_help_hint();
    println!(
        "{} {}  {} {}",
        "Communing through".dimmed(),
        target.display_name().cyan().bold(),
        "· type".dimmed(),
        "/help".yellow()
    );
    println!();

    let mut turn: u32 = 0;

    if let Some(first) = initial_prompt {
        dispatch_turn(cfg, target, &first, turn, cwd.as_ref()).await?;
        turn = turn.saturating_add(1);
    }

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    loop {
        write!(
            stdout,
            "{} {} ",
            "⚙".magenta(),
            format!("[{}]", short_tool(target)).yellow().bold()
        )?;
        write!(stdout, "{}", "› ".bright_cyan())?;
        stdout.flush()?;

        let mut line = String::new();
        let n = stdin.lock().read_line(&mut line)?;
        if n == 0 {
            // EOF
            println!();
            persona::say("The rite is sealed. Omnissiah be praised.");
            return Ok(0);
        }

        let input = line.trim();
        if input.is_empty() {
            continue;
        }

        match handle_slash(input, cfg, &mut target)? {
            SlashResult::Continue => continue,
            SlashResult::Quit => {
                persona::say("The incense fades. Until the next communion.");
                return Ok(0);
            }
            SlashResult::Prompt(user_prompt) => {
                match dispatch_turn(cfg, target, &user_prompt, turn, cwd.as_ref()).await {
                    Ok(()) => turn = turn.saturating_add(1),
                    Err(err) => {
                        persona::announce_error(target.display_name());
                        eprintln!("{} {}", "HERESY:".red().bold(), err);
                    }
                }
            }
        }
    }
}

enum SlashResult {
    Continue,
    Quit,
    Prompt(String),
}

fn handle_slash(input: &str, cfg: &mut Config, target: &mut Target) -> Result<SlashResult> {
    if !input.starts_with('/') {
        return Ok(SlashResult::Prompt(input.to_string()));
    }

    let mut parts = input.splitn(2, char::is_whitespace);
    let cmd = parts.next().unwrap_or("").to_ascii_lowercase();
    let rest = parts.next().map(str::trim).filter(|s| !s.is_empty());

    match cmd.as_str() {
        "/help" | "/h" | "/?" => {
            print_help();
            Ok(SlashResult::Continue)
        }
        "/quit" | "/exit" | "/q" => Ok(SlashResult::Quit),
        "/bless" => {
            persona::incense::swing(cfg.incense);
            persona::say(&persona::dialogue::greeting());
            Ok(SlashResult::Continue)
        }
        "/pray" => {
            if cfg.incense {
                persona::incense::swing(true);
            }
            persona::pray::recite();
            Ok(SlashResult::Continue)
        }
        "/spirits" | "/tools" => {
            println!("  current: {}", target.display_name().cyan());
            println!("  /tool claude-code");
            println!("  /tool cursor");
            Ok(SlashResult::Continue)
        }
        "/tool" | "/t" => {
            let Some(name) = rest else {
                println!(
                    "{}",
                    "Usage: /tool claude-code | cursor".dimmed()
                );
                return Ok(SlashResult::Continue);
            };
            *target = parse_tool(name)?;
            persona::say(&format!(
                "Attention shifts to the Machine Spirit of {}.",
                target.display_name()
            ));
            Ok(SlashResult::Continue)
        }
        "/raw" => {
            cfg.wrap_prompt = !cfg.wrap_prompt;
            println!(
                "  wrap_prompt = {}",
                if cfg.wrap_prompt {
                    "on".green()
                } else {
                    "off".yellow()
                }
            );
            Ok(SlashResult::Continue)
        }
        "/incense" => {
            cfg.incense = !cfg.incense;
            println!(
                "  incense = {}",
                if cfg.incense {
                    "on".green()
                } else {
                    "off".yellow()
                }
            );
            Ok(SlashResult::Continue)
        }
        other => {
            println!(
                "{} unknown rite '{}' — try {}",
                "HERESY:".yellow(),
                other,
                "/help".cyan()
            );
            Ok(SlashResult::Continue)
        }
    }
}

async fn dispatch_turn(
    cfg: &Config,
    target: Target,
    user_prompt: &str,
    turn: u32,
    cwd: Option<&PathBuf>,
) -> Result<()> {
    let final_prompt = prompt::build(user_prompt, target.display_name(), cfg);

    if cfg.incense && turn == 0 {
        persona::incense::swing(true);
    }
    persona::say(&persona::dialogue::before_dispatch(target.display_name()));
    println!();

    let mut extra = Vec::new();
    // Continue the underlying tool's conversation after the first turn.
    if turn > 0 {
        extra.push("--continue".into());
    }

    let code = orchestrator::dispatch(
        target,
        cfg,
        DispatchOptions {
            prompt: Some(final_prompt),
            print: true, // always headless — never hand off the TUI
            extra_args: extra,
            cwd: cwd.cloned(),
            detach_stdin: true,
        },
    )
    .await?;

    println!();
    if code == 0 {
        persona::announce_success();
        Ok(())
    } else {
        persona::announce_error(target.display_name());
        bail!("Machine Spirit returned exit code {code}");
    }
}

fn parse_tool(name: &str) -> Result<Target> {
    match name.to_ascii_lowercase().as_str() {
        "claude" | "claude-code" | "claude_code" | "cc" => Ok(Target::ClaudeCode),
        "cursor" | "agent" | "cursor-agent" | "cursor_agent" => Ok(Target::Cursor),
        other => bail!("unknown tool '{other}' (claude-code | cursor)"),
    }
}

fn short_tool(target: Target) -> &'static str {
    match target {
        Target::ClaudeCode => "claude",
        Target::Cursor => "cursor",
    }
}

fn print_help_hint() {
    println!(
        "{}",
        "You remain within Omnissiah. Petitions are offered to the tool via print-mode."
            .dimmed()
    );
}

fn print_help() {
    println!("{}", "Rites available in this communion:".yellow());
    println!("  {:<18} {}", "/help", "Show this litany");
    println!("  {:<18} {}", "/quit", "End the session");
    println!("  {:<18} {}", "/pray", "Recite the Litany of the Omnissiah");
    println!("  {:<18} {}", "/bless", "Swing the incense");
    println!("  {:<18} {}", "/tool <name>", "Switch claude-code | cursor");
    println!("  {:<18} {}", "/spirits", "List Machine Spirits");
    println!("  {:<18} {}", "/raw", "Toggle prompt wrapping");
    println!("  {:<18} {}", "/incense", "Toggle incense animation");
    println!("  {:<18} {}", "<text>", "Offer a petition to the current tool");
}
