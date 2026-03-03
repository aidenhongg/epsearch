import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Edge Middleware — runs BEFORE every matched request hits the serverless function.
 *
 * Responsibilities:
 * 1. Rate-limit /api/chat to prevent wallet-draining abuse
 * 2. Block suspicious bot patterns (basic WAF)
 * 3. Add security headers to all responses
 */

// ── Rate-limit configuration ──────────────────────────────────────
const CHAT_RATE_LIMIT = {
  maxRequests: 20,     // 20 requests per window (generous for chat)
  windowMs: 60_000,    // 1-minute window
};

const GLOBAL_RATE_LIMIT = {
  maxRequests: 100,    // 100 requests per minute for all other API routes
  windowMs: 60_000,
};

// ── Bot / abuse patterns ──────────────────────────────────────────
const BLOCKED_USER_AGENTS = [
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /httpx/i,
  /scrapy/i,
  /go-http-client/i,
  /java\//i,
  /libwww-perl/i,
  /php\//i,
  /axios\//i,      // server-side axios (not browser)
  /node-fetch/i,
  /undici/i,
];

/** Extract the client IP for rate-limiting. Works on Vercel Edge. */
function getClientIp(req: NextRequest): string {
  // Vercel sets this automatically for all requests
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Standard security headers applied to every response. */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // CSP: cdn.jsdelivr.net is required by @huggingface/transformers for ONNX WASM backend.
  // 'wasm-unsafe-eval' is required to compile WASM modules.
  // cdn-lfs.hf.co / cdn-lfs-us-1.hf.co serve the actual ONNX model weight blobs (LFS).
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.venice.ai https://*.pinecone.io https://*.svc.pinecone.io https://cdn.jsdelivr.net https://huggingface.co https://*.hf.co; worker-src 'self' blob:; font-src 'self'; frame-ancestors 'none';",
};

function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") ?? "";

  // ── 1. Block known bot user-agents on API routes ─────────────────
  if (pathname.startsWith("/api/")) {
    // Allow empty UA (some legitimate clients) but block known scrapers
    if (ua && BLOCKED_USER_AGENTS.some((pattern) => pattern.test(ua))) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "Forbidden" },
          { status: 403 },
        ),
      );
    }

    // Block requests with no Origin/Referer header (non-browser clients)
    // Exception: allow in development
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (
      process.env.NODE_ENV === "production" &&
      !origin &&
      !referer &&
      req.method === "POST"
    ) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "Forbidden: missing origin" },
          { status: 403 },
        ),
      );
    }
  }

  // ── 2. Rate-limit /api/chat (the expensive LLM endpoint) ────────
  if (pathname === "/api/chat" && req.method === "POST") {
    const result = rateLimit(`chat:${ip}`, CHAT_RATE_LIMIT);

    if (!result.allowed) {
      const response = NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: result.headers["Retry-After"],
        },
        { status: 429 },
      );
      for (const [k, v] of Object.entries(result.headers)) {
        response.headers.set(k, v);
      }
      return addSecurityHeaders(response);
    }

    // Attach rate-limit headers to the forwarded response
    const response = NextResponse.next();
    for (const [k, v] of Object.entries(result.headers)) {
      response.headers.set(k, v);
    }
    return addSecurityHeaders(response);
  }

  // ── 3. Rate-limit all other API routes (lighter limit) ──────────
  if (pathname.startsWith("/api/")) {
    const result = rateLimit(`api:${ip}`, GLOBAL_RATE_LIMIT);
    if (!result.allowed) {
      const response = NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
      for (const [k, v] of Object.entries(result.headers)) {
        response.headers.set(k, v);
      }
      return addSecurityHeaders(response);
    }
  }

  // ── 4. Add security headers to all responses ────────────────────
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

/**
 * Match paths for middleware execution.
 * Running on every path to apply security headers globally.
 * Rate limiting only triggers on /api/* paths (see logic above).
 */
export const config = {
  matcher: [
    // Match all request paths except static files and _next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
