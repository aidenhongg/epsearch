import { useRef, useMemo, useEffect, useCallback } from "react";
import {
  ResponseDict,
  assembleResponseDict,
} from "@/lib/response-parser";

/**
 * Custom hook that manages a structured ResponseDict.
 *
 * The dict is trashed (set to null) when ANY of the following occur:
 *   1. The model starts streaming (isStreaming flips to true → returns null)
 *   2. A different assistant message ID arrives (cache ID mismatch → nulled)
 *   3. Page reloads (beforeunload listener + in-memory ref is lost)
 *   4. Page/tab exits (pagehide listener + in-memory ref is lost)
 *   5. Component unmounts (cleanup effect)
 *
 * The dict is only marked `assembled: true` once streaming finishes,
 * at which point it contains the full parsed sentence segments.
 * The component should only render from the dict when `assembled === true`.
 *
 * @param messageId   - The current assistant message ID (or undefined)
 * @param rawText     - The full raw text extracted from the message parts
 * @param isStreaming  - Whether the model is still streaming
 */
export function useResponseDict(
  messageId: string | undefined,
  rawText: string,
  isStreaming: boolean,
): ResponseDict | null {
  const cachedDictRef = useRef<ResponseDict | null>(null);

  /** Imperatively trash the cached dict */
  const trashDict = useCallback(() => {
    cachedDictRef.current = null;
  }, []);

  // --- Trash on page reload / tab close / visibility hidden ---
  useEffect(() => {
    const handleUnload = () => trashDict();

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      // Trash on unmount as well (navigation away, route change, etc.)
      trashDict();
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [trashDict]);

  const dict = useMemo<ResponseDict | null>(() => {
    // No message yet
    if (!messageId) {
      cachedDictRef.current = null;
      return null;
    }

    // New assistant message arrived — invalidate old cache
    if (cachedDictRef.current && cachedDictRef.current.id !== messageId) {
      cachedDictRef.current = null;
    }

    // Still streaming — return null (dict is not yet constructable)
    // This ensures a half-built dict is never exposed to consumers
    if (isStreaming) {
      return null;
    }

    // Already assembled for this exact message + text — return cached
    if (
      cachedDictRef.current?.id === messageId &&
      cachedDictRef.current.assembled &&
      cachedDictRef.current.rawText === rawText
    ) {
      return cachedDictRef.current;
    }

    // Streaming done — assemble the dict, cache it, and return
    const assembled = assembleResponseDict(messageId, rawText);
    cachedDictRef.current = assembled;
    return assembled;
  }, [messageId, rawText, isStreaming]);

  return dict;
}
