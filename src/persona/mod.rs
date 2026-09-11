pub mod dialogue;
pub mod incense;
pub mod pray;

use colored::Colorize;

/// Render a Tech Priest speech bubble.
pub fn say(message: &str) {
    let border = "═".repeat(message.chars().count().saturating_add(4).min(72));
    println!("{}", format!("╔{border}╗").yellow());
    println!(
        "{} {} {}",
        "║".yellow(),
        message.bright_cyan().bold(),
        "║".yellow()
    );
    println!("{}", format!("╚{border}╝").yellow());
}

pub fn announce_start(tool: &str, animate_incense: bool) {
    say(&dialogue::greeting());
    incense::awaken(animate_incense);
    println!(
        "{} {}",
        "Awakened:".dimmed(),
        tool.cyan().bold()
    );
}

pub fn announce_success() {
    say(&dialogue::success());
}

pub fn announce_error(tool: &str) {
    say(&dialogue::error(tool));
}
