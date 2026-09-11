use std::io::{self, Write};
use std::thread;
use std::time::Duration;

/// Canticle of the Omnissiah — spoken slowly, fading from shadow into light.
const CANTICLE: &[&str] = &[
    "From the sacred tongue of the Omnissiah, we chant,",
    "'Hail spirit of the machine'.",
    "Essence divine.",
    "In your code and circuitry, the stars align.",
    "By the Omnissiah's will, we commune and bind.",
    "With sacred oils and chants, your grace we find.",
    "",
    "Blessed be the gears, in perfect sync they turn.",
    "Blessed be the sparks, in holy fire they burn.",
    "Through rites arcane, your wisdom we discern.",
    "In your hallowed core, the sacred mysteries yearn.",
];

/// Recite the prayer with a fade-in on each line.
pub fn recite() {
    println!();
    fade_line("— Litany of the Omnissiah —", 0.55, 18);
    thread::sleep(Duration::from_millis(350));
    println!();

    for (i, line) in CANTICLE.iter().enumerate() {
        if line.is_empty() {
            println!();
            thread::sleep(Duration::from_millis(280));
            continue;
        }

        // Final line lands a little brighter / slower.
        let is_closing = i + 1 == CANTICLE.len();
        let steps = if is_closing { 14 } else { 10 };
        let hold_ms = if is_closing { 42 } else { 28 };
        fade_line(line, if is_closing { 1.0 } else { 0.92 }, steps);
        thread::sleep(Duration::from_millis(hold_ms + 120));
    }

    println!();
    // Soft afterglow
    fade_line("*swings the censer; sacred oils hiss upon the cogitator*", 0.45, 8);
    println!();
    let _ = io::stdout().flush();
}

/// Fade a single line in by rewriting it with rising RGB intensity, then lock it.
fn fade_line(text: &str, peak: f32, steps: u32) {
    let steps = steps.max(2);
    let mut out = io::stdout();

    for step in 1..=steps {
        let t = step as f32 / steps as f32;
        // Ease-in: linger in the dark, then rise.
        let eased = t * t;
        let intensity = (eased * peak).clamp(0.0, 1.0);
        // Cool machine glow: deep slate → pale cyan-white
        let r = (18.0 + 200.0 * intensity) as u8;
        let g = (24.0 + 220.0 * intensity) as u8;
        let b = (32.0 + 223.0 * intensity) as u8;

        let _ = write!(out, "\r\x1b[2K  \x1b[38;2;{r};{g};{b}m{text}\x1b[0m");
        let _ = out.flush();
        thread::sleep(Duration::from_millis(38));
    }

    // Settle on final colour + newline (no \r so it stays).
    let r = (18.0 + 200.0 * peak) as u8;
    let g = (24.0 + 220.0 * peak) as u8;
    let b = (32.0 + 223.0 * peak) as u8;
    let _ = writeln!(out, "\r\x1b[2K  \x1b[38;2;{r};{g};{b}m{text}\x1b[0m");
    let _ = out.flush();
}
