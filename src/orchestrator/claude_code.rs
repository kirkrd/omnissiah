use anyhow::{bail, Result};

use super::{run_tool, DispatchOptions};
use crate::config::Config;

/// Dispatch to Claude Code (`claude` CLI).
/// Interactive Omnissiah sessions always use `--print` so Claude does not take over the TTY.
pub async fn run(cfg: &Config, opts: DispatchOptions) -> Result<i32> {
    let mut args: Vec<String> = Vec::new();

    if opts.print {
        args.push("--print".into());
    }

    args.extend(opts.extra_args);

    match opts.prompt {
        Some(prompt) if !prompt.is_empty() => args.push(prompt),
        _ if opts.print => {
            bail!("Claude Code print-mode requires a non-empty prompt");
        }
        _ => {}
    }

    run_tool(&cfg.claude_bin, &args, opts.cwd.as_ref(), opts.detach_stdin).await
}
