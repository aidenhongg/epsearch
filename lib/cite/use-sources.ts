import { UIMessage } from "@ai-sdk/react";
import { useRef, useMemo, useEffect, useCallback } from "react";

export type Source = {
  citationindex: number;
  text?: string;
  conf?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Extracts sources from message metadata (set by the server via
 * message-metadata stream parts). No tool parts involved — sources
 * never appear in conversation history sent to the LLM.
 *
 * Follows the same trash-on-reset lifecycle as useResponseDict:
 * nulled during streaming, on new message, on beforeunload /
 * pagehide / unmount.
 */
export function useSources(
  lastAssistantMessage: UIMessage | undefined,
  isStreaming: boolean,
): Source[] | null {
  const cachedRef = useRef<{ id: string; sources: Source[] } | null>(null);

  const trash = useCallback(() => {
    cachedRef.current = null;
  }, []);

  // Trash on page reload / tab close / unmount
  useEffect(() => {
    window.addEventListener("beforeunload", trash);
    window.addEventListener("pagehide", trash);
    return () => {
      trash();
      window.removeEventListener("beforeunload", trash);
      window.removeEventListener("pagehide", trash);
    };
  }, [trash]);

  return useMemo(() => {
    if (!lastAssistantMessage) {
      cachedRef.current = null;
      return null;
    }

    // New message → invalidate cache
    if (cachedRef.current && cachedRef.current.id !== lastAssistantMessage.id) {
      cachedRef.current = null;
    }

    // Still streaming → not ready
    if (isStreaming) return null;

    // Already cached for this message
    if (cachedRef.current?.id === lastAssistantMessage.id) {
      return cachedRef.current.sources;
    }

    // Extract from message metadata
    const meta = lastAssistantMessage.metadata as
      | { sources?: Source[] }
      | undefined;
    const sources = meta?.sources;

    if (sources && sources.length > 0) {
      cachedRef.current = { id: lastAssistantMessage.id, sources };

      if (process.env.NODE_ENV === "development") {
        console.log("[useSources] extracted:", sources.length, "sources from metadata");
      }
      return sources;
    }

    return null;
  }, [lastAssistantMessage, isStreaming]);
}
