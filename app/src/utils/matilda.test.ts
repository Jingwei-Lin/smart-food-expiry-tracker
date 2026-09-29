import { readMatildaStream, toMatildaMessages } from '@/utils/matilda';

/** A stream shaped like Matilda's real replies, carrying the given tokens. */
function stream(tokens: string[], { extraEvents = '', done = true } = {}) {
  const tokenEvents = tokens.map(
    (content, index) =>
      `id: ${index + 2}-0\nevent: token\ndata: ${JSON.stringify({ content })}\n\n`,
  );

  return [
    'event: stream_init\ndata: {"stream_id":"s-1","resumable":true}\n\n',
    'id: 1-0\nevent: generation_status\ndata: {"phase":"generating"}\n\n',
    ...tokenEvents,
    extraEvents,
    'id: 90-0\nevent: usage\ndata: {"output_tokens":0,"input_tokens":0}\n\n',
    done ? 'id: 91-0\nevent: done\ndata: {"completion_tokens":0}\n\n' : '',
  ].join('');
}

describe('toMatildaMessages', () => {
  it('folds the system instructions into one user message, instructions first', () => {
    expect(
      toMatildaMessages([
        { role: 'system', content: 'Reply with JSON only.' },
        { role: 'user', content: 'Food I want to use:\n- Spinach (expires today)' },
      ]),
    ).toEqual([
      {
        role: 'user',
        content: 'Reply with JSON only.\n\nFood I want to use:\n- Spinach (expires today)',
      },
    ]);
  });
});

describe('readMatildaStream', () => {
  it('joins the token events into the reply', () => {
    expect(readMatildaStream(stream(['{"', 'recipes', '":[]}']))).toBe('{"recipes":[]}');
  });

  it('reads a stream with Windows line endings', () => {
    expect(readMatildaStream(stream(['{"a":', '1}']).replace(/\n/g, '\r\n'))).toBe('{"a":1}');
  });

  it.each([
    ['an error event', 'event: error\ndata: {"code":"overloaded","message":"Try later"}\n\n'],
    ['the safety filter replacing the answer', 'event: replace\ndata: {"content":"Sorry"}\n\n'],
    ['a truncated reply', 'event: truncated\ndata: {"reason":"max_tokens"}\n\n'],
  ])('refuses a reply with %s', (_, extraEvents) => {
    expect(readMatildaStream(stream(['{"recipes":[]}'], { extraEvents }))).toBeNull();
  });

  it('refuses a stream that stopped before it was done', () => {
    expect(readMatildaStream(stream(['{"recipes":'], { done: false }))).toBeNull();
  });

  it('refuses a stream with no text in it', () => {
    expect(readMatildaStream(stream([]))).toBeNull();
  });
});
