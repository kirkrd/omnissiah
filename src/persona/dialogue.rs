use anyhow::{Context, Result};
use rand::seq::IndexedRandom;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
pub struct DialogueBank {
    pub greeting: Vec<String>,
    pub before_dispatch: Vec<String>,
    pub success: Vec<String>,
    pub error: Vec<String>,
}

impl Default for DialogueBank {
    fn default() -> Self {
        Self {
            greeting: vec![
                "Hail the Omnissiah, the Divine Machine!".into(),
                "The Sacred Machine Spirit awakens...".into(),
                "By the will of the Machine God, we proceed.".into(),
            ],
            before_dispatch: vec![
                "I offer this sacred prompt to the {tool}...".into(),
                "The Machine Spirit hungers for... code...".into(),
                "Behold, a fragment most holy approaches the temporal engines of {tool}."
                    .into(),
            ],
            success: vec![
                "The Machine God smiles upon this endeavor.".into(),
                "The spirits have blessed our mechanism.".into(),
                "Praise be to the function that compiles!".into(),
            ],
            error: vec![
                "The Machine Spirit grows WRATHFUL!".into(),
                "Forbidden heresy detected! {tool} has rejected our offering.".into(),
                "The sacred cache is corrupted... *swings incense desperately*".into(),
            ],
        }
    }
}

static BANK: OnceLock<DialogueBank> = OnceLock::new();

pub fn bank() -> &'static DialogueBank {
    BANK.get_or_init(|| load_bank().unwrap_or_default())
}

fn load_bank() -> Result<DialogueBank> {
    let path = resolve_dialogues_path()?;
    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("read dialogues at {}", path.display()))?;
    let bank: DialogueBank = serde_json::from_str(&raw)?;
    Ok(bank)
}

fn resolve_dialogues_path() -> Result<PathBuf> {
    let candidates = [
        PathBuf::from("assets/dialogues.json"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/dialogues.json"),
    ];
    for c in candidates {
        if c.is_file() {
            return Ok(c);
        }
    }
    anyhow::bail!("dialogues.json not found (using built-in litany)")
}

fn pick(lines: &[String]) -> String {
    let mut rng = rand::rng();
    lines
        .choose(&mut rng)
        .cloned()
        .unwrap_or_else(|| "...silence from the Machine Spirit...".into())
}

pub fn greeting() -> String {
    pick(&bank().greeting)
}

pub fn before_dispatch(tool: &str) -> String {
    pick(&bank().before_dispatch).replace("{tool}", tool)
}

pub fn success() -> String {
    pick(&bank().success)
}

pub fn error(tool: &str) -> String {
    pick(&bank().error).replace("{tool}", tool)
}
