import { getEmbeddingPipeline } from "@/lib/local-embedding";
import {
  waitForVectorization,
  getCache,
  newMatchAbort,
} from "@/lib/cite-state";

/** Dot-product cosine similarity (vectors are already L2-normalised). */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Strip everything that isn't alphanumeric or whitespace, collapsing runs of spaces. */
function stripSpecial(text: string): string {
  return text.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s{2,}/g, " ").trim();
}

function aborted(signal: AbortSignal): never {
  throw new DOMException("Aborted", "AbortError");
}

/**
 * POST /api/chat/cite/match
 *
 * Accepts { sentence: string }.
 * Returns the metadata of the best-matching cached source (cosine ≥ 0.8),
 * or null if nothing qualifies.
 *
 * Refuses to run while source vectorisation is in progress.
 * Aborts if a new query triggers source vectorisation, or if the client
 * disconnects (page reload / exit).
 */
export async function POST(req: Request) {
  const { sentence } = (await req.json()) as { sentence: string };
  const cleaned = stripSpecial(sentence);
  if (!cleaned) {
    return Response.json({ match: null, reason: "empty-input" });
  }

  // Combine two abort sources:
  //   1. matchAbort — fired when a new query starts source vectorisation
  //   2. req.signal — fired when the client disconnects (page reload/exit)
  const matchCtrl = newMatchAbort();
  const signal = matchCtrl.signal;
  req.signal?.addEventListener("abort", () => matchCtrl.abort(), { once: true });

  try {
    // ── Wait for source vectorisation to finish before matching ─────
    
    await Promise.race([
      waitForVectorization(),
      new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    ]);
    console.log("First promise.");
    const cache = getCache();
    console.log(cache.length, "cached sources.");
    if (cache.length === 0) {
      return Response.json({ match: null, reason: "empty-cache" });
    }
    console.log("Nonempty cache.");
    const extractor = await getEmbeddingPipeline();
    if (signal.aborted) aborted(signal);
    console.log("Not aborted signal 1.");
    const output = await extractor(cleaned, { pooling: "mean", normalize: true });
    const vec = Array.from(output.data as Float32Array);

    if (signal.aborted) aborted(signal);
    console.log("Not aborted signal 2");
    // Find the highest-similarity cached source
    let bestIdx = -1;
    let bestSim = -Infinity;
    console.log(`── Match scores for: "${cleaned.slice(0, 80)}${cleaned.length > 80 ? "…" : ""}" ──`);
    for (let i = 0; i < cache.length; i++) {
      const sim = cosine(vec, cache[i].vector);
      console.log(`  [${cache[i].citationindex}] ${sim.toFixed(4)}`);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestSim >= 0.35) {
      console.log(`── Best match: [${cache[bestIdx].citationindex}] ${bestSim.toFixed(4)} ──`);
      return Response.json({ match: cache[bestIdx].metadata, citationindex: cache[bestIdx].citationindex, similarity: bestSim });
    }
    return Response.json({ match: null, similarity: bestSim });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return Response.json({ match: null, reason: "aborted" });
    }
    throw err;
  }
}
