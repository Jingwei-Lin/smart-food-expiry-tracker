import { ChatMessage } from '@/utils/recipe-prompt';

/*
 * Matilda (Maincode) is not OpenAI-compatible. Its chat API is
 * `POST /chat` with `{ messages, responseMode, persist }`, it accepts only
 * "user" and "assistant" messages, and it answers with a server-sent event
 * stream rather than one JSON body. These helpers adapt our recipe request to
 * it and turn the stream back into text for the shared recipe parser.
 */

export type MatildaMessage = { role: 'user'; content: string };

/** Folds the system instructions into the single user message Matilda accepts. */
export function toMatildaMessages(messages: ChatMessage[]): MatildaMessage[] {
  return [{ role: 'user', content: messages.map((message) => message.content).join('\n\n') }];
}

/**
 * Joins the `token` events of a finished stream into the model's reply.
 *
 * Returns null when the reply cannot be trusted: an `error` event, a `replace`
 * (Matilda's safety filter swapping the answer out), a `truncated` reply, or a
 * stream that stopped before its `done` event.
 */
export function readMatildaStream(stream: string): string | null {
  let event = '';
  let content = '';
  let isDone = false;

  for (const line of stream.split(/\r?\n/)) {
    if (line === '') {
      event = '';
    } else if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();

      if (event === 'error' || event === 'replace' || event === 'truncated') {
        return null;
      }

      if (event === 'done') {
        isDone = true;
      }
    } else if (line.startsWith('data:') && event === 'token') {
      try {
        const data = JSON.parse(line.slice('data:'.length)) as { content?: unknown };

        if (typeof data.content === 'string') {
          content += data.content;
        }
      } catch {
        return null;
      }
    }
  }

  return isDone && content.trim() ? content : null;
}
