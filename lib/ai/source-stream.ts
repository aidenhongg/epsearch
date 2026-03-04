/**
 * Wraps a streamText result in a UI message stream response that
 * delivers sources as message metadata.
 *
 * Sources travel as `message.metadata.sources` — invisible to the LLM,
 * no tool-role messages in conversation history, Venice never sees them.
 * The client reads them via `useSources` from the message metadata.
 */

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";

import type { StreamTextResult } from "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStreamTextResult = StreamTextResult<any, any>;

interface SourceEntry {
  citationindex: number;
  text: string | undefined;
  conf: number | undefined;
  metadata: unknown;
}

/**
 * Wrap a `streamText` result, attaching sources as message metadata.
 */
export function createSourceAugmentedResponse(
  result: AnyStreamTextResult,
  sources: SourceEntry[],
): Response {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        // Attach sources as message metadata (not tool parts)
        if (sources.length > 0) {
          writer.write({
            type: "message-metadata",
            messageMetadata: { sources },
          });
        }
        // Merge the LLM text stream
        writer.merge(result.toUIMessageStream());
      },
    }),
  });
}
