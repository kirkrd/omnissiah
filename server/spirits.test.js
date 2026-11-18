import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StreamParser, buildInvocation, splitArgs } from './spirits.js';
import { parseConfig } from './config.js';

const cfg = { claude_bin: 'claude', cursor_bin: 'agent', claude_args: '--permission-mode acceptEdits', cursor_args: '' };

test('claude invocation passes prompt on stdin and resumes by id', () => {
  const inv = buildInvocation('claude-code', cfg, 'hi', 'abc');
  assert.equal(inv.stdin, 'hi');
  assert.deepEqual(inv.args.slice(-4), ['--resume', 'abc', '--permission-mode', 'acceptEdits']);
});

test('cursor invocation passes prompt as last arg', () => {
  const inv = buildInvocation('cursor', cfg, 'hi', null);
  assert.equal(inv.args.at(-1), 'hi');
  assert.equal(inv.stdin, null);
});

test('splitArgs honours quotes', () => {
  assert.deepEqual(splitArgs(`--a "b c" 'd'`), ['--a', 'b c', 'd']);
});

test('parser builds text and tool blocks from claude stream-json', () => {
  const turn = { blocks: [], live: '' };
  let sid;
  const p = new StreamParser(turn, { onSessionId: (s) => (sid = s) });
  const lines = [
    { type: 'system', subtype: 'init', session_id: 's1', model: 'm' },
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'He' } } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }, { type: 'tool_use', id: 't', name: 'Bash', input: { command: 'ls' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't', content: [{ type: 'text', text: 'a.txt' }] }] } },
    { type: 'result', total_cost_usd: 0.5, duration_ms: 10, is_error: false, result: 'Hello' },
  ];
  // feed in awkward chunks to exercise line buffering
  const raw = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  for (let i = 0; i < raw.length; i += 7) p.feed(raw.slice(i, i + 7));
  p.flush();
  assert.equal(sid, 's1');
  assert.equal(turn.model, 'm');
  assert.equal(turn.live, '');
  assert.equal(turn.cost, 0.5);
  assert.deepEqual(turn.blocks.map((b) => b.kind), ['text', 'tool']);
  assert.equal(turn.blocks[1].result, 'a.txt');
  assert.equal(turn.blocks[1].status, 'done');
});

test('parser handles cursor tool_call events and plain text', () => {
  const turn = { blocks: [], live: '' };
  const p = new StreamParser(turn);
  p.feed(JSON.stringify({ type: 'tool_call', subtype: 'started', call_id: 'c', tool_call: { shellToolCall: { args: { command: 'ls' } } } }) + '\n');
  p.feed(JSON.stringify({ type: 'tool_call', subtype: 'completed', call_id: 'c', tool_call: { shellToolCall: { result: { success: { stdout: 'x' } } } } }) + '\n');
  p.feed('not json\n');
  assert.equal(turn.blocks[0].name, 'shell');
  assert.equal(turn.blocks[0].status, 'done');
  assert.equal(turn.blocks[1].raw, true);
});

test('config parser reads typed values and ignores comments', () => {
  const c = parseConfig(`reverence = 3 # loud\nincense = off\nclaude_args = "--model opus # not a comment"\nunknown = 1`);
  assert.deepEqual(c, { reverence: 3, incense: false, claude_args: '--model opus # not a comment' });
});
