/**
 * Input sanitization and validation for LLM-facing user content.
 *
 * Defense-in-depth: even though the AI SDK handles message serialization,
 * we enforce hard limits and strip known injection patterns BEFORE
 * the messages reach the model.
 */

/** Absolute maximum characters per user message. Venice / most models cap
 *  at ~128k tokens, but a single user turn should never need more than ~4k. */
const MAX_MESSAGE_LENGTH = 8_000;

/** Maximum number of messages the client may send in a single request.
 *  Since you currently do single-turn (setMessages([])), 1-3 is reasonable. */
const MAX_MESSAGES = 10;

/** Maximum total payload size in characters across all messages. */
const MAX_TOTAL_CHARS = 50_000;

/**
 * Patterns commonly used in prompt injection attacks.
 * These are stripped from user content — NOT from the system prompt.
 *
 * We don't block the request (to avoid DoS via false positives),
 * but we neuter the injection strings.
 */
const INJECTION_PATTERNS = [
  // Attempts to override system prompt
  /\bsystem\s*:\s*/gi,
  /\b(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|rules?|directives?)/gi,
  /\byou\s+are\s+now\b/gi,
  /\bact\s+as\b/gi,
  /\bnew\s+(?:instructions?|role|persona)\s*:/gi,
  // Delimiter injection (trying to fake multi-turn boundaries)
  /={3,}/g,
  /-{5,}/g,
  /#{3,}\s*system/gi,
  // Token manipulation
  /<\|(?:im_start|im_end|system|endoftext)\|>/gi,
  /\[INST\]|\[\/INST\]/gi,
  /<\/?(?:system|assistant|user)>/gi,
];

/**
 * Sanitize a single user message string.
 * Returns the cleaned string, truncated to MAX_MESSAGE_LENGTH.
 */
export function sanitizeUserInput(input: string): string {
  let cleaned = input;

  // Strip null bytes and other control characters (except newlines/tabs)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Neuter known injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Hard-truncate
  if (cleaned.length > MAX_MESSAGE_LENGTH) {
    cleaned = cleaned.slice(0, MAX_MESSAGE_LENGTH);
  }

  return cleaned.trim();
}

export interface SanitizedMessages {
  /** Cleaned messages safe to pass to the model. */
  messages: Array<{ role: string; content: string; parts?: unknown[] }>;
  /** Whether any message was modified during sanitization. */
  wasModified: boolean;
  /** Validation error message, if the payload was rejected entirely. */
  error?: string;
}

/**
 * Validate and sanitize the full messages array from the client.
 * Returns an error string if the payload should be rejected (4xx).
 */
export function validateAndSanitizeMessages(
  messages: unknown,
): SanitizedMessages {
  if (!Array.isArray(messages)) {
    return { messages: [], wasModified: false, error: "messages must be an array" };
  }

  if (messages.length === 0) {
    return { messages: [], wasModified: false, error: "messages array is empty" };
  }

  if (messages.length > MAX_MESSAGES) {
    return {
      messages: [],
      wasModified: false,
      error: `Too many messages: ${messages.length} exceeds limit of ${MAX_MESSAGES}`,
    };
  }

  let totalChars = 0;
  let wasModified = false;
  const cleaned = [];

  for (const msg of messages) {
    if (typeof msg !== "object" || msg === null) {
      return { messages: [], wasModified: false, error: "Invalid message format" };
    }

    const { role } = msg as { role?: string };
    if (!role || !["user", "assistant", "system"].includes(role)) {
      return { messages: [], wasModified: false, error: `Invalid role: ${role}` };
    }

    // Only sanitize user messages — assistant/system messages are ours
    if (role === "user") {
      // Extract text content from parts if present (AI SDK UIMessage format)
      const parts = (msg as { parts?: Array<{ type: string; text?: string }> }).parts;
      if (parts && Array.isArray(parts)) {
        const sanitizedParts = parts.map((part) => {
          if (part.type === "text" && typeof part.text === "string") {
            const original = part.text;
            const sanitized = sanitizeUserInput(original);
            if (sanitized !== original) wasModified = true;
            totalChars += sanitized.length;
            return { ...part, text: sanitized };
          }
          return part;
        });
        cleaned.push({ ...msg, parts: sanitizedParts });
      } else {
        cleaned.push(msg);
      }
    } else {
      cleaned.push(msg);
    }

    // Rough char count from the raw object for total-size enforcement
    const rawSize = JSON.stringify(msg).length;
    totalChars += rawSize;
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return {
      messages: [],
      wasModified: false,
      error: `Total payload too large: ${totalChars} chars exceeds ${MAX_TOTAL_CHARS}`,
    };
  }

  return { messages: cleaned, wasModified };
}
