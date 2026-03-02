import {
  pipeline,
  type FeatureExtractionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let instance: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Returns (and caches) a singleton feature-extraction pipeline.
 * The first call triggers the download + ONNX compile; subsequent
 * calls return the same promise so the work is never repeated.
 */
export function getEmbeddingPipeline(
  onProgress?: (progress: ProgressInfo) => void,
): Promise<FeatureExtractionPipeline> {
  if (!instance) {
    instance = (pipeline as Function)(
      "feature-extraction",
      MODEL_ID,
      { progress_callback: onProgress },
    ) as Promise<FeatureExtractionPipeline>;
  }
  return instance;
}

/**
 * Convenience wrapper: embed a single string and return a plain number[].
 */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
