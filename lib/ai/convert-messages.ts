import { convertToModelMessages, UIMessage } from "ai";

const CHAR_LIMIT = 48_000;

type ModelMessages = Awaited<ReturnType<typeof convertToModelMessages>>;

function msgChars(m: ModelMessages[number]): number {
  if (typeof m.content === "string") return m.content.length;
  if (Array.isArray(m.content)) {
    return m.content.reduce(
      (sum, part) =>
        "text" in part && typeof part.text === "string"
          ? sum + part.text.length
          : sum + 50,
      0,
    );
  }
  return 50;
}

/**
 * Convert UI messages to model messages and trim to the last
 * `CHAR_LIMIT` characters worth of conversation.
 */
export async function convertAndTrimMessages(
  uiMessages: UIMessage[],
): Promise<ModelMessages> {
  const all = await convertToModelMessages(uiMessages);

  let total = 0;
  let cutoff = all.length;
  for (let i = all.length - 1; i >= 0; i--) {
    total += msgChars(all[i]);
    if (total > CHAR_LIMIT) break;
    cutoff = i;
  }

  return all.slice(cutoff);
}
