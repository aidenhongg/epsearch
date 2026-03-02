import { UIMessage } from "@ai-sdk/react";
import { isToolUIPart, getToolName } from "ai";
import { useRef, useMemo, useEffect, useCallback } from "react";

export type Source = {
  citationindex: number;
  text?: string;
  conf?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Extracts sources from the getInformation tool result in the last
 * assistant message. Follows the same trash-on-reset lifecycle as
 * useResponseDict: nulled during streaming, on new message, on
 * beforeunload / pagehide / unmount.
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

    // Extract from dynamic-tool parts
    const sources = extractSources(lastAssistantMessage);
    if (sources.length > 0) {
      cachedRef.current = { id: lastAssistantMessage.id, sources };
      return sources;
    }

    return null;
  }, [lastAssistantMessage, isStreaming]);
}

function extractSources(message: UIMessage): Source[] {
  const all: Source[] = [];
  const seen = new Set<number>();

  // SECURITY: Removed verbose parts logging that could leak document content
  // to browser devtools / third-party error monitoring.

  for (const part of message.parts) {
    // Handle both static (tool-getInformation) and dynamic-tool parts
    const isDynamic =
      part.type === "dynamic-tool" && part.toolName === "getInformation";
    const isStatic = isToolUIPart(part) && getToolName(part) === "getInformation";

    if (!isDynamic && !isStatic) continue;

    const toolPart = part as { state?: string; output?: unknown };
    if (toolPart.state !== "output-available" || !Array.isArray(toolPart.output))
      continue;

    for (const s of toolPart.output as Source[]) {
      if (!seen.has(s.citationindex)) {
        seen.add(s.citationindex);
        all.push(s);
      }
    }
  }

  // SECURITY: Only log count, not content
  if (process.env.NODE_ENV === "development") {
    console.log("[useSources] extracted:", all.length, "sources");
  }
  return all;
}
