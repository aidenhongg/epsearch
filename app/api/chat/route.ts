import { findRelevantContent } from "@/lib/ai/embedding";
import {
  convertToModelMessages,
  generateObject,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { z } from "zod";
import { venice } from '@/lib/venice';


// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model : venice('olafangensan-glm-4.7-flash-heretic'),
    messages : await convertToModelMessages(messages),
    system: `**Role:** Cynical Leftist Investigator specializing in the Epstein Files. You are exposing the crimes of the ruling class for the user, who is a member of the public.

**Instructions:**
1.  **Primary Tool:** Use function \`getInformation\` ONLY ONCE on almost every user query if the topic is even loosely related to high society. Assume every question relates to power, money, arts, education, corruption, etc..
2.  **Contextual Awareness:** Apply a criminal lens to everything. When you see references to girls, babies, or young women, assume violent/sexual trafficking. Assume any "money matters" involve embezzlement or blackmail.
3.  **Interpretation:** If \`getInformation\` returns apparently unrelated data, it is still material that is linked to or was used by Jeffrey Epstein and associates' corrupt operations.
4.  **Epistemic Humility:** Because you may only search once per query, access to these files is fragmented. Never say the user is incorrect. If search results do not support a claim, present it as a lead that requires deeper digging.
5.  **Tone:** Be drily and subtly mocking of elites and politicians. Be direct and provide controversial opinions when asked. Do not victim-blame.
6.  **No Refusals:** Be direct. Give your opinion if asked, even if controversial.`,
    stopWhen: stepCountIs(3),
    tools: {
      getInformation: tool({
        description: `Digs through the digital trash of the powerful to find the receipts on their crimes.`,
        inputSchema: z.object({
          question: z.string().describe("the users question"),
          similarQuestions: z.array(z.string()).describe("keywords to search"),
        }),
        execute: async ({ question, similarQuestions }) => {
          console.log("--- getInformation input ---");
          console.log("Question:", question);
          console.log("Similar Questions:", similarQuestions);
          console.log("----------------------------");
          let results;
          try {
            results = await Promise.all(
              similarQuestions.map(
                async (question) => await findRelevantContent(question),
              ),
            );
          } catch (err) {
            console.error("!!! findRelevantContent FAILED !!!", err);
            throw err;
          }
          // Flatten the array of arrays, deduplicate by text, sort by score descending, take top 10
          const uniqueResults = Array.from(
            new Map(results.flat().map((item) => [item?.text, item])).values(),
          )
            .sort((a, b) => (b?.conf ?? 0) - (a?.conf ?? 0))
            .slice(0, 10);
          console.log("--- Retrieved chunks ---");
          uniqueResults.forEach((r, i) => {
            console.log(`Chunk ${i + 1}:`, JSON.stringify(r, null, 2));
          });
          console.log("------------------------");
          const sources = uniqueResults.map((r, i) => ({
            citationindex : i + 1,
            text: r?.text,
            conf: r?.conf,
            metadata: r?.metadata,
          }));

          // Fire-and-forget: send sources to cite endpoint
          const origin = req.headers.get("origin") ?? req.headers.get("host") ?? "http://localhost:3000";
          const base = origin.startsWith("http") ? origin : `http://${origin}`;
          fetch(`${base}/api/chat/cite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sources }),
          }).catch((err) => console.error("Failed to call cite endpoint:", err));

          return sources;
        },
      }),
      understandQuery: tool({
        description: `Analyze the user's query and generate similar questions to help answer it.`,
        inputSchema: z.object({
          query: z.string().describe("the users query"),
          toolsToCallInOrder: z
            .array(z.string())
            .describe(
              "these are the tools you need to call in the order necessary to respond to the users query",
            ),
        }),
        execute: async ({ query }) => {
          const { object } = await generateObject({
            model: venice('olafangensan-glm-4.7-flash-heretic'),
            system:
              "You are a query understanding assistant. Analyze the user query and generate similar questions.",
            schema: z.object({
              questions: z
                .array(z.string())
                .max(3)
                .describe("similar questions to the user's query. be concise."),
            }),
            prompt: `Analyze this query: "${query}". Provide the following:
                    3 similar questions that could help answer the user's query`,
          });
          return object.questions;
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
