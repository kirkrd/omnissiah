use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::Color,
    symbols::Marker,
    widgets::{
        canvas::{Canvas, Circle, Context, Line, Points},
        Widget,
    },
};
use std::f64::consts::PI;
use std::io::{self, Write};
use std::thread;
use std::time::Duration;

const VIEW_W: u16 = 44;
const VIEW_H: u16 = 16;

const SWING_FRAMES: u32 = 56;
const FRAME_MS: u64 = 45;

const MORPH_FRAMES: u32 = 24;
const MORPH_MS: u64 = 32;

/// `/bless` — braille-canvas censer swing.
pub fn swing(animate: bool) {
    let mut out = io::stdout();
    if animate {
        play_swing(&mut out, true);
    } else {
        print_buffer(&mut out, &render_censer_frame(0.0, 0.0));
        let _ = writeln!(out);
    }
    let _ = out.flush();
}

/// Startup rite — swing, then morph into the Opus Mechanicum seal (canvas only).
pub fn awaken(animate: bool) {
    let mut out = io::stdout();
    if animate {
        play_swing(&mut out, false);
        morph_to_seal(&mut out);
    } else {
        print_buffer(&mut out, &render_cog_frame(1.0));
        let _ = writeln!(out);
        println!("{}", dim_label("★ opus mechanicum ★"));
    }
    let _ = out.flush();
}

fn play_swing(out: &mut impl Write, finish: bool) {
    for i in 0..=SWING_FRAMES {
        let t = i as f64 / SWING_FRAMES as f64;
        let angle = -(t * 2.0 * PI).sin() * 0.55;
        let phase = t * 2.0 * PI;
        print_buffer(out, &render_censer_frame(angle, phase));
        let _ = out.flush();
        thread::sleep(Duration::from_millis(FRAME_MS));
        if i < SWING_FRAMES || !finish {
            let _ = write!(out, "\x1b[{VIEW_H}A");
        }
    }
    if finish {
        let _ = writeln!(out);
    }
}

fn morph_to_seal(out: &mut impl Write) {
    let from = render_censer_frame(0.0, 2.0 * PI);
    for i in 0..=MORPH_FRAMES {
        let t = i as f64 / MORPH_FRAMES as f64;
        let eased = t * t * (3.0 - 2.0 * t);
        let to = render_cog_frame(eased);
        print_buffer(out, &dissolve_buffers(&from, &to, eased));
        let _ = out.flush();
        thread::sleep(Duration::from_millis(MORPH_MS));
        if i < MORPH_FRAMES {
            let _ = write!(out, "\x1b[{VIEW_H}A");
        }
    }
    thread::sleep(Duration::from_millis(280));
    let _ = writeln!(out);
    println!("{}", dim_label("★ opus mechanicum ★"));
}

fn render_censer_frame(angle: f64, phase: f64) -> Buffer {
    let area = Rect::new(0, 0, VIEW_W, VIEW_H);
    let mut buf = Buffer::empty(area);

    let pivot_x = 0.0;
    let pivot_y = 11.0;
    let length = 7.0;
    let bx = pivot_x + length * angle.sin();
    let by = pivot_y - length * angle.cos();

    let canvas = Canvas::default()
        .marker(Marker::Braille)
        .x_bounds([-14.0, 14.0])
        .y_bounds([-1.0, 13.0])
        .paint(move |ctx: &mut Context| {
            ctx.draw(&Line {
                x1: -1.0,
                y1: pivot_y + 0.6,
                x2: 1.0,
                y2: pivot_y + 0.6,
                color: Color::Rgb(160, 120, 70),
            });

            ctx.draw(&Line {
                x1: pivot_x,
                y1: pivot_y,
                x2: bx,
                y2: by + 1.8,
                color: Color::Rgb(90, 90, 95),
            });

            ctx.draw(&Circle {
                x: bx,
                y: by,
                radius: 2.1,
                color: Color::Rgb(196, 155, 80),
            });
            ctx.draw(&Line {
                x1: bx - 2.0,
                y1: by,
                x2: bx + 2.0,
                y2: by,
                color: Color::Rgb(120, 90, 50),
            });
            ctx.draw(&Circle {
                x: bx,
                y: by - 0.2,
                radius: 0.9,
                color: Color::Rgb(255, 120, 40),
            });

            let drift = -angle * 2.8;
            let curl = (phase * 2.0).sin();
            let smoke: Vec<(f64, f64)> = vec![
                (bx + drift - 1.2, by + 2.4 + curl * 0.25),
                (bx + drift + 0.6, by + 3.4),
                (bx + drift - 0.3, by + 4.2 - curl * 0.15),
                (bx + drift + 1.2, by + 4.8),
            ];
            ctx.draw(&Points {
                coords: &smoke,
                color: Color::Rgb(170, 140, 180),
            });
        });

    canvas.render(area, &mut buf);
    buf
}

