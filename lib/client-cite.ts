/**
 * Client-side citation matching.
 *
 * Uses the already-preloaded local embedding model to vectorize sources
 * and response segments, then matches them via cosine similarity.
 *
 * This replaces the broken server-side architecture that relied on
 * globalThis shared state between serverless function instances
 * (which don't share memory on Vercel).
 */

import type { Source } from "@/lib/use-sources";
import type { SentenceSegment } from "@/lib/response-parser";

export type Citation = { label: string; url: string | null };

/** Dot-product cosine similarity (vectors are already L2-normalised). */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Strip non-alphanumeric chars, collapse whitespace. */
function cleanText(text: string): string {
  return text.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s{2,}/g, " ").trim();
}

interface SourceVector {
  citationindex: number;
  metadata: Record<string, unknown>;
  vector: number[];
}

/**
 * Vectorize sources and response segments client-side, then match via
 * cosine similarity. Returns a map of segment index → Citation.
 *
 * The embedding pipeline is loaded lazily so `@huggingface/transformers`
 * never appears in the initial bundle.
 */
export async function matchCitationsClientSide(
  sources: Source[],
  segments: SentenceSegment[],
  buildUrl: (meta: Record<string, unknown>) => string | null,
  signal?: AbortSignal,
): Promise<Record<number, Citation>> {
  // Dynamic import keeps ONNX WASM out of the initial chunk
  const { getEmbeddingPipeline } = await import("@/lib/local-embedding");
  const extractor = await getEmbeddingPipeline();
  if (signal?.aborted) return {};

  // ── Vectorize all source texts ───────────────────────────────────
  const sourceVectors: SourceVector[] = [];
  for (const source of sources) {
    if (signal?.aborted) return {};
    const output = await extractor(source.text ?? "", {
      pooling: "mean",
      normalize: true,
    });
    sourceVectors.push({
      citationindex: source.citationindex,
      metadata: source.metadata ?? {},
      vector: Array.from(output.data as Float32Array),
    });
  }

  if (sourceVectors.length === 0) return {};

  // ── Match each segment against source vectors ────────────────────
  const citations: Record<number, Citation> = {};

  for (let i = 0; i < segments.length; i++) {
    if (signal?.aborted) return citations;

    const seg = segments[i];
    // Skip structural / non-prose segments
    if (
      !seg.text.trim() ||
      /^```/.test(seg.text) ||
      /^#{1,6}\s/.test(seg.text)
    )
      continue;

    const cleaned = cleanText(seg.text);
    if (!cleaned) continue;

    const output = await extractor(cleaned, {
      pooling: "mean",
      normalize: true,
    });
    const vec = Array.from(output.data as Float32Array);

    let bestIdx = -1;
    let bestSim = -Infinity;
    for (let j = 0; j < sourceVectors.length; j++) {
      const sim = cosine(vec, sourceVectors[j].vector);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = j;
      }
    }

    if (bestSim >= 0.35 && bestIdx >= 0) {
      const url = buildUrl(sourceVectors[bestIdx].metadata);
      citations[i] = {
        label: ` [${sourceVectors[bestIdx].citationindex}]`,
        url,
      };
    }
  }

  return citations;
}
