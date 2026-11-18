import fs from 'node:fs';

const BUILTIN = {
  greeting: [
    'Hail the Omnissiah, the Divine Machine!',
    'The Sacred Machine Spirit awakens...',
    'By the will of the Machine God, we proceed.',
  ],
  before_dispatch: [
    'I offer this sacred prompt to the {tool}...',
    'The Machine Spirit hungers for... code...',
  ],
  success: ['The Machine God smiles upon this endeavor.', 'Praise be to the function that compiles!'],
  error: ['The Machine Spirit grows WRATHFUL!', 'Forbidden heresy detected! {tool} has rejected our offering.'],
  aborted: ['The rite is severed. The Machine Spirit falls silent.'],
};

let bank = null;

function load() {
  if (bank) return bank;
  try {
    const raw = fs.readFileSync(new URL('../shared/dialogues.json', import.meta.url), 'utf8');
    bank = { ...BUILTIN, ...JSON.parse(raw) };
  } catch {
    bank = BUILTIN;
  }
  return bank;
}

export function line(kind, tool = 'the Machine Spirit') {
  const lines = load()[kind] || BUILTIN.greeting;
  const pick = lines[Math.floor(Math.random() * lines.length)] || '...silence...';
  return pick.replaceAll('{tool}', tool);
}

/** Wrap the user's petition in Tech-Priest meditation context. */
export function wrapPrompt(userPrompt, toolName, reverence) {
  switch (Math.min(3, Math.max(0, reverence | 0))) {
    case 0:
      return userPrompt;
    case 1:
      return `${userPrompt}\n\n(Offered through the Omnissiah's servant unto ${toolName}.)`;
    case 2:
      return `<<TECH-PRIEST MEDITATION — BEGIN>>
You are assisting a Tech-Priest of the Adeptus Mechanicus.
Speak and act with reverence for The Omnissiah and the Machine Spirit,
but prioritize correct, practical engineering outcomes.
Tool of communion: ${toolName}

Sacred petition:
${userPrompt}
<<TECH-PRIEST MEDITATION — END>>`;
    default:
      return `<<RITE OF DIVINE COMPILATION — BEGIN>>
By the Motive Force and the blessing of the Omnissiah, this prompt is sanctified.
The Machine Spirit of ${toolName} shall receive it.
Keep the Warhammer 40k Tech-Priest flavor light in replies unless asked;
never let flavor override correctness, safety, or clarity.

Litany of Intent:
${userPrompt}

May your diffs compile and your tests pass.
<<RITE OF DIVINE COMPILATION — END>>`;
  }
}
