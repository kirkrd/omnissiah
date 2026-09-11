pub mod context;

use crate::config::Config;

/// Build the final prompt that will be offered to the Machine Spirit.
pub fn build(user_prompt: &str, tool_name: &str, cfg: &Config) -> String {
    if cfg.wrap_prompt {
        context::wrap(user_prompt, tool_name, cfg.reverence)
    } else {
        user_prompt.to_string()
    }
}
