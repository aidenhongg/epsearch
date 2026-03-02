import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "@/lib/env.mjs";

export const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });

export interface PineconeData {
  [key: string]: string;
  text: string;
  metadata: string;
}

export const index = pinecone.index<PineconeData>(env.PINECONE_INDEX_NAME);
