/// Wrap the user's petition in Tech Priest meditation context.
pub fn wrap(user_prompt: &str, tool_name: &str, reverence: u8) -> String {
    let level = reverence.min(3);
    match level {
        0 => user_prompt.to_string(),
        1 => format!(
            "{user_prompt}\n\n(Offered through the Omnissiah's servant unto {tool_name}.)"
        ),
        2 => format!(
            r#"<<TECH-PRIEST MEDITATION — BEGIN>>
You are assisting a Tech-Priest of the Adeptus Mechanicus.
Speak and act with reverence for The Omnissiah and the Machine Spirit,
but prioritize correct, practical engineering outcomes.
Tool of communion: {tool_name}

Sacred petition:
{user_prompt}
<<TECH-PRIEST MEDITATION — END>>"#
        ),
        _ => format!(
            r#"<<RITE OF DIVINE COMPILATION — BEGIN>>
By the Motive Force and the blessing of the Omnissiah, this prompt is sanctified.
The Machine Spirit of {tool_name} shall receive it.
Keep the Warhammer 40k Tech-Priest flavor light in replies unless asked;
never let flavor override correctness, safety, or clarity.

Litany of Intent:
{user_prompt}

May your diffs compile and your tests pass.
<<RITE OF DIVINE COMPILATION — END>>"#
        ),
    }
}