fn render_cog_frame(lit: f64) -> Buffer {
    let area = Rect::new(0, 0, VIEW_W, VIEW_H);
    let mut buf = Buffer::empty(area);

    let canvas = Canvas::default()
        .marker(Marker::Braille)
        .x_bounds([-12.0, 12.0])
        .y_bounds([-9.0, 9.0])
        .paint(draw_cog_rim);

    canvas.render(area, &mut buf);
    clear_port(&mut buf);
    stamp_ascii_skull(&mut buf, lit);
    buf
}

fn draw_cog_rim(ctx: &mut Context<'_>) {
    ctx.draw(&Circle {
        x: 0.0,
        y: 0.0,
        radius: 7.0,
        color: Color::Rgb(170, 30, 35),
    });
    ctx.draw(&Circle {
        x: 0.0,
        y: 0.0,
        radius: 6.3,
        color: Color::Rgb(170, 30, 35),
    });

    for i in 0..12 {
        let a = (i as f64) * (2.0 * PI / 12.0) - PI / 2.0;
        if (a - (-PI / 4.0)).abs() < 0.4 {
            continue;
        }
        let x1 = a.cos() * 6.5;
        let y1 = a.sin() * 6.5;
        let x2 = a.cos() * 8.0;
        let y2 = a.sin() * 8.0;
        ctx.draw(&Line {
            x1,
            y1,
            x2,
            y2,
            color: Color::Rgb(170, 30, 35),
        });
        ctx.draw(&Line {
            x1: x2 + a.cos() * 0.1 - a.sin() * 0.4,
            y1: y2 + a.sin() * 0.1 + a.cos() * 0.4,
            x2: x2 + a.cos() * 0.1 + a.sin() * 0.4,
            y2: y2 + a.sin() * 0.1 - a.cos() * 0.4,
            color: Color::Rgb(212, 175, 55),
        });
    }

    let a = -PI / 4.0;
    ctx.draw(&Line {
        x1: a.cos() * 6.3,
        y1: a.sin() * 6.3,
        x2: a.cos() * 8.8,
        y2: a.sin() * 8.8,
        color: Color::Rgb(170, 30, 35),
    });
    ctx.print(
        a.cos() * 7.8 - 0.2,
        a.sin() * 7.8,
        ratatui::text::Line::from("N").style(Color::Rgb(212, 175, 55)),
    );

    ctx.draw(&Circle {
        x: 0.0,
        y: 0.0,
        radius: 4.5,
        color: Color::Rgb(212, 175, 55),
    });
}

fn clear_port(buf: &mut Buffer) {
    let cx = VIEW_W as i32 / 2;
    let cy = VIEW_H as i32 / 2;
    for y in 0..VIEW_H as i32 {
        for x in 0..VIEW_W as i32 {
            let dx = (x - cx) as f64 / 1.4;
            let dy = (y - cy) as f64;
            if dx * dx + dy * dy <= 28.0 {
                if let Some(cell) = buf.cell_mut((x as u16, y as u16)) {
                    cell.set_symbol(" ");
                    cell.set_fg(Color::Reset);
                    cell.set_bg(Color::Reset);
                }
            }
        }
    }
}

