"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UIMessage, useChat } from "@ai-sdk/react";
import { AnimatePresence, motion } from "framer-motion";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { getToolName, isToolUIPart } from "ai";

import { cn } from "@/lib/utils";
import { LoadingIcon } from "@/components/icons";
import { useResponseDict } from "@/lib/use-response-dict";
import { useSources } from "@/lib/use-sources";
import { ChatMessage, ChatHistoryEntry } from "@/components/ai-elements/chat-message";
import { buildSourceUrl } from "@/lib/source-url";
import { matchCitationsClientSide } from "@/lib/client-cite";
import type { Source } from "@/lib/use-sources";

export const ChatInterface: React.FC = () => {
  const { messages, status, sendMessage, setMessages } = useChat({
    onToolCall({ toolCall }) {
      if (process.env.NODE_ENV === "development") {
        console.log("Tool call:", toolCall.toolName);
      }
    },
    onError: () => {
      toast.error("You've been rate limited, please try again later!");
    },
  });

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Preload the embedding model lazily
  useEffect(() => {
    import("@/lib/local-embedding").then(({ getEmbeddingPipeline }) =>
      getEmbeddingPipeline(),
    );
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, history]);

  const currentToolCall = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    if (!lastAssistant) return undefined;

    const pendingPart = [...lastAssistant.parts].reverse().find((part) => {
      if (part.type === "dynamic-tool") {
        return (
          part.state !== "output-available" && part.state !== "output-error"
        );
      }
      if (!isToolUIPart(part)) return false;
      const toolPart = part as { state?: string };
      return (
        toolPart.state !== "output-available" &&
        toolPart.state !== "output-error"
      );
    });

    if (!pendingPart) return undefined;
    if (pendingPart.type === "dynamic-tool") return pendingPart.toolName;
    if (isToolUIPart(pendingPart)) return getToolName(pendingPart);
    return undefined;
  }, [messages]);

  const isAwaitingResponse =
    status === "submitted" || status === "streaming" || currentToolCall != null;

  const [showLoading, setShowLoading] = useState(isAwaitingResponse);

  useEffect(() => {
    if (isAwaitingResponse) {
      setShowLoading(true);
      return;
    }
    const timeout = setTimeout(() => setShowLoading(false), 120);
    return () => clearTimeout(timeout);
  }, [isAwaitingResponse]);

  const userQuery: UIMessage | undefined = messages
    .filter((m) => m.role === "user")
    .slice(-1)[0];

  const lastAssistantMessage: UIMessage | undefined = messages
    .filter((m) => m.role !== "user")
    .slice(-1)[0];

  const assistantRawText = useMemo(() => {
    if (!lastAssistantMessage) return "";
    return lastAssistantMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");
  }, [lastAssistantMessage]);

  const responseDict = useResponseDict(
    lastAssistantMessage?.id,
    assistantRawText,
    isAwaitingResponse,
  );

  const sources = useSources(lastAssistantMessage, isAwaitingResponse);

  type CitationType = { label: string; url: string | null };
  const [citations, setCitations] = useState<Record<number, CitationType>>({});
  const citationAbortRef = useRef<AbortController | null>(null);

  const runCitationMatch = useCallback(
    async (
      dict: NonNullable<typeof responseDict>,
      currentSources: Source[],
      signal: AbortSignal,
    ) => {
      try {
        const result = await matchCitationsClientSide(
          currentSources,
          dict.segments,
          buildSourceUrl,
          signal,
        );
        if (!signal.aborted) setCitations(result);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Client-side citation matching error:", err);
      }
    },
    [],
  );

  useEffect(() => {
    citationAbortRef.current?.abort();
    setCitations({});
    if (!responseDict?.assembled || !sources?.length) return;
    const ctrl = new AbortController();
    citationAbortRef.current = ctrl;
    runCitationMatch(responseDict, sources, ctrl.signal);
    return () => ctrl.abort();
  }, [responseDict, sources, runCitationMatch]);

  const latestEntryRef = useRef<ChatHistoryEntry | null>(null);

  useEffect(() => {
    if (responseDict?.assembled && userQuery) {
      const userText = userQuery.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ");
      latestEntryRef.current = { userText, responseDict, citations };
    }
  }, [responseDict, citations, userQuery]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isAwaitingResponse || input.trim() === "") return;

    const snapshot = latestEntryRef.current;
    if (snapshot) {
      latestEntryRef.current = null;
      setHistory((prev) => [...prev, snapshot]);
    }
    setMessages([]);
    sendMessage({ text: input });
    setInput("");
  };

  const hasMessages =
    history.length > 0 || showLoading || responseDict?.assembled;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto chat-scrollbar px-4 md:px-0">
        <div className="mx-auto w-full max-w-2xl py-6">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
              <p className="text-lg text-muted-foreground">
                Ask a question to get started
              </p>
              <p className="text-sm text-muted-foreground/60">
                Powered by Pinecone and Venice AI
              </p>
            </div>
          )}

          {/* Past exchanges */}
          {history.map((entry, i) => (
            <MessageBubblePair key={`history-${i}`} entry={entry} />
          ))}

          {/* Current exchange */}
          <AnimatePresence>
            {showLoading ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4"
              >
                <UserBubble
                  text={
                    userQuery?.parts
                      .filter((part) => part.type === "text")
                      .map((part) => part.text)
                      .join(" ") ?? ""
                  }
                />
                <AssistantBubbleLoading tool={currentToolCall ?? undefined} />
              </motion.div>
            ) : responseDict?.assembled ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <UserBubble
                  text={
                    userQuery?.parts
                      .filter((part) => part.type === "text")
                      .map((part) => part.text)
                      .join(" ") ?? ""
                  }
                />
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg border border-border bg-card p-4 shadow-sm">
                    <ChatMessage
                      userText=""
                      responseDict={responseDict}
                      citations={citations}
                      sources={sources}
                    />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-2xl px-4 py-4">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 transition-shadow"
          >
            <input
              type="text"
              className="flex-1 bg-transparent px-2 py-2 text-base text-foreground placeholder:text-muted-foreground outline-none"
              minLength={3}
              required
              disabled={isAwaitingResponse}
              value={input}
              placeholder="Ask me anything..."
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={isAwaitingResponse || input.trim() === ""}
              className={cn(
                "flex items-center justify-center rounded-md p-2.5 transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ─── Sub-components ─── */

function UserBubble({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[85%] rounded-lg bg-accent px-4 py-3 shadow-sm">
        <p className="text-lg text-accent-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function AssistantBubbleLoading({ tool }: { tool?: string }) {
  const toolName =
    tool === "getInformation"
      ? "Getting information"
      : tool === "addResource"
        ? "Adding information"
        : "Thinking";

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%] rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="animate-spin text-muted-foreground">
            <LoadingIcon />
          </div>
          <span className="text-sm text-muted-foreground">{toolName}...</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubblePair({ entry }: { entry: ChatHistoryEntry }) {
  return (
    <div className="mb-4">
      <UserBubble text={entry.userText} />
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-lg border border-border bg-card p-4 shadow-sm">
          <ChatMessage
            userText=""
            responseDict={entry.responseDict}
            citations={entry.citations}
          />
        </div>
      </div>
    </div>
  );
}
