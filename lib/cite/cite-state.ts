/**
 * Shared server-side state for source vectorisation and sentence matching.
 *
 * Both `/api/chat/cite` (source vectorisation) and `/api/chat/cite/match`
 * (sentence matching) import from here so they share a single cache and
 * coordinated abort signals.
 *
 * State is anchored on globalThis so that it stays shared even when Next.js
 * creates separate module instances for different route handlers (common in
 * dev mode with HMR / webpack chunking).
 */

export type CacheEntry = {
  citationindex: number;
  metadata: Record<string, unknown>;
  vector: number[];
};

// ── Singleton state via globalThis ─────────────────────────────────
type CiteState = {
  vectorCache: CacheEntry[];
  sourceAbort: AbortController | null;
  matchAbort: AbortController | null;
  readyResolve: (() => void) | null;
  readyPromise: Promise<void> | null;
};

const KEY = Symbol.for("__cite_state__");

function getState(): CiteState {
  const g = globalThis as unknown as Record<symbol, CiteState | undefined>;
  if (!g[KEY]) {
    g[KEY] = {
      vectorCache: [],
      sourceAbort: null,
      matchAbort: null,
      readyResolve: null,
      readyPromise: null,
    };
  }
  return g[KEY]!;
}

// ── Cache accessors ────────────────────────────────────────────────
export const getCache = () => getState().vectorCache;
export const setCache = (entries: CacheEntry[]) => { getState().vectorCache = entries; };
export const clearCache = () => { getState().vectorCache = []; };

// ── Vectorisation ready signal ─────────────────────────────────────

/** Create a new vectorisation gate. Returns a resolve callback for cite to call. */
export function newVectorizationGate(): () => void {
  const s = getState();
  // Reject any previous waiters implicitly — they'll see an empty cache
  s.readyPromise = new Promise<void>((res) => { s.readyResolve = res; });
  return () => {
    s.readyResolve?.();
    s.readyResolve = null;
  };
}

/** Await until vectorisation is done. Resolves immediately if no gate is active. */
export function waitForVectorization(): Promise<void> {
  return getState().readyPromise ?? Promise.resolve();
}

// ── Source abort ───────────────────────────────────────────────────
/** Abort in-flight source vectorisation + any match, create fresh controller. */
export function newSourceAbort(): AbortController {
  const s = getState();
  s.sourceAbort?.abort();
  s.matchAbort?.abort();           // new query → kill match too
  s.matchAbort = null;

  const ctrl = new AbortController();
  s.sourceAbort = ctrl;
  return ctrl;
}

// ── Match abort ────────────────────────────────────────────────────
/** Create a new match-scoped AbortController (aborts any prior match). */
export function newMatchAbort(): AbortController {
  const s = getState();
  s.matchAbort?.abort();
  const ctrl = new AbortController();
  s.matchAbort = ctrl;
  return ctrl;
}