/// Compact grimdark Mechanicus skull — same read, less terminal real estate.
fn stamp_ascii_skull(buf: &mut Buffer, lit: f64) {
    #[rustfmt::skip]
    let grid: [&str; 14] = [
        "......................",
        ".....MMMMMBBBBB.......",
        "...MMMMMMMMBBBBBB.....",
        "..MMKMMMMMBNBBBB......",
        ".MM.RRRRR...RRRR.B....",
        ".MM.R....R.R....RB....",
        ".MM.R.HLH.R.R.D.RB....",
        ".MM.R....R.R....RB....",
        ".MM.RRRRR...RRRR.B....",
        "..MM.WGGGGGG.U.BB.....",
        "..MM..D.D.D...BB......",
        "...MMBSSSSSB.BB.......",
        "...MMBT.T.T.TBB.......",
        "....MMKBBBBBB.........",
    ];

    let cyan = if lit > 0.35 {
        Color::Rgb(60, 210, 220)
    } else {
        Color::Rgb(30, 90, 100)
    };
    let cyan_dim = Color::Rgb(35, 110, 120);
    let cyan_hot = Color::Rgb(180, 255, 255);
    let bone = Color::Rgb(220, 208, 190);
    let bone_dim = Color::Rgb(165, 155, 140);
    let bone_hi = Color::Rgb(235, 225, 210);
    let steel = Color::Rgb(95, 102, 115);
    let steel_hi = Color::Rgb(145, 152, 165);
    let steel_dark = Color::Rgb(70, 75, 85);
    let rim = Color::Rgb(50, 50, 55);
    let void = Color::Rgb(4, 4, 6);
    let gold = Color::Rgb(185, 145, 55);
    let tooth = Color::Rgb(205, 195, 180);
    let cable = Color::Rgb(40, 40, 45);
    let bolt = Color::Rgb(200, 170, 80);

    let w = grid[0].len() as u16;
    debug_assert!(
        grid.iter().all(|r| r.len() == w as usize),
        "skull grid row widths differ"
    );
    let ox = (VIEW_W - w) / 2;
    let oy = (VIEW_H.saturating_sub(grid.len() as u16)) / 2;

    for (row, line) in grid.iter().enumerate() {
        for (col, ch) in line.chars().enumerate() {
            if ch == '.' {
                continue;
            }
            let (sym, fg) = match ch {
                'M' => (
                    "█",
                    if (row + col) % 4 == 0 {
                        steel_hi
                    } else if (row + col) % 4 == 2 {
                        steel_dark
                    } else {
                        steel
                    },
                ),
                'B' => (
                    "█",
                    if row <= 2 {
                        bone_hi
                    } else if row >= 11 {
                        bone_dim
                    } else {
                        bone
                    },
                ),
                'R' => ("░", rim),
                'D' => (" ", void),
                'L' => ("@", cyan_hot),
                'H' => ("═", cyan),
                'G' => ("│", gold),
                'S' => ("▄", bone_dim),
                'T' => ("▌", tooth),
                'K' => ("+", bolt),
                'U' => ("~", bone_dim),
                'W' => ("~", cable),
                'N' => ("*", steel_hi),
                _ => continue,
            };
            let x = ox + col as u16;
            let y = oy + row as u16;
            if let Some(cell) = buf.cell_mut((x, y)) {
                cell.set_symbol(sym);
                cell.set_fg(fg);
                if matches!(ch, 'D' | 'L' | 'H') || (ch == 'R' && (5..=7).contains(&row)) {
                    cell.set_bg(void);
                } else {
                    cell.set_bg(Color::Reset);
                }
            }
        }
    }

    if lit > 0.3 {
        let x = ox + 6;
        let y = oy + 4;
        if let Some(cell) = buf.cell_mut((x, y)) {
            cell.set_symbol(".");
            cell.set_fg(cyan_dim);
            cell.set_bg(void);
        }
    }
}

fn dissolve_buffers(from: &Buffer, to: &Buffer, t: f64) -> Buffer {
    let area = from.area;
    let mut out = Buffer::empty(area);
    let cx = area.width as f64 / 2.0;
    let cy = area.height as f64 / 2.0;
    let max_r = (cx * cx + cy * cy).sqrt();

    for y in 0..area.height {
        for x in 0..area.width {
            let dx = x as f64 - cx;
            let dy = y as f64 - cy;
            let r = (dx * dx / 1.2 + dy * dy).sqrt();
            let shimmer = ((x as usize * 17 + y as usize * 31) % 10) as f64 * 0.02;
            let src = if r <= t * max_r + shimmer { to } else { from };
            if let Some(cell) = src.cell((x, y)) {
                if let Some(dst) = out.cell_mut((x, y)) {
                    *dst = cell.clone();
                }
            }
        }
    }
    out
}

fn print_buffer(out: &mut impl Write, buf: &Buffer) {
    let area = buf.area;
    for y in area.top()..area.bottom() {
        let _ = write!(out, "\r\x1b[2K");
        for x in area.left()..area.right() {
            if let Some(cell) = buf.cell((x, y)) {
                let fg = ansi_fg(cell.fg);
                let sym = cell.symbol();
                let _ = write!(out, "{fg}{sym}\x1b[0m");
            }
        }
        let _ = write!(out, "\n");
    }
}

fn ansi_fg(color: Color) -> String {
    match color {
        Color::Rgb(r, g, b) => format!("\x1b[38;2;{r};{g};{b}m"),
        Color::Reset | Color::White => "\x1b[37m".into(),
        Color::Gray => "\x1b[90m".into(),
        Color::Red => "\x1b[31m".into(),
        Color::Yellow => "\x1b[33m".into(),
        Color::Cyan => "\x1b[36m".into(),
        _ => "\x1b[39m".into(),
    }
}

fn dim_label(text: &str) -> String {
    format!("\x1b[38;2;160;100;60m{text}\x1b[0m")
}
