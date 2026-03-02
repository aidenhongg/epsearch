import { index, pinecone } from "@/lib/pinecone";

const generateChunks = (input: string): string[] => {
  return input
    .trim()
    .split(".")
    .filter((i) => i !== "");
};

export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const result = await pinecone.inference.embed("multilingual-e5-large", chunks, {
    inputType: "passage",
  });
  return result.data.map((e, i) => ({ content: chunks[i], embedding: e.values ?? [] }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const result = await pinecone.inference.embed("multilingual-e5-large", [value], {
    inputType: "query",
  });
  return result.data[0].values ?? [];
};

export const findRelevantContent = async (userQuery: string) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);

  const results = await index.namespace('epstein').query({
    vector: userQueryEmbedded,
    topK: 10,
    includeMetadata: true,
  });

  // 2. Use Pinecone's ScoredVector type instead of 'unknown'
  return (results.matches ?? [])
    .filter((m) => (m.score ?? 0) > 0.3)
    .map((m) => {
      // Pinecone metadata is Record<string, any> | undefined
      const metadata = m.metadata;

      let parsedExtra = {};
      if (metadata?.metadata) {
        try {
          parsedExtra = JSON.parse(metadata.metadata);
        } catch (e) {
          console.warn("Metadata parse failed for ID:", m.id);
        }
      }

      return {
        text: metadata?.text ?? "",
        conf: m.score ?? 0,
        metadata: parsedExtra ?? {}, 
      };
    });
};