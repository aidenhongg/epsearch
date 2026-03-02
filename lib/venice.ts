import { createOpenAI } from '@ai-sdk/openai';
import { env } from "@/lib/env.mjs";

const openai = createOpenAI({
  apiKey: env.VENICE_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

export const venice = (modelId: string) => openai.chat(modelId);
