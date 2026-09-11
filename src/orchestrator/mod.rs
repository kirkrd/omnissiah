pub mod claude_code;
pub mod cursor;

use anyhow::{Context, Result};
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

use crate::config::Config;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Target {
    ClaudeCode,
    Cursor,
}

impl Target {
    pub fn display_name(self) -> &'static str {
        match self {
            Self::ClaudeCode => "Claude Code",
            Self::Cursor => "Cursor Agent",
        }
    }
}

#[derive(Debug, Clone)]
pub struct DispatchOptions {
    /// Prompt to offer. Required for print-mode dispatches from the REPL.
    pub prompt: Option<String>,
    /// Non-interactive print mode when true.
    pub print: bool,
    /// Extra args forwarded to the underlying tool (e.g. `--continue`).
    pub extra_args: Vec<String>,
    /// Working directory for the subprocess.
    pub cwd: Option<PathBuf>,
    /// When true, do not inherit stdin (keeps the Omnissiah REPL in control).
    pub detach_stdin: bool,
}

pub async fn dispatch(target: Target, cfg: &Config, opts: DispatchOptions) -> Result<i32> {
    match target {
        Target::ClaudeCode => claude_code::run(cfg, opts).await,
        Target::Cursor => cursor::run(cfg, opts).await,
    }
}

pub(crate) async fn run_tool(
    bin: &str,
    args: &[String],
    cwd: Option<&PathBuf>,
    detach_stdin: bool,
) -> Result<i32> {
    let mut cmd = Command::new(bin);
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    // Always stream tool output into *this* terminal; optionally keep stdin for the REPL.
    if detach_stdin {
        cmd.stdin(Stdio::null());
    } else {
        cmd.stdin(Stdio::inherit());
    }
    cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());

    let mut child = cmd.spawn().with_context(|| {
        format!("failed to awaken Machine Spirit '{bin}' — is it installed and on PATH?")
    })?;

    let status = child
        .wait()
        .await
        .with_context(|| format!("lost communion with '{bin}'"))?;

    Ok(status.code().unwrap_or(1))
}
