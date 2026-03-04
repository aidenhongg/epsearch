/**
 * Parses raw model markdown text into structured sentence segments,
 * preserving markdown formatting and newline information.
 */

export interface SentenceSegment {
  /** The sentence text with markdown formatting preserved */
  text: string;
  /** Number of newlines preceding this segment (relative to previous segment) */
  precedingNewlines: number;
}

export interface ResponseDict {
  /** Unique ID for this response (from message ID) */
  id: string;
  /** The original raw markdown text */
  rawText: string;
  /** Parsed sentence segments */
  segments: SentenceSegment[];
  /** Whether the dict is fully assembled (streaming complete + parsed) */
  assembled: boolean;
}

/**
 * Split a non-code-block text line into sentences.
 * Splits on sentence-ending punctuation (.!?) followed by whitespace
 * and a character that typically starts a new sentence (uppercase, quote, markdown).
 * Avoids splitting inside inline code, URLs, or common abbreviations.
 */
function splitIntoSentences(text: string): string[] {
  if (!text.trim()) return [];

  // Protect inline code spans by replacing them with placeholders
  const codeSpans: string[] = [];
  const withPlaceholders = text.replace(/`[^`]+`/g, (match) => {
    codeSpans.push(match);
    return `\x00CODE${codeSpans.length - 1}\x00`;
  });

  // Protect URLs
  const urls: string[] = [];
  const withUrlPlaceholders = withPlaceholders.replace(
    /https?:\/\/[^\s)]+/g,
    (match) => {
      urls.push(match);
      return `\x00URL${urls.length - 1}\x00`;
    },
  );

  // Split on sentence boundaries:
  // lookbehind for sentence-ending punctuation,
  // followed by 1+ whitespace,
  // lookahead for uppercase letter, quote, markdown opener, or bracket
  const parts = withUrlPlaceholders.split(
    /(?<=[.!?])\s+(?=[A-Z"'`*_\[($])/,
  );

  // Restore placeholders
  return parts
    .map((part) => {
      let restored = part;
      restored = restored.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeSpans[+i]);
      restored = restored.replace(/\x00URL(\d+)\x00/g, (_, i) => urls[+i]);
      return restored;
    })
    .filter((s) => s.trim().length > 0);
}

/**
 * Parses raw markdown response text into an array of SentenceSegments.
 *
 * Strategy:
 * 1. Extract code blocks as atomic (unsplit) segments.
 * 2. For non-code text, split by newline boundaries to capture paragraph/newline counts.
 * 3. Within each paragraph/line, split into sentences.
 */
export function parseResponseToSegments(text: string): SentenceSegment[] {
  if (!text.trim()) return [];

  const segments: SentenceSegment[] = [];

  // Split text into alternating chunks of code-blocks and non-code-blocks
  // Regex captures fenced code blocks (``` ... ```)
  const codeBlockRegex = /(```[\s\S]*?```)/g;
  const chunks = text.split(codeBlockRegex);

  let isFirstSegment = true;

  for (const chunk of chunks) {
    if (!chunk) continue;

    // Code block: treat as single atomic segment
    if (/^```[\s\S]*```$/.test(chunk)) {
      // Count leading newlines from the chunk boundary
      const leadingNewlines = isFirstSegment
        ? 0
        : (chunk.match(/^\n*/)?.[0].length ?? 0);

      segments.push({
        text: chunk.replace(/^\n+/, "").replace(/\n+$/, ""),
        precedingNewlines: Math.max(leadingNewlines, isFirstSegment ? 0 : 1),
      });
      isFirstSegment = false;
      continue;
    }

    // Non-code text: split by newline groups to track newline counts
    const lineParts = chunk.split(/(\n+)/);

    let pendingNewlines = 0;

    for (const part of lineParts) {
      // Newline separator: accumulate count
      if (/^\n+$/.test(part)) {
        pendingNewlines += part.length;
        continue;
      }

      const trimmed = part.trim();
      if (!trimmed) continue;

      // Check if this line is a markdown structural element (header, list, hr)
      // that should not be sentence-split
      const isStructural =
        /^#{1,6}\s/.test(trimmed) || // headers
        /^[-*+]\s/.test(trimmed) || // unordered list items
        /^\d+[.)]\s/.test(trimmed) || // ordered list items
        /^>\s/.test(trimmed) || // blockquotes
        /^[-*_]{3,}$/.test(trimmed); // horizontal rules

      if (isStructural) {
        segments.push({
          text: trimmed,
          precedingNewlines: isFirstSegment ? 0 : pendingNewlines,
        });
        pendingNewlines = 0;
        isFirstSegment = false;
        continue;
      }

      // Regular paragraph text: split into sentences
      const sentences = splitIntoSentences(trimmed);

      for (let i = 0; i < sentences.length; i++) {
        segments.push({
          text: sentences[i],
          precedingNewlines:
            i === 0 ? (isFirstSegment ? 0 : pendingNewlines) : 0,
        });
        isFirstSegment = false;
      }

      pendingNewlines = 0;
    }
  }

  return segments;
}

/** Creates an empty ResponseDict shell. */
export function createEmptyDict(id: string): ResponseDict {
  return {
    id,
    rawText: "",
    segments: [],
    assembled: false,
  };
}

/** Assembles a complete ResponseDict from finished response text. */
export function assembleResponseDict(
  id: string,
  rawText: string,
): ResponseDict {
  return {
    id,
    rawText,
    segments: parseResponseToSegments(rawText),
    assembled: true,
  };
}
