use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct Config {
    /// Binary used for Claude Code (default: `claude`)
    pub claude_bin: String,
    /// Binary used for Cursor Agent (default: `agent`)
    pub cursor_bin: String,
    /// Default Machine Spirit when `-t/--tool` is omitted
    pub default_tool: String,
    /// How theatrical the Tech Priest persona is (0..=3)
    pub reverence: u8,
    /// Animate incense frames before dispatch
    pub incense: bool,
    /// Wrap the user prompt in Tech Priest meditation context
    pub wrap_prompt: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            claude_bin: "claude".into(),
            cursor_bin: "agent".into(),
            default_tool: "claude-code".into(),
            reverence: 2,
            incense: true,
            wrap_prompt: true,
        }
    }
}

impl Config {
    pub fn load() -> Result<Self> {
        let mut cfg = Self::default();

        if let Some(path) = find_config_file() {
            let raw = fs::read_to_string(&path)
                .with_context(|| format!("failed to read config {}", path.display()))?;
            let file_cfg = parse_config(&raw)
                .with_context(|| format!("failed to parse {}", path.display()))?;
            cfg = file_cfg;
        }

        if let Ok(v) = std::env::var("OMNISSIAH_CLAUDE_BIN") {
            cfg.claude_bin = v;
        }
        if let Ok(v) = std::env::var("OMNISSIAH_CURSOR_BIN") {
            cfg.cursor_bin = v;
        }
        if let Ok(v) = std::env::var("OMNISSIAH_DEFAULT_TOOL") {
            cfg.default_tool = v;
        }
        if let Ok(v) = std::env::var("OMNISSIAH_REVERENCE") {
            if let Ok(n) = v.parse() {
                cfg.reverence = n;
            }
        }

        Ok(cfg)
    }
}

fn find_config_file() -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd;
        for _ in 0..8 {
            dirs.push(dir.clone());
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
            } else {
                break;
            }
        }
    }
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".config").join("omnissiah"));
        dirs.push(home);
    }

    for dir in dirs {
        for name in [".omnissiah.toml", ".tech-priest.toml", "config.toml"] {
            let p = dir.join(name);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

fn parse_config(raw: &str) -> Result<Config> {
    let mut cfg = Config::default();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with('[') {
            continue;
        }
        let Some((k, v)) = line.split_once('=') else {
            continue;
        };
        let key = k.trim();
        let val = v.trim().trim_matches('"');
        match key {
            "claude_bin" => cfg.claude_bin = val.to_string(),
            "cursor_bin" => cfg.cursor_bin = val.to_string(),
            "default_tool" => cfg.default_tool = val.to_string(),
            "reverence" => cfg.reverence = val.parse().unwrap_or(cfg.reverence),
            "incense" => cfg.incense = parse_bool(val),
            "wrap_prompt" => cfg.wrap_prompt = parse_bool(val),
            _ => {}
        }
    }
    Ok(cfg)
}

fn parse_bool(v: &str) -> bool {
    matches!(v.to_ascii_lowercase().as_str(), "true" | "1" | "yes" | "on")
}
