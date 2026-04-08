# EPSEARCH

**RAG-powered search engine for the Epstein document corpus -- uncensored LLM inference, vector retrieval, and client-side citation matching via in-browser ONNX embeddings.**

## Skills & Frameworks

`Next.js 15` `App Router` `Edge Middleware` `Vercel AI SDK v6` `Pinecone` `Venice AI` `HuggingFace Transformers.js` `ONNX Runtime WASM` `Zod` `t3-env` `Tailwind CSS` `Framer Motion` `TypeScript`

**Concepts:** Retrieval-Augmented Generation, vector similarity search, query expansion, cosine similarity thresholding, prompt injection defense, sliding-window rate limiting, streaming token delivery, ONNX quantized model inference (fp16), markdown-aware NLP parsing

---

## Architecture

<p align="center"><img src="docs/images/rag-pipeline.png" width="800"/></p>

**Server track:** Query -> sanitize -> expand into 3 queries (Qwen 3.5, structured output via `generateObject` + Zod) -> embed all 3 (multilingual-e5-large) -> vector search (Pinecone, top-10 per query) -> deduplicate + rank -> inject top-10 unique chunks into system prompt -> stream response (venice-uncensored, temp=0.15).

**Client track:** Source chunks are vectorized in the background while the response streams. On completion, a custom markdown-aware parser splits the response into sentence segments, each is embedded with MiniLM-L6-v2 running in-browser via ONNX/WASM, and cosine similarity matches each sentence to its best source. Citations above the $0.4$ threshold become clickable `[1] [2] [3]` links to justice.gov PDFs.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router, Edge Middleware) |
| **AI Orchestration** | Vercel AI SDK v6 |
| **LLM** | Venice AI -- `venice-uncensored` (response), `qwen3-5-35b-a3b` (query expansion) |
| **Vector Search** | Pinecone (`multilingual-e5-large` embeddings, `epstein` namespace) |
| **Client Embeddings** | HuggingFace Transformers.js (`all-MiniLM-L6-v2`, ONNX/WASM, fp16) |
| **UI** | Tailwind CSS, Framer Motion, Lucide icons |
| **Validation** | Zod + t3-env (type-safe environment variables) |
| **Deployment** | Vercel (Hobby tier, 60s max function duration) |

---

## Client-Side Citation Matching

<p align="center"><img src="docs/images/citation-flow.png" width="750"/></p>

The original architecture attempted server-side citation matching using `globalThis` shared state between serverless functions. **This is fundamentally broken on Vercel** -- each invocation gets isolated memory. The fix: move the entire citation pipeline to the browser.

The local model (`all-MiniLM-L6-v2`, fp16 quantized, ~23MB) is lazy-loaded, cached as a singleton, and runs in ONNX Runtime WASM. The response text is split into sentence-level segments using a custom parser that treats code blocks, headers, and list items as atomic units while splitting prose on `.!?` boundaries with protection for inline code, URLs, and abbreviations. Each segment is matched against source vectors via dot-product cosine similarity.

The $0.4$ threshold was chosen empirically -- lower values produce false positives on generic legal language, higher values miss legitimate paraphrased matches.

---

## Security

<p align="center"><img src="docs/images/security-layers.png" width="700"/></p>

Five layers, outermost to innermost:

- **Edge Middleware** -- blocks bot user-agents, rejects headerless POST requests in production, applies CSP + security headers
- **Rate limiting** -- sliding-window per IP: 20 req/min on `/api/chat`, 100 req/min on other API routes, with `X-RateLimit-*` and `Retry-After` headers
- **Input sanitization** -- strips 11 categories of prompt injection patterns (system overrides, delimiter injection, token manipulation like `<|im_start|>`); neuters injected strings rather than blocking requests to avoid DoS via false positives
- **Prompt architecture** -- sources injected above a `---BEGIN USER DATA---` guard delimiter; model treats everything below as untrusted input
- **Client isolation** -- ONNX WASM sandboxed by browser; client embedding model never touches the server

---

## Key Thresholds

| Parameter | Value | Why |
|-----------|-------|-----|
| Vector search top-K | 10 per query | Balances recall vs. context window size |
| Similarity threshold | 0.3 | Filters irrelevant Pinecone results |
| Citation threshold | 0.4 | Balances precision vs. recall for in-text links |
| Context window | 48,000 chars | Fits within Venice model limits |
| Max message length | 8,000 chars | Prevents context flooding |
| LLM temperature | 0.15 | Answers should be grounded, not creative |

---

## Getting Started

```bash
pnpm install
cp .env.example .env.local   # Add VENICE_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME
pnpm dev
```

Requires a funded Venice AI account and a Pinecone index pre-populated with embedded document chunks in the `epstein` namespace. Environment variables are validated at startup via `t3-env` + Zod.

---

## Retrospective

**Serverless citation fix** was the hardest problem. Server-side shared state doesn't exist on Vercel -- each function invocation is isolated. Moving citation matching to the browser via ONNX/WASM eliminated all shared-state and race condition issues.

**Query expansion adds ~2-3s latency.** A pre-computed query-to-cluster mapping or smaller expansion model would improve cold-start performance.

**The document processing pipeline (chunking, OCR cleanup, embedding, Pinecone ingestion) is a separate project** -- not included in this repo.

---

MIT License
