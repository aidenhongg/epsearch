import { getEmbeddingPipeline } from "@/lib/cite/local-embedding";
import {
  type CacheEntry,
  newSourceAbort,
  clearCache,
  setCache,
  newVectorizationGate,
} from "@/lib/cite/cite-state";

type Source = {
  citationindex: number;
  text?: string;
  conf?: number;
  metadata?: Record<string, unknown>;
};

export async function POST(req: Request) {
  const { sources } = (await req.json()) as { sources: Source[] };

  // Cancel any in-flight vectorisation / match & wipe old vectors
  const abort = newSourceAbort();
  clearCache();

  // Create gate — match route will await this before comparing
  const markReady = newVectorizationGate();

  // Fire-and-forget vectorisation
  vectoriseSources(sources, abort.signal, markReady).catch((err) => {
    if (err?.name !== "AbortError") console.error("Vectorisation failed:", err);
  });

  return Response.json({ ok: true });
}

/** Embed every source's text and commit to cache atomically. */
async function vectoriseSources(sources: Source[], signal: AbortSignal, markReady: () => void) {
  try {
    const extractor = await getEmbeddingPipeline();
    const results: CacheEntry[] = [];

    for (const source of sources) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const output = await extractor(source.text ?? "", {
        pooling: "mean",
        normalize: true,
      });
      results.push({
        citationindex: source.citationindex,
        metadata: source.metadata ?? {},
        vector: Array.from(output.data as Float32Array),
      });
    }

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    setCache(results);
    console.log(`Vectorised ${results.length} sources into cache.`);
  } finally {
    markReady();
  }
}
